import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { WEB_QUERIES_UNAVAILABLE } from "../constants";
import type {
	PreparedResponseSnapshotBundle,
	ResponseSnapshotCaptureMethod,
	ResponseSnapshotContentSource,
	ResponseSnapshotDraft,
	ResponseSnapshotDraftV2,
} from "../response-snapshots/contract";
import type { StoredResponseSnapshot } from "../response-snapshots/storage";
import { db } from "./db";
import type { DeliveryTransaction } from "./delivery-batches";
import {
	citations,
	evidenceArtifacts,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
	responseSnapshotOutbox,
	responseSnapshots,
} from "./schema";

export const RESPONSE_SNAPSHOT_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;
export const RESPONSE_SNAPSHOT_OUTBOX_TTL_MS = 24 * 60 * 60 * 1_000;
const RESPONSE_SNAPSHOT_CLAIM_LEASE_MS = 5 * 60 * 1_000;

export type SnapshotReservation = {
	snapshotId: string;
	revision: number;
	expiresAt: Date;
};

export type SnapshotFlushClaim = {
	reservation: SnapshotReservation;
	bundle: PreparedResponseSnapshotBundle;
	outboxExpiresAt: Date;
	claimedAt: Date;
};

export type SnapshotExpiryCandidate = {
	snapshotId: string;
	storageKey: string;
};

export interface ResponseSnapshotPersistence {
	enqueue(reservation: SnapshotReservation, bundle: PreparedResponseSnapshotBundle): Promise<SnapshotReservation>;
	markPendingFailed(reservation: SnapshotReservation, failureCode: string, failedAt: Date): Promise<void>;
	claimForFlush(snapshotId: string, now: Date): Promise<SnapshotFlushClaim | "already_ready" | null>;
	listFlushableSnapshotIds(limit: number, now: Date): Promise<string[]>;
	completeFlush(snapshotId: string, stored: StoredResponseSnapshot, readyAt: Date): Promise<void>;
	deferFlush(snapshotId: string, failureCode: string, nextAttemptAt: Date): Promise<void>;
	failExpiredOutbox(snapshotId: string, failedAt: Date): Promise<void>;
	claimExpiredReady(before: Date, limit: number): Promise<SnapshotExpiryCandidate[]>;
	completeExpiredDeletion(snapshotId: string): Promise<void>;
	listStalePendingReservations(before: Date, limit: number): Promise<SnapshotReservation[]>;
	supersedeStaleReservation(reservation: SnapshotReservation, failedAt: Date): Promise<SnapshotReservation>;
	loadReconstructedDraft(snapshotId: string): Promise<ResponseSnapshotDraft | ResponseSnapshotDraftV2>;
}

type SnapshotHashIdentity = {
	status?: "pending" | "ready" | "failed" | "expired";
	htmlSha256: string | null;
	jsonSha256: string | null;
	manifestSha256: string | null;
};

export class ResponseSnapshotStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotStateError";
	}
}

export function calculateResponseSnapshotExpiresAt(observedAt: Date): Date {
	if (Number.isNaN(observedAt.getTime())) throw new ResponseSnapshotStateError("observedAt must be a valid date");
	return new Date(observedAt.getTime() + RESPONSE_SNAPSHOT_RETENTION_MS);
}

export function isResponseSnapshotOutboxExpired(expiresAt: Date, now: Date): boolean {
	if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(now.getTime())) {
		throw new ResponseSnapshotStateError("Outbox timestamps must be valid dates");
	}
	return expiresAt <= now;
}

export function resolveResponseSnapshotEnqueueAction(
	existing: SnapshotHashIdentity | null,
	bundle: PreparedResponseSnapshotBundle,
): "populate_reservation" | "reuse_revision" | "create_revision" {
	if (existing?.status === "failed" || existing?.status === "expired") return "create_revision";
	if (!existing || (!existing.htmlSha256 && !existing.jsonSha256 && !existing.manifestSha256)) {
		return "populate_reservation";
	}
	if (
		existing.htmlSha256 === bundle.htmlSha256 &&
		existing.jsonSha256 === bundle.jsonSha256 &&
		existing.manifestSha256 === bundle.manifestSha256
	) {
		return "reuse_revision";
	}
	return "create_revision";
}

