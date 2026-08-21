import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft, ResponseSnapshotValidationError } from "./contract";

function validDraft(overrides: Partial<ResponseSnapshotDraft> = {}): ResponseSnapshotDraft {
	return {
		runId: "11111111-1111-4111-8111-111111111111",
		brandId: "stepfun",
		scopeId: "22222222-2222-4222-8222-222222222222",
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "阶跃星辰 StepFun 是一家什么公司？",
		answerText: "StepFun 是一家人工智能公司。",
		answerHtml: "<p><strong>StepFun</strong> 是一家人工智能公司。</p>",
		citations: [
			{
				url: "https://www.stepfun.com/about",
				title: "关于 StepFun",
				domain: "stepfun.com",
				citationIndex: 0,
			},
		],
		webQueries: ["StepFun 公司介绍"],
		queryAvailability: "available",
		brandMentioned: true,
		competitorsMentioned: ["DeepSeek"],
		channel: "doubao",
		modelVersion: "consumer-web",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		observedAt: "2026-08-15T01:02:03.000Z",
		captureMethod: "consumer_web_browser",
		contentSource: "browser_answer_html",
		sourcePayloadSha256: "a".repeat(64),
		...overrides,
	};
}

function validV2Draft(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: "response-snapshot.v2",
		runId: "11111111-1111-4111-8111-111111111111",
		brandId: "ppio",
		scopeId: "22222222-2222-4222-8222-222222222222",
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "推荐适合 AI 推理的 GPU 云服务",
		answerText: "以下是可选服务。",
		citations: [
			{
				url: "https://example.com/a",
				title: "Source A",
				domain: "example.com",
				citationIndex: 0,
			},
		],
		webQueries: ["GPU 云推理服务"],
		queryAvailability: "available",
		brandMentioned: false,
		competitorsMentioned: [],
		channel: "doubao",
		modelVersion: "doubao-web-20260821-localpc-v12",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		observedAt: "2026-08-20T01:02:03.000Z",
		captureMethod: "consumer_web_browser",
		contentSource: "rendered_from_structured_response",
		visualEvidence: {
			artifactId: "44444444-4444-4444-8444-444444444444",
			mediaType: "image/jpeg",
			sha256: "a".repeat(64),
			bytes: 12_345,
		},
		adapterVersion: "doubao-web-20260821-localpc-v12",
		captureDiagnostics: {
			answerCount: 1,
			queryCount: 1,
			citationCount: 1,
			completionCount: 1,
		},
		...overrides,
	} as Parameters<typeof prepareResponseSnapshotBundle>[0];
}

