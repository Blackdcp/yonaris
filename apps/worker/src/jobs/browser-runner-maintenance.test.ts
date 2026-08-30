import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { runBrowserRunnerMaintenance } from "./browser-runner-maintenance";

describe("Browser Runner maintenance orchestration", () => {
	it("skips a concurrent settlement run under the advisory lock", async () => {
		const settle = mock.fn(async () => settlementReceipt());
		const result = await runBrowserRunnerMaintenance(
			{ source: "scheduled" },
			{
				acquireLock: async () => ({ acquired: false, release: async () => undefined }),
				settle,
			},
		);

		assert.deepEqual(result, { status: "already_running" });
		assert.equal(settle.mock.callCount(), 0);
	});

	it("runs one bounded daily truth settlement and releases the lock", async () => {
		const now = new Date("2026-08-30T04:00:00.000Z");
		let released = 0;
		const settle = mock.fn(async ({ now: receivedNow }: { now?: Date } = {}) => {
			assert.equal(receivedNow, now);
			return settlementReceipt({ settledBatches: 2, failedTasks: 14 });
		});
		const result = await runBrowserRunnerMaintenance(
			{ source: "scheduled" },
			{
				now: () => now,
				acquireLock: async () => ({
					acquired: true,
					async release() {
						released += 1;
					},
				}),
				settle,
			},
		);

		assert.deepEqual(result, {
			status: "completed",
			settlement: settlementReceipt({ settledBatches: 2, failedTasks: 14 }),
		});
		assert.equal(settle.mock.callCount(), 1);
		assert.equal(released, 1);
	});

	it("always releases the maintenance lock after a settlement failure", async () => {
		let released = 0;
		await assert.rejects(
			runBrowserRunnerMaintenance(
				{ source: "scheduled" },
				{
					acquireLock: async () => ({
						acquired: true,
						async release() {
							released += 1;
						},
					}),
					settle: async () => Promise.reject(new Error("database offline")),
				},
			),
			/database offline/,
		);
		assert.equal(released, 1);
	});
});

function settlementReceipt(overrides: Partial<ReturnType<typeof baseSettlementReceipt>> = {}) {
	return { ...baseSettlementReceipt(), ...overrides };
}

function baseSettlementReceipt() {
	return {
		scannedBatches: 2,
		dueBatches: 2,
		settledBatches: 0,
		deferredLiveLeaseBatches: 0,
		failedBatches: 0,
		failedTasks: 0,
	};
}
