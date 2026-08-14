import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { db } from "@workspace/lib/db/db";
import { promptRuns, responseSnapshotAccessEvents, responseSnapshots } from "@workspace/lib/db/schema";
import type { ResponseSnapshotAssetName, ResponseSnapshotStorage } from "@workspace/lib/response-snapshots/storage";
import { type Archiver, type ArchiverError, ZipArchive } from "archiver";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { checkBrandAccess, isAdmin, isImpersonatedSession } from "@/lib/auth/helpers";
import { ResponseSnapshotAccessError, resolveResponseSnapshotActorAccess } from "./response-snapshots";

export const RESPONSE_SNAPSHOT_EXPORT_MAX_DAYS = 31;
export const RESPONSE_SNAPSHOT_EXPORT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
export const RESPONSE_SNAPSHOT_EXPORT_MAX_OBJECTS = 10_000;
const RESPONSE_SNAPSHOT_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/u;
const SAFE_BRAND_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class ResponseSnapshotExportPolicyError extends Error {
	constructor(
		message: string,
		public readonly status: 400 | 409 = 400,
	) {
		super(message);
		this.name = "ResponseSnapshotExportPolicyError";
	}
}

export type ResponseSnapshotExportRequest = {
	brandId: string;
	startDate: string;
	endDate: string;
	startUtc: Date;
	endExclusiveUtc: Date;
	mode: "estimate" | "download";
};

export type ResponseSnapshotExportRow = {
	id: string;
	promptRunId: string;
	brandId: string;
	status: "pending" | "ready" | "failed" | "expired";
	isCurrent: boolean;
	storageBackend: "filesystem" | "kodo" | null;
	storageKey: string | null;
	channel: string;
	observedAt: Date;
	expiresAt: Date;
	htmlBytes: number | null;
	jsonBytes: number | null;
	manifestBytes: number | null;
	htmlSha256: string | null;
	jsonSha256: string | null;
	manifestSha256: string | null;
};

type SnapshotSession = {
	user: { id: string; role?: unknown; hasReportGeneratorAccess?: unknown };
	session?: unknown;
};

export type AuthorizedResponseSnapshotExport = {
	actorUserId: string;
	actorKind: "customer" | "platform_admin";
};

export type ResponseSnapshotExportLock = {
	release: () => Promise<void>;
};

export function parseResponseSnapshotExportQuery(url: URL, now = new Date()): ResponseSnapshotExportRequest {
	const allowedKeys = new Set(["brandId", "start", "end", "mode"]);
	for (const key of url.searchParams.keys()) {
		if (!allowedKeys.has(key)) throw new ResponseSnapshotExportPolicyError("Unknown export query parameter");
	}
	for (const key of allowedKeys) {
		if (url.searchParams.getAll(key).length !== 1) {
			throw new ResponseSnapshotExportPolicyError(`${key} must be provided exactly once`);
		}
	}

	const brandId = url.searchParams.get("brandId") ?? "";
	const startDate = url.searchParams.get("start") ?? "";
	const endDate = url.searchParams.get("end") ?? "";
	const mode = url.searchParams.get("mode");
	if (!SAFE_BRAND_ID.test(brandId) || brandId === "." || brandId === "..") {
		throw new ResponseSnapshotExportPolicyError("brandId is invalid");
	}
	if (mode !== "estimate" && mode !== "download") {
		throw new ResponseSnapshotExportPolicyError("mode must be estimate or download");
	}

	const startUtc = parseBeijingDate(startDate);
	const endUtc = parseBeijingDate(endDate);
	const endExclusiveUtc = new Date(endUtc.getTime() + DAY_MS);
	const rangeDays = (endExclusiveUtc.getTime() - startUtc.getTime()) / DAY_MS;
	if (rangeDays < 1) throw new ResponseSnapshotExportPolicyError("Export end date must not precede start date");
	if (rangeDays > RESPONSE_SNAPSHOT_EXPORT_MAX_DAYS) {
		throw new ResponseSnapshotExportPolicyError("Export range must not exceed 31 days; split the export by month");
	}

	const todayBeijing = beijingDate(new Date(now));
	const earliestBeijing = beijingDate(new Date(now.getTime() - RESPONSE_SNAPSHOT_RETENTION_DAYS * DAY_MS));
	if (startDate < earliestBeijing) {
		throw new ResponseSnapshotExportPolicyError("Export start date is outside the 90-day retention horizon");
	}
	if (endDate > todayBeijing) throw new ResponseSnapshotExportPolicyError("Export end date cannot be in the future");

	return { brandId, startDate, endDate, startUtc, endExclusiveUtc, mode };
}

