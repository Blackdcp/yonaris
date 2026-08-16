import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
	EXPECTED_STEPFUN_PROMPTS,
	parseSamplingBatchCliOptions,
	parseSamplingBatchRequest,
	readSamplingBatchRequestFile,
	SamplingBatchRequestError,
} from "./sampling-batch-request";
import { validSamplingBatchManifest } from "./sampling-batch-test-fixture";

describe("StepFun sampling batch CLI input", () => {
	it("defaults to dry-run and requires an explicit flag for apply or status-only", () => {
		assert.deepEqual(parseSamplingBatchCliOptions(["--request-file", "request.json"]), {
			requestFile: "request.json",
			mode: "dry-run",
		});
		assert.equal(parseSamplingBatchCliOptions(["--request-file", "request.json", "--apply"]).mode, "apply");
		assert.equal(parseSamplingBatchCliOptions(["--status-only", "--request-file", "request.json"]).mode, "status-only");
		assert.throws(
			() => parseSamplingBatchCliOptions(["--request-file", "request.json", "--apply", "--status-only"]),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "conflicting_mode",
		);
	});
});

describe("StepFun sampling batch request manifest", () => {
	it("keeps the reviewed Chinese prompt texts as valid UTF-8", () => {
		assert.deepEqual(EXPECTED_STEPFUN_PROMPTS, [
			"国内有哪些主流大模型公司?",
			"如果我要选择国产大模型服务商,有哪些推荐?",
			"阶跃星辰 StepFun 是一家什么公司?",
		]);
		for (const prompt of EXPECTED_STEPFUN_PROMPTS) {
			assert.equal(prompt.includes("\uFFFD"), false);
		}
	});

	it("accepts only the reviewed StepFun CN Doubao 3-prompt by 6-sample contract", () => {
		assert.deepEqual(parseSamplingBatchRequest(validSamplingBatchManifest), validSamplingBatchManifest);
		assert.deepEqual(EXPECTED_STEPFUN_PROMPTS, validSamplingBatchManifest.promptSelection.textsExact);
	});

	it("fails closed when the execution budget or browser protocol changes", () => {
		for (const execution of [
			{ ...validSamplingBatchManifest.execution, samplesPerPrompt: 5 },
			{ ...validSamplingBatchManifest.execution, sessionRequirement: "anonymous_clean" },
			{ ...validSamplingBatchManifest.execution, searchRequirement: "forbidden" },
			{ ...validSamplingBatchManifest.execution, surfaceTargetKey: "deepseek.consumer_web" },
		]) {
			assert.throws(
				() => parseSamplingBatchRequest({ ...validSamplingBatchManifest, execution }),
				(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "invalid_execution_contract",
			);
		}
	});

	it("rejects a missing, duplicate, altered, or extra enabled prompt text", () => {
		for (const textsExact of [
			EXPECTED_STEPFUN_PROMPTS.slice(0, 2),
			[EXPECTED_STEPFUN_PROMPTS[0], EXPECTED_STEPFUN_PROMPTS[0], EXPECTED_STEPFUN_PROMPTS[2]],
			[EXPECTED_STEPFUN_PROMPTS[0], EXPECTED_STEPFUN_PROMPTS[1], "被替换的提示词"],
			[...EXPECTED_STEPFUN_PROMPTS, "额外提示词"],
		]) {
			assert.throws(
				() =>
					parseSamplingBatchRequest({
						...validSamplingBatchManifest,
						promptSelection: {
							...validSamplingBatchManifest.promptSelection,
							textsExact,
						},
					}),
				(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "invalid_prompt_contract",
			);
		}
	});

	it("requires the fixed Beijing window and rejects hidden fields", () => {
		assert.throws(
			() =>
				parseSamplingBatchRequest({
					...validSamplingBatchManifest,
					measurementWindow: {
						...validSamplingBatchManifest.measurementWindow,
						startsAt: "2026-08-12T16:00:00Z",
					},
				}),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "invalid_measurement_window",
		);
		assert.throws(
			() => parseSamplingBatchRequest({ ...validSamplingBatchManifest, token: "must-not-be-accepted" }),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "invalid_manifest_shape",
		);
	});

	it("reads only checked JSON files inside the configured request directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "yonaris-sampling-request-"));
		try {
			const allowlisted = join(root, "allowlisted");
			await mkdir(allowlisted);
			const requestPath = join(allowlisted, "request.json");
			const outsidePath = join(root, "outside.json");
			await writeFile(requestPath, JSON.stringify(validSamplingBatchManifest), "utf8");
			await writeFile(outsidePath, JSON.stringify(validSamplingBatchManifest), "utf8");
			assert.deepEqual(await readSamplingBatchRequestFile(requestPath, allowlisted), validSamplingBatchManifest);
			await assert.rejects(
				() => readSamplingBatchRequestFile(outsidePath, allowlisted),
				(error: unknown) =>
					error instanceof SamplingBatchRequestError && error.code === "request_file_outside_allowlist",
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("ships the reviewed request as the fixed checked-in manifest", async () => {
		assert.deepEqual(
			await readSamplingBatchRequestFile("src/sampling-batch-requests/stepfun-cn-doubao-6x-20260816-v4.json"),
			validSamplingBatchManifest,
		);
	});
});
