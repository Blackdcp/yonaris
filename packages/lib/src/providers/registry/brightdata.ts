import { createHash } from "node:crypto";
import { bdclient } from "@brightdata/sdk";
import { WEB_QUERIES_UNAVAILABLE } from "../../constants";
import { getCredential } from "../../secrets";
import { type Citation, extractCitationsFromBrightdata, extractTextFromBrightdata } from "../../text-extraction";
import type { ModelConfig, Provider, ProviderOptions, ScrapeResult } from "../types";

// Google AI Overview isn't a Web Scraper dataset — it's the AI summary block on
// a normal Google results page, fetched through BrightData's SERP API instead of
// the datasets/v3 collectors below.
const AI_OVERVIEW_MODEL = "google-ai-overview";

const BD_DATASET_IDS: Record<string, string> = {
	chatgpt: "gd_m7aof0k82r803d5bjm",
	perplexity: "gd_m7dhdot1vw9a7gc1n",
	copilot: "gd_m7di5jy6s9geokz8w",
	gemini: "gd_mbz66arm2mf9cu856y",
	"google-ai-mode": "gd_mcswdt6z2elth3zqr2",
};

const BD_BASE_URL: Record<string, string> = {
	chatgpt: "https://chatgpt.com/",
	"google-ai-mode": "https://google.com/aimode",
	gemini: "https://gemini.google.com/",
	copilot: "https://copilot.microsoft.com/chats",
	perplexity: "https://www.perplexity.ai/",
};

function createClient(): bdclient {
	return new bdclient({ apiKey: getCredential("BRIGHTDATA_API_TOKEN") });
}

type BrightDataZoneClient = {
	listZones(): Promise<Array<{ name: string; type: string; status?: string | null }>>;
	close(): Promise<void>;
};

function createReadOnlyZoneClient(): BrightDataZoneClient {
	return new bdclient({ apiKey: getCredential("BRIGHTDATA_API_TOKEN"), autoCreateZones: false });
}

const BRIGHTDATA_REQUEST_URL = "https://api.brightdata.com/request";

export class BrightDataProviderError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "BrightDataProviderError";
		this.code = code;
	}
}

/** Google AI Overview uses a customer-owned SERP zone. A fallback zone is unsafe:
 * it can be absent from an account and turns one invalid batch into repeated 400s. */
export function requireGoogleAiOverviewSerpZone(environment: Record<string, string | undefined> = process.env): string {
	const zone = environment.BRIGHTDATA_SERP_ZONE?.trim();
	if (!zone) {
		throw new BrightDataProviderError(
			"brightdata_serp_zone_unavailable",
			"Google AI Overview is unavailable: configure BRIGHTDATA_SERP_ZONE for this Bright Data account",
		);
	}
	return zone;
}

/**
 * A zone listing is an account metadata request, not a SERP collection. Keep
 * the SDK's zone auto-create feature disabled so this preflight cannot create
 * or bill a zone as a side effect.
 */
export async function preflightGoogleAiOverviewSerpZone(
	dependencies: { zone?: string; createClient?: () => BrightDataZoneClient } = {},
): Promise<void> {
	const zone = dependencies.zone ?? requireGoogleAiOverviewSerpZone();
	const client = (dependencies.createClient ?? createReadOnlyZoneClient)();
	try {
		const zones = await client.listZones();
		const activeSerpZone = zones.some(
			(candidate) =>
				candidate.name === zone &&
				candidate.type === "serp" &&
				(candidate.status == null || candidate.status === "active"),
		);
		if (!activeSerpZone) {
			throw new BrightDataProviderError(
				"brightdata_serp_zone_unavailable",
				"Google AI Overview is unavailable: the configured Bright Data SERP zone is missing or inactive",
			);
		}
	} catch (error) {
		if (error instanceof BrightDataProviderError) throw error;
		throw new BrightDataProviderError(
			"brightdata_serp_zone_unavailable",
			"Google AI Overview is unavailable: Bright Data active SERP zones could not be verified",
		);
	} finally {
		try {
			await client.close();
		} catch {
			// The metadata preflight has already completed; SDK cleanup must not mask its result.
		}
	}
}

type BrightDataSerpResponse = { ok: boolean; status: number; text(): Promise<string> };

