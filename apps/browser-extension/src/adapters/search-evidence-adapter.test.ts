import { describe, expect, test } from "vitest";
import deepSeekContract from "../selector-contracts/deepseek-web-v1.json";
import { createConsumerAdapter } from "./consumer-adapter";
import type { SelectorContract } from "./contracts";
import type { SearchEvidenceAdapter, SearchEvidenceResult } from "./search-evidence-adapter";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("surface-specific search evidence adapter boundary", () => {
	test.each([
		[
			"exposed",
			{
				webSearchObserved: true,
				queryAvailability: "exposed",
				webQueries: ["provider rewrite"],
				citations: [],
			},
		],
		["unavailable", { webSearchObserved: true, queryAvailability: "unavailable", webQueries: [], citations: [] }],
		["not_searched", { webSearchObserved: false, queryAvailability: "not_searched", webQueries: [], citations: [] }],
		[
			"unknown",
			{
				webSearchObserved: null,
				queryAvailability: "unknown",
				webQueries: [],
				citations: [{ url: "https://example.com/", title: "Visible source" }],
			},
		],
	] as const)("maps %s evidence without changing the accepted answer", async (_label, partial) => {
		const adapter = createConsumerAdapter(
			new FixtureDomPort(
				createAdapterFixture({
					initiallySubmitted: true,
					pageUrl: "https://chat.deepseek.com/a/chat/s/test-session",
					submittedPrompt: "Prompt A",
					generatingDurationMs: 0,
					completionReadyDelayMs: 0,
				}),
			),
			deepSeekContract as SelectorContract,
			fixedEvidenceAdapter(partial),
		);
		await adapter.resumeSubmitted("Prompt A");

		const collected = await adapter.collectCurrentAnswer();

		expect(collected.answerText).toBe("Current answer");
		expect(collected).toMatchObject(partial);
		expect(collected.searchEvidenceDiagnostics).toMatchObject({
			extractorVersion: "test-evidence-v1",
			evidenceSource: "dom",
		});
	});

	test("preserves the accepted answer and independently valid direct citations when evidence extraction throws", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				initiallySubmitted: true,
				pageUrl: "https://chat.deepseek.com/a/chat/s/test-session",
				submittedPrompt: "Prompt A",
				generatingDurationMs: 0,
				completionReadyDelayMs: 0,
				answer: {
					text: "Current answer",
					html: "<div>Current answer</div>",
					citations: [{ url: "https://example.com/", title: "Visible source" }],
				},
			}),
		);
		const adapter = createConsumerAdapter(port, deepSeekContract as SelectorContract, {
			version: "throwing-evidence-v1",
			read: async () => {
				throw new Error("provider DOM drift");
			},
		});
		await adapter.resumeSubmitted("Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
			webSearchObserved: null,
			queryAvailability: "unknown",
			webQueries: [],
			citations: [{ url: "https://example.com/", title: "Visible source" }],
			searchEvidenceDiagnostics: {
				extractorVersion: "throwing-evidence-v1",
				evidenceSource: "none",
				searchBlockCount: 0,
				queryCandidateCount: 0,
				citationCandidateCount: 1,
			},
		});
	});

	test("preserves extractor candidate counts after accepted values are normalized", async () => {
		const adapter = createConsumerAdapter(
			new FixtureDomPort(
				createAdapterFixture({
					initiallySubmitted: true,
					pageUrl: "https://chat.deepseek.com/a/chat/s/test-session",
					submittedPrompt: "Prompt A",
					generatingDurationMs: 0,
					completionReadyDelayMs: 0,
				}),
			),
			deepSeekContract as SelectorContract,
			{
				version: "candidate-count-v1",
				read: async () => ({
					webSearchObserved: true,
					queryAvailability: "exposed",
					webQueries: ["same query", "same query"],
					citations: [
						{ url: "https://example.com/source", title: "Source" },
						{ url: "https://example.com/source", title: "Source" },
					],
					diagnostics: {
						extractorVersion: "candidate-count-v1",
						evidenceSource: "dom",
						searchBlockCount: 1,
						queryCandidateCount: 2,
						citationCandidateCount: 2,
					},
				}),
			},
		);
		await adapter.resumeSubmitted("Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			webQueries: ["same query"],
			citations: [{ url: "https://example.com/source", title: "Source" }],
			searchEvidenceDiagnostics: { queryCandidateCount: 2, citationCandidateCount: 2 },
		});
	});
});

function fixedEvidenceAdapter(partial: {
	readonly webSearchObserved: SearchEvidenceResult["webSearchObserved"];
	readonly queryAvailability: SearchEvidenceResult["queryAvailability"];
	readonly webQueries: readonly string[];
	readonly citations: readonly SearchEvidenceResult["citations"][number][];
}): SearchEvidenceAdapter {
	return {
		version: "test-evidence-v1",
		read: async () => ({
			...partial,
			webQueries: [...partial.webQueries],
			citations: [...partial.citations],
			diagnostics: {
				extractorVersion: "test-evidence-v1",
				evidenceSource: "dom",
				searchBlockCount: partial.webSearchObserved === true ? 1 : 0,
				queryCandidateCount: partial.webQueries.length,
				citationCandidateCount: partial.citations.length,
			},
		}),
	};
}
