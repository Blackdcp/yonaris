import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WEB_QUERIES_UNAVAILABLE } from "../../constants";
import { toBrightDataScrapeResult } from "./brightdata";

describe("toBrightDataScrapeResult", () => {
	it("prefers the native answer HTML and removes large provider fields from customer raw output", () => {
		const payload = [
			{
				answer_text: "A structured answer",
				answer_html: "<article><strong>Native answer</strong></article>",
				answer_section_html: "<section>Fallback answer</section>",
				response_raw: "x".repeat(50_000),
				model: "gpt-5",
				citations: [{ url: "https://example.com/source", title: "Source" }],
				web_search_query: ["example query"],
			},
		];

		const result = toBrightDataScrapeResult(payload, {
			captureMethod: "brightdata_dataset",
			webSearch: true,
			providerSubmissionId: "snapshot-123",
		});

		expect(result.snapshotSource).toEqual({
			captureMethod: "brightdata_dataset",
			contentSource: "native_answer_html",
			answerHtml: "<article><strong>Native answer</strong></article>",
			sourcePayloadSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
		});
		expect(result.rawOutput).toEqual([
			{
				answer_text: "A structured answer",
				model: "gpt-5",
				citations: [{ url: "https://example.com/source", title: "Source" }],
				web_search_query: ["example query"],
			},
		]);
		expect(result.providerSubmissionId).toBe("snapshot-123");
	});

	it("uses answer_section_html when answer_html is absent", () => {
		const result = toBrightDataScrapeResult(
			[{ answer_text: "Answer", answer_section_html: "<section>Native section</section>" }],
			{ captureMethod: "brightdata_dataset", webSearch: false },
		);

		expect(result.snapshotSource?.contentSource).toBe("native_answer_html");
		expect(result.snapshotSource?.answerHtml).toBe("<section>Native section</section>");
	});

	it("never treats response_raw as trusted HTML", () => {
		const result = toBrightDataScrapeResult(
			[{ answer_text: "Answer", response_raw: "<script>alert('provider')</script>" }],
			{ captureMethod: "brightdata_dataset", webSearch: false },
		);

		expect(result.snapshotSource).toMatchObject({
			captureMethod: "brightdata_dataset",
			contentSource: "rendered_from_structured_response",
		});
		expect(result.snapshotSource).not.toHaveProperty("answerHtml");
		expect(JSON.stringify(result.rawOutput)).not.toContain("script");
	});

	it("renders a structured archive when the provider has no native answer HTML", () => {
		const result = toBrightDataScrapeResult(
			[
				{
					answer_text: "Answer without native HTML",
					citations: [{ url: "https://example.com/source", title: "Source" }],
					web_search_query: ["first query", "second query"],
				},
			],
			{ captureMethod: "brightdata_dataset", webSearch: true },
		);

		expect(result.textContent).toBe("Answer without native HTML");
		expect(result.webQueries).toEqual(["first query", "second query"]);
		expect(result.citations).toHaveLength(1);
		expect(result.snapshotSource?.contentSource).toBe("rendered_from_structured_response");
	});

	it("records unavailable query expansion honestly for dataset results", () => {
		const result = toBrightDataScrapeResult(
			[{ answer_text: "Answer", citations: [{ url: "https://example.com/source" }] }],
			{ captureMethod: "brightdata_dataset", webSearch: true },
		);

		expect(result.webQueries).toEqual([WEB_QUERIES_UNAVAILABLE]);
	});

	it("creates a structured snapshot source for Google AI Overview SERP results", () => {
		const payload = {
			ai_overview: {
				text: "Overview answer",
				references: [{ url: "https://example.com/overview", title: "Overview source" }],
			},
		};
		const result = toBrightDataScrapeResult(payload, {
			captureMethod: "brightdata_serp",
			webSearch: true,
			modelVersion: "brightdata-serp",
		});

		expect(result.snapshotSource).toMatchObject({
			captureMethod: "brightdata_serp",
			contentSource: "rendered_from_structured_response",
		});
		expect(result.snapshotSource).not.toHaveProperty("answerHtml");
		expect(result.webQueries).toEqual([WEB_QUERIES_UNAVAILABLE]);
		expect(result.modelVersion).toBe("brightdata-serp");
	});
});