export async function requestGoogleAiOverviewSerp(input: {
	zone: string;
	request: () => Promise<BrightDataSerpResponse>;
	sleep?: (milliseconds: number) => Promise<void>;
}): Promise<ScrapeResult> {
	const response = await input.request();
	const text = await response.text();

	if (response.status === 400) {
		if (/\bzone\b[\s\S]*\bnot found\b/i.test(text)) {
			throw new BrightDataProviderError(
				"brightdata_serp_zone_unavailable",
				"Google AI Overview is unavailable: the configured Bright Data SERP zone was not found",
			);
		}
		throw new BrightDataProviderError(
			"brightdata_serp_request_rejected",
			"Google AI Overview request was rejected by Bright Data (HTTP 400)",
		);
	}

	let parsed: unknown;
	if (response.ok && text.trim()) {
		try {
			parsed = JSON.parse(text);
		} catch {
			// Without a provider idempotency token, retrying the POST could create another paid collection.
		}
	}

	if (parsed !== undefined) {
		return toBrightDataScrapeResult(parsed, {
			captureMethod: "brightdata_serp",
			webSearch: true,
			modelVersion: "brightdata-serp",
		});
	}

	const failureSummary = `${response.status} ${text.slice(0, 200)}`.trim();
	throw new BrightDataProviderError(
		"brightdata_serp_request_failed",
		`BrightData SERP request failed without retry — ${failureSummary}`,
	);
}

/**
 * Fetch Google's AI Overview through BrightData's SERP API. AI Overview is the
 * AI summary block on a normal results page, so we request a US-English Google
 * SERP as parsed JSON (`brd_json=1`) with `brd_ai_overview=2` — the flag that
 * makes BrightData surface the overview; without it AIO shows up in only a
 * fraction of SERPs. This runs through the explicitly configured customer SERP
 * zone, billed to the same BRIGHTDATA_API_TOKEN — no dataset id or extra
 * credential. The parsed SERP carries an `ai_overview` object when Google shows
 * one.
 */
