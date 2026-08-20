import { db } from "@workspace/lib/db/db";
import {
	evidenceArtifacts,
	promptRuns,
	responseSnapshotAccessEvents,
	responseSnapshots,
} from "@workspace/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkBrandAccess, isAdmin, isImpersonatedSession } from "@/lib/auth/helpers";
import type { ResponseSnapshotAppAssetName } from "./response-snapshot-http";

export type ResponseSnapshotAccessCode = "unauthorized" | "forbidden" | "not_found" | "pending" | "expired";

export class ResponseSnapshotAccessError extends Error {
	constructor(
		public readonly code: ResponseSnapshotAccessCode,
		message: string,
	) {
		super(message);
		this.name = "ResponseSnapshotAccessError";
	}
}

export type ResponseSnapshotActorKind = "customer" | "platform_admin";

export function resolveResponseSnapshotActorAccess(input: {
	isAdmin: boolean;
	isReportOperator: boolean;
	hasBrandAccess: boolean;
}): ResponseSnapshotActorKind {
	if (input.isAdmin) return "platform_admin";
	if (input.isReportOperator) {
		throw new ResponseSnapshotAccessError("forbidden", "Report operators cannot access customer response snapshots");
	}
	if (!input.hasBrandAccess) {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot was not found");
	}
	return "customer";
}

export function assertReadableResponseSnapshot(input: {
	status: "pending" | "ready" | "failed" | "expired";
	isCurrent: boolean;
	storageBackend: "filesystem" | "kodo" | null;
	storageKey: string | null;
	expiresAt: Date;
	now: Date;
}): string {
	if (!input.isCurrent || input.status === "failed") {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot was not found");
	}
	if (input.status === "pending") {
		throw new ResponseSnapshotAccessError("pending", "Response snapshot is still being prepared");
	}
	if (input.status === "expired") {
		throw new ResponseSnapshotAccessError("expired", "Response snapshot has expired");
	}
	if (input.expiresAt <= input.now) {
		throw new ResponseSnapshotAccessError("expired", "Response snapshot has expired");
	}
	if (input.storageBackend !== "filesystem" || !input.storageKey) {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot is unavailable");
	}
	return input.storageKey;
}

export type AuthorizedResponseSnapshot = {
	id: string;
	promptRunId: string;
	brandId: string;
	scopeId: string | null;
	schemaVersion: string;
	expiresAt: Date;
	storageKey: string;
	htmlSha256: string;
	jsonSha256: string;
	manifestSha256: string;
	actorUserId: string;
	actorKind: ResponseSnapshotActorKind;
};

type SnapshotSession = {
	user: { id: string; role?: unknown; hasReportGeneratorAccess?: unknown };
	session?: unknown;
};

export async function loadAuthorizedResponseSnapshot(
	snapshotId: string,
	session: SnapshotSession | null,
): Promise<AuthorizedResponseSnapshot> {
	if (!session) throw new ResponseSnapshotAccessError("unauthorized", "Authentication required");
	if (isImpersonatedSession(session)) {
		throw new ResponseSnapshotAccessError("forbidden", "Impersonated sessions cannot access response snapshots");
	}
	const [snapshot] = await db
		.select({
			id: responseSnapshots.id,
			promptRunId: responseSnapshots.promptRunId,
			brandId: responseSnapshots.brandId,
			scopeId: responseSnapshots.scopeId,
			status: responseSnapshots.status,
			isCurrent: responseSnapshots.isCurrent,
			storageBackend: responseSnapshots.storageBackend,
			storageKey: responseSnapshots.storageKey,
			htmlSha256: responseSnapshots.htmlSha256,
			jsonSha256: responseSnapshots.jsonSha256,
			manifestSha256: responseSnapshots.manifestSha256,
			schemaVersion: responseSnapshots.schemaVersion,
			expiresAt: responseSnapshots.expiresAt,
		})
		.from(responseSnapshots)
		.where(and(eq(responseSnapshots.id, snapshotId), eq(responseSnapshots.isCurrent, true)))
		.limit(1);
	if (!snapshot) throw new ResponseSnapshotAccessError("not_found", "Response snapshot was not found");

	const platformAdmin = isAdmin(session);
	const actorKind = resolveResponseSnapshotActorAccess({
		isAdmin: platformAdmin,
		isReportOperator: session.user.hasReportGeneratorAccess === true,
		hasBrandAccess: platformAdmin ? false : await checkBrandAccess(session.user.id, snapshot.brandId),
	});
	const storageKey = assertReadableResponseSnapshot({ ...snapshot, now: new Date() });
	if (!snapshot.htmlSha256 || !snapshot.jsonSha256 || !snapshot.manifestSha256 || !snapshot.schemaVersion) {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot is unavailable");
	}
	return {
		id: snapshot.id,
		promptRunId: snapshot.promptRunId,
		brandId: snapshot.brandId,
		scopeId: snapshot.scopeId,
		schemaVersion: snapshot.schemaVersion,
		expiresAt: snapshot.expiresAt,
		storageKey,
		htmlSha256: snapshot.htmlSha256,
		jsonSha256: snapshot.jsonSha256,
		manifestSha256: snapshot.manifestSha256,
		actorUserId: session.user.id,
		actorKind,
	};
}

