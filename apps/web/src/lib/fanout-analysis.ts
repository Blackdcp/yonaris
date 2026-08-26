/**
 * Pure aggregation for the Query Fanout page. No DB or React imports, so it can
 * be unit-tested in isolation and safely imported by both the server fn and the
 * page (for its result types).
 *
 * "Query fanout" = the sub-queries an AI engine issues to the web while
 * answering a tracked prompt (`prompt_runs.web_queries`) — the single source
 * for every figure on the page, uniformly across providers. Two kinds of
 * entries are excluded as a read-time display rule (in the SQL that reads
 * web_queries, and defensively here): a query identical to the prompt (engines
 * do sometimes search the prompt verbatim — real data, kept in the DB, but a
 * repeat says nothing about how the prompt was *rewritten*, which is what this
 * page shows), and the `"unavailable"` sentinel providers write when a search
 * happened but the real query strings aren't exposed (OpenRouter and
 * DataForSEO always; BrightData/Olostep on extraction failure). So every row
 * that reaches the aggregator is a genuine expansion, and engines that never
 * expose their searches simply contribute none.
 */
import { WEB_QUERIES_UNAVAILABLE } from "@workspace/lib/constants";

// ---------------------------------------------------------------------------
// Input rows (shapes returned by postgres-read; kept here as the single source
// of truth so the server-only read layer imports these as types).
// ---------------------------------------------------------------------------

export interface FanoutBreakdownRow {
	prompt_id: string;
	model: string;
	query: string;
	count: number;
	brand_mentions: number;
}

export interface FanoutModelTotalRow {
	model: string;
	runs: number;
	/** Runs whose persisted web_queries contained a non-blank value, including the unavailable sentinel. */
	raw_query_runs: number;
	/** Runs with at least one non-sentinel query string, including prompt echoes. */
	exposed_query_runs: number;
	fanout_runs: number;
	total_queries: number;
}

/** Per-prompt run count (the denominator for avg queries per prompt run). */
export interface FanoutPromptTotalRow {
	prompt_id: string;
	runs: number;
}

// ---------------------------------------------------------------------------
// Output shapes (rendered by the page).
// ---------------------------------------------------------------------------

export interface FanoutQueryStat {
	query: string;
	count: number;
	/** % of this query's runs whose answer mentioned the brand (0..100). */
	brandMentionRate: number;
}

/** One prompt's contribution to a fan-out query (the Top Queries drill-down). */
export interface QueryPromptRef {
	promptId: string;
	promptValue: string;
	/** Run instances of this prompt that issued the query. */
	runs: number;
}

/** A fan-out query ranked by reach: how many prompts / runs issued it. */
export interface TopQueryStat {
	query: string;
	/** Distinct prompts whose runs issued this search. */
	prompts: number;
	/** Total run instances that issued it. */
	runs: number;
	/** The prompts involved, heaviest first. */
	promptRefs: QueryPromptRef[];
}

export interface TermStat {
	term: string;
	count: number;
}

/** One word's behavior in the prompt → query transformation. */
export interface WordChangeStat {
	word: string;
	/** Fan-out query instances exhibiting this change. */
	count: number;
	/** Share of all fan-out queries (0..100). */
	share: number;
	/** A stop word ("the", "for", …) — hidden by default in the UI. */
	isStop: boolean;
}

/** How prompt wording is transformed in the searches engines run. */
export interface WordChanges {
	/** Words engines add that weren't in the prompt. */
	added: WordChangeStat[];
	/** Prompt words engines leave out of the search. */
	dropped: WordChangeStat[];
	/** Prompt words engines keep in the search. */
	preserved: WordChangeStat[];
}

export interface ModelFanoutStat {
	model: string;
	runs: number;
	rawQueryRuns: number;
	exposedQueryRuns: number;
	fanoutRuns: number;
	totalQueries: number;
	/** Mean fan-out queries per run that fanned out (1 decimal). */
	avgPerExecution: number;
	topQueries: FanoutQueryStat[];
}

export interface PromptFanoutStat {
	promptId: string;
	promptValue: string;
	/** Total fan-out query instances for this prompt. */
	totalQueries: number;
	/** Distinct fan-out queries (variations). */
	uniqueQueries: number;
	/** Total runs of this prompt in the window — the denominator for avg/run. */
	runs: number;
	/** Mean fan-out queries per prompt run (1 decimal). */
	avgPerExecution: number;
	/** The fan-out queries themselves, for the per-prompt list. */
	variations: FanoutQueryStat[];
}

