import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
	BROKER_REQUEST_MAX_BYTES,
	BROKER_RESPONSE_MAX_BYTES,
	encodeBrokerFrame,
	parseBrokerRequest,
	parseBrokerResponse,
	readBrokerFrame,
} from "./broker-protocol.js";

const frozenTask = {
	id: "task-1",
	batchId: "batch-1",
	brandId: "stepfun",
	promptText: "国内有哪些主流大模型公司？",
	surfaceTargetKey: "doubao.consumer_web",
	captureRouteKey: "browser_runner.doubao",
	sampleIndex: 1,
	sessionRequirement: "dedicated_sampling_profile",
	searchRequirement: "platform_default",
	evaluationRole: "scored",
	minimumEvidenceArtifacts: 2,
	automationAttemptCount: 1,
	leaseGeneration: 3,
} as const;

test("broker create accepts only the frozen browser task fields", () => {
	const parsed = parseBrokerRequest({
		version: 1,
		requestId: "request-1",
		operation: "create",
		task: frozenTask,
		attempt: 1,
	});
	assert.equal(parsed.operation, "create");
	if (parsed.operation !== "create") throw new Error("Expected create request");
	assert.deepEqual(parsed.task, frozenTask);

	assert.throws(
		() =>
			parseBrokerRequest({
				version: 1,
				requestId: "request-2",
				operation: "create",
				task: frozenTask,
				attempt: 1,
				leaseToken: "must-never-cross-the-browser-boundary",
			}),
		/unknown field/i,
	);
	assert.throws(
		() =>
			parseBrokerRequest({
				version: 1,
				requestId: "request-3",
				operation: "create",
				task: { ...frozenTask, apiToken: "must-never-cross-the-browser-boundary" },
				attempt: 1,
			}),
		/unknown field/i,
	);
});

test("broker rejects protocol downgrade and oversized prompt text", () => {
	assert.throws(
		() => parseBrokerRequest({ version: 0, requestId: "request-1", operation: "create", task: frozenTask, attempt: 1 }),
		/protocol version/i,
	);
	assert.throws(
		() =>
			parseBrokerRequest({
				version: 1,
				requestId: "request-1",
				operation: "create",
				task: { ...frozenTask, promptText: "x".repeat(500_001) },
				attempt: 1,
			}),
		/promptText/i,
	);
});

test("broker frame reader rejects an oversized declaration before accepting its body", async () => {
	const stream = new PassThrough();
	const declared = Buffer.alloc(4);
	declared.writeUInt32BE(BROKER_REQUEST_MAX_BYTES + 1);
	stream.end(declared);
	await assert.rejects(() => readBrokerFrame(stream, BROKER_REQUEST_MAX_BYTES), /frame exceeds/i);
});

test("broker frame is length-prefixed and round-trips one strict JSON value", async () => {
	const request = { version: 1, requestId: "request-4", operation: "open", sessionId: "session-1" } as const;
	const encoded = encodeBrokerFrame(request, BROKER_REQUEST_MAX_BYTES);
	assert.equal(encoded.readUInt32BE(0), encoded.byteLength - 4);
	const stream = new PassThrough();
	stream.end(encoded);
	assert.deepEqual(parseBrokerRequest(await readBrokerFrame(stream, BROKER_REQUEST_MAX_BYTES)), request);
});

test("broker response boundary carries a valid multibyte answer up to the Portal completion limit", async () => {
	const response = {
		version: 1,
		requestId: "request-large-response",
		ok: true,
		result: {
			kind: "response",
			response: {
				answerText: "中".repeat(400_000),
				pageUrl: "https://www.doubao.com/chat/",
				observedAt: "2026-08-13T00:00:00.000Z",
				citations: [],
				webQueries: [],
				webSearchObserved: null,
			},
		},
	} as const;
	const encoded = encodeBrokerFrame(response, BROKER_RESPONSE_MAX_BYTES);
	assert.ok(encoded.byteLength > BROKER_REQUEST_MAX_BYTES);
	const stream = new PassThrough();
	stream.end(encoded);
	const parsed = parseBrokerResponse(await readBrokerFrame(stream, BROKER_RESPONSE_MAX_BYTES));
	assert.equal(parsed.ok && parsed.result.kind === "response" && parsed.result.response.answerText.length, 400_000);
});

test("broker response parser rejects undeclared data and preserves a typed error", () => {
	const failure = parseBrokerResponse({
		version: 1,
		requestId: "request-5",
		ok: false,
		error: {
			code: "page_drift",
			phase: "pre_submit",
			disposition: "needs_human",
			message: "The approved selector changed",
		},
	});
	assert.equal(failure.ok, false);
	if (failure.ok) throw new Error("Expected broker failure");
	assert.equal(failure.error.code, "page_drift");

	assert.throws(
		() =>
			parseBrokerResponse({
				version: 1,
				requestId: "request-6",
				ok: true,
				result: { kind: "session", sessionId: "session-1", apiToken: "forbidden" },
			}),
		/unknown field/i,
	);
});
