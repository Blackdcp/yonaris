import assert from "node:assert/strict";
import test from "node:test";
import {
	buildReviewedConsumerSourceKey,
	parseReviewedConsumerCohort,
	reviewedConsumerCohortFingerprint,
} from "./reviewed-consumer-cohort-policy";

const PROMPTS = [
	"国内有哪些主流大模型公司？",
	"国内有哪些大模型服务商？",
	"阶跃星辰 StepFun 是一家什么公司？",
] as const;

function validManifest() {
	const observations = [];
	for (let sampleIndex = 1; sampleIndex <= 6; sampleIndex += 1) {
		for (let promptIndex = 1; promptIndex <= 3; promptIndex += 1) {
			const sequence = (sampleIndex - 1) * 3 + promptIndex;
			observations.push({
				externalId: `stepfun-local-pc-deepseek-20260814-${String(sequence).padStart(2, "0")}-p${promptIndex}-s${sampleIndex}`,
				promptIndex,
				sampleIndex,
				promptText: PROMPTS[promptIndex - 1],
				answerText: `第 ${sampleIndex} 次采集的第 ${promptIndex} 个完整 DeepSeek 回答。`,
				observedAt: `2026-08-14T0${sampleIndex}:00:00.000Z`,
				pageUrl: `https://chat.deepseek.com/a/chat/s/${promptIndex}${sampleIndex}abcdef`,
				webSearchObserved: sampleIndex % 3 === 0 ? null : sampleIndex % 2 === 0,
				webQueries: sampleIndex % 2 === 0 ? [`检索词-${promptIndex}-${sampleIndex}`] : [],
				citations:
					sampleIndex % 2 === 0
						? [
								{
									url: `https://example.com/source-${promptIndex}-${sampleIndex}`,
									title: "来源标题",
									citationIndex: 0,
								},
							]
						: [],
				evidence: {
					screenshotSha256: "a".repeat(64),
					pageSnapshotSha256: "b".repeat(64),
				},
			});
		}
	}
	return {
		schemaVersion: 1,
		importId: "stepfun-local-pc-deepseek-18-20260814",
		brandId: "stepfun",
		scopeKey: "cn-zh-scored",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		evaluationRole: "scored",
		model: "deepseek",
		surfaceTargetKey: "deepseek.consumer_web",
		captureRouteKey: "assisted_browser.generic",
		sessionMode: "dedicated_sampling_profile",
		searchMode: "native_auto",
		observations,
	};
}

test("accepts only the exact reviewed StepFun DeepSeek three-by-six cohort", () => {
	const manifest = parseReviewedConsumerCohort(validManifest());
	const firstObservation = manifest.observations[0];
	if (!firstObservation) throw new Error("invalid test fixture");
	assert.equal(manifest.observations.length, 18);
	assert.equal(manifest.observations.filter((item) => item.webSearchObserved === null).length, 6);
	assert.equal(new Set(manifest.observations.map((item) => `${item.promptIndex}:${item.sampleIndex}`)).size, 18);
	assert.match(reviewedConsumerCohortFingerprint(manifest), /^[0-9a-f]{64}$/);
	assert.equal(
		buildReviewedConsumerSourceKey(firstObservation),
		"reviewed-consumer-cohort:stepfun-local-pc-deepseek-18-20260814:stepfun-local-pc-deepseek-20260814-01-p1-s1",
	);
});

test("rejects altered channel, route, scope and prompt identities", () => {
	for (const patch of [
		{ model: "doubao" },
		{ surfaceTargetKey: "doubao.consumer_web" },
		{ captureRouteKey: "browser_runner.doubao" },
		{ scopeKey: "default" },
	]) {
		assert.throws(() => parseReviewedConsumerCohort({ ...validManifest(), ...patch }), /DeepSeek contract/);
	}
	const promptManifest = validManifest();
	(promptManifest.observations as Array<Record<string, unknown>>)[0] = {
		...promptManifest.observations[0],
		promptText: "改过的问题",
	};
	assert.throws(() => parseReviewedConsumerCohort(promptManifest), /exact reviewed 3 by 6 cohort/);
});

test("rejects duplicate or extra slots and non-durable DeepSeek URLs", () => {
	const duplicate = validManifest();
	duplicate.observations[17] = { ...duplicate.observations[0] };
	assert.throws(() => parseReviewedConsumerCohort(duplicate), /exact reviewed 3 by 6 cohort/);

	const extra = validManifest();
	extra.observations.push({ ...extra.observations[0], externalId: "extra" });
	assert.throws(() => parseReviewedConsumerCohort(extra), /exact reviewed 3 by 6 cohort/);

	const badUrl = validManifest();
	badUrl.observations[0] = { ...badUrl.observations[0], pageUrl: "https://example.com/chat/1" };
	assert.throws(() => parseReviewedConsumerCohort(badUrl), /DeepSeek conversation URL/);
});

test("rejects prompt echoes, malformed evidence, citation indexes and secret-shaped fields", () => {
	const echo = validManifest();
	const echoObservation = echo.observations[0];
	if (!echoObservation) throw new Error("invalid test fixture");
	echo.observations[0] = { ...echoObservation, answerText: echoObservation.promptText };
	assert.throws(() => parseReviewedConsumerCohort(echo), /valid completed response/);

	const digest = validManifest();
	const digestObservation = digest.observations[0];
	if (!digestObservation) throw new Error("invalid test fixture");
	digest.observations[0] = {
		...digestObservation,
		evidence: { ...digestObservation.evidence, screenshotSha256: "bad" },
	};
	assert.throws(() => parseReviewedConsumerCohort(digest), /evidence digest/);

	const citation = validManifest();
	const citationObservation = citation.observations[3];
	const firstCitation = citationObservation?.citations[0];
	if (!firstCitation) throw new Error("invalid test fixture");
	firstCitation.citationIndex = 1;
	assert.throws(() => parseReviewedConsumerCohort(citation), /contiguous and zero based/);

	const secret = validManifest() as ReturnType<typeof validManifest> & { metadata?: unknown };
	secret.metadata = { authorizationToken: "forbidden" };
	assert.throws(() => parseReviewedConsumerCohort(secret), /secret-shaped field/);
});

test("fingerprint changes when reviewed observation content changes", () => {
	const original = parseReviewedConsumerCohort(validManifest());
	const changedInput = validManifest();
	const changedObservation = changedInput.observations[0];
	if (!changedObservation) throw new Error("invalid test fixture");
	changedInput.observations[0] = {
		...changedObservation,
		answerText: `${changedObservation.answerText} 补充`,
	};
	const changed = parseReviewedConsumerCohort(changedInput);
	assert.notEqual(reviewedConsumerCohortFingerprint(original), reviewedConsumerCohortFingerprint(changed));
});