async function runGoogleAiOverview(prompt: string): Promise<ScrapeResult> {
	const zone = requireGoogleAiOverviewSerpZone();
	const url = `https://www.google.com/search?q=${encodeURIComponent(prompt)}&brd_json=1&brd_ai_overview=2&gl=us&hl=en`;
	return requestGoogleAiOverviewSerp({
		zone,
		request: () =>
			fetch(BRIGHTDATA_REQUEST_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${getCredential("BRIGHTDATA_API_TOKEN")}`,
					"Content-Type": "application/json",
				},
				// `method: "GET"` tells BrightData how to fetch the target URL — without
				// it the response comes back empty. `format: "raw"` returns the brd_json
				// SERP directly as the body.
				body: JSON.stringify({ zone, url, method: "GET", format: "raw" }),
			}),
	});
}

function normalizeAnswer(record: Record<string, any>): string {
	for (const key of ["answer_text_markdown", "answer_text", "answer", "response_raw", "response", "text", "content"]) {
		if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
	}
	return JSON.stringify(record).slice(0, 2000);
}

function extractSources(record: Record<string, any>): Citation[] {
	const citations: Citation[] = [];
	const seen = new Set<string>();
	let idx = 0;

	for (const field of ["citations", "links_attached", "sources"]) {
		const arr = record[field];
		if (!Array.isArray(arr)) continue;
		for (const item of arr) {
			const url = typeof item === "string" ? item : item?.url;
			if (!url || typeof url !== "string" || !url.startsWith("http")) continue;
			if (seen.has(url)) continue;
			seen.add(url);
			try {
				const parsed = new URL(url);
				citations.push({
					url,
					title: item?.title ?? undefined,
					domain: parsed.hostname.replace(/^www\./, ""),
					citationIndex: idx++,
				});
			} catch (e) {
				console.warn(`BrightData: skipping invalid citation URL: ${url}`, e);
			}
		}
	}
	return citations;
}

function extractWebQueries(record: Record<string, any>): string[] {
	// web_search_query is a direct array of strings
	if (Array.isArray(record.web_search_query)) {
		return record.web_search_query.filter((q: any) => typeof q === "string" && q.trim());
	}
	// search_model_queries may be nested in metadata (e.g. chatgpt)
	const smq = record.metadata?.search_model_queries ?? record.search_model_queries;
	if (smq?.queries && Array.isArray(smq.queries)) {
		return smq.queries.filter((q: any) => typeof q === "string" && q.trim());
	}
	if (Array.isArray(smq)) {
		return smq.filter((q: any) => typeof q === "string" && q.trim());
	}
	return [];
}

export function toBrightDataScrapeResult(
	payload: unknown,
	options: {
		captureMethod: "brightdata_dataset" | "brightdata_serp";
		webSearch: boolean;
		modelVersion?: string;
		providerSubmissionId?: string;
	},
): ScrapeResult {
	const record = ((Array.isArray(payload) ? payload[0] : payload) ?? {}) as Record<string, any>;
	const citations =
		options.captureMethod === "brightdata_serp" ? extractCitationsFromBrightdata(payload) : extractSources(record);
	const extractedQueries = options.captureMethod === "brightdata_serp" ? [] : extractWebQueries(record);
	const textContent =
		options.captureMethod === "brightdata_serp" ? extractTextFromBrightdata(payload) : normalizeAnswer(record);
	const nativeHtml = firstNonemptyString(record.answer_html, record.answer_section_html);
	const {
		answer_html: _answerHtml,
		response_raw: _responseRaw,
		answer_section_html: _answerSectionHtml,
		...trimmed
	} = record;

	return {
		rawOutput: Array.isArray(payload) ? [trimmed] : trimmed,
		textContent,
		webQueries: options.webSearch
			? extractedQueries.length > 0
				? extractedQueries
				: citations.length > 0
					? [WEB_QUERIES_UNAVAILABLE]
					: []
			: [],
		citations,
		modelVersion: options.modelVersion ?? (typeof record.model === "string" ? record.model : undefined),
		providerSubmissionId: options.providerSubmissionId,
		snapshotSource: {
			captureMethod: options.captureMethod,
			contentSource: nativeHtml ? "native_answer_html" : "rendered_from_structured_response",
			...(nativeHtml ? { answerHtml: nativeHtml } : {}),
			sourcePayloadSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
		},
	};
}

function firstNonemptyString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value;
	}
	return undefined;
}

export const brightdata: Provider = {
	id: "brightdata",
	name: "BrightData",

	isConfigured() {
		return !!getCredential("BRIGHTDATA_API_TOKEN");
	},

	validateTarget(config: ModelConfig) {
		// Google AI Overview goes through the SERP API, not a dataset collector.
		if (config.model === AI_OVERVIEW_MODEL) {
			if (!config.webSearch) {
				return `${config.model}:brightdata requires :online — AI Overview always uses web search`;
			}
			try {
				requireGoogleAiOverviewSerpZone();
			} catch (error) {
				return error instanceof Error ? error.message : "Google AI Overview is unavailable";
			}
			return null;
		}
		// Allow custom dataset IDs via version slug (e.g. chatgpt:brightdata:gd_abc123)
		if (!config.version && !BD_DATASET_IDS[config.model]) {
			return `BrightData does not support model "${config.model}". Supported: ${[...Object.keys(BD_DATASET_IDS), AI_OVERVIEW_MODEL].join(", ")}`;
		}
		// ChatGPT has a web search toggle; all other chatbots always search
		if (!config.webSearch && config.model !== "chatgpt") {
			return `${config.model}:brightdata requires :online — this chatbot always uses web search`;
		}
		return null;
	},

	async preflightTarget(config: ModelConfig) {
		if (config.model !== AI_OVERVIEW_MODEL) return null;
		const targetError = this.validateTarget?.(config);
		if (targetError) return targetError;
		try {
			await preflightGoogleAiOverviewSerpZone();
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : "Google AI Overview is unavailable";
		}
	},

	async run(model: string, prompt: string, options?: ProviderOptions): Promise<ScrapeResult> {
		if (model === AI_OVERVIEW_MODEL) {
			return runGoogleAiOverview(prompt);
		}

		const datasetId = options?.version ?? BD_DATASET_IDS[model];
		if (!datasetId) {
			throw new Error(
				`BrightData: no dataset ID for model "${model}". ` +
					`Either use a known model (${Object.keys(BD_DATASET_IDS).join(", ")}) ` +
					`or pass a dataset ID as the version slug: ${model}:brightdata:gd_abc123`,
			);
		}

		const client = createClient();
		let snapshotId: string | undefined;
		let consumed = false;
		try {
			const triggerRes = await fetch(
				`https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&notify=false&include_errors=true&format=json`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${getCredential("BRIGHTDATA_API_TOKEN")}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify([
						{
							url: BD_BASE_URL[model] ?? "",
							prompt,
							index: 1,
							...(model === "chatgpt" ? { web_search: options?.webSearch ?? false } : {}),
						},
					]),
				},
			);

			if (!triggerRes.ok) {
				throw new Error(`BrightData trigger failed (${triggerRes.status}): ${await triggerRes.text()}`);
			}

			({ snapshot_id: snapshotId } = (await triggerRes.json()) as { snapshot_id: string });
			if (!snapshotId) throw new Error("BrightData trigger returned no snapshot ID");
			await pollUntilReady(snapshotId);
			const readySnapshotId = snapshotId;
			const payload = await fetchBrightDataSnapshotWhenReady(() =>
				client.scrape.snapshot.fetch(readySnapshotId, { format: "json" }),
			);
			consumed = true;

			return toBrightDataScrapeResult(payload, {
				captureMethod: "brightdata_dataset",
				webSearch: options?.webSearch ?? false,
				providerSubmissionId: snapshotId,
			});
		} finally {
			// A triggered snapshot we never consumed (timeout, terminal failure, an
			// unknown status we gave up on, or any thrown error) keeps running on
			// BrightData and counts against the per-dataset concurrency cap — which
			// eventually 429s even healthy triggers. Best-effort cancel so abandoned
			// jobs don't accumulate. (Worker SIGTERM mid-poll still leaks; those need
			// the periodic snapshot sweep.)
			if (snapshotId && !consumed) await cancelSnapshot(client, snapshotId);
			await client.close();
		}
	},
};

/** Terminal failure statuses from datasets/v3/progress. Anything else —
 *  running, building, "starting", queued, or a status BrightData adds later —
 *  is treated as "still working" so a degraded scraper or an unrecognized
 *  status string doesn't fail the run on the very first poll. */
const TERMINAL_FAILURE = new Set(["failed", "error", "cancelled"]);

async function pollUntilReady(snapshotId: string): Promise<void> {
	const maxAttempts = 60;
	const BASE_DELAY = 2000;
	const MAX_DELAY = 10000;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const status = await getSnapshotStatus(snapshotId);
		if (status === "ready") return;
		if (TERMINAL_FAILURE.has(status)) {
			throw new Error(`BrightData snapshot ${snapshotId} ${status}`);
		}

		const delay = Math.min(BASE_DELAY * 2 ** Math.floor(attempt / 5), MAX_DELAY);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	throw new Error(`BrightData snapshot ${snapshotId} timed out`);
}

export async function fetchBrightDataSnapshotWhenReady<T>(
	fetchSnapshot: () => Promise<T>,
	sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
		new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
	let lastError: Error | undefined;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return await fetchSnapshot();
		} catch (error) {
			if (!isSnapshotNotReadyError(error)) throw error;
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < 2) await sleep(1000 * (attempt + 1));
		}
	}
	throw new BrightDataProviderError(
		"brightdata_snapshot_not_ready",
		lastError?.message ?? "BrightData snapshot is not ready yet, please try again later",
	);
}

function isSnapshotNotReadyError(error: unknown): boolean {
	return error instanceof Error && /snapshot is not ready yet/i.test(error.message);
}

/** Read snapshot status straight from datasets/v3/progress. We bypass the SDK's
 *  getStatus because its response schema is a strict enum
 *  (running|ready|failed|cancelled|error) that throws on any other value — and the
 *  live API also returns statuses like "starting", which would otherwise fail the
 *  run instantly instead of waiting. A transient HTTP/parse error is reported as a
 *  non-terminal status so we keep polling rather than abandon the snapshot. */
async function getSnapshotStatus(snapshotId: string): Promise<string> {
	try {
		const res = await fetch(`https://api.brightdata.com/datasets/v3/progress/${snapshotId}`, {
			headers: { Authorization: `Bearer ${getCredential("BRIGHTDATA_API_TOKEN")}` },
		});
		if (!res.ok) return "pending";
		const body = (await res.json()) as { status?: string };
		return body.status ?? "pending";
	} catch {
		return "pending";
	}
}

/** Best-effort cancel of a triggered snapshot we're abandoning, so it stops
 *  counting against BrightData's per-dataset running-jobs cap. Cancellation is
 *  cleanup, not part of the run's success path, so errors are swallowed. */
async function cancelSnapshot(client: bdclient, snapshotId: string): Promise<void> {
	try {
		await client.scrape.snapshot.cancel(snapshotId);
	} catch (e) {
		console.warn(`BrightData: failed to cancel snapshot ${snapshotId}`, e);
	}
}
