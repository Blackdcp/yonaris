import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertResponseSnapshotCapacity,
	evaluateResponseSnapshotCapacity,
	isResponseSnapshotExpired,
	isResponseSnapshotOutboxPastTtl,
	readResponseSnapshotRuntimeConfig,
	responseSnapshotMaintenanceCutoffs,
} from "./response-snapshot-maintenance-policy";

describe("response snapshot maintenance policy", () => {
	it("warns at 70% and stops new capture at 80%", () => {
		assert.deepEqual(evaluateResponseSnapshotCapacity({ blocks: 100, availableBlocks: 31 }), {
			state: "normal",
			usedPercent: 69,
		});
		assert.deepEqual(evaluateResponseSnapshotCapacity({ blocks: 100, availableBlocks: 30 }), {
			state: "warn",
			usedPercent: 70,
		});
		assert.deepEqual(evaluateResponseSnapshotCapacity({ blocks: 100, availableBlocks: 21 }), {
			state: "warn",
			usedPercent: 79,
		});
		assert.deepEqual(evaluateResponseSnapshotCapacity({ blocks: 100, availableBlocks: 20 }), {
			state: "stop",
			usedPercent: 80,
		});
	});

	it("fails closed for invalid or unavailable capacity", async () => {
		assert.throws(() => evaluateResponseSnapshotCapacity({ blocks: 0, availableBlocks: 0 }), /invalid/i);
		await assert.rejects(
			assertResponseSnapshotCapacity(
				{ enabled: true, storageRoot: "/var/lib/yonaris/response-snapshots/v1" },
				{ statfs: async () => Promise.reject(new Error("offline")) },
			),
			/unavailable/i,
		);
	});

	it("uses the immutable 90/70/80/24 v1 configuration", () => {
		assert.deepEqual(readResponseSnapshotRuntimeConfig({ RESPONSE_SNAPSHOT_ENABLED: "false" }), {
			enabled: false,
			retentionDays: 90,
			warnUsedPercent: 70,
			stopUsedPercent: 80,
			outboxTtlHours: 24,
		});
		assert.throws(
			() =>
				readResponseSnapshotRuntimeConfig({
					RESPONSE_SNAPSHOT_ENABLED: "true",
					RESPONSE_SNAPSHOT_RETENTION_DAYS: "30",
				}),
			/fixed at 90/,
		);
	});

	it("expires outbox and snapshots at their end-exclusive boundary", () => {
		const createdAt = new Date("2026-08-15T00:00:00.000Z");
		const outboxBoundary = new Date("2026-08-16T00:00:00.000Z");
		assert.equal(isResponseSnapshotOutboxPastTtl(createdAt, new Date(outboxBoundary.getTime() - 1)), false);
		assert.equal(isResponseSnapshotOutboxPastTtl(createdAt, outboxBoundary), true);

		const expiresAt = new Date("2026-11-13T00:00:00.000Z");
		assert.equal(isResponseSnapshotExpired(expiresAt, new Date(expiresAt.getTime() - 1)), false);
		assert.equal(isResponseSnapshotExpired(expiresAt, expiresAt), true);
	});

	it("derives stable bounded maintenance cutoffs", () => {
		assert.deepEqual(responseSnapshotMaintenanceCutoffs(new Date("2026-08-15T12:00:00.000Z")), {
			flushLimit: 50,
			recoverLimit: 20,
			expireLimit: 500,
			orphanLimit: 100,
			stalePendingBefore: new Date("2026-08-15T11:55:00.000Z"),
			expireBefore: new Date("2026-08-15T12:00:00.000Z"),
			orphanBefore: new Date("2026-08-14T12:00:00.000Z"),
		});
	});
});
