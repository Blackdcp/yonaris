import { db } from "@workspace/lib/db/db";
import { responseSnapshotAccessEvents, responseSnapshots } from "@workspace/lib/db/schema";
import type { ResponseSnapshotAssetName } from "@workspace/lib/response-snapshots/storage";
import { and, eq } from "drizzle-orm";
import { checkBrandAccess, isAdmin, isImpersonatedSession } from "@/lib/auth/helpers";

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
	if (input.storageBackend !== "filesystem" || !input.storageKey) {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot is unavailable");
	}
	return input.storageKey;
}

export type AuthorizedResponseSnapshot = {
	id: string;
	brandId: string;
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
			brandId: responseSnapshots.brandId,
			status: responseSnapshots.status,
			isCurrent: responseSnapshots.isCurrent,
			storageBackend: responseSnapshots.storageBackend,
			storageKey: responseSnapshots.storageKey,
			htmlSha256: responseSnapshots.htmlSha256,
			jsonSha256: responseSnapshots.jsonSha256,
			manifestSha256: responseSnapshots.manifestSha256,
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
	const storageKey = assertReadableResponseSnapshot(snapshot);
	if (!snapshot.htmlSha256 || !snapshot.jsonSha256 || !snapshot.manifestSha256) {
		throw new ResponseSnapshotAccessError("not_found", "Response snapshot is unavailable");
	}
	return {
		id: snapshot.id,
		brandId: snapshot.brandId,
		storageKey,
		htmlSha256: snapshot.htmlSha256,
		jsonSha256: snapshot.jsonSha256,
		manifestSha256: snapshot.manifestSha256,
		actorUserId: session.user.id,
		actorKind,
	};
}

export function responseSnapshotAccessAction(input: {
	asset: ResponseSnapshotAssetName;
	download: boolean;
}): "view_html" | "download_html" | "download_json" | "download_manifest" {
	if (input.asset === "html") return input.download ? "download_html" : "view_html";
	return input.asset === "json" ? "download_json" : "download_manifest";
}

export async function recordResponseSnapshotAccess(input: {
	snapshotId: string;
	brandId: string;
	actorUserId: string;
	asset: ResponseSnapshotAssetName;
	download: boolean;
}): Promise<void> {
	await db.insert(responseSnapshotAccessEvents).values({
		snapshotId: input.snapshotId,
		brandId: input.brandId,
		actorUserId: input.actorUserId,
		action: responseSnapshotAccessAction(input),
	});
}
