import assert from "node:assert/strict";
import test from "node:test";
import { buildOverseasFormalReadiness } from "./overseas-formal-readiness";

const baseInput = {
	brand: {
		name: "StepFun",
		enabled: true,
		enabledModels: null as string[] | null,
		delayHours: 24,
	},
	sourceScope: {
		key: "cn-zh-scored",
		enabled: true,
		automaticTargetKeys: [] as string[] | null,
		promptCount: 3,
		exactPromptMatchCount: 3,
	},
	brightDataTargets: [
		{
			model: "chatgpt",
			webSearch: true,
			surfaceTargetKey: "chatgpt.consumer_web",
			captureRouteKey: "brightdata.chatgpt_dataset",
		},
		{
			model: "perplexity",
			webSearch: true,
			surfaceTargetKey: "perplexity.consumer_web",
			captureRouteKey: "brightdata.perplexity_dataset",
		},
	],
	providerConfigured: true,
	responseSnapshotsEnabled: true,
	runsPerPrompt: 5,
};

test("reports a bounded one-shot plan without enabling daily execution", () => {
	const report = buildOverseasFormalReadiness(baseInput);

	assert.equal(report.readyForOneShot, true);
	assert.deepEqual(report.blockers, []);
	assert.equal(report.oneShot.promptCount, 3);
	assert.equal(report.oneShot.targetCount, 2);
	assert.equal(report.oneShot.totalCalls, 6);
	assert.equal(report.oneShot.dailyAutomationEnabled, false);
	assert.equal(report.dailyIfEnabled.callsPerCycle, 30);
	assert.equal(report.dailyIfEnabled.cadenceHours, 24);
	assert.deepEqual(
		report.targets.map(({ model }) => model),
		["chatgpt", "perplexity"],
	);
});

test("fails closed when prompt identity, provider, snapshots, or call cap is unsafe", () => {
	const report = buildOverseasFormalReadiness({
		...baseInput,
		sourceScope: { ...baseInput.sourceScope, exactPromptMatchCount: 2 },
		brightDataTargets: Array.from({ length: 7 }, (_, index) => ({
			model: `model-${index}`,
			webSearch: true,
			surfaceTargetKey: `model-${index}.consumer_web`,
			captureRouteKey: `brightdata.model-${index}`,
		})),
		providerConfigured: false,
		responseSnapshotsEnabled: false,
	});

	assert.equal(report.readyForOneShot, false);
	assert.deepEqual(report.blockers, [
		"prompt_identity_mismatch",
		"brightdata_not_configured",
		"response_snapshots_disabled",
		"one_shot_call_cap_exceeded",
	]);
	assert.equal(report.oneShot.totalCalls, 21);
});

test("does not expose provider versions, credentials, prompt text, or database ids", () => {
	const reportText = JSON.stringify(buildOverseasFormalReadiness(baseInput));

	for (const forbidden of ["apiKey", "token", "password", "promptText", "scopeId", "brandId", "version"]) {
		assert.equal(reportText.includes(forbidden), false);
	}
});
