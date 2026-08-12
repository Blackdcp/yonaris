import assert from "node:assert/strict";
import test from "node:test";
import { pollStartedBatches } from "./poll.js";

test("poll maintenance failures are reported but do not stop later batch work", async () => {
	const controller = new AbortController();
	let maintenanceCalls = 0;
	let maintenanceErrors = 0;
	let claimCalls = 0;
	await pollStartedBatches({
		signal: controller.signal,
		idlePollMs: 1_000,
		maintenanceIntervalMs: 60_000,
		async maintenance() {
			maintenanceCalls += 1;
			throw new Error("retention sweep unavailable");
		},
		onMaintenanceError() {
			maintenanceErrors += 1;
		},
		async createOptions() {
			return {
				taskSource: {
					async claimNext() {
						claimCalls += 1;
						controller.abort();
						return null;
					},
					queueState: () => "settled" as const,
					async recordSubmitIntent() {},
					async confirmPromptSubmitted() {},
				},
				sessionFactory: {
					async create() {
						throw new Error("not reached");
					},
				},
				journal: {
					runId: "poll-test",
					async append() {},
					async writeSummary() {},
				} as never,
				sink: { async submit() {} },
			};
		},
	});
	assert.equal(maintenanceCalls, 1);
	assert.equal(maintenanceErrors, 1);
	assert.equal(claimCalls, 1);
});

test("an idle drained queue backs off without emitting incomplete run noise", async () => {
	const controller = new AbortController();
	let completedEvents = 0;
	let errorEvents = 0;
	let claimCalls = 0;
	await pollStartedBatches({
		signal: controller.signal,
		idlePollMs: 1_000,
		onRunCompleted() {
			completedEvents += 1;
		},
		onRunError() {
			errorEvents += 1;
		},
		async createOptions() {
			return {
				taskSource: {
					async claimNext() {
						claimCalls += 1;
						controller.abort();
						return null;
					},
					queueState: () => "drained" as const,
					async recordSubmitIntent() {},
					async confirmPromptSubmitted() {},
				},
				sessionFactory: {
					async create() {
						throw new Error("not reached");
					},
				},
				journal: { runId: "idle-run", async append() {}, async writeSummary() {} } as never,
				sink: { async submit() {} },
			};
		},
	});
	assert.equal(claimCalls, 1);
	assert.equal(completedEvents, 0);
	assert.equal(errorEvents, 0);
});
