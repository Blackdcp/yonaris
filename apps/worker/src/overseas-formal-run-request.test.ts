import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
	EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
	parseOverseasFormalRunRequest,
	readOverseasFormalRunRequestFile,
} from "./overseas-formal-run-request";

test("accepts only the fixed StepFun US ChatGPT three-call one-shot contract", () => {
	const parsed = parseOverseasFormalRunRequest(structuredClone(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST));

	assert.equal(parsed.target.samplesPerPrompt, 1);
	assert.equal(parsed.target.model, "chatgpt");
	assert.equal(parsed.target.provider, "brightdata");
	assert.equal(parsed.dailyAutomationEnabled, false);
	assert.deepEqual(parsed.destinationScope.automaticTargetKeys, []);
	assert.equal(parsed.prompts.textsExact.length, 3);
});

test("rejects expanded call budgets, scheduling, hidden fields, and a changed target", () => {
	for (const changed of [
		{ ...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, dailyAutomationEnabled: true },
		{
			...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
			target: { ...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST.target, samplesPerPrompt: 2 },
		},
		{
			...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
			target: { ...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST.target, model: "perplexity" },
		},
		{ ...EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, hidden: "work" },
	]) {
		assert.throws(() => parseOverseasFormalRunRequest(changed), /fixed reviewed contract/);
	}
});

test("ships the exact reviewed request from the fixed request directory", async () => {
	const parsed = await readOverseasFormalRunRequestFile(
		resolve(process.cwd(), "src/overseas-formal-run-requests/stepfun-us-chatgpt-1x-20260816.json"),
	);

	assert.deepEqual(parsed, EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST);
});