export interface FanoutAnalysis {
	totalQueries: number;
	uniqueQueries: number;
	fanoutRuns: number;
	totalRuns: number;
	/** Runs with any persisted query payload, including the unavailable sentinel. */
	rawQueryRuns: number;
	/** Runs with a usable query string, including exact prompt echoes. */
	exposedQueryRuns: number;
	/** Mean fan-out queries per run that fanned out (1 decimal). */
	avgPerExecution: number;
	/** Baseline brand-mention rate across all fan-out query instances (0..100). */
	coverageRate: number;
	topQueries: FanoutQueryStat[];
	terms: TermStat[];
	wordChanges: WordChanges;
	byModel: ModelFanoutStat[];
	byPrompt: PromptFanoutStat[];
	/** Queries reaching the most distinct prompts (cross-prompt searches). */
	topByPrompts: TopQueryStat[];
	/** Queries issued by the most prompt runs. */
	topByRuns: TopQueryStat[];
}

export type FanoutAvailability =
	| { kind: "no_search_enabled_runs" }
	| { kind: "queries_not_exposed"; unknownRuns: number; rawQueryRuns: number }
	| { kind: "query_exposed_no_fanout"; exposedRuns: number; unknownRuns: number }
	| { kind: "queries_available" };

export function summarizeFanoutRunExposure(
	input: Pick<FanoutAnalysis, "totalRuns" | "exposedQueryRuns" | "fanoutRuns">,
): { exposedRuns: number; unknownRuns: number; fanoutRuns: number } {
	return {
		exposedRuns: input.exposedQueryRuns,
		unknownRuns: Math.max(0, input.totalRuns - input.exposedQueryRuns),
		fanoutRuns: input.fanoutRuns,
	};
}

/**
 * Distinguishes an engine that did not run with web search from one that ran
 * but did not expose any verifiable query strings.
 */
export function describeFanoutAvailability(
	input: Pick<FanoutAnalysis, "totalRuns" | "totalQueries" | "rawQueryRuns" | "exposedQueryRuns">,
): FanoutAvailability {
	if (input.totalRuns === 0) return { kind: "no_search_enabled_runs" };
	if (input.totalQueries > 0) return { kind: "queries_available" };
	if (input.exposedQueryRuns === 0) {
		return {
			kind: "queries_not_exposed",
			unknownRuns: input.totalRuns,
			rawQueryRuns: input.rawQueryRuns,
		};
	}
	return {
		kind: "query_exposed_no_fanout",
		exposedRuns: input.exposedQueryRuns,
		unknownRuns: Math.max(0, input.totalRuns - input.exposedQueryRuns),
	};
}

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const LIMITS = {
	topQueries: 25,
	terms: 60,
	wordChanges: 60,
	perModelTop: 8,
	// Brand-wide page shows a teaser per prompt — View Details has the full list.
	variations: 10,
	breadth: 20,
};

/** Per-call overrides for the list caps (single-prompt mode raises them). */
export type FanoutLimitOverrides = Partial<typeof LIMITS>;

/**
 * Stop words for the term cloud and word-change analysis. Deliberately excludes
 * the modifiers that *are* the signal in fan-out research — "best", "top",
 * "review(s)", "vs", "comparison", year numbers — so they surface, not hide.
 */
const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"but",
	"of",
	"to",
	"in",
	"on",
	"for",
	"with",
	"by",
	"at",
	"from",
	"as",
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"do",
	"does",
	"did",
	"has",
	"have",
	"had",
	"will",
	"would",
	"can",
	"could",
	"should",
	"may",
	"might",
	"must",
	"shall",
	"what",
	"which",
	"who",
	"whom",
	"whose",
	"how",
	"when",
	"where",
	"why",
	"that",
	"this",
	"these",
	"those",
	"it",
	"its",
	"you",
	"your",
	"yours",
	"i",
	"me",
	"my",
	"we",
	"our",
	"ours",
	"they",
	"them",
	"their",
	"he",
	"she",
	"his",
	"her",
	"about",
	"into",
	"over",
	"than",
	"then",
	"there",
	"here",
	"if",
	"so",
	"not",
	"no",
	"up",
	"out",
	"off",
	"all",
	"any",
	"some",
	"more",
	"most",
	"such",
	"own",
	"too",
	"very",
	"s",
	"t",
	"re",
	"ll",
	"ve",
	"d",
	"m",
]);

