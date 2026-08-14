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

describe("response snapshot contract", () => {
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
