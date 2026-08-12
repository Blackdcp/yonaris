import { appendFile, chmod, lstat, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { sanitizeDiagnostic } from "./errors.js";

export const DEFAULT_LOCAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export async function cleanupExpiredRunnerState(
	stateDirectory: string,
	options: { now?: Date; retentionMs?: number } = {},
): Promise<{ deleted: number; blocked: number }> {
	const root = path.resolve(stateDirectory);
	const now = options.now ?? new Date();
	const retentionMs = options.retentionMs ?? DEFAULT_LOCAL_RETENTION_MS;
	if (!Number.isSafeInteger(retentionMs) || retentionMs < 60_000 || retentionMs > 90 * 24 * 60 * 60 * 1_000) {
		throw new Error("retentionMs must be between one minute and 90 days");
	}
	await mkdir(root, { recursive: true, mode: 0o700 });
	await chmod(root, 0o700);
	const cutoff = now.getTime() - retentionMs;
	let deleted = 0;
	let blocked = 0;
	const auditPath = path.join(root, "retention.jsonl");
	const audit = async (event: Record<string, unknown>) => {
		await appendFile(auditPath, `${JSON.stringify({ at: now.toISOString(), ...event })}\n`, {
			encoding: "utf8",
			flag: "a",
			mode: 0o600,
		});
		await chmod(auditPath, 0o600);
	};

	const runsDirectory = path.join(root, "runs");
	for (const entry of await directoryEntries(runsDirectory)) {
		const target = path.join(runsDirectory, entry.name);
		try {
			assertChild(runsDirectory, target);
			const metadata = await lstat(target);
			if (metadata.mtimeMs >= cutoff) continue;
			await rm(target, { recursive: true, force: true });
			deleted += 1;
			await audit({ action: "deleted", kind: "run", id: safeAuditId(entry.name) });
		} catch (error) {
			blocked += 1;
			await audit({ action: "blocked", kind: "run", code: diagnosticCode(error) });
		}
	}

	const profilesDirectory = path.join(root, "profiles");
	const handoffsDirectory = path.join(root, "handoffs");
	const referencedProfiles = new Set<string>();
	let invalidHandoffFound = false;
	for (const entry of await directoryEntries(handoffsDirectory)) {
		if (!entry.name.endsWith(".json")) continue;
		const handoffPath = path.join(handoffsDirectory, entry.name);
		try {
			assertChild(handoffsDirectory, handoffPath);
			const metadata = JSON.parse(await readFile(handoffPath, "utf8")) as {
				createdAt?: unknown;
				profileDirectory?: unknown;
			};
			if (typeof metadata.profileDirectory !== "string" || typeof metadata.createdAt !== "string") {
				throw new Error("invalid_handoff_metadata");
			}
			const profileDirectory = path.resolve(metadata.profileDirectory);
			assertChild(profilesDirectory, profileDirectory);
			referencedProfiles.add(profileDirectory);
			const createdAt = Date.parse(metadata.createdAt);
			if (!Number.isFinite(createdAt)) throw new Error("invalid_handoff_timestamp");
			if (createdAt >= cutoff) continue;
			await rm(profileDirectory, { recursive: true, force: true });
			await rm(handoffPath, { force: true });
			deleted += 2;
			await audit({ action: "deleted", kind: "expired_handoff", id: safeAuditId(entry.name) });
		} catch (error) {
			invalidHandoffFound = true;
			blocked += 1;
			await audit({ action: "blocked", kind: "handoff", code: diagnosticCode(error) });
		}
	}

	// If any handoff is malformed, retain every otherwise-orphaned profile. We
	// cannot safely prove that a profile is unreferenced, so deletion fails closed.
	if (!invalidHandoffFound) {
		for (const entry of await directoryEntries(profilesDirectory)) {
			const target = path.resolve(profilesDirectory, entry.name);
			try {
				assertChild(profilesDirectory, target);
				if (referencedProfiles.has(target)) continue;
				const metadata = await lstat(target);
				if (metadata.mtimeMs >= cutoff) continue;
				await rm(target, { recursive: true, force: true });
				deleted += 1;
				await audit({ action: "deleted", kind: "orphan_profile", id: safeAuditId(entry.name) });
			} catch (error) {
				blocked += 1;
				await audit({ action: "blocked", kind: "profile", code: diagnosticCode(error) });
			}
		}
	}
	return { deleted, blocked };
}

async function directoryEntries(directory: string) {
	try {
		return await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if (isNotFound(error)) return [];
		throw error;
	}
}

function assertChild(rootDirectory: string, childDirectory: string): void {
	const root = path.resolve(rootDirectory);
	const child = path.resolve(childDirectory);
	const relative = path.relative(root, child);
	if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error("unsafe_retention_path");
	}
}

function safeAuditId(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function diagnosticCode(error: unknown): string {
	const message = sanitizeDiagnostic(error instanceof Error ? error.message : String(error));
	return message.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "cleanup_failed";
}

function isNotFound(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