/** True for stop words; the Word changes view hides these by default. */
export function isStopword(word: string): boolean {
	return STOPWORDS.has(word.toLowerCase());
}

/** Normalize a display word for keyword matching: lowercase, alphanumerics only. */
export const normTok = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface QueryTextSegmenter {
	segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
}

export interface QueryTextSlice {
	/** Exact source slice. Concatenating every slice recreates the input byte-for-byte. */
	text: string;
	/** Normalized analysis token when the slice is a supported word. */
	token?: string;
}

type IntlWithSegmenter = typeof Intl & {
	Segmenter?: new (locale: string, options: { granularity: "word" }) => QueryTextSegmenter;
};

let runtimeHanSegmenter: QueryTextSegmenter | null | undefined;

function getRuntimeHanSegmenter(): QueryTextSegmenter | null {
	if (runtimeHanSegmenter !== undefined) return runtimeHanSegmenter;
	const Segmenter = (Intl as IntlWithSegmenter).Segmenter;
	runtimeHanSegmenter = Segmenter ? new Segmenter("zh-CN", { granularity: "word" }) : null;
	return runtimeHanSegmenter;
}

const QUERY_TEXT_RUN = /\p{Script=Han}+|[\p{Script=Latin}\p{Number}]+/gu;
const HAN_RUN = /^\p{Script=Han}+$/u;

function segmentHanRun(run: string, segmenter: QueryTextSegmenter | null): QueryTextSlice[] {
	if (segmenter) {
		const segmented = [...segmenter.segment(run)]
			.filter(({ segment }) => segment.length > 0)
			.map(({ segment, isWordLike }) => ({ text: segment, token: isWordLike === false ? undefined : segment }));
		if (segmented.map(({ text }) => text).join("") === run) return segmented;
	}

	return Array.from(run, (text) => ({ text, token: text }));
}

/**
 * Splits analysis words while retaining every raw separator and code point.
 * Passing `null` selects the deterministic Han-code-point fallback; omitting
 * the dependency lazily uses the runtime's Chinese word segmenter when present.
 */
export function segmentQueryTextSlices(text: string, segmenter?: QueryTextSegmenter | null): QueryTextSlice[] {
	const resolvedSegmenter = segmenter === undefined ? getRuntimeHanSegmenter() : segmenter;
	const slices: QueryTextSlice[] = [];
	let cursor = 0;

	for (const match of text.matchAll(QUERY_TEXT_RUN)) {
		const start = match.index;
		if (start > cursor) slices.push({ text: text.slice(cursor, start) });

		const run = match[0];
		if (HAN_RUN.test(run)) {
			slices.push(...segmentHanRun(run, resolvedSegmenter));
		} else {
			const token = run.toLowerCase();
			slices.push({ text: run, token: token.length >= 2 ? token : undefined });
		}
		cursor = start + run.length;
	}

	if (cursor < text.length) slices.push({ text: text.slice(cursor) });
	return slices;
}

/** Locale-independent analysis tokens in source order. Display text is never normalized. */
export function tokenizeQueryText(text: string, segmenter?: QueryTextSegmenter | null): string[] {
	return segmentQueryTextSlices(text, segmenter).flatMap(({ token }) => (token ? [token] : []));
}

/**
 * Non-stop-word tokens from the prompt — the page bolds these in each fan-out
 * query. A possessive contributes its base form too ("Acme's" yields "acmes"
 * AND "acme"), since engines search for the bare name, which would otherwise
 * not match the prompt's possessive token.
 */