export function assertResponseSnapshotExportRows(
	rows: readonly ResponseSnapshotExportRow[],
	input: { brandId: string; now: Date },
): { count: number; uncompressedBytes: number } {
	if (rows.length > RESPONSE_SNAPSHOT_EXPORT_MAX_OBJECTS) {
		throw new ResponseSnapshotExportPolicyError("Export contains too many snapshots; split the date range");
	}
	let uncompressedBytes = 0;
	const snapshotIds = new Set<string>();
	for (const row of rows) {
		if (snapshotIds.has(row.id)) throw new ResponseSnapshotExportPolicyError("Export contains a duplicate snapshot");
		snapshotIds.add(row.id);
		const storageKeyParts = row.storageKey?.split("/") ?? [];
		if (
			row.brandId !== input.brandId ||
			row.status !== "ready" ||
			!row.isCurrent ||
			row.storageBackend !== "filesystem" ||
			!isSafeStorageKey(row.storageKey) ||
			storageKeyParts[0] !== row.brandId ||
			storageKeyParts[3] !== row.promptRunId ||
			row.expiresAt.getTime() <= input.now.getTime()
		) {
			throw new ResponseSnapshotExportPolicyError("Export contains an unauthorized or unavailable snapshot");
		}
		assertSafeSegment(row.channel, "channel");
		assertSafeSegment(row.promptRunId, "run id");
		for (const bytes of [row.htmlBytes, row.jsonBytes, row.manifestBytes]) {
			if (!Number.isSafeInteger(bytes) || (bytes ?? 0) < 1) {
				throw new ResponseSnapshotExportPolicyError("Export contains invalid artifact metadata");
			}
			uncompressedBytes += bytes as number;
			if (!Number.isSafeInteger(uncompressedBytes) || uncompressedBytes >= RESPONSE_SNAPSHOT_EXPORT_MAX_BYTES) {
				throw new ResponseSnapshotExportPolicyError("Export exceeds 2 GiB; split the export by month");
			}
		}
		for (const hash of [row.htmlSha256, row.jsonSha256, row.manifestSha256]) {
			if (!hash || !/^[0-9a-f]{64}$/u.test(hash)) {
				throw new ResponseSnapshotExportPolicyError("Export contains invalid artifact hashes");
			}
		}
	}
	return { count: rows.length, uncompressedBytes };
}

export async function authorizeResponseSnapshotExport(
	brandId: string,
	session: SnapshotSession | null,
): Promise<AuthorizedResponseSnapshotExport> {
	if (!session) throw new ResponseSnapshotAccessError("unauthorized", "Authentication required");
	if (isImpersonatedSession(session)) {
		throw new ResponseSnapshotAccessError("forbidden", "Impersonated sessions cannot export response snapshots");
	}
	const platformAdmin = isAdmin(session);
	const actorKind = resolveResponseSnapshotActorAccess({
		isAdmin: platformAdmin,
		isReportOperator: session.user.hasReportGeneratorAccess === true,
		hasBrandAccess: platformAdmin ? false : await checkBrandAccess(session.user.id, brandId),
	});
	return { actorUserId: session.user.id, actorKind };
}

export async function loadResponseSnapshotExportRows(
	request: Pick<ResponseSnapshotExportRequest, "brandId" | "startUtc" | "endExclusiveUtc">,
	now = new Date(),
): Promise<ResponseSnapshotExportRow[]> {
	return db
		.select({
			id: responseSnapshots.id,
			promptRunId: responseSnapshots.promptRunId,
			brandId: responseSnapshots.brandId,
			status: responseSnapshots.status,
			isCurrent: responseSnapshots.isCurrent,
			storageBackend: responseSnapshots.storageBackend,
			storageKey: responseSnapshots.storageKey,
			channel: promptRuns.model,
			observedAt: responseSnapshots.observedAt,
			expiresAt: responseSnapshots.expiresAt,
			htmlBytes: responseSnapshots.htmlBytes,
			jsonBytes: responseSnapshots.jsonBytes,
			manifestBytes: responseSnapshots.manifestBytes,
			htmlSha256: responseSnapshots.htmlSha256,
			jsonSha256: responseSnapshots.jsonSha256,
			manifestSha256: responseSnapshots.manifestSha256,
		})
		.from(responseSnapshots)
		.innerJoin(promptRuns, eq(promptRuns.id, responseSnapshots.promptRunId))
		.where(
			and(
				eq(responseSnapshots.brandId, request.brandId),
				eq(responseSnapshots.isCurrent, true),
				eq(responseSnapshots.status, "ready"),
				eq(responseSnapshots.storageBackend, "filesystem"),
				gte(responseSnapshots.observedAt, request.startUtc),
				lt(responseSnapshots.observedAt, request.endExclusiveUtc),
				gt(responseSnapshots.expiresAt, now),
			),
		)
		.orderBy(asc(responseSnapshots.observedAt), asc(responseSnapshots.id));
}

export async function acquireResponseSnapshotExportLock(actorUserId: string): Promise<ResponseSnapshotExportLock> {
	const client = await db.$client.connect();
	try {
		const result = await client.query<{ acquired: boolean }>(
			"SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS acquired",
			["yonaris:response-snapshot-export", actorUserId],
		);
		if (result.rows[0]?.acquired !== true) {
			throw new ResponseSnapshotExportPolicyError("Another response snapshot export is already running", 409);
		}
		let released = false;
		return {
			release: async () => {
				if (released) return;
				released = true;
				try {
					await client.query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [
						"yonaris:response-snapshot-export",
						actorUserId,
					]);
				} finally {
					client.release();
				}
			},
		};
	} catch (error) {
		client.release();
		throw error;
	}
}