export async function reserveResponseSnapshotInTransaction(
	tx: Pick<DeliveryTransaction, "insert" | "select">,
	input: {
		promptRunId: string;
		brandId: string;
		scopeId: string | null;
		promptId: string;
		observedAt: Date;
	},
): Promise<SnapshotReservation> {
	const expiresAt = calculateResponseSnapshotExpiresAt(input.observedAt);
	const [inserted] = await tx
		.insert(responseSnapshots)
		.values({
			promptRunId: input.promptRunId,
			brandId: input.brandId,
			scopeId: input.scopeId,
			promptId: input.promptId,
			revision: 1,
			isCurrent: true,
			status: "pending",
			observedAt: input.observedAt,
			expiresAt,
		})
		.onConflictDoNothing()
		.returning({
			snapshotId: responseSnapshots.id,
			revision: responseSnapshots.revision,
			expiresAt: responseSnapshots.expiresAt,
		});
	if (inserted) return inserted;

	const [existing] = await tx
		.select({
			snapshotId: responseSnapshots.id,
			brandId: responseSnapshots.brandId,
			scopeId: responseSnapshots.scopeId,
			promptId: responseSnapshots.promptId,
			revision: responseSnapshots.revision,
			expiresAt: responseSnapshots.expiresAt,
			observedAt: responseSnapshots.observedAt,
		})
		.from(responseSnapshots)
		.where(and(eq(responseSnapshots.promptRunId, input.promptRunId), eq(responseSnapshots.isCurrent, true)))
		.limit(1)
		.for("update");
	if (
		!existing ||
		existing.brandId !== input.brandId ||
		existing.scopeId !== input.scopeId ||
		existing.promptId !== input.promptId ||
		existing.observedAt.getTime() !== input.observedAt.getTime()
	) {
		throw new ResponseSnapshotStateError("Existing snapshot reservation has a conflicting run identity");
	}
	return { snapshotId: existing.snapshotId, revision: existing.revision, expiresAt: existing.expiresAt };
}

export async function enqueuePreparedResponseSnapshot(
	reservation: SnapshotReservation,
	bundle: PreparedResponseSnapshotBundle,
): Promise<SnapshotReservation> {
	return db.transaction(async (tx) => enqueuePreparedResponseSnapshotInTransaction(tx, reservation, bundle));
}

async function enqueuePreparedResponseSnapshotInTransaction(
	tx: DeliveryTransaction,
	reservation: SnapshotReservation,
	bundle: PreparedResponseSnapshotBundle,
): Promise<SnapshotReservation> {
	const [current] = await tx
		.select()
		.from(responseSnapshots)
		.where(eq(responseSnapshots.id, reservation.snapshotId))
		.limit(1)
		.for("update");
	if (!current?.isCurrent) throw new ResponseSnapshotStateError("Snapshot reservation is not current");
	if (
		current.brandId !== bundle.brandId ||
		current.promptRunId !== bundle.runId ||
		current.revision !== reservation.revision ||
		current.expiresAt.getTime() !== reservation.expiresAt.getTime() ||
		current.observedAt.getTime() !== new Date(bundle.observedAt).getTime()
	) {
		throw new ResponseSnapshotStateError("Snapshot bundle does not match its reservation");
	}

	const action = resolveResponseSnapshotEnqueueAction(current, bundle);
	if (action === "reuse_revision") {
		if (current.status === "ready") return reservation;
		if (current.status !== "pending") {
			throw new ResponseSnapshotStateError("Snapshot revision cannot accept an outbox payload");
		}
		await ensureIdenticalOutbox(tx, reservation.snapshotId, bundle);
		return reservation;
	}

	let target = reservation;
	if (action === "create_revision") {
		const [latest] = await tx
			.select({ revision: responseSnapshots.revision })
			.from(responseSnapshots)
			.where(eq(responseSnapshots.promptRunId, current.promptRunId))
			.orderBy(desc(responseSnapshots.revision))
			.limit(1)
			.for("update");
		const nextRevision = (latest?.revision ?? current.revision) + 1;
		if (nextRevision > 32_767) throw new ResponseSnapshotStateError("Snapshot revision limit has been reached");
		await tx
			.update(responseSnapshots)
			.set(
				current.status === "pending"
					? {
							isCurrent: false,
							status: "failed",
							failureCode: "superseded_by_new_revision",
							failedAt: new Date(),
						}
					: { isCurrent: false },
			)
			.where(eq(responseSnapshots.id, current.id));
		await tx.delete(responseSnapshotOutbox).where(eq(responseSnapshotOutbox.snapshotId, current.id));
		const [created] = await tx
			.insert(responseSnapshots)
			.values({
				promptRunId: current.promptRunId,
				brandId: current.brandId,
				scopeId: current.scopeId,
				promptId: current.promptId,
				revision: nextRevision,
				isCurrent: true,
				status: "pending",
				observedAt: current.observedAt,
				expiresAt: current.expiresAt,
				...bundleMetadata(bundle),
			})
			.returning({
				snapshotId: responseSnapshots.id,
				revision: responseSnapshots.revision,
				expiresAt: responseSnapshots.expiresAt,
			});
		if (!created) throw new ResponseSnapshotStateError("Failed to create a new snapshot revision");
		target = created;
	} else {
		await tx
			.update(responseSnapshots)
			.set(bundleMetadata(bundle))
			.where(and(eq(responseSnapshots.id, current.id), eq(responseSnapshots.status, "pending")));
	}

	await insertOutbox(tx, target.snapshotId, bundle);
	return target;
}