export type AuthorizedResponseSnapshotScreenshot = {
	artifactId: string;
	mediaType: "image/jpeg";
	sha256: string;
	bytes: number;
	content: Buffer;
};

export type ResponseSnapshotVisualEvidenceReference = Omit<AuthorizedResponseSnapshotScreenshot, "content">;

export function parseResponseSnapshotVisualEvidenceManifest(
	manifestJson: Uint8Array,
	expectedRunId: string,
): ResponseSnapshotVisualEvidenceReference {
	let manifest: unknown;
	try {
		manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestJson));
	} catch {
		throw new Error("Response snapshot v2 manifest is invalid");
	}
	if (typeof manifest !== "object" || manifest === null) {
		throw new Error("Response snapshot v2 manifest is invalid");
	}
	const value = manifest as Record<string, unknown>;
	if (
		value.schemaVersion !== "response-snapshot-manifest.v2" ||
		value.runId !== expectedRunId ||
		typeof value.visualEvidence !== "object" ||
		value.visualEvidence === null
	) {
		throw new Error("Response snapshot v2 manifest identity is invalid");
	}
	const evidence = value.visualEvidence as Record<string, unknown>;
	if (
		typeof evidence.artifactId !== "string" ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(evidence.artifactId) ||
		evidence.mediaType !== "image/jpeg" ||
		typeof evidence.sha256 !== "string" ||
		!/^[0-9a-f]{64}$/u.test(evidence.sha256) ||
		typeof evidence.bytes !== "number" ||
		!Number.isSafeInteger(evidence.bytes) ||
		evidence.bytes < 1 ||
		evidence.bytes > 2 * 1024 * 1024
	) {
		throw new Error("Response snapshot v2 manifest visual evidence is invalid");
	}
	return {
		artifactId: evidence.artifactId,
		mediaType: "image/jpeg",
		sha256: evidence.sha256,
		bytes: evidence.bytes,
	};
}

export async function loadAuthorizedResponseSnapshotScreenshot(
	snapshot: AuthorizedResponseSnapshot,
	expected: ResponseSnapshotVisualEvidenceReference,
): Promise<AuthorizedResponseSnapshotScreenshot | null> {
	if (snapshot.schemaVersion !== "response-snapshot.v2") return null;
	const scopeCondition = snapshot.scopeId
		? eq(evidenceArtifacts.scopeId, snapshot.scopeId)
		: isNull(evidenceArtifacts.scopeId);
	const rows = await db
		.select({
			artifactId: evidenceArtifacts.id,
			mediaType: evidenceArtifacts.mediaType,
			sha256: evidenceArtifacts.sha256,
			bytes: evidenceArtifacts.byteSize,
			content: evidenceArtifacts.content,
		})
		.from(evidenceArtifacts)
		.innerJoin(
			promptRuns,
			and(
				eq(promptRuns.id, snapshot.promptRunId),
				eq(promptRuns.observationAttemptId, evidenceArtifacts.observationAttemptId),
			),
		)
		.where(
			and(
				eq(evidenceArtifacts.id, expected.artifactId),
				eq(evidenceArtifacts.brandId, snapshot.brandId),
				scopeCondition,
				eq(evidenceArtifacts.kind, "screenshot"),
				eq(evidenceArtifacts.status, "attached"),
				eq(evidenceArtifacts.mediaType, "image/jpeg"),
			),
		)
		.limit(2);
	if (rows.length !== 1) return null;
	const artifact = rows[0];
	if (
		artifact?.mediaType !== "image/jpeg" ||
		artifact.artifactId !== expected.artifactId ||
		artifact.sha256 !== expected.sha256 ||
		artifact.bytes !== expected.bytes
	) {
		return null;
	}
	return { ...artifact, mediaType: "image/jpeg" };
}

export function responseSnapshotAccessAction(input: {
	asset: ResponseSnapshotAppAssetName;
	download: boolean;
}): "view_html" | "download_html" | "download_json" | "download_manifest" | "view_screenshot" | "download_screenshot" {
	if (input.asset === "screenshot") return input.download ? "download_screenshot" : "view_screenshot";
	if (input.asset === "html") return input.download ? "download_html" : "view_html";
	return input.asset === "json" ? "download_json" : "download_manifest";
}

export async function recordResponseSnapshotAccess(input: {
	snapshotId: string;
	brandId: string;
	actorUserId: string;
	asset: ResponseSnapshotAppAssetName;
	download: boolean;
}): Promise<void> {
	await db.insert(responseSnapshotAccessEvents).values({
		snapshotId: input.snapshotId,
		brandId: input.brandId,
		actorUserId: input.actorUserId,
		action: responseSnapshotAccessAction(input),
	});
}
