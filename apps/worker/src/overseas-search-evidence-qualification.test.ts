import assert from "node:assert/strict";
import test from "node:test";
import type { ScrapeResult } from "@workspace/lib/providers/types";
import {
	OVERSEAS_SEARCH_EVIDENCE_MATRIX,
	qualifyProviderResult,
} from "./overseas-search-evidence-qualification.js";

const PROMPT = "Compare enterprise inference providers";

function result(overrides: Partial<ScrapeResult> = {}): ScrapeResult {
	return {
		textContent: "A private answer that must never enter the report.",
		rawOutput: {
			web_search_query: ["Compare enterprise inference providers", "regional GPU availability"],
			answer: { text: "secret answer payload" },
			metadata: { search_used: true, latency: 123 },
		},
		webQueries: [PROMPT, "unavailable", "regional GPU availability", "regional GPU availability", "  "],
		webSearchObserved: true,
		citations: [
			{
				url: "https://example.com/private-source?token=secret",
				title: "Private source",
				domain: "example.com",
				citationIndex: 0,
			},
			{
				url: "https://docs.example.org/source",
				title: "Docs",
				domain: "docs.example.org",
				citationIndex: 1,
			},
			{
				url: "not-a-url",
				title: "Invalid",
				domain: "",
				citationIndex: 2,
			},
		],
		providerSubmissionId: "provider-job-123",
		...overrides,
	};
}

test("separates raw, exposed, and genuine query counts", () => {
	const report = qualifyProviderResult({
		channel: "chatgpt.consumer_web",
		provider: "brightdata",
		captureRouteKey: "brightdata.dataset",
		prompt: PROMPT,
		latencyMs: 234,
		result: result(),
	});

	assert.equal(report.rawQueryCount, 5);
	assert.equal(report.exposedQueryCount, 2);
	assert.equal(report.genuineQueryCount, 1);
	assert.equal(report.webSearchObserved, true);
	assert.equal(report.citationCount, 3);
	assert.equal(report.uniqueDomainCount, 2);
	assert.equal(report.invalidCitationCount, 1);
});

test("emits only redacted response shape and hashes", () => {
	const input = {
		channel: "chatgpt.consumer_web",
		provider: "brightdata",
		captureRouteKey: "brightdata.dataset",
		prompt: PROMPT,
		latencyMs: 234,
		result: result(),
	};
	const first = qualifyProviderResult(input);
	const second = qualifyProviderResult(input);
	const serialized = JSON.stringify(first);

	assert.equal(first.rawPayloadSha256, second.rawPayloadSha256);
	assert.match(first.rawPayloadSha256, /^[a-f0-9]{64}$/);
	assert.ok(first.responseShape.includes("$.web_search_query:array"));
	assert.ok(first.responseShape.includes("$.metadata.search_used:boolean"));
	assert.ok(!serialized.includes(PROMPT));
	assert.ok(!serialized.includes("private answer"));
	assert.ok(!serialized.includes("example.com/private-source"));
	assert.ok(!serialized.includes("secret answer payload"));
	assert.equal(first.providerSubmissionId, "provider-job-123");
});

test("bounds response-shape traversal depth and path count", () => {
	const wide = Object.fromEntries(Array.from({ length: 2_100 }, (_, index) => [`field_${index}`, index]));
	const deep = { a: { b: { c: { d: { e: { f: { g: { h: { secret: "not traversed" } } } } } } } } };
	const report = qualifyProviderResult({
		channel: "gemini.consumer_web",
		provider: "olostep",
		captureRouteKey: "olostep.batch",
		prompt: PROMPT,
		latencyMs: 1,
		result: result({ rawOutput: { wide, deep } }),
	});

	assert.ok(report.responseShape.length <= 2_000);
	assert.ok(!report.responseShape.some((path) => path.includes("secret")));
});

test("redacts dynamic payload keys that could contain prompt text", () => {
	const report = qualifyProviderResult({
		channel: "gemini.consumer_web",
		provider: "dataforseo",
		captureRouteKey: "dataforseo.llm",
		prompt: PROMPT,
		latencyMs: 1,
		result: result({ rawOutput: { [PROMPT]: { value: true } } }),
	});

	assert.ok(!JSON.stringify(report).includes(PROMPT));
	assert.ok(report.responseShape.some((path) => path.includes("[redacted_key]")));
});

test("declares the exact supported 21-call qualification matrix", () => {
	assert.equal(OVERSEAS_SEARCH_EVIDENCE_MATRIX.length, 21);
	assert.equal(new Set(OVERSEAS_SEARCH_EVIDENCE_MATRIX.map((entry) => `${entry.channel}:${entry.provider}`)).size, 21);
	assert.deepEqual(
		OVERSEAS_SEARCH_EVIDENCE_MATRIX.filter((entry) => entry.channel === "copilot.consumer_web").map(
			(entry) => entry.provider,
		),
		["brightdata", "olostep"],
	);
});