async function ensureIdenticalOutbox(
	tx: DeliveryTransaction,
	snapshotId: string,
	bundle: PreparedResponseSnapshotBundle,
): Promise<void> {
	const [existing] = await tx
		.select()
		.from(responseSnapshotOutbox)
		.where(eq(responseSnapshotOutbox.snapshotId, snapshotId))
		.limit(1)
		.for("update");
	if (!existing) {
		await insertOutbox(tx, snapshotId, bundle);
		return;
	}
	if (
		!Buffer.from(existing.htmlGzip).equals(Buffer.from(bundle.htmlGzip)) ||
		!Buffer.from(existing.jsonGzip).equals(Buffer.from(bundle.jsonGzip)) ||
		!Buffer.from(existing.manifestJson).equals(Buffer.from(bundle.manifestJson))
	) {
		throw new ResponseSnapshotStateError("Snapshot outbox conflicts with the immutable revision hashes");
	}
}

async function insertOutbox(
	tx: DeliveryTransaction,
	snapshotId: string,
	bundle: PreparedResponseSnapshotBundle,
): Promise<void> {
	const now = new Date();
	await tx.insert(responseSnapshotOutbox).values({
		snapshotId,
		htmlGzip: Buffer.from(bundle.htmlGzip),
		jsonGzip: Buffer.from(bundle.jsonGzip),
		manifestJson: Buffer.from(bundle.manifestJson),
		nextAttemptAt: now,
		createdAt: now,
		expiresAt: new Date(now.getTime() + RESPONSE_SNAPSHOT_OUTBOX_TTL_MS),
	});
}

function bundleMetadata(bundle: PreparedResponseSnapshotBundle) {
	return {
		contentSource: bundle.contentSource,
		captureMethod: bundle.captureMethod,
		schemaVersion: bundle.schemaVersion,
		templateVersion: bundle.templateVersion,
		htmlSha256: bundle.htmlSha256,
		jsonSha256: bundle.jsonSha256,
		manifestSha256: bundle.manifestSha256,
		sourcePayloadSha256: bundle.sourcePayloadSha256,
		htmlBytes: bundle.htmlBytes,
		jsonBytes: bundle.jsonBytes,
		manifestBytes: bundle.manifestBytes,
		htmlGzipBytes: bundle.htmlGzipBytes,
		jsonGzipBytes: bundle.jsonGzipBytes,
	};
}