export function createResponseSnapshotExportArchive(input: {
	rows: readonly ResponseSnapshotExportRow[];
	storage: Pick<ResponseSnapshotStorage, "get">;
	onArchived?: () => Promise<void>;
}) {
	const archive = new ZipArchive({ zlib: { level: 6 } });
	archive.on("warning", (error: ArchiverError) => archive.destroy(error));
	void populateArchive(archive, input).catch((error) => archive.destroy(error as Error));
	return archive;
}

export async function recordResponseSnapshotExportAccess(input: {
	rows: readonly ResponseSnapshotExportRow[];
	brandId: string;
	actorUserId: string;
	startDate: string;
	endDate: string;
	uncompressedBytes: number;
}): Promise<void> {
	if (input.rows.length > 0) {
		await db.insert(responseSnapshotAccessEvents).values(
			input.rows.map((row) => ({
				snapshotId: row.id,
				brandId: input.brandId,
				actorUserId: input.actorUserId,
				action: "export" as const,
			})),
		);
	}
	console.info(
		JSON.stringify({
			event: "response_snapshot_export",
			brandId: input.brandId,
			actorUserId: input.actorUserId,
			startDate: input.startDate,
			endDate: input.endDate,
			count: input.rows.length,
			uncompressedBytes: input.uncompressedBytes,
		}),
	);
}

async function populateArchive(
	archive: Archiver,
	input: {
		rows: readonly ResponseSnapshotExportRow[];
		storage: Pick<ResponseSnapshotStorage, "get">;
		onArchived?: () => Promise<void>;
	},
): Promise<void> {
	for (const row of input.rows) {
		if (!row.storageKey) throw new ResponseSnapshotExportPolicyError("Snapshot storage key is unavailable");
		for (const assetName of ["html", "json", "manifest"] as const) {
			const asset = await input.storage.get(row.storageKey, assetName);
			const expectedSha256 = {
				html: row.htmlSha256,
				json: row.jsonSha256,
				manifest: row.manifestSha256,
			}[assetName];
			if (asset.sha256 !== expectedSha256) {
				throw new ResponseSnapshotExportPolicyError("Snapshot changed after export preflight");
			}
			const body = Readable.from(Buffer.from(asset.body));
			const source = asset.contentEncoding === "gzip" ? body.pipe(createGunzip()) : body;
			await appendArchiveEntry(archive, source, buildResponseSnapshotExportEntryPath(row, assetName));
		}
	}
	await input.onArchived?.();
	await archive.finalize();
}

async function appendArchiveEntry(archive: Archiver, source: Readable, name: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const onEntry = (entry: { name: string }) => {
			if (entry.name !== name) return;
			cleanup();
			resolve();
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const cleanup = () => {
			archive.off("entry", onEntry);
			archive.off("error", onError);
		};
		archive.on("entry", onEntry);
		archive.on("error", onError);
		archive.append(source, { name });
	});
}

export function buildResponseSnapshotExportEntryPath(
	row: Pick<ResponseSnapshotExportRow, "observedAt" | "channel" | "promptRunId">,
	asset: ResponseSnapshotAssetName,
): string {
	assertSafeSegment(row.channel, "channel");
	assertSafeSegment(row.promptRunId, "run id");
	const fileName = asset === "manifest" ? "manifest.json" : `snapshot.${asset}`;
	return `${beijingDate(row.observedAt)}/${row.channel}/${row.promptRunId}/${fileName}`;
}

function parseBeijingDate(value: string): Date {
	if (!DATE_PATTERN.test(value)) throw new ResponseSnapshotExportPolicyError("Export dates must use YYYY-MM-DD");
	const parsed = new Date(`${value}T00:00:00+08:00`);
	if (Number.isNaN(parsed.getTime()) || beijingDate(parsed) !== value) {
		throw new ResponseSnapshotExportPolicyError("Export date is invalid");
	}
	return parsed;
}

function beijingDate(value: Date): string {
	if (Number.isNaN(value.getTime())) throw new ResponseSnapshotExportPolicyError("Snapshot date is invalid");
	return new Date(value.getTime() + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function assertSafeSegment(value: string, label: string): void {
	if (!SAFE_IDENTIFIER.test(value) || value === "." || value === "..") {
		throw new ResponseSnapshotExportPolicyError(`Export ${label} is unsafe`);
	}
}

function isSafeStorageKey(value: string | null): value is string {
	if (!value || value.startsWith("/") || value.startsWith("\\")) return false;
	const segments = value.split("/");
	return (
		segments.length > 1 &&
		segments.every((segment) => SAFE_IDENTIFIER.test(segment) && segment !== "." && segment !== "..")
	);
}
