import { describe, expect, it } from "vitest";
import {
	type BrowserRunnerDailySettlementBatchSnapshot,
	type BrowserRunnerDailySettlementTaskPatch,
	type BrowserRunnerDailySettlementTaskSnapshot,
	type BrowserRunnerDailySettlementTransaction,
	executeBrowserRunnerDailySettlement,
} from "./browser-runner";

const NOW = new Date("2026-08-30T04:00:00.000Z");

describe("Browser Runner daily settlement transaction", () => {
	it("locks batch before tasks, preserves successes, writes only canonical failures, and is idempotent", async () => {
		const success = {
			id: "task-success",
			status: "succeeded",
			automationStatus: "completed",
			observationAttemptId: "observation-success",
			succeededAt: new Date("2026-08-29T11:00:00.000Z"),
		};
		const successBefore = structuredClone(success);
		const state = fakeSettlementState([
			success,
			unresolvedTask({ id: "task-unstarted", status: "available", leaseGeneration: 0 }),
			unresolvedTask({
				id: "task-submit-unknown",
				status: "claimed",
				leaseGeneration: 2,
				leaseExpiresAt: new Date("2026-08-30T03:59:00.000Z"),
				submitIntentAt: new Date("2026-08-29T10:00:00.000Z"),
			}),
		]);

		const first = await executeBrowserRunnerDailySettlement({ batchId: state.batch.id, now: NOW }, state.transaction);

		expect(first).toEqual({ kind: "settled", failedTasks: 2 });
		expect(state.calls.slice(0, 2)).toEqual(["lock_batch", "lock_tasks"]);
		expect(success).toEqual(successBefore);
		expect(state.tasks.filter(({ status }) => status === "failed")).toHaveLength(2);
		expect(state.tasks.find(({ id }) => id === "task-unstarted")).toMatchObject({
			status: "failed",
			automationStatus: "completed",
			leaseTokenHash: null,
			leaseExpiresAt: null,
			lastErrorClass: "BrowserRunnerTerminalFailure",
			lastErrorCode: "daily_cutoff_unresolved",
			needsHumanCode: null,
			needsHumanReason: null,
		});
		expect(state.tasks.find(({ id }) => id === "task-submit-unknown")).toMatchObject({
			status: "failed",
			lastErrorCode: "submit_outcome_unknown",
		});
		expect(state.batch.status).toBe("completed");
		expect(state.promptRuns).toEqual([]);
		expect(state.observations).toEqual(["observation-success"]);
		expect(state.evidenceArtifacts).toEqual(["evidence-success"]);

		const writesAfterFirst = state.failureWrites.length;
		const second = await executeBrowserRunnerDailySettlement({ batchId: state.batch.id, now: NOW }, state.transaction);
		expect(second).toEqual({ kind: "not_due" });
		expect(state.failureWrites).toHaveLength(writesAfterFirst);
		expect(state.promptRuns).toEqual([]);
	});

	it("defers the entire batch without partial writes while one lease is live", async () => {
		const available = unresolvedTask({ id: "task-available", status: "available", leaseGeneration: 0 });
		const live = unresolvedTask({
			id: "task-live",
			status: "claimed",
			leaseGeneration: 3,
			leaseExpiresAt: new Date("2026-08-30T04:05:00.000Z"),
		});
		const state = fakeSettlementState([available, live]);

		const result = await executeBrowserRunnerDailySettlement({ batchId: state.batch.id, now: NOW }, state.transaction);

		expect(result).toEqual({ kind: "deferred_live_lease" });
		expect(state.failureWrites).toEqual([]);
		expect(state.tasks).toEqual([available, live]);
		expect(state.batch.status).toBe("in_progress");
		expect(state.calls).not.toContain("settle_batch");
	});
});

type MutableTask = Record<string, unknown> & { id: string; status: string };

function unresolvedTask(
	overrides: Partial<BrowserRunnerDailySettlementTaskSnapshot> &
		Pick<BrowserRunnerDailySettlementTaskSnapshot, "id" | "status">,
): MutableTask {
	return {
		id: overrides.id,
		status: overrides.status,
		automationStatus: overrides.status === "claimed" ? "running" : "queued",
		leaseGeneration: overrides.leaseGeneration ?? 0,
		leaseTokenHash: overrides.status === "claimed" ? "lease-hash" : null,
		leaseExpiresAt: overrides.leaseExpiresAt ?? null,
		submitIntentAt: overrides.submitIntentAt ?? null,
		needsHumanCode: overrides.needsHumanCode ?? null,
		needsHumanReason: overrides.needsHumanReason ?? null,
		observationAttemptId: overrides.observationAttemptId ?? null,
		succeededAt: null,
		failedAt: null,
		cancelledAt: null,
	};
}

function fakeSettlementState(initialTasks: MutableTask[]) {
	const batch: BrowserRunnerDailySettlementBatchSnapshot & { status: string } = {
		id: "batch-1",
		brandId: "brand-1",
		scopeId: "scope-cn",
		status: "in_progress",
		executionMode: "browser_runner",
		automationStartedAt: new Date("2026-08-29T09:49:00.000Z"),
		startedAt: new Date("2026-08-29T09:49:00.000Z"),
		protocol: {
			measurementWindow: {
				startsAt: "2026-08-29T00:00:00.000Z",
				endsAt: "2026-08-31T00:00:00.000Z",
			},
			evidence: {
				minimumArtifacts: 1,
				requireSha256: true,
				requirePageUrl: true,
				allowedUriSchemes: ["https"],
			},
		},
	};
	const calls: string[] = [];
	const failureWrites: BrowserRunnerDailySettlementTaskPatch[] = [];
	const tasks = initialTasks;
	const transaction: BrowserRunnerDailySettlementTransaction = {
		async lockBatch(batchId) {
			calls.push("lock_batch");
			return batchId === batch.id ? batch : null;
		},
		async lockUnresolvedTasks(batchId) {
			calls.push("lock_tasks");
			if (batchId !== batch.id) return [];
			return tasks
				.filter(({ status }) => status === "available" || status === "claimed")
				.map((task) => task as unknown as BrowserRunnerDailySettlementTaskSnapshot);
		},
		async readScope() {
			calls.push("read_scope");
			return { market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" };
		},
		async failTask({ task, patch }) {
			calls.push(`fail_task:${task.id}`);
			const current = tasks.find(({ id }) => id === task.id);
			if (!current || current.status !== task.status || current.leaseGeneration !== task.leaseGeneration) return false;
			expect(patch).toMatchObject({
				status: "failed",
				automationStatus: "completed",
				leaseTokenHash: null,
				leaseExpiresAt: null,
				failedAt: NOW,
				lastErrorClass: "BrowserRunnerTerminalFailure",
				needsHumanCode: null,
				needsHumanReason: null,
			});
			failureWrites.push(patch);
			Object.assign(current, patch);
			return true;
		},
		async markBatchInProgress() {
			calls.push("mark_batch_in_progress");
			batch.status = "in_progress";
			return true;
		},
		async settleBatch() {
			calls.push("settle_batch");
			if (tasks.some(({ status }) => status === "available" || status === "claimed")) {
				throw new Error("Cannot settle while tasks remain unresolved");
			}
			batch.status = "completed";
		},
	};
	return {
		batch,
		tasks,
		calls,
		failureWrites,
		promptRuns: [] as string[],
		observations: ["observation-success"],
		evidenceArtifacts: ["evidence-success"],
		transaction,
	};
}