export const databaseResponseSnapshotPersistence: ResponseSnapshotPersistence = {
	enqueue: enqueuePreparedResponseSnapshot,
	async markPendingFailed(reservation, failureCode, failedAt) {
		await db.transaction(async (tx) => {
			await tx
				.update(responseSnapshots)
				.set({ status: "failed", failureCode: stableFailureCode(failureCode), failedAt })
				.where(and(eq(responseSnapshots.id, reservation.snapshotId), eq(responseSnapshots.status, "pending")));
			await tx.delete(responseSnapshotOutbox).where(eq(responseSnapshotOutbox.snapshotId, reservation.snapshotId));
		});
	},
	async claimForFlush(snapshotId, now) {
		return db.transaction(async (tx) => {
			const [snapshot] = await tx
				.select()
				.from(responseSnapshots)
				.where(eq(responseSnapshots.id, snapshotId))
				.limit(1)
				.for("update", { skipLocked: true });
			if (!snapshot) return null;
			if (snapshot.status === "ready") return "already_ready" as const;
			if (snapshot.status !== "pending") return null;
			const [outbox] = await tx
				.select()
				.from(responseSnapshotOutbox)
				.where(and(eq(responseSnapshotOutbox.snapshotId, snapshotId), lte(responseSnapshotOutbox.nextAttemptAt, now)))
				.limit(1)
				.for("update", { skipLocked: true });
			if (!outbox) return null;
			await tx
				.update(responseSnapshotOutbox)
				.set({
					attemptCount: sql`${responseSnapshotOutbox.attemptCount} + 1`,
					nextAttemptAt: new Date(now.getTime() + RESPONSE_SNAPSHOT_CLAIM_LEASE_MS),
				})
				.where(eq(responseSnapshotOutbox.snapshotId, snapshotId));
			return {
				reservation: { snapshotId, revision: snapshot.revision, expiresAt: snapshot.expiresAt },
				bundle: hydratePreparedResponseSnapshotBundle(snapshot, outbox),
				outboxExpiresAt: outbox.expiresAt,
				claimedAt: now,
			};
		});
	},
	async listFlushableSnapshotIds(limit, now) {
		const rows = await db
			.select({ snapshotId: responseSnapshotOutbox.snapshotId })
			.from(responseSnapshotOutbox)
			.innerJoin(responseSnapshots, eq(responseSnapshots.id, responseSnapshotOutbox.snapshotId))
			.where(and(eq(responseSnapshots.status, "pending"), lte(responseSnapshotOutbox.nextAttemptAt, now)))
			.orderBy(asc(responseSnapshotOutbox.nextAttemptAt), asc(responseSnapshotOutbox.snapshotId))
			.limit(limit);
		return rows.map(({ snapshotId }) => snapshotId);
	},
	async completeFlush(snapshotId, stored, readyAt) {
		await db.transaction(async (tx) => {
			const [snapshot] = await tx
				.select()
				.from(responseSnapshots)
				.where(eq(responseSnapshots.id, snapshotId))
				.limit(1)
				.for("update");
			if (!snapshot) throw new ResponseSnapshotStateError("Snapshot reservation no longer exists");
			if (snapshot.status === "ready") return;
			if (
				snapshot.status !== "pending" ||
				snapshot.revision !== stored.revision ||
				snapshot.brandId !== stored.brandId ||
				snapshot.promptRunId !== stored.runId ||
				snapshot.htmlSha256 !== stored.htmlSha256 ||
				snapshot.jsonSha256 !== stored.jsonSha256 ||
				snapshot.manifestSha256 !== stored.manifestSha256
			) {
				throw new ResponseSnapshotStateError("Stored snapshot does not match the pending revision");
			}
			await tx
				.update(responseSnapshots)
				.set({
					status: "ready",
					storageBackend: stored.storageBackend,
					storageKey: stored.storageKey,
					readyAt,
				})
				.where(and(eq(responseSnapshots.id, snapshotId), eq(responseSnapshots.status, "pending")));
			await tx.delete(responseSnapshotOutbox).where(eq(responseSnapshotOutbox.snapshotId, snapshotId));
		});
	},
	async deferFlush(snapshotId, failureCode, nextAttemptAt) {
		await db
			.update(responseSnapshotOutbox)
			.set({ lastErrorCode: stableFailureCode(failureCode), nextAttemptAt })
			.where(eq(responseSnapshotOutbox.snapshotId, snapshotId));
	},
	async failExpiredOutbox(snapshotId, failedAt) {
		await db.transaction(async (tx) => {
			await tx
				.update(responseSnapshots)
				.set({ status: "failed", failureCode: "outbox_expired", failedAt })
				.where(and(eq(responseSnapshots.id, snapshotId), eq(responseSnapshots.status, "pending")));
			await tx.delete(responseSnapshotOutbox).where(eq(responseSnapshotOutbox.snapshotId, snapshotId));
		});
	},
	async claimExpiredReady(before, limit) {
		return db.transaction(async (tx) => {
			const candidates = await tx
				.select({
					id: responseSnapshots.id,
					storageKey: responseSnapshots.storageKey,
					status: responseSnapshots.status,
				})
				.from(responseSnapshots)
				.where(
					or(
						and(eq(responseSnapshots.status, "ready"), lte(responseSnapshots.expiresAt, before)),
						and(eq(responseSnapshots.status, "expired"), sql`${responseSnapshots.storageKey} IS NOT NULL`),
					),
				)
				.orderBy(asc(responseSnapshots.expiresAt), asc(responseSnapshots.id))
				.limit(limit)
				.for("update", { skipLocked: true });
			const readyIds = candidates.filter(({ status }) => status === "ready").map(({ id }) => id);
			if (readyIds.length > 0) {
				await tx.update(responseSnapshots).set({ status: "expired" }).where(inArray(responseSnapshots.id, readyIds));
			}
			return candidates.map(({ id, storageKey }) => {
				if (!storageKey) throw new ResponseSnapshotStateError("Expired snapshot is missing its deletion key");
				return { snapshotId: id, storageKey };
			});
		});
	},
	async completeExpiredDeletion(snapshotId) {
		await db.transaction(async (tx) => {
			const [snapshot] = await tx
				.select({
					status: responseSnapshots.status,
					schemaVersion: responseSnapshots.schemaVersion,
					brandId: responseSnapshots.brandId,
					observationAttemptId: promptRuns.observationAttemptId,
				})
				.from(responseSnapshots)
				.innerJoin(promptRuns, eq(promptRuns.id, responseSnapshots.promptRunId))
				.where(eq(responseSnapshots.id, snapshotId))
				.limit(1)
				.for("update");
			if (!snapshot || snapshot.status !== "expired") return;
			if (snapshot.schemaVersion === "response-snapshot.v2") {
				if (!snapshot.observationAttemptId) {
					throw new ResponseSnapshotStateError("Expired v2 snapshot has no observation attempt");
				}
				const artifacts = await tx
					.select({ id: evidenceArtifacts.id })
					.from(evidenceArtifacts)
					.where(
						and(
							eq(evidenceArtifacts.observationAttemptId, snapshot.observationAttemptId),
							eq(evidenceArtifacts.brandId, snapshot.brandId),
							eq(evidenceArtifacts.kind, "screenshot"),
							eq(evidenceArtifacts.status, "attached"),
							eq(evidenceArtifacts.mediaType, "image/jpeg"),
						),
					)
					.for("update");
				if (artifacts.length !== 1) {
					throw new ResponseSnapshotStateError("Expired v2 snapshot must have exactly one attached JPEG");
				}
				await tx.delete(evidenceArtifacts).where(eq(evidenceArtifacts.id, artifacts[0]!.id));
			}
			await tx
				.update(responseSnapshots)
				.set({ storageBackend: null, storageKey: null })
				.where(and(eq(responseSnapshots.id, snapshotId), eq(responseSnapshots.status, "expired")));
		});
	},
	async listStalePendingReservations(before, limit) {
		const rows = await db
			.select({
				snapshotId: responseSnapshots.id,
				revision: responseSnapshots.revision,
				expiresAt: responseSnapshots.expiresAt,
			})
			.from(responseSnapshots)
			.leftJoin(responseSnapshotOutbox, eq(responseSnapshotOutbox.snapshotId, responseSnapshots.id))
			.where(
				and(
					eq(responseSnapshots.status, "pending"),
					eq(responseSnapshots.isCurrent, true),
					lte(responseSnapshots.createdAt, before),
					isNull(responseSnapshotOutbox.snapshotId),
				),
			)
			.orderBy(asc(responseSnapshots.createdAt), asc(responseSnapshots.id))
			.limit(limit);
		return rows;
	},
	async supersedeStaleReservation(reservation, failedAt) {
		return db.transaction(async (tx) => {
			const [current] = await tx
				.select()
				.from(responseSnapshots)
				.where(eq(responseSnapshots.id, reservation.snapshotId))
				.limit(1)
				.for("update");
			if (!current?.isCurrent || current.status !== "pending" || current.revision !== reservation.revision) {
				throw new ResponseSnapshotStateError("Stale snapshot reservation is no longer recoverable");
			}
			const [existingOutbox] = await tx
				.select({ snapshotId: responseSnapshotOutbox.snapshotId })
				.from(responseSnapshotOutbox)
				.where(eq(responseSnapshotOutbox.snapshotId, current.id))
				.limit(1)
				.for("update");
			if (existingOutbox) throw new ResponseSnapshotStateError("Stale snapshot reservation already has an outbox");
			const nextRevision = current.revision + 1;
			if (nextRevision > 32_767) throw new ResponseSnapshotStateError("Snapshot revision limit has been reached");
			await tx
				.update(responseSnapshots)
				.set({
					isCurrent: false,
					status: "failed",
					failureCode: "stale_pending_rebuilt",
					failedAt,
				})
				.where(and(eq(responseSnapshots.id, current.id), eq(responseSnapshots.status, "pending")));
			const [created] = await tx
				.insert(responseSnapshots)
				.values({
					promptRunId: current.promptRunId,
					brandId: current.brandId,
					scopeId: current.scopeId,
					promptId: current.promptId,
					revision: nextRevision,
					isCurrent: true,
					status: "pending",
					observedAt: current.observedAt,
					expiresAt: current.expiresAt,
				})
				.returning({
					snapshotId: responseSnapshots.id,
					revision: responseSnapshots.revision,
					expiresAt: responseSnapshots.expiresAt,
				});
			if (!created) throw new ResponseSnapshotStateError("Failed to create a reconstructed snapshot revision");
			return created;
		});
	},
	async loadReconstructedDraft(snapshotId) {
		const [row] = await db
			.select({
				runId: promptRuns.id,
				brandId: promptRuns.brandId,
				scopeId: promptRuns.scopeId,
				promptId: promptRuns.promptId,
				promptText: prompts.value,
				answerText: promptRuns.answerText,
				webQueries: promptRuns.webQueries,
				brandMentioned: promptRuns.brandMentioned,
				competitorsMentioned: promptRuns.competitorsMentioned,
				channel: promptRuns.model,
				surfaceTargetKey: promptRuns.surfaceTargetKey,
				modelVersion: promptRuns.version,
				webSearchEnabled: promptRuns.webSearchEnabled,
				observedAt: promptRuns.observedAt,
				market: measurementScopes.market,
				locale: measurementScopes.locale,
				timezone: measurementScopes.timezone,
				observationAttemptId: promptRuns.observationAttemptId,
				captureMetadata: observationAttempts.captureMetadata,
			})
			.from(responseSnapshots)
			.innerJoin(promptRuns, eq(promptRuns.id, responseSnapshots.promptRunId))
			.innerJoin(prompts, eq(prompts.id, promptRuns.promptId))
			.leftJoin(observationAttempts, eq(observationAttempts.id, promptRuns.observationAttemptId))
			.leftJoin(measurementScopes, eq(measurementScopes.id, promptRuns.scopeId))
			.where(eq(responseSnapshots.id, snapshotId))
			.limit(1);
		if (!row) throw new ResponseSnapshotStateError("Snapshot run cannot be reconstructed");
		if (!row.answerText || !row.observedAt) {
			throw new ResponseSnapshotStateError("Snapshot run does not contain a reconstructable successful answer");
		}
		const citationRows = await db
			.select({
				url: citations.url,
				title: citations.title,
				domain: citations.domain,
				citationIndex: citations.citationIndex,
			})
			.from(citations)
			.where(eq(citations.promptRunId, row.runId))
			.orderBy(asc(citations.citationIndex), asc(citations.id));
		const visualEvidenceRows =
			isV2RecoveryMetadata(row.captureMetadata) && row.observationAttemptId
				? await db
						.select({
							artifactId: evidenceArtifacts.id,
							mediaType: evidenceArtifacts.mediaType,
							sha256: evidenceArtifacts.sha256,
							bytes: evidenceArtifacts.byteSize,
						})
						.from(evidenceArtifacts)
						.where(
							and(
								eq(evidenceArtifacts.observationAttemptId, row.observationAttemptId),
								eq(evidenceArtifacts.brandId, row.brandId),
								eq(evidenceArtifacts.kind, "screenshot"),
								eq(evidenceArtifacts.status, "attached"),
								eq(evidenceArtifacts.mediaType, "image/jpeg"),
							),
						)
						.orderBy(asc(evidenceArtifacts.createdAt), asc(evidenceArtifacts.id))
				: [];
		const queryEvidence = resolveReconstructedQueryEvidence(row.webQueries, row.webSearchEnabled);
		return buildReconstructedResponseSnapshotDraft({
			base: {
				runId: row.runId,
				brandId: row.brandId,
				scopeId: row.scopeId,
				promptId: row.promptId,
				promptText: row.promptText,
				answerText: row.answerText,
				citations: citationRows,
				...queryEvidence,
				brandMentioned: row.brandMentioned,
				competitorsMentioned: row.competitorsMentioned,
				channel: row.surfaceTargetKey ?? row.channel,
				modelVersion: row.modelVersion,
				market: row.market ?? "ZZ",
				locale: row.locale ?? "und",
				timezone: row.timezone ?? "UTC",
				observedAt: row.observedAt.toISOString(),
			},
			captureMetadata: row.captureMetadata,
			visualEvidence: visualEvidenceRows,
		});
	},
};

