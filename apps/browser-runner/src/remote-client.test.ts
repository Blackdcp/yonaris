import assert from "node:assert/strict";
import test from "node:test";
import {
	assertRunnerCompletePayloadWithinLimit,
	BrowserRunnerRemoteClient,
	RUNNER_INTERNAL_JSON_MAX_BYTES,
} from "./remote-client.js";

test("remote intent and confirmation bind the durable browser session without following bearer redirects", async () => {
	const requests: Array<{ pathname: string; body: unknown; redirect: RequestRedirect | undefined }> = [];
	const fetchImplementation = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input.toString());
		const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
		requests.push({ pathname: url.pathname, body, redirect: init?.redirect });
		if (url.pathname.endsWith("/tasks/claim")) {
			return jsonResponse({
				claim: claimResponse({ runnerSessionId: undefined, postSubmitAssist: false }),
				queueState: "waiting",
			});
		}
		return jsonResponse({});
	}) as typeof fetch;
	const remote = new BrowserRunnerRemoteClient({
		baseUrl: "http://localhost:3000",
		apiToken: "x".repeat(32),
		brandId: "stepfun",
		fetchImplementation,
	});
	const claimed = await remote.claimNext("batch-1");
	assert.ok(claimed);
	assert.equal(claimed.runnerSessionId, null);
	assert.equal(remote.queueState(), "waiting");
	await remote.recordSubmitIntent(claimed, { sessionId: "durable-session-1" });
	await remote.confirmPromptSubmitted(claimed, { sessionId: "durable-session-1" });

	for (const operation of ["submit-intent", "submit-confirmed"]) {
		const request = requests.find(({ pathname }) => pathname.endsWith(`/${operation}`));
		assert.ok(request);
		assert.equal((request.body as { runnerSessionId?: unknown }).runnerSessionId, "durable-session-1");
	}
	assert.ok(requests.length > 0);
	assert.ok(requests.every(({ redirect }) => redirect === "error"));
});

test("resume accepts only a server-declared post-submit assist session", async () => {
	const fetchImplementation = (async (input: string | URL | Request) => {
		const url = new URL(input instanceof Request ? input.url : input.toString());
		assert.ok(url.pathname.endsWith("/tasks/task-1/resume"));
		return jsonResponse({
			claim: claimResponse({ runnerSessionId: "original-durable-session", postSubmitAssist: true }),
		});
	}) as typeof fetch;
	const remote = new BrowserRunnerRemoteClient({
		baseUrl: "http://127.0.0.1:3000",
		apiToken: "x".repeat(32),
		brandId: "stepfun",
		fetchImplementation,
	});
	const claimed = await remote.resume("task-1");
	assert.equal(claimed.postSubmitAssist, true);
	assert.equal(claimed.runnerSessionId, "original-durable-session");
});

test("oversized UTF-8 completion payloads fail closed with an explicit post-submit code", () => {
	assert.doesNotThrow(() => assertRunnerCompletePayloadWithinLimit({ answerText: "a".repeat(1000) }));
	assert.throws(
		() => assertRunnerCompletePayloadWithinLimit({ answerText: "阶".repeat(RUNNER_INTERNAL_JSON_MAX_BYTES) }),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "answer_payload_too_large" &&
			"phase" in error &&
			error.phase === "post_submit",
	);
});

test("claim exposes a drained automatic lane without treating it as an unknown wait", async () => {
	const remote = new BrowserRunnerRemoteClient({
		baseUrl: "http://127.0.0.1:3000",
		apiToken: "token-that-is-long-enough-for-the-test-client",
		brandId: "stepfun",
		adapterVersion: "test",
		fetchImplementation: (async () => jsonResponse({ claim: null, queueState: "drained" })) as typeof fetch,
	});
	assert.equal(await remote.claimNext("batch-1"), null);
	assert.equal(remote.queueState(), "drained");
});

function claimResponse(input: { runnerSessionId: string | undefined; postSubmitAssist: boolean }) {
	return {
		task: {
			id: "task-1",
			batchId: "batch-1",
			brandId: "stepfun",
			promptText: "frozen prompt",
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_runner.doubao",
			sampleIndex: 1,
			sessionRequirement: "anonymous_clean",
			searchRequirement: "forbidden",
			evaluationRole: "scored",
			minimumEvidenceArtifacts: 2,
			automationAttemptCount: 3,
		},
		leaseToken: "y".repeat(32),
		leaseGeneration: 5,
		submitConfirmed: false,
		postSubmitAssist: input.postSubmitAssist,
		...(input.runnerSessionId === undefined ? {} : { runnerSessionId: input.runnerSessionId }),
	};
}

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
