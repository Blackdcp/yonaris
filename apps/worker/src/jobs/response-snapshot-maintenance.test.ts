import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { runResponseSnapshotMaintenance } from "./response-snapshot-maintenance";

describe("response snapshot maintenance orchestration", () => {
	it("is inert while capture is disabled", async () => {
		const acquireLock = mock.fn(async () => ({ acquired: true, release: async () => undefined }));
		const result = await runResponseSnapshotMaintenance(
			{ source: "scheduled" },
			{ env: { RESPONSE_SNAPSHOT_ENABLED: "false" }, acquireLock },
		);

		assert.deepEqual(result, { status: "disabled" });
		assert.equal(acquireLock.mock.callCount(), 0);
	});

	it("skips a concurrent run under the advisory lock", async () => {
		const result = await runResponseSnapshotMaintenance(
			{ source: "scheduled" },
			{
				env: enabledEnv(),
				acquireLock: async () => ({ acquired: false, release: async () => undefined }),
			},
		);

		assert.deepEqual(result, { status: "already_running" });
	});

	it("runs bounded flush, recovery, expiry and orphan cleanup once", async () => {
		const calls: string[] = [];
		let released = 0;
		const now = new Date("2026-08-15T12:00:00.000Z");
		const result = await runResponseSnapshotMaintenance(
			{ source: "scheduled" },
			{
				env: enabledEnv(),
				now: () => now,
				acquireLock: async () => ({
					acquired: true,
					release: async () => {
						released += 1;
					},
				}),
				assertCapacity: async () => ({ state: "warn", usedPercent: 75 }),
				createService: () => ({
					flushPending: async ({ limit }) => {
						calls.push(`flush:${limit}`);
						return { ready: 2, alreadyReady: 0, retryLater: 1 };
					},
					recoverStalePending: async ({ before, limit }) => {
						calls.push(`recover:${before.toISOString()}:${limit}`);
						return { recovered: 1, failed: 0 };
					},
					expire: async ({ before, limit }) => {
						calls.push(`expire:${before.toISOString()}:${limit}`);
						return { expired: 3, deleted: 3, deleteRetry: 0 };
					},
				}),
				cleanupOrphans: async ({ before, limit }) => {
					calls.push(`orphans:${before.toISOString()}:${limit}`);
					return { scanned: 4, deleted: 1, failed: 0 };
				},
				readTelemetry: async () => ({
					ready: [{ brandId: "stepfun", channel: "doubao", month: "2026-08", count: 18, bytes: 1000 }],
					pending: { count: 1, oldestAgeSeconds: 30 },
					failed: [],
					expired: { count: 0, bytes: 0 },
				}),
			},
		);

		assert.equal(result.status, "completed");
		assert.deepEqual(calls, [
			"flush:50",
			"recover:2026-08-15T11:55:00.000Z:20",
			"expire:2026-08-15T12:00:00.000Z:500",
			"orphans:2026-08-14T12:00:00.000Z:100",
		]);
		assert.equal(released, 1);
	});

	it("always releases the maintenance lock after a failure", async () => {
		let released = 0;
		await assert.rejects(
			runResponseSnapshotMaintenance(
				{ source: "scheduled" },
				{
					env: enabledEnv(),
					acquireLock: async () => ({
						acquired: true,
						async release() {
							released += 1;
						},
					}),
					assertCapacity: async () => ({ state: "normal", usedPercent: 10 }),
					createService: () => ({
						flushPending: async () => Promise.reject(new Error("database offline")),
						recoverStalePending: async () => ({ recovered: 0, failed: 0 }),
						expire: async () => ({ expired: 0, deleted: 0, deleteRetry: 0 }),
					}),
					cleanupOrphans: async () => ({ scanned: 0, deleted: 0, failed: 0 }),
					readTelemetry: async () => ({
						ready: [],
						pending: { count: 0, oldestAgeSeconds: null },
						failed: [],
						expired: { count: 0, bytes: 0 },
					}),
				},
			),
			/database offline/,
		);
		assert.equal(released, 1);
	});
});

function enabledEnv() {
	return {
		RESPONSE_SNAPSHOT_ENABLED: "true",
		RESPONSE_SNAPSHOT_ROOT: "/var/lib/yonaris/response-snapshots/v1",
	};
}