export function resolveReconstructedQueryEvidence(
	webQueries: readonly string[],
	webSearchEnabled: boolean,
): Pick<ResponseSnapshotDraft, "webQueries" | "queryAvailability"> {
	if (!webSearchEnabled) return { webQueries: [], queryAvailability: "not_applicable" };
	if (webQueries.includes(WEB_QUERIES_UNAVAILABLE) || webQueries.length === 0) {
		return { webQueries: [], queryAvailability: "unavailable" };
	}
	return { webQueries: [...webQueries], queryAvailability: "available" };
}

type ReconstructedResponseSnapshotBase = Omit<
	ResponseSnapshotDraft,
	"answerHtml" | "captureMethod" | "contentSource" | "queryAvailability" | "sourcePayloadSha256"
> & {
	queryAvailability: ResponseSnapshotDraftV2["queryAvailability"];
};

type ReconstructedVisualEvidence = {
	artifactId: string;
	mediaType: string;
	sha256: string;
	bytes: number;
};

export function buildReconstructedResponseSnapshotDraft(input: {
	base: ReconstructedResponseSnapshotBase;
	captureMetadata: unknown;
	visualEvidence: readonly ReconstructedVisualEvidence[];
}): ResponseSnapshotDraft | ResponseSnapshotDraftV2 {
	if (!isV2RecoveryMetadata(input.captureMetadata)) {
		const legacyQueryAvailability: ResponseSnapshotDraft["queryAvailability"] = (() => {
			switch (input.base.queryAvailability) {
				case "available":
				case "unavailable":
				case "not_applicable":
					return input.base.queryAvailability;
				default:
					throw new ResponseSnapshotStateError(
						"Legacy snapshot recovery cannot represent structured query availability",
					);
			}
		})();
		return {
			...input.base,
			queryAvailability: legacyQueryAvailability,
			captureMethod: "historical_reconstruction",
			contentSource: "reconstructed_from_historical_run",
		};
	}
	const adapterVersion = input.captureMetadata.adapterVersion;
	const captureDiagnostics = input.captureMetadata.captureDiagnostics;
	const queryAvailability = normalizeRecoveryQueryAvailability(input.captureMetadata.queryAvailability, input.base);
	if (typeof adapterVersion !== "string" || !adapterVersion.trim() || adapterVersion.length > 100) {
		throw new ResponseSnapshotStateError("Structured snapshot recovery metadata has no valid adapter version");
	}
	if (!isValidCaptureDiagnostics(captureDiagnostics, input.base)) {
		throw new ResponseSnapshotStateError("Structured snapshot recovery diagnostics do not match the stored run");
	}
	if (input.visualEvidence.length !== 1) {
		throw new ResponseSnapshotStateError("Structured snapshot recovery requires exactly one attached JPEG");
	}
	const [visualEvidence] = input.visualEvidence;
	if (
		!visualEvidence ||
		visualEvidence.mediaType !== "image/jpeg" ||
		!/^[0-9a-f]{64}$/u.test(visualEvidence.sha256) ||
		!Number.isSafeInteger(visualEvidence.bytes) ||
		visualEvidence.bytes < 1 ||
		visualEvidence.bytes > 2 * 1024 * 1024
	) {
		throw new ResponseSnapshotStateError("Structured snapshot recovery JPEG metadata is invalid");
	}
	return {
		...input.base,
		queryAvailability,
		schemaVersion: "response-snapshot.v2",
		captureMethod: "consumer_web_browser",
		contentSource: "rendered_from_structured_response",
		adapterVersion: adapterVersion.trim(),
		captureDiagnostics,
		visualEvidence: {
			artifactId: visualEvidence.artifactId,
			mediaType: "image/jpeg",
			sha256: visualEvidence.sha256,
			bytes: visualEvidence.bytes,
		},
	};
}

