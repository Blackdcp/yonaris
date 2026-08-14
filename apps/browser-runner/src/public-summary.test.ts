import assert from "node:assert/strict";
import test from "node:test";
import type { RunSummary } from "./contracts.js";
import { publicSummary } from "./public-summary.js";

test("public summaries never expose prompts, answers, URLs, or evidence paths", () => {
	const summary: RunSummary = {
		runId: "run-1",
		status: "complete",
		queuedRemaining: 0,
		startedAt: "2026-08-13T00:00:00.000Z",
		completedAt: "2026-08-13T00:01:00.000Z",
		total: 1,
		succeeded: 1,
		retryQueued: 0,
		needsHuman: 0,
		results: [
			{
				taskId: "task-1",
				status: "succeeded",
				observation: {
					idempotencyKey: "secret-idempotency-key",
					sessionId: "secret-session-id",
					task: {
						id: "task-1",
						batchId: "batch-1",
						brandId: "brand-1",
						promptText: "customer prompt",
						surfaceTargetKey: "doubao.consumer_web",
						captureRouteKey: "browser_runner.doubao",
						sampleIndex: 1,
						sessionRequirement: "anonymous_clean",
						searchRequirement: "forbidden",
						evaluationRole: "scored",
						automationAttemptCount: 1,
						leaseGeneration: 1,
					},
					response: {
						answerText: "customer answer",
						answerHtml: "<section>customer answer</section>",
						pageUrl: "https://www.doubao.com/chat/secret",
						observedAt: "2026-08-13T00:00:30.000Z",
						citations: [],
						webQueries: [],
					},
					evidence: [
						{
							kind: "screenshot",
							path: "C:/secret/page.png",
							mediaType: "image/png",
							sha256: "digest",
							bytes: 1,
						},
					],
					sessionMode: "anonymous_clean",
					searchMode: "off",
					webSearchObserved: false,
				},
			},
		],
	};
	const output = JSON.stringify(publicSummary(summary));
	assert.doesNotMatch(output, /customer prompt|customer answer|doubao\.com|secret|page\.png/);
	assert.deepEqual(Object.keys(publicSummary(summary)), [
		"runId",
		"status",
		"queuedRemaining",
		"startedAt",
		"completedAt",
		"total",
		"succeeded",
		"retryQueued",
		"needsHuman",
	]);
});
