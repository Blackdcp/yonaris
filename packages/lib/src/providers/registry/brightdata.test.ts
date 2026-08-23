import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WEB_QUERIES_UNAVAILABLE } from "../../constants";
import {
	fetchBrightDataSnapshotWhenReady,
	preflightGoogleAiOverviewSerpZone,
	requestGoogleAiOverviewSerp,
	requireGoogleAiOverviewSerpZone,
	toBrightDataScrapeResult,
} from "./brightdata";

describe("Bright Data overseas failure handling", () => {
	it("rejects Google AI Overview before cohort dispatch when no explicit SERP zone is configured", () => {
		expect(() => requireGoogleAiOverviewSerpZone({})).toThrow(/BRIGHTDATA_SERP_ZONE/);
	});

	it("rejects a configured Google AI Overview zone that is missing from the account's active SERP zones", async () => {
		let listCalls = 0;
		let closeCalls = 0;
		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						listCalls += 1;
						return [{ name: "another_serp_zone", type: "serp", status: "active" }];
					},
					async close() {
						closeCalls += 1;
					},
				}),
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_zone_unavailable" });
		expect(listCalls).toBe(1);
		expect(closeCalls).toBe(1);
	});

	it("accepts an active SERP zone when the active-zones API omits status", async () => {
		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						return [{ name: "configured_serp_zone", type: "serp" }];
					},
					async close() {},
				}),
			}),
		).resolves.toBeUndefined();
	});

	it("accepts an active SERP zone when the active-zones API returns a null status", async () => {
		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						return [{ name: "configured_serp_zone", type: "serp", status: null }];
					},
					async close() {},
				}),
			}),
		).resolves.toBeUndefined();
	});

	it("accepts an explicitly active SERP zone and rejects an explicitly inactive one", async () => {
		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						return [{ name: "configured_serp_zone", type: "serp", status: "active" }];
					},
					async close() {},
				}),
			}),
		).resolves.toBeUndefined();

		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						return [{ name: "configured_serp_zone", type: "serp", status: "inactive" }];
					},
					async close() {},
				}),
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_zone_unavailable" });
	});

	it("rejects an active same-name zone when it is not a SERP zone", async () => {
		await expect(
			preflightGoogleAiOverviewSerpZone({
				zone: "configured_serp_zone",
				createClient: () => ({
					async listZones() {
						return [{ name: "configured_serp_zone", type: "unblocker", status: "active" }];
					},
					async close() {},
				}),
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_zone_unavailable" });
	});

	it("does not retry Bright Data's non-recoverable missing-zone response", async () => {
		let requests = 0;
		await expect(
			requestGoogleAiOverviewSerp({
				zone: "configured_serp_zone",
				request: async () => {
					requests += 1;
					return {
						ok: false,
						status: 400,
						text: async () => 'zone "configured_serp_zone" not found',
					};
				},
				sleep: async () => undefined,
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_zone_unavailable" });
		expect(requests).toBe(1);
	});

	it("does not retry any other non-recoverable HTTP 400 response", async () => {
		let requests = 0;
		await expect(
			requestGoogleAiOverviewSerp({
				zone: "configured_serp_zone",
				request: async () => {
					requests += 1;
					return { ok: false, status: 400, text: async () => "invalid SERP request" };
				},
				sleep: async () => undefined,
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_request_rejected" });
		expect(requests).toBe(1);
	});

	it("does not resubmit a paid SERP request after a transient HTTP failure", async () => {
		let requests = 0;
		await expect(
			requestGoogleAiOverviewSerp({
				zone: "configured_serp_zone",
				request: async () => {
					requests += 1;
					return { ok: false, status: 503, text: async () => "temporarily unavailable" };
				},
				sleep: async () => undefined,
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_request_failed" });
		expect(requests).toBe(1);
	});

	it("does not resubmit a paid SERP request after a non-JSON success response", async () => {
		let requests = 0;
		await expect(
			requestGoogleAiOverviewSerp({
				zone: "configured_serp_zone",
				request: async () => {
					requests += 1;
					return { ok: true, status: 200, text: async () => "<html>edge response</html>" };
				},
				sleep: async () => undefined,
			}),
		).rejects.toMatchObject({ code: "brightdata_serp_request_failed" });
		expect(requests).toBe(1);
	});

	it("retries a just-ready dataset snapshot without submitting another paid dataset job", async () => {
		let fetches = 0;
		const payload = await fetchBrightDataSnapshotWhenReady(
			async () => {
				fetches += 1;
				if (fetches < 3) throw new Error("snapshot is not ready yet, please try again later");
				return [{ answer_text: "Recovered without retriggering" }];
			},
			async () => undefined,
		);

		expect(fetches).toBe(3);
		expect(payload).toEqual([{ answer_text: "Recovered without retriggering" }]);
	});

	it("retains a stable retryable code when a dataset snapshot remains temporarily unavailable", async () => {
		await expect(
			fetchBrightDataSnapshotWhenReady(
				async () => {
					throw new Error("snapshot is not ready yet, please try again later");
				},
				async () => undefined,
			),
		).rejects.toMatchObject({ code: "brightdata_snapshot_not_ready" });
	});
});

describe("toBrightDataScrapeResult", () => {
	it("uses provider-reported ChatGPT search state instead of the requested toggle", () => {
		const searched = toBrightDataScrapeResult(
			[{ answer_text: "Answer", web_search_triggered: true, web_search_query: ["expanded query"] }],
			{ captureMethod: "brightdata_dataset", webSearch: true },
		);
		const notSearched = toBrightDataScrapeResult(
			[{ answer_text: "Answer", web_search_triggered: false }],
			{ captureMethod: "brightdata_dataset", webSearch: true },
		);

		expect(searched.webSearchObserved).toBe(true);
		expect(notSearched.webSearchObserved).toBe(false);
	});

	it("does not infer observed search from generic dataset citations", () => {
		const result = toBrightDataScrapeResult(
			[{ answer_text: "Answer", citations: [{ url: "https://example.com/source" }] }],
			{ captureMethod: "brightdata_dataset", webSearch: true },
		);

		expect(result.webSearchObserved).toBeNull();
	});

	it("recognizes answer-bound sources on an intrinsic Google AI search surface", () => {
		const options = {
			captureMethod: "brightdata_dataset",
			webSearch: true,
			model: "google-ai-mode",
		} as Parameters<typeof toBrightDataScrapeResult>[1];
		const result = toBrightDataScrapeResult(
			[{ answer_text: "Answer", citations: [{ url: "https://example.com/source" }] }],
			options,
		);

		expect(result.webSearchObserved).toBe(true);
	});

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
		expect(result.webSearchObserved).toBe(true);
		expect(result.modelVersion).toBe("brightdata-serp");
	});
});