function isV2RecoveryMetadata(value: unknown): value is {
	responseSnapshotSchemaVersion: "response-snapshot.v2";
	adapterVersion?: unknown;
	queryAvailability?: unknown;
	captureDiagnostics?: unknown;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"responseSnapshotSchemaVersion" in value &&
		value.responseSnapshotSchemaVersion === "response-snapshot.v2"
	);
}

function normalizeRecoveryQueryAvailability(
	value: unknown,
	base: Pick<ReconstructedResponseSnapshotBase, "webQueries" | "queryAvailability">,
): ResponseSnapshotDraftV2["queryAvailability"] {
	if (value === undefined) return base.queryAvailability;
	if (value === "exposed" && base.webQueries.length > 0) return "available";
	if (value === "unavailable" && base.webQueries.length === 0) return "unavailable";
	if (value === "not_searched" && base.webQueries.length === 0) return "not_searched";
	if (value === "unknown" && base.webQueries.length === 0) return "unknown";
	throw new ResponseSnapshotStateError("Structured snapshot recovery query availability is invalid");
}

function isValidCaptureDiagnostics(
	value: unknown,
	base: Pick<ReconstructedResponseSnapshotBase, "webQueries" | "citations">,
): value is ResponseSnapshotDraftV2["captureDiagnostics"] {
	if (typeof value !== "object" || value === null) return false;
	const diagnostics = value as Record<string, unknown>;
	return (
		Object.keys(diagnostics).length === 9 &&
		diagnostics.answerCount === 1 &&
		diagnostics.completionCount === 1 &&
		diagnostics.queryCount === base.webQueries.length &&
		diagnostics.citationCount === base.citations.length &&
		typeof diagnostics.extractorVersion === "string" &&
		diagnostics.extractorVersion.trim().length > 0 &&
		diagnostics.extractorVersion.length <= 100 &&
		["dom", "network", "dom_and_network", "none"].includes(String(diagnostics.evidenceSource)) &&
		[diagnostics.searchBlockCount, diagnostics.queryCandidateCount, diagnostics.citationCandidateCount].every(
			(count) => Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 10_000,
		)
	);
}

