import assert from "node:assert/strict";
import test from "node:test";
import {
	buildDeepSeekSlots,
	deepSeekManifestFingerprint,
	parseDeepSeekReviewedManifest,
	STEPFUN_DEEPSEEK_PROMPTS,
} from "./deepseek-capture-contract.js";

function validObservation(promptIndex: 1 | 2 | 3, sampleIndex: 1 | 2 | 3 | 4 | 5 | 6) {
	const sequence = (sampleIndex - 1) * 3 + promptIndex;
	return {
		externalId: `stepfun-local-pc-deepseek-20260814-${String(sequence).padStart(2, "0")}-p${promptIndex}-s${sampleIndex}`,
		promptIndex,
		sampleIndex,
		promptText: STEPFUN_DEEPSEEK_PROMPTS[promptIndex - 1],
		answerText: `第 ${sampleIndex} 次独立回答：这是关于第 ${promptIndex} 个问题的有效完整结果。`,
		observedAt: `2026-08-14T0${sampleIndex}:00:00.000Z`,
		pageUrl: `https://chat.deepseek.com/a/chat/s/${promptIndex}${sampleIndex}abcdef`,
		webSearchObserved: sampleIndex % 3 === 0 ? null : sampleIndex % 2 === 0,
		webQueries: sampleIndex % 2 === 0 ? [`第${sampleIndex}次检索词`] : [],
		citations:
			sampleIndex % 2 === 0
				? [{ url: `https://example.com/source-${promptIndex}-${sampleIndex}`, title: "示例来源", citationIndex: 0 }]
				: [],
		evidence: {
			screenshotSha256: "a".repeat(64),
			pageSnapshotSha256: "b".repeat(64),
		},
	};
}

function validManifest() {
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
		observations: buildDeepSeekSlots().map((slot) => validObservation(slot.promptIndex, slot.sampleIndex)),
	};
}

test("freezes the exact StepFun three-prompt by six-sample DeepSeek matrix", () => {
	const slots = buildDeepSeekSlots();
	assert.deepEqual(STEPFUN_DEEPSEEK_PROMPTS, [
		"国内有哪些主流大模型公司？",
		"国内有哪些大模型服务商？",
		"阶跃星辰 StepFun 是一家什么公司？",
	]);
	assert.equal(slots.length, 18);
	assert.equal(new Set(slots.map((slot) => `${slot.promptIndex}:${slot.sampleIndex}`)).size, 18);
	assert.deepEqual(slots[0], {
		externalId: "stepfun-local-pc-deepseek-20260814-01-p1-s1",
		promptIndex: 1,
		sampleIndex: 1,
		promptText: "国内有哪些主流大模型公司？",
	});
	assert.deepEqual(slots[17], {
		externalId: "stepfun-local-pc-deepseek-20260814-18-p3-s6",
		promptIndex: 3,
		sampleIndex: 6,
		promptText: "阶跃星辰 StepFun 是一家什么公司？",
	});
});

test("accepts only the frozen DeepSeek consumer-web identity and preserves search unknown", () => {
	const parsed = parseDeepSeekReviewedManifest(validManifest());
	assert.equal(parsed.observations.length, 18);
	assert.equal(parsed.model, "deepseek");
	assert.equal(parsed.surfaceTargetKey, "deepseek.consumer_web");
	assert.equal(parsed.captureRouteKey, "assisted_browser.generic");
	assert.equal(parsed.observations[6]?.webSearchObserved, null);
	assert.match(deepSeekManifestFingerprint(parsed), /^[0-9a-f]{64}$/);
});

test("rejects a duplicate slot even when the row count stays eighteen", () => {
	const manifest = validManifest();
	manifest.observations[17] = { ...manifest.observations[0] };
	assert.throws(() => parseDeepSeekReviewedManifest(manifest), /exact reviewed 3 by 6 cohort/);
});

test("rejects non-DeepSeek conversation URLs and hidden URL state", () => {
	for (const pageUrl of [
		"https://example.com/a/chat/s/11",
		"http://chat.deepseek.com/a/chat/s/11",
		"https://user@chat.deepseek.com/a/chat/s/11",
		"https://chat.deepseek.com:8443/a/chat/s/11",
		"https://chat.deepseek.com/a/chat/s/11?secret=1",
	]) {
		const manifest = validManifest();
		manifest.observations[0] = { ...manifest.observations[0], pageUrl };
		assert.throws(() => parseDeepSeekReviewedManifest(manifest), /DeepSeek conversation URL/);
	}
});

test("rejects secret-shaped fields anywhere in the reviewed manifest", () => {
	const manifest = validManifest() as ReturnType<typeof validManifest> & { metadata?: unknown };
	manifest.metadata = { cookie: "do-not-store" };
	assert.throws(() => parseDeepSeekReviewedManifest(manifest), /secret-shaped field/i);
});

test("rejects malformed evidence and altered public channel identity", () => {
	const evidenceManifest = validManifest();
	const firstEvidence = evidenceManifest.observations[0]?.evidence;
	assert.ok(firstEvidence);
	evidenceManifest.observations[0] = {
		...evidenceManifest.observations[0],
		evidence: { ...firstEvidence, screenshotSha256: "not-a-digest" },
	};
	assert.throws(() => parseDeepSeekReviewedManifest(evidenceManifest), /evidence digest/);

	const identityManifest = { ...validManifest(), model: "doubao" };
	assert.throws(() => parseDeepSeekReviewedManifest(identityManifest), /DeepSeek contract/);
});

test("fingerprint changes when a captured answer changes", () => {
	const original = parseDeepSeekReviewedManifest(validManifest());
	const changedInput = validManifest();
	const firstAnswer = changedInput.observations[0]?.answerText;
	assert.ok(firstAnswer);
	changedInput.observations[0] = {
		...changedInput.observations[0],
		answerText: `${firstAnswer} 补充内容`,
	};
	const changed = parseDeepSeekReviewedManifest(changedInput);
	assert.notEqual(deepSeekManifestFingerprint(original), deepSeekManifestFingerprint(changed));
});
