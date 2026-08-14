import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
	assertLocalDemoExistingObservationIdentity,
	assertLocalDemoImportObservationSet,
	buildLocalDemoDefaultScopePromotion,
	isLocalDemoStructuredDetailCurrent,
	parseLocalDemoImportObservation,
	toLocalDemoCitations,
} from "./local-demo-import-policy";

const VALID_OBSERVATION = {
	externalId: "stepfun-local-pc-demo-20260814-02-p2-s1",
	promptIndex: 2,
	sampleIndex: 1,
	promptText: "如果我要选择国产大模型服务商,有哪些推荐?",
	answerText: `搜索 2 个关键词，参考 2 篇资料\n${"有效回答。".repeat(50)}`,
	observedAt: "2026-08-14T05:00:00.000Z",
	pageUrl: "https://www.doubao.com/chat/123456789",
	answerCharacters: 269,
	webSearchObserved: true as const,
	webQueries: ["国产大模型服务商", "企业大模型私有化"],
	citations: [
		{ citationIndex: 0, url: "https://www.example.com/one", title: "Example One" },
		{ citationIndex: 1, url: "https://docs.example.org/two", title: "Example Two" },
	],
};

describe("local demo import default scope promotion", () => {
	it("promotes only the reviewed StepFun local PC Doubao import scope", () => {
		assert.deepEqual(
			buildLocalDemoDefaultScopePromotion({
				brandId: "stepfun",
				scopeId: "cn-zh-scored",
				importId: "stepfun-local-pc-doubao-demo-20260814",
				source: "local_pc_demo",
			}),
			{ brandId: "stepfun", scopeId: "cn-zh-scored" },
		);
	});

	it("rejects unreviewed imports", () => {
		assert.throws(
			() =>
				buildLocalDemoDefaultScopePromotion({
					brandId: "stepfun",
					scopeId: "cn-zh-scored",
					importId: "other-import",
					source: "local_pc_demo",
				}),
			/unsupported_local_demo_default_scope_promotion/,
		);
	});

	it("accepts a complete consumer observation and derives citation domains", () => {
		const observation = parseLocalDemoImportObservation(VALID_OBSERVATION);

		assert.equal(observation.answerText.length, 269);
		assert.deepEqual(observation.webQueries, ["国产大模型服务商", "企业大模型私有化"]);
		assert.deepEqual(toLocalDemoCitations(observation.citations), [
			{
				citationIndex: 0,
				url: "https://www.example.com/one",
				title: "Example One",
				domain: "example.com",
			},
			{
				citationIndex: 1,
				url: "https://docs.example.org/two",
				title: "Example Two",
				domain: "docs.example.org",
			},
		]);
	});

	it("rejects a citation title that is only whitespace", () => {
		assert.throws(
			() =>
				parseLocalDemoImportObservation({
					...VALID_OBSERVATION,
					citations: [{ ...VALID_OBSERVATION.citations[0], title: "   " }, VALID_OBSERVATION.citations[1]],
				}),
			/invalid citation title/i,
		);
	});

	it("rejects a prompt echo even when punctuation width differs", () => {
		assert.throws(
			() =>
				parseLocalDemoImportObservation({
					...VALID_OBSERVATION,
					answerText: "如果我要选择国产大模型服务商，有哪些推荐？",
					answerCharacters: 21,
				}),
			/answer must not equal the prompt/i,
		);
	});

	it("rejects structured detail counts that disagree with the captured answer", () => {
		assert.throws(
			() => parseLocalDemoImportObservation({ ...VALID_OBSERVATION, webQueries: ["国产大模型服务商"] }),
			/search detail count mismatch/i,
		);
	});

	it("rejects a local placeholder instead of a durable Doubao conversation URL", () => {
		assert.throws(
			() =>
				parseLocalDemoImportObservation({
					...VALID_OBSERVATION,
					pageUrl: "https://www.doubao.com/chat/local_1082541182147867",
				}),
			/durable Doubao conversation URL/i,
		);
	});

	it("allows repairs only for the exact reviewed local demo identity", () => {
		const identity = {
			promptId: "prompt-2",
			brandId: "stepfun",
			scopeId: "cn-zh-scored",
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_runner.doubao",
			model: "doubao",
			provider: "local-pc-demo",
			version: "local-pc-doubao-demo-20260814",
			webSearchEnabled: true,
			sampleIndex: 1,
			importId: "stepfun-local-pc-doubao-demo-20260814",
			source: "local_pc_demo",
		};

		assert.doesNotThrow(() => assertLocalDemoExistingObservationIdentity(identity, identity));
		assert.throws(
			() => assertLocalDemoExistingObservationIdentity({ ...identity, provider: "brightdata" }, identity),
			/existing local demo observation identity mismatch/i,
		);
	});

	it("treats a prior atomic structured-detail revision as an idempotent no-op", () => {
		assert.equal(
			isLocalDemoStructuredDetailCurrent({ structuredDetailRevision: 1, sampleFingerprint: "sha256-a" }, "sha256-a"),
			true,
		);
		assert.equal(
			isLocalDemoStructuredDetailCurrent({ structuredDetailRevision: 1, sampleFingerprint: "sha256-b" }, "sha256-a"),
			false,
		);
		assert.equal(isLocalDemoStructuredDetailCurrent({ sampleFingerprint: "sha256-a" }, "sha256-a"), false);
	});

	it("accepts only the exact three-prompt by six-sample observation slots", () => {
		const observations = Array.from({ length: 18 }, (_, index) => {
			const promptIndex = ((index % 3) + 1) as 1 | 2 | 3;
			const sampleIndex = Math.floor(index / 3) + 1;
			return {
				...VALID_OBSERVATION,
				externalId: `stepfun-local-pc-demo-20260814-${String(index + 1).padStart(2, "0")}-p${promptIndex}-s${sampleIndex}`,
				promptIndex,
				promptText: `${VALID_OBSERVATION.promptText}-${promptIndex}`,
				sampleIndex,
			};
		});

		assert.doesNotThrow(() => assertLocalDemoImportObservationSet(observations));
		const firstObservation = observations[0];
		assert.ok(firstObservation);
		assert.throws(
			() => assertLocalDemoImportObservationSet([...observations.slice(0, 17), firstObservation]),
			/exact reviewed 3 by 6 slots/i,
		);
		assert.throws(
			() =>
				assertLocalDemoImportObservationSet([
					{ ...firstObservation, externalId: "stepfun-local-pc-demo-20260814-18-p1-s1" },
					...observations.slice(1),
				]),
			/exact reviewed 3 by 6 slots/i,
		);
	});

	it("ships the reviewed schema-v2 manifest with all 18 structured observations", () => {
		const request = JSON.parse(
			readFileSync(resolve("src/local-demo-imports/stepfun-local-pc-doubao-18-20260814.json"), "utf8"),
		) as { schemaVersion?: unknown; observations?: unknown[] };
		assert.equal(request.schemaVersion, 2);
		assert.equal(request.observations?.length, 18);
		const observations = request.observations?.map(parseLocalDemoImportObservation) ?? [];
		assertLocalDemoImportObservationSet(observations);
		assert.equal(
			observations.reduce((total, item) => total + item.webQueries.length, 0),
			48,
		);
		assert.equal(
			observations.reduce((total, item) => total + item.citations.length, 0),
			271,
		);
	});
});