export function hydratePreparedResponseSnapshotBundle(
	snapshot: {
		promptRunId: string;
		brandId: string;
		observedAt: Date;
		contentSource: ResponseSnapshotContentSource | null;
		captureMethod: ResponseSnapshotCaptureMethod | null;
		schemaVersion: string | null;
		templateVersion: string | null;
		sourcePayloadSha256: string | null;
		htmlSha256: string | null;
		jsonSha256: string | null;
		manifestSha256: string | null;
		htmlBytes: number | null;
		jsonBytes: number | null;
		manifestBytes: number | null;
		htmlGzipBytes: number | null;
		jsonGzipBytes: number | null;
	},
	outbox: { htmlGzip: Uint8Array; jsonGzip: Uint8Array; manifestJson: Uint8Array },
): PreparedResponseSnapshotBundle {
	const isV1 =
		snapshot.schemaVersion === "response-snapshot.v1" && snapshot.templateVersion === "response-snapshot-html.v1";
	const isV2 =
		snapshot.schemaVersion === "response-snapshot.v2" && snapshot.templateVersion === "response-snapshot-html.v2";
	if (
		!snapshot.contentSource ||
		!snapshot.captureMethod ||
		(!isV1 && !isV2) ||
		!snapshot.htmlSha256 ||
		!snapshot.jsonSha256 ||
		!snapshot.manifestSha256 ||
		snapshot.htmlBytes === null ||
		snapshot.jsonBytes === null ||
		snapshot.manifestBytes === null ||
		snapshot.htmlGzipBytes === null ||
		snapshot.jsonGzipBytes === null
	) {
		throw new ResponseSnapshotStateError("Pending snapshot metadata is incomplete");
	}
	const common = {
		runId: snapshot.promptRunId,
		brandId: snapshot.brandId,
		observedAt: snapshot.observedAt.toISOString(),
		contentSource: snapshot.contentSource,
		captureMethod: snapshot.captureMethod,
		sourcePayloadSha256: snapshot.sourcePayloadSha256,
		htmlGzip: outbox.htmlGzip,
		jsonGzip: outbox.jsonGzip,
		manifestJson: outbox.manifestJson,
		htmlSha256: snapshot.htmlSha256,
		jsonSha256: snapshot.jsonSha256,
		manifestSha256: snapshot.manifestSha256,
		htmlBytes: snapshot.htmlBytes,
		jsonBytes: snapshot.jsonBytes,
		manifestBytes: snapshot.manifestBytes,
		htmlGzipBytes: snapshot.htmlGzipBytes,
		jsonGzipBytes: snapshot.jsonGzipBytes,
	};
	return isV2
		? { ...common, schemaVersion: "response-snapshot.v2", templateVersion: "response-snapshot-html.v2" }
		: { ...common, schemaVersion: "response-snapshot.v1", templateVersion: "response-snapshot-html.v1" };
}

function stableFailureCode(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/gu, "_")
		.slice(0, 100);
	return normalized || "snapshot_failed";
}
