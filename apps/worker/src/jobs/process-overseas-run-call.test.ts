import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

test("records durable paid intent before invoking the provider and completes once", async () => {
	const { executeOverseasRunCall } = await import("./process-overseas-run-call.js");
	const events: string[] = [];
	const result = await executeOverseasRunCall(
		{ cohortId: "cohort-1", callId: "call-1" },
		{
			async claim() {
				events.push("claim");
				return { id: "call-1", cohortId: "cohort-1" };
			},
			async execute(_call, hooks) {
				await hooks.beforeProviderRun();
				events.push("provider");
				return { observationAttemptId: "attempt-1", promptRunId: "run-1", providerSubmissionId: "snapshot-1" };
			},
			async recordPaidIntent() {
				events.push("paid-intent");
			},
			async complete() {
				events.push("complete");
			},
			async fail() {
				throw new Error("must not fail");
			},
		},
	);

	assert.equal(result, "succeeded");
	assert.deepEqual(events, ["claim", "paid-intent", "provider", "complete"]);
});

test("records one call failure without throwing a cohort-wide retry", async () => {
	const { executeOverseasRunCall } = await import("./process-overseas-run-call.js");
	const events: string[] = [];
	const result = await executeOverseasRunCall(
		{ cohortId: "cohort-1", callId: "call-1" },
		{
			async claim() {
				return { id: "call-1", cohortId: "cohort-1" };
			},
			async execute(_call, hooks) {
				await hooks.beforeProviderRun();
				throw new Error("provider failed");
			},
			async recordPaidIntent() {
				events.push("paid-intent");
			},
			async complete() {
				throw new Error("must not complete");
			},
			async fail(input) {
				events.push(`failed:${input.failureMessage}`);
			},
		},
	);

	assert.equal(result, "failed");
	assert.deepEqual(events, ["paid-intent", "failed:provider failed"]);
});

test("does not invoke a provider for an already claimed or terminal call", async () => {
	const { executeOverseasRunCall } = await import("./process-overseas-run-call.js");
	let executions = 0;
	const result = await executeOverseasRunCall(
		{ cohortId: "cohort-1", callId: "call-1" },
		{
			async claim() {
				return null;
			},
			async execute() {
				executions += 1;
				throw new Error("must not execute");
			},
			async recordPaidIntent() {},
			async complete() {},
			async fail() {},
		},
	);

	assert.equal(result, "skipped");
	assert.equal(executions, 0);
});

test("preserves the provider-observed search state for persistence", async () => {
	const { buildPromptObservationSearchEvidence } = await import("./process-prompt-snapshot-policy.js");

	assert.deepEqual(
		buildPromptObservationSearchEvidence({
			webQueries: ["expanded query"],
			webSearchObserved: true,
		}),
		{
			webQueries: ["expanded query"],
			webSearchObserved: true,
		},
	);
	assert.deepEqual(buildPromptObservationSearchEvidence({ webQueries: [] }), {
		webQueries: [],
		webSearchObserved: null,
	});
});
