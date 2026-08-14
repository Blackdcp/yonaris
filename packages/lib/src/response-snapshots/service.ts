import {
	databaseResponseSnapshotPersistence,
	type ResponseSnapshotPersistence,
	type SnapshotFlushClaim,
	type SnapshotReservation,
} from "../db/response-snapshots";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft, ResponseSnapshotValidationError } from "./contract";
import type { ResponseSnapshotStorage } from "./storage";

const MAX_BATCH_SIZE = 1_000;

export type { ResponseSnapshotPersistence, SnapshotFlushClaim, SnapshotReservation };

export function createResponseSnapshotService(dependencies: {
	persistence?: ResponseSnapshotPersistence;
	storage: ResponseSnapshotStorage;
	now?: () => Date;
}) {
	const persistence = dependencies.persistence ?? databaseResponseSnapshotPersistence;
	const now = dependencies.now ?? (() => new Date());

	const flush = async (snapshotId: string): Promise<"ready" | "already_ready" | "retry_later"> => {
		const claimed = await persistence.claimForFlush(snapshotId, now()).catch(() => null);
		if (claimed === "already_ready") return "already_ready";
		if (!claimed) return "retry_later";
		if (claimed.outboxExpiresAt <= claimed.claimedAt) {
			await persistence.failExpiredOutbox(snapshotId, claimed.claimedAt).catch(() => undefined);
			return "retry_later";
		}
		try {
			const stored = await dependencies.storage.put(claimed.bundle, claimed.reservation.revision);
			await persistence.completeFlush(snapshotId, stored, now());
			return "ready";
		} catch (error) {
			await persistence
				.deferFlush(snapshotId, failureCode(error), new Date(now().getTime() + 30_000))
				.catch(() => undefined);
			return "retry_later";
		}
	};
	const record = async (input: { reservation: SnapshotReservation; draft: ResponseSnapshotDraft }) => {
		let bundle: ReturnType<typeof prepareResponseSnapshotBundle>;
		try {
			bundle = prepareResponseSnapshotBundle(input.draft);
		} catch (error) {
			await persistence
				.markPendingFailed(
					input.reservation,
					error instanceof ResponseSnapshotValidationError ? "snapshot_contract_invalid" : "snapshot_prepare_failed",
					now(),
				)
				.catch(() => undefined);
			return { status: "failed" as const, snapshotId: input.reservation.snapshotId, queued: false };
		}
		let queuedReservation: SnapshotReservation;
		try {
			queuedReservation = await persistence.enqueue(input.reservation, bundle);
		} catch {
			return { status: "retry_later" as const, snapshotId: input.reservation.snapshotId, queued: false };
		}
		const status = await flush(queuedReservation.snapshotId);
		return { status, snapshotId: queuedReservation.snapshotId, queued: true };
	};

	return {
		record,
		flush,
		async flushPending(input: { limit: number }) {
			const limit = validatedLimit(input.limit);
			const snapshotIds = await persistence.listFlushableSnapshotIds(limit, now());
			const receipt = { ready: 0, alreadyReady: 0, retryLater: 0 };
			for (const snapshotId of snapshotIds) {
				const result = await flush(snapshotId);
				if (result === "ready") receipt.ready += 1;
				else if (result === "already_ready") receipt.alreadyReady += 1;
				else receipt.retryLater += 1;
			}
			return receipt;
		},
		async expire(input: { before: Date; limit: number }) {
			if (Number.isNaN(input.before.getTime())) throw new Error("Expiry cutoff must be a valid date");
			const candidates = await persistence.claimExpiredReady(input.before, validatedLimit(input.limit));
			const receipt = { expired: candidates.length, deleted: 0, deleteRetry: 0 };
			for (const candidate of candidates) {
				try {
					await dependencies.storage.delete(candidate.storageKey);
					await persistence.completeExpiredDeletion(candidate.snapshotId);
					receipt.deleted += 1;
				} catch {
					receipt.deleteRetry += 1;
				}
			}
			return receipt;
		},
		async recoverStalePending(input: { before: Date; limit: number }) {
			if (Number.isNaN(input.before.getTime())) throw new Error("Recovery cutoff must be a valid date");
			const candidates = await persistence.listStalePendingReservations(input.before, validatedLimit(input.limit));
			const receipt = { recovered: 0, failed: 0 };
			for (const candidate of candidates) {
				try {
					const reconstructedDraft = await persistence.loadReconstructedDraft(candidate.snapshotId);
					const replacement = await persistence.supersedeStaleReservation(candidate, now());
					const result = await record({ reservation: replacement, draft: reconstructedDraft });
					if (result.status === "failed" || !result.queued) receipt.failed += 1;
					else receipt.recovered += 1;
				} catch {
					await persistence
						.markPendingFailed(candidate, "snapshot_reconstruction_failed", now())
						.catch(() => undefined);
					receipt.failed += 1;
				}
			}
			return receipt;
		},
	};
}

export async function recordResponseSnapshot(
	input: { reservation: SnapshotReservation; draft: ResponseSnapshotDraft; storage: ResponseSnapshotStorage },
	dependencies?: { persistence?: ResponseSnapshotPersistence; now?: () => Date },
) {
	return createResponseSnapshotService({ storage: input.storage, ...dependencies }).record(input);
}

export async function flushResponseSnapshot(
	snapshotId: string,
	storage: ResponseSnapshotStorage,
	dependencies?: { persistence?: ResponseSnapshotPersistence; now?: () => Date },
) {
	return createResponseSnapshotService({ storage, ...dependencies }).flush(snapshotId);
}

export async function flushPendingResponseSnapshots(
	input: { limit: number; storage: ResponseSnapshotStorage },
	dependencies?: { persistence?: ResponseSnapshotPersistence; now?: () => Date },
) {
	return createResponseSnapshotService({ storage: input.storage, ...dependencies }).flushPending(input);
}

export async function expireResponseSnapshots(
	input: { before: Date; limit: number; storage: ResponseSnapshotStorage },
	dependencies?: { persistence?: ResponseSnapshotPersistence; now?: () => Date },
) {
	return createResponseSnapshotService({ storage: input.storage, ...dependencies }).expire(input);
}

function validatedLimit(value: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
		throw new Error(`Snapshot batch limit must be between 1 and ${MAX_BATCH_SIZE}`);
	}
	return value;
}

function failureCode(error: unknown): string {
	if (!error || typeof error !== "object" || !("name" in error) || typeof error.name !== "string") {
		return "snapshot_flush_failed";
	}
	return error.name
		.replace(/([a-z])([A-Z])/gu, "$1_$2")
		.toLowerCase()
		.replace(/[^a-z0-9_]+/gu, "_")
		.slice(0, 100);
}
