import assert from "node:assert/strict";
import test from "node:test";
import {
	assertOverseasFormalDestination,
	buildOverseasFormalCallPlan,
	selectOverseasFormalDiagnosticCalls,
} from "./overseas-formal-run-policy";
import { EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST } from "./overseas-formal-run-request";

const prompts = [
	{ id: "prompt-1", value: "国内有哪些主流大模型公司？", tags: ["market"], systemTags: [] },
	{ id: "prompt-2", value: "如果我要选择国产大模型服务商，有哪些推荐？", tags: [], systemTags: ["buyer"] },
	{ id: "prompt-3", value: "阶跃星辰 StepFun 是一家什么公司？", tags: ["brand"], systemTags: [] },
];

test("builds exactly three stable one-shot calls without a scheduling instruction", () => {
	const plan = buildOverseasFormalCallPlan(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, prompts, {
		model: "chatgpt",
		provider: "brightdata",
		webSearch: true,
		surfaceTargetKey: "chatgpt.consumer_web",
		captureRouteKey: "brightdata.chatgpt_dataset",
	});

	assert.equal(plan.calls.length, 3);
	assert.equal(new Set(plan.calls.map(({ sourceJobId }) => sourceJobId)).size, 3);
	assert.ok(plan.calls.every(({ sampleIndex }) => sampleIndex === 1));
	assert.equal(JSON.stringify(plan).includes("schedule"), false);
	assert.equal(JSON.stringify(plan).includes("cadence"), false);
});

test("diagnostics use destination prompt identities once the copied scope exists", () => {
	const sourcePlan = buildOverseasFormalCallPlan(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, prompts, {
		model: "chatgpt",
		provider: "brightdata",
		webSearch: true,
		surfaceTargetKey: "chatgpt.consumer_web",
		captureRouteKey: "brightdata.chatgpt_dataset",
	});
	const destinationPlan = buildOverseasFormalCallPlan(
		EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
		prompts.map((prompt) => ({ ...prompt, id: `destination-${prompt.id}` })),
		{
			model: "chatgpt",
			provider: "brightdata",
			webSearch: true,
			surfaceTargetKey: "chatgpt.consumer_web",
			captureRouteKey: "brightdata.chatgpt_dataset",
		},
	);

	const selected = selectOverseasFormalDiagnosticCalls(sourcePlan.calls, destinationPlan.calls);
	assert.deepEqual(
		selected.map(({ sourceJobId }) => sourceJobId),
		destinationPlan.calls.map(({ sourceJobId }) => sourceJobId),
	);
	assert.notDeepEqual(
		selected.map(({ sourceJobId }) => sourceJobId),
		sourcePlan.calls.map(({ sourceJobId }) => sourceJobId),
	);
});

test("fails closed for an extra prompt or another channel", () => {
	assert.throws(
		() =>
			buildOverseasFormalCallPlan(
				EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
				[...prompts, { id: "prompt-4", value: "extra", tags: [], systemTags: [] }],
				{
					model: "chatgpt",
					provider: "brightdata",
					webSearch: true,
					surfaceTargetKey: "chatgpt.consumer_web",
					captureRouteKey: "brightdata.chatgpt_dataset",
				},
			),
		/prompt identity/,
	);
	assert.throws(
		() =>
			buildOverseasFormalCallPlan(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, prompts, {
				model: "perplexity",
				provider: "brightdata",
				webSearch: true,
				surfaceTargetKey: "perplexity.consumer_web",
				captureRouteKey: "brightdata.perplexity_dataset",
			}),
		/target identity/,
	);
});

test("accepts only the manual-only US destination scope and exact prompt copies", () => {
	assert.doesNotThrow(() =>
		assertOverseasFormalDestination(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, {
			key: "us-en-chatgpt-one-shot-20260816",
			name: "US · English · ChatGPT one-shot 2026-08-16",
			market: "US",
			locale: "en-US",
			timezone: "Asia/Shanghai",
			samplingEvaluationRole: "scored",
			automaticTargetKeys: [],
			enabled: true,
			isDefault: false,
			prompts,
		}),
	);
	assert.throws(
		() =>
			assertOverseasFormalDestination(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST, {
				key: "us-en-chatgpt-one-shot-20260816",
				name: "US · English · ChatGPT one-shot 2026-08-16",
				market: "US",
				locale: "en-US",
				timezone: "Asia/Shanghai",
				samplingEvaluationRole: "scored",
				automaticTargetKeys: ["chatgpt:brightdata:online"],
				enabled: true,
				isDefault: false,
				prompts,
			}),
		/manual-only/,
	);
});
