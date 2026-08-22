import { createHash } from "node:crypto";
import { WEB_QUERIES_UNAVAILABLE } from "@workspace/lib/constants";
import type { ScrapeResult } from "@workspace/lib/providers/types";

export type ProviderQualificationInput = {
	channel: string;
	provider: string;
	captureRouteKey: string;
	prompt: string;
	latencyMs: number;
	result: ScrapeResult;
};

export type ProviderQualificationResult = {
	channel: string;
	provider: string;
	captureRouteKey: string;
	latencyMs: number;
	answerPresent: boolean;
	webSearchObserved: boolean | null;
	rawQueryCount: number;
	exposedQueryCount: number;
	genuineQueryCount: number;
	citationCount: number;
	uniqueDomainCount: number;
	invalidCitationCount: number;
	responseShape: string[];
	providerSubmissionId: string | null;
	rawPayloadSha256: string;
};

export const OVERSEAS_SEARCH_EVIDENCE_PROMPT =
	"Compare current enterprise AI inference platforms using recent public sources.";

export const OVERSEAS_SEARCH_EVIDENCE_MATRIX = [
	{ channel: "chatgpt.consumer_web", model: "chatgpt", provider: "brightdata" },
	{ channel: "chatgpt.consumer_web", model: "chatgpt", provider: "dataforseo" },
	{ channel: "chatgpt.consumer_web", model: "chatgpt", provider: "olostep" },
	{ channel: "chatgpt.consumer_web", model: "chatgpt", provider: "oxylabs" },
	{ channel: "copilot.consumer_web", model: "copilot", provider: "brightdata" },
	{ channel: "copilot.consumer_web", model: "copilot", provider: "olostep" },
	{ channel: "gemini.consumer_web", model: "gemini", provider: "brightdata" },
	{ channel: "gemini.consumer_web", model: "gemini", provider: "dataforseo" },
	{ channel: "gemini.consumer_web", model: "gemini", provider: "olostep" },
	{ channel: "google_search.ai_mode", model: "google-ai-mode", provider: "brightdata" },
	{ channel: "google_search.ai_mode", model: "google-ai-mode", provider: "dataforseo" },
	{ channel: "google_search.ai_mode", model: "google-ai-mode", provider: "olostep" },
	{ channel: "google_search.ai_mode", model: "google-ai-mode", provider: "oxylabs" },
	{ channel: "google_search.ai_overview", model: "google-ai-overview", provider: "brightdata" },
	{ channel: "google_search.ai_overview", model: "google-ai-overview", provider: "dataforseo" },
	{ channel: "google_search.ai_overview", model: "google-ai-overview", provider: "olostep" },
	{ channel: "google_search.ai_overview", model: "google-ai-overview", provider: "oxylabs" },
	{ channel: "perplexity.consumer_web", model: "perplexity", provider: "brightdata" },
	{ channel: "perplexity.consumer_web", model: "perplexity", provider: "dataforseo" },
	{ channel: "perplexity.consumer_web", model: "perplexity", provider: "olostep" },
	{ channel: "perplexity.consumer_web", model: "perplexity", provider: "oxylabs" },
] as const;

export function qualifyProviderResult(input: ProviderQualificationInput): ProviderQualificationResult {
	const exposedQueries = uniqueQueries(
		input.result.webQueries.filter((query) => query.trim() && query !== WEB_QUERIES_UNAVAILABLE),
	);
	const normalizedPrompt = normalizeQuery(input.prompt);
	const genuineQueries = exposedQueries.filter((query) => normalizeQuery(query) !== normalizedPrompt);
	const citationEvidence = inspectCitations(input.result.citations);
	const rawPayload = JSON.stringify(input.result.rawOutput) ?? "undefined";

	return {
		channel: input.channel,
		provider: input.provider,
		captureRouteKey: input.captureRouteKey,
		latencyMs: input.latencyMs,
		answerPresent: input.result.textContent.trim().length > 0,
		webSearchObserved: input.result.webSearchObserved ?? null,
		rawQueryCount: input.result.webQueries.length,
		exposedQueryCount: exposedQueries.length,
		genuineQueryCount: genuineQueries.length,
		citationCount: input.result.citations.length,
		uniqueDomainCount: citationEvidence.uniqueDomainCount,
		invalidCitationCount: citationEvidence.invalidCitationCount,
		responseShape: responseShape(input.result.rawOutput),
		providerSubmissionId: input.result.providerSubmissionId ?? null,
		rawPayloadSha256: createHash("sha256").update(rawPayload).digest("hex"),
	};
}

function normalizeQuery(value: string): string {
	return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function uniqueQueries(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = normalizeQuery(value);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(value.trim());
	}
	return result;
}

function inspectCitations(citations: ScrapeResult["citations"]): {
	uniqueDomainCount: number;
	invalidCitationCount: number;
} {
	const domains = new Set<string>();
	let invalidCitationCount = 0;
	for (const citation of citations) {
		try {
			const url = new URL(citation.url);
			if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
				invalidCitationCount += 1;
				continue;
			}
			domains.add(url.hostname.replace(/^www\./, "").toLowerCase());
		} catch {
			invalidCitationCount += 1;
		}
	}
	return { uniqueDomainCount: domains.size, invalidCitationCount };
}

function responseShape(value: unknown): string[] {
	const paths = new Set<string>();
	visitShape(value, "$", 0, paths);
	return [...paths].sort().slice(0, 2_000);
}

function visitShape(value: unknown, path: string, depth: number, paths: Set<string>): void {
	if (paths.size >= 2_000) return;
	const type = valueType(value);
	paths.add(`${path}:${type}`);
	if (depth >= 8 || value === null || typeof value !== "object") return;

	if (Array.isArray(value)) {
		for (const item of value) {
			visitShape(item, `${path}[]`, depth + 1, paths);
			if (paths.size >= 2_000) return;
		}
		return;
	}

	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		visitShape((value as Record<string, unknown>)[key], `${path}.${safeShapeKey(key)}`, depth + 1, paths);
		if (paths.size >= 2_000) return;
	}
}

function safeShapeKey(key: string): string {
	return /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/.test(key) ? key : "[redacted_key]";
}

function valueType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}
