import { describe, expect, it, vi } from "vitest";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft } from "./contract";
import { createResponseSnapshotService, type ResponseSnapshotPersistence, type SnapshotFlushClaim } from "./service";
import type { ResponseSnapshotStorage, StoredResponseSnapshot } from "./storage";

const reservation = {
	snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	revision: 1,
	expiresAt: new Date("2026-11-13T01:02:03.000Z"),
};

function draft(overrides: Partial<ResponseSnapshotDraft> = {}): ResponseSnapshotDraft {
	return {
		runId: "11111111-1111-4111-8111-111111111111",
		brandId: "stepfun",
		scopeId: null,
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "What is StepFun?",
		answerText: "StepFun builds foundation models.",
		citations: [],
		webQueries: [],
		queryAvailability: "available",
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "chatgpt",
		modelVersion: "consumer-web",
		market: "US",
		locale: "en-US",
		timezone: "America/New_York",
		observedAt: "2026-08-15T01:02:03.000Z",
		captureMethod: "brightdata_dataset",
		contentSource: "rendered_from_structured_response",
		...overrides,
	};
}

function harness() {
	let state: "pending" | "ready" | "failed" | "expired" = "pending";
	let queuedBundle = prepareResponseSnapshotBundle(draft());
	let outbox = false;
	let outboxExpiresAt = new Date("2026-08-16T01:02:03.000Z");
	let stored: StoredResponseSnapshot | null = null;
	let failReadyOnce = false;
	let currentReservation = reservation;
	const storage = {
		put: vi.fn(async (bundle, revision = 1) => {
			if (stored) return stored;
			stored = {
				storageBackend: "filesystem",
				storageKey: `stepfun/2026/08/${bundle.runId}/r${revision}`,
				brandId: bundle.brandId,
				runId: bundle.runId,
				revision,
				htmlSha256: bundle.htmlSha256,
				jsonSha256: bundle.jsonSha256,
				manifestSha256: bundle.manifestSha256,
				htmlBytes: bundle.htmlBytes,
				jsonBytes: bundle.jsonBytes,
				manifestBytes: bundle.manifestBytes,
				htmlGzipBytes: bundle.htmlGzipBytes,
				jsonGzipBytes: bundle.jsonGzipBytes,
			};
			return stored;
		}),
		get: vi.fn(),
		head: vi.fn(),
		delete: vi.fn(async () => undefined),
		createDownload: vi.fn(),
	} satisfies ResponseSnapshotStorage;
	const persistence: ResponseSnapshotPersistence = {
		enqueue: vi.fn(async (queuedReservation, bundle) => {
			queuedBundle = bundle;
			outbox = true;
			currentReservation = queuedReservation;
			return queuedReservation;
		}),
		markPendingFailed: vi.fn(async () => {
			state = "failed";
			outbox = false;
		}),
		claimForFlush: vi.fn(async (_snapshotId, now): Promise<SnapshotFlushClaim | "already_ready" | null> => {
			if (state === "ready") return "already_ready";
			if (state !== "pending" || !outbox) return null;
			return { reservation: currentReservation, bundle: queuedBundle, outboxExpiresAt, claimedAt: now };
		}),
		listFlushableSnapshotIds: vi.fn(async () => (outbox ? [reservation.snapshotId] : [])),
		completeFlush: vi.fn(async (_snapshotId, value) => {
			if (failReadyOnce) {
				failReadyOnce = false;
				throw new Error("injected database commit failure");
			}
			stored = value;
			state = "ready";
			outbox = false;
		}),
		deferFlush: vi.fn(async () => undefined),
		failExpiredOutbox: vi.fn(async () => {
			state = "failed";
			outbox = false;
		}),
		claimExpiredReady: vi.fn(async () => {
			if ((state !== "ready" && state !== "expired") || !stored) return [];
			if (state === "ready") state = "expired";
			return [{ snapshotId: reservation.snapshotId, storageKey: stored.storageKey }];
		}),
		completeExpiredDeletion: vi.fn(async () => {
			stored = null;
		}),
		listStalePendingReservations: vi.fn(async () => (state === "pending" && !outbox ? [currentReservation] : [])),
		supersedeStaleReservation: vi.fn(async () => {
			currentReservation = { ...currentReservation, snapshotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revision: 2 };
			return currentReservation;
		}),
		loadReconstructedDraft: vi.fn(async () =>
			draft({
				captureMethod: "historical_reconstruction",
				contentSource: "reconstructed_from_historical_run",
			}),
		),
	};
	return {
		persistence,
		storage,
		getState: () => ({ state, outbox, stored }),
		setOutboxExpiry: (value: Date) => {
			outboxExpiresAt = value;
		},
		failNextReadyCommit: () => {
			failReadyOnce = true;
		},
		setStorageFailure: (error: Error) => {
			storage.put.mockRejectedValueOnce(error);
		},
		setDeleteFailure: (error: Error) => {
			storage.delete.mockRejectedValueOnce(error);
		},
	};
}