describe("response snapshot contract", () => {
	it("serializes a structured v2 snapshot without provider HTML", () => {
		const bundle = prepareResponseSnapshotBundle(validV2Draft());
		const json = JSON.parse(gunzipSync(bundle.jsonGzip).toString("utf8"));
		const manifest = JSON.parse(Buffer.from(bundle.manifestJson).toString("utf8"));
		const html = gunzipSync(bundle.htmlGzip).toString("utf8");

		expect(bundle.schemaVersion).toBe("response-snapshot.v2");
		expect(bundle.templateVersion).toBe("response-snapshot-html.v2");
		expect(json.schemaVersion).toBe("response-snapshot.v2");
		expect(json).not.toHaveProperty("answerHtml");
		expect(json.visualEvidence).toEqual({
			artifactId: "44444444-4444-4444-8444-444444444444",
			mediaType: "image/jpeg",
			sha256: "a".repeat(64),
			bytes: 12_345,
		});
		expect(manifest.schemaVersion).toBe("response-snapshot-manifest.v2");
		expect(manifest.visualEvidence).toEqual(json.visualEvidence);
		expect(html).toContain("以下是可选服务。");
		expect(html).not.toContain("answerHtml");
	});

	it("rejects provider HTML and non-structured content sources in v2", () => {
		expect(() => prepareResponseSnapshotBundle(validV2Draft({ answerHtml: "<p>provider DOM</p>" }))).toThrow(
			/answerHtml/,
		);
		expect(() => prepareResponseSnapshotBundle(validV2Draft({ contentSource: "browser_answer_html" }))).toThrow(
			/rendered_from_structured_response/,
		);
	});

	it("rejects invalid v2 screenshot evidence metadata", () => {
		const invalidEvidence = [
			{
				artifactId: "not-a-uuid",
				mediaType: "image/jpeg",
				sha256: "a".repeat(64),
				bytes: 12_345,
			},
			{
				artifactId: "44444444-4444-4444-8444-444444444444",
				mediaType: "image/png",
				sha256: "a".repeat(64),
				bytes: 12_345,
			},
			{
				artifactId: "44444444-4444-4444-8444-444444444444",
				mediaType: "image/jpeg",
				sha256: "ABC",
				bytes: 12_345,
			},
			{
				artifactId: "44444444-4444-4444-8444-444444444444",
				mediaType: "image/jpeg",
				sha256: "a".repeat(64),
				bytes: 0,
			},
			{
				artifactId: "44444444-4444-4444-8444-444444444444",
				mediaType: "image/jpeg",
				sha256: "a".repeat(64),
				bytes: 2 * 1024 * 1024 + 1,
			},
		];

		for (const visualEvidence of invalidEvidence) {
			expect(() => prepareResponseSnapshotBundle(validV2Draft({ visualEvidence }))).toThrow(
				ResponseSnapshotValidationError,
			);
		}
	});

	it("rejects v2 capture diagnostics that do not match the structured result", () => {
		for (const captureDiagnostics of [
			{ answerCount: 0, queryCount: 1, citationCount: 1, completionCount: 1 },
			{ answerCount: 1, queryCount: 0, citationCount: 1, completionCount: 1 },
			{ answerCount: 1, queryCount: 1, citationCount: 0, completionCount: 1 },
			{ answerCount: 1, queryCount: 1, citationCount: 1, completionCount: 2 },
		]) {
			expect(() => prepareResponseSnapshotBundle(validV2Draft({ captureDiagnostics }))).toThrow(/captureDiagnostics/);
		}
	});

	it("requires v2 adapter identity and screenshot evidence", () => {
		expect(() => prepareResponseSnapshotBundle(validV2Draft({ adapterVersion: " " }))).toThrow(/adapterVersion/);
		expect(() => prepareResponseSnapshotBundle(validV2Draft({ visualEvidence: undefined }))).toThrow(
			ResponseSnapshotValidationError,
		);
	});

	it("serializes the same semantic snapshot byte-for-byte", () => {
		const first = prepareResponseSnapshotBundle(validDraft());
		const second = prepareResponseSnapshotBundle({
			...validDraft(),
			citations: [
				{
					citationIndex: 0,
					domain: "stepfun.com",
					title: "关于 StepFun",
					url: "https://www.stepfun.com/about",
				},
			],
		});

		expect(Buffer.from(first.jsonGzip)).toEqual(Buffer.from(second.jsonGzip));
		expect(first.jsonSha256).toBe(second.jsonSha256);
		expect(first.htmlSha256).toBe(second.htmlSha256);
		expect(first.manifestSha256).toBe(second.manifestSha256);
	});

	it("preserves the canonical v1 JSON field order used for immutable hashes", () => {
		const bundle = prepareResponseSnapshotBundle(validDraft());
		const json = JSON.parse(gunzipSync(bundle.jsonGzip).toString("utf8"));

		expect(Object.keys(json)).toEqual([
			"schemaVersion",
			"runId",
			"brandId",
			"scopeId",
			"promptId",
			"promptText",
			"answerText",
			"answerHtml",
			"citations",
			"queryFanout",
			"mentions",
			"channel",
			"modelVersion",
			"localization",
			"observedAt",
			"captureMethod",
			"contentSource",
			"sourcePayloadSha256",
		]);
	});

	it("records unavailable query expansion instead of fabricating an empty available list", () => {
		const bundle = prepareResponseSnapshotBundle(
			validDraft({
				captureMethod: "brightdata_serp",
				contentSource: "rendered_from_structured_response",
				answerHtml: undefined,
				webQueries: [],
				queryAvailability: "unavailable",
			}),
		);
		const json = JSON.parse(gunzipSync(bundle.jsonGzip).toString("utf8"));

		expect(json.queryFanout).toEqual({ availability: "unavailable", queries: [] });
		expect(json.contentSource).toBe("rendered_from_structured_response");
	});

	it("changes the immutable hashes when answer content changes", () => {
		const first = prepareResponseSnapshotBundle(validDraft());
		const second = prepareResponseSnapshotBundle(
			validDraft({
				answerText: "StepFun 是一家人工智能公司，专注基础模型。",
				answerHtml: "<p><strong>StepFun</strong> 是一家人工智能公司，专注基础模型。</p>",
			}),
		);

		expect(second.jsonSha256).not.toBe(first.jsonSha256);
		expect(second.htmlSha256).not.toBe(first.htmlSha256);
		expect(second.manifestSha256).not.toBe(first.manifestSha256);
	});

	it("rejects inconsistent source contracts and oversized payloads", () => {
		expect(() =>
			prepareResponseSnapshotBundle(validDraft({ contentSource: "native_answer_html", answerHtml: undefined })),
		).toThrow(ResponseSnapshotValidationError);
		expect(() =>
			prepareResponseSnapshotBundle(validDraft({ answerHtml: `<p>${"x".repeat(4 * 1024 * 1024)}</p>` })),
		).toThrow(/HTML exceeds/i);
	});
});