export function promptKeywords(promptValue: string): Set<string> {
	const out = new Set(tokenizeQueryText(promptValue).filter((token) => !isStopword(token)));
	for (const raw of promptValue.split(/\s+/)) {
		for (const form of [raw, raw.replace(/['’]s$/i, "")]) {
			const tok = normTok(form);
			if (tok.length > 0 && !isStopword(tok)) out.add(tok);
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase();
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Sentinel some providers store in `web_queries` when a web search happened but
 * the actual query strings aren't exposed (OpenRouter always; BrightData/Olostep
 * on extraction failure). It's not a real fan-out query — the SQL filters it, and
 * this guards the pure aggregator against any that slip through. Compare against
 * `norm`-ed (trimmed + lowercased) queries. Aliases the shared constant the
 * provider implementations write, so the two sides can't drift.
 */
export const UNAVAILABLE_SENTINEL = WEB_QUERIES_UNAVAILABLE;

type Tally = { count: number; brand: number };
function bump(map: Map<string, Tally>, key: string, count: number, brand: number) {
	const t = map.get(key);
	if (t) {
		t.count += count;
		t.brand += brand;
	} else {
		map.set(key, { count, brand });
	}
}

function toQueryStats(map: Map<string, Tally>, limit: number): FanoutQueryStat[] {
	return [...map.entries()]
		.map(([query, t]) => ({ query, count: t.count, brandMentionRate: pct(t.brand, t.count) }))
		.sort((a, b) => b.count - a.count || compareText(a.query, b.query))
		.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export function computeFanoutAnalysis(
	breakdown: FanoutBreakdownRow[],
	modelTotals: FanoutModelTotalRow[],
	promptValueMap: Map<string, string>,
	opts: {
		/** prompt id → runs that produced ≥1 web query, for per-prompt avg fan-out per run. */
		promptRuns?: Map<string, number>;
		/** Raise/lower the list caps (e.g. effectively uncapped for a single prompt). */
		limits?: FanoutLimitOverrides;
		/** Injectable for deterministic CJK analysis tests; omitted in production. */
		segmenter?: QueryTextSegmenter | null;
	} = {},
): FanoutAnalysis {
	const { promptRuns, segmenter } = opts;
	const L = { ...LIMITS, ...opts.limits };

	const overall = new Map<string, Tally>();
	/** query → prompt id → run instances (feeds the Top Queries drill-down). */
	const promptsPerQuery = new Map<string, Map<string, number>>();
	const perModel = new Map<string, Map<string, Tally>>();
	const perPrompt = new Map<string, { value: string; total: number; queries: Map<string, Tally> }>();
	const terms = new Map<string, number>();
	const added = new Map<string, number>();
	const dropped = new Map<string, number>();
	const preserved = new Map<string, number>();

	let totalQueries = 0;
	let totalBrand = 0;

	// A prompt's token set is identical for every one of its breakdown rows.
	const promptTokensByPrompt = new Map<string, Set<string>>();
	const promptTokensFor = (promptId: string, promptValue: string): Set<string> => {
		let set = promptTokensByPrompt.get(promptId);
		if (!set) {
			set = new Set(tokenizeQueryText(promptValue, segmenter));
			promptTokensByPrompt.set(promptId, set);
		}
		return set;
	};

	for (const row of breakdown) {
		const query = norm(row.query);
		const promptValue = promptValueMap.get(row.prompt_id) ?? "";
		if (!query || query === UNAVAILABLE_SENTINEL || query === norm(promptValue)) continue;
		totalQueries += row.count;
		totalBrand += row.brand_mentions;

		bump(overall, query, row.count, row.brand_mentions);

		let queryPrompts = promptsPerQuery.get(query);
		if (!queryPrompts) {
			queryPrompts = new Map();
			promptsPerQuery.set(query, queryPrompts);
		}
		queryPrompts.set(row.prompt_id, (queryPrompts.get(row.prompt_id) ?? 0) + row.count);

		if (!perModel.has(row.model)) perModel.set(row.model, new Map());
		bump(perModel.get(row.model)!, query, row.count, row.brand_mentions);

		let pp = perPrompt.get(row.prompt_id);
		if (!pp) {
			pp = { value: promptValue, total: 0, queries: new Map() };
			perPrompt.set(row.prompt_id, pp);
		}
		pp.total += row.count;
		bump(pp.queries, query, row.count, row.brand_mentions);

		// Term cloud — unigram frequency across fan-out queries, weighted by count.
		for (const tok of tokenizeQueryText(query, segmenter)) {
			if (STOPWORDS.has(tok)) continue;
			terms.set(tok, (terms.get(tok) ?? 0) + row.count);
		}

		// Word transformations — how the prompt's wording changes in this query.
		// Each fan-out query votes once per distinct token (weighted by count).
		const promptTokens = promptTokensFor(row.prompt_id, promptValue);
		const queryTokens = new Set(tokenizeQueryText(query, segmenter));
		for (const tok of queryTokens) {
			if (!promptTokens.has(tok)) added.set(tok, (added.get(tok) ?? 0) + row.count);
		}
		for (const tok of promptTokens) {
			const target = queryTokens.has(tok) ? preserved : dropped;
			target.set(tok, (target.get(tok) ?? 0) + row.count);
		}
	}

	const coverageRate = pct(totalBrand, totalQueries);
	const allQueryStats = toQueryStats(overall, overall.size);
	const topQueries = allQueryStats.slice(0, L.topQueries);

	const termStats: TermStat[] = [...terms.entries()]
		.map(([term, count]) => ({ term, count }))
		.sort((a, b) => b.count - a.count || compareText(a.term, b.term))
		.slice(0, L.terms);

	const toWordChanges = (map: Map<string, number>): WordChangeStat[] =>
		[...map.entries()]
			.map(([word, count]) => ({ word, count, share: pct(count, totalQueries), isStop: STOPWORDS.has(word) }))
			.sort((a, b) => b.count - a.count || compareText(a.word, b.word))
			.slice(0, L.wordChanges);
	const wordChanges: WordChanges = {
		added: toWordChanges(added),
		dropped: toWordChanges(dropped),
		preserved: toWordChanges(preserved),
	};

	const byModel: ModelFanoutStat[] = modelTotals
		.filter((m) => m.runs > 0)
		.map((m) => ({
			model: m.model,
			runs: m.runs,
			rawQueryRuns: m.raw_query_runs,
			exposedQueryRuns: m.exposed_query_runs,
			fanoutRuns: m.fanout_runs,
			totalQueries: m.total_queries,
			avgPerExecution: m.fanout_runs > 0 ? Math.round((m.total_queries / m.fanout_runs) * 10) / 10 : 0,
			topQueries: perModel.has(m.model) ? toQueryStats(perModel.get(m.model)!, L.perModelTop) : [],
		}))
		.sort((a, b) => b.totalQueries - a.totalQueries || b.runs - a.runs);

	// Every prompt that produced fan-out (no cap) — the Prompts tab searches and
	// sorts the full set client-side; `variations` per prompt is still bounded.
	const byPrompt: PromptFanoutStat[] = [...perPrompt.entries()]
		.map(([promptId, pp]) => {
			const runs = promptRuns?.get(promptId) ?? 0;
			return {
				promptId,
				promptValue: pp.value,
				totalQueries: pp.total,
				uniqueQueries: pp.queries.size,
				runs,
				avgPerExecution: runs > 0 ? Math.round((pp.total / runs) * 10) / 10 : 0,
				variations: toQueryStats(pp.queries, L.variations),
			};
		})
		.sort((a, b) => b.totalQueries - a.totalQueries);

	// Breadth framing — the searches that matter beyond a single prompt, with
	// the prompts behind each one so the list can drill down like the
	// Prompt Fan-Out accordion (just inverted: query → prompts).
	const breadthStats: TopQueryStat[] = [...overall.entries()].map(([query, t]) => {
		const per = promptsPerQuery.get(query) ?? new Map<string, number>();
		const promptRefs: QueryPromptRef[] = [...per.entries()]
			.map(([promptId, runs]) => ({ promptId, promptValue: promptValueMap.get(promptId) ?? "", runs }))
			.sort((a, b) => b.runs - a.runs || compareText(a.promptValue, b.promptValue));
		return { query, prompts: per.size, runs: t.count, promptRefs };
	});
	const topByPrompts = [...breadthStats]
		.sort((a, b) => b.prompts - a.prompts || b.runs - a.runs || compareText(a.query, b.query))
		.slice(0, L.breadth);
	const topByRuns = [...breadthStats]
		.sort((a, b) => b.runs - a.runs || b.prompts - a.prompts || compareText(a.query, b.query))
		.slice(0, L.breadth);

	const totalRuns = modelTotals.reduce((s, m) => s + m.runs, 0);
	const rawQueryRuns = modelTotals.reduce((s, m) => s + m.raw_query_runs, 0);
	const exposedQueryRuns = modelTotals.reduce((s, m) => s + m.exposed_query_runs, 0);
	const fanoutRuns = modelTotals.reduce((s, m) => s + m.fanout_runs, 0);

	return {
		totalQueries,
		uniqueQueries: overall.size,
		fanoutRuns,
		totalRuns,
		rawQueryRuns,
		exposedQueryRuns,
		avgPerExecution: fanoutRuns > 0 ? Math.round((totalQueries / fanoutRuns) * 10) / 10 : 0,
		coverageRate,
		topQueries,
		terms: termStats,
		wordChanges,
		byModel,
		byPrompt,
		topByPrompts,
		topByRuns,
	};
}