describe("response snapshot service", () => {
	it("prepares, enqueues and flushes a ready snapshot without touching answer semantics", async () => {
		const test = harness();
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:00:00.000Z"),
		});

		await expect(service.record({ reservation, draft: draft() })).resolves.toMatchObject({ status: "ready" });
		expect(test.getState()).toMatchObject({ state: "ready", outbox: false });
		expect(test.storage.put).toHaveBeenCalledTimes(1);
	});

	it("retains the outbox when storage or the final database commit fails", async () => {
		const test = harness();
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:00:00.000Z"),
		});
		await test.persistence.enqueue(reservation, prepareResponseSnapshotBundle(draft()));
		test.setStorageFailure(new Error("disk temporarily unavailable"));

		await expect(service.flush(reservation.snapshotId)).resolves.toBe("retry_later");
		expect(test.getState()).toMatchObject({ state: "pending", outbox: true });

		test.failNextReadyCommit();
		await expect(service.flush(reservation.snapshotId)).resolves.toBe("retry_later");
		expect(test.getState()).toMatchObject({ state: "pending", outbox: true });
		await expect(service.flush(reservation.snapshotId)).resolves.toBe("ready");
		expect(test.storage.put).toHaveBeenCalledTimes(3);
	});

	it("fails an expired outbox without calling the AI channel or filesystem", async () => {
		const test = harness();
		await test.persistence.enqueue(reservation, prepareResponseSnapshotBundle(draft()));
		test.setOutboxExpiry(new Date("2026-08-15T02:00:00.000Z"));
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:00:00.000Z"),
		});

		await expect(service.flush(reservation.snapshotId)).resolves.toBe("retry_later");
		expect(test.getState()).toMatchObject({ state: "failed", outbox: false });
		expect(test.storage.put).not.toHaveBeenCalled();
	});

	it("marks expired content inaccessible before deletion and retries a failed delete", async () => {
		const test = harness();
		const recorder = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:00:00.000Z"),
		});
		await recorder.record({ reservation, draft: draft() });
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-11-14T00:00:00.000Z"),
		});
		test.setDeleteFailure(new Error("filesystem busy"));

		await expect(service.expire({ before: new Date("2026-11-14T00:00:00.000Z"), limit: 10 })).resolves.toEqual({
			expired: 1,
			deleted: 0,
			deleteRetry: 1,
		});
		expect(test.getState()).toMatchObject({ state: "expired" });

		await expect(service.expire({ before: new Date("2026-11-14T00:00:00.000Z"), limit: 10 })).resolves.toEqual({
			expired: 1,
			deleted: 1,
			deleteRetry: 0,
		});
		expect(test.getState().stored).toBeNull();
	});

	it("contains contract failures inside snapshot handling", async () => {
		const test = harness();
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:00:00.000Z"),
		});

		await expect(service.record({ reservation, draft: draft({ answerText: "" }) })).resolves.toMatchObject({
			status: "failed",
		});
		expect(test.getState()).toMatchObject({ state: "failed", outbox: false });
	});

	it("rebuilds a stale reservation from the stored run as a new revision without querying the channel", async () => {
		const test = harness();
		const service = createResponseSnapshotService({
			persistence: test.persistence,
			storage: test.storage,
			now: () => new Date("2026-08-15T02:10:00.000Z"),
		});

		await expect(
			service.recoverStalePending({ before: new Date("2026-08-15T02:05:00.000Z"), limit: 10 }),
		).resolves.toEqual({ recovered: 1, failed: 0 });
		expect(test.persistence.supersedeStaleReservation).toHaveBeenCalledWith(reservation, expect.any(Date));
		expect(test.persistence.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({ revision: 2 }),
			expect.objectContaining({
				captureMethod: "historical_reconstruction",
				contentSource: "reconstructed_from_historical_run",
			}),
		);
	});
});
