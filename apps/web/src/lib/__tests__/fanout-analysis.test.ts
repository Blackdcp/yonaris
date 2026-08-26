import { describe, expect, it } from "vitest";
import {
	computeFanoutAnalysis,
	describeFanoutAvailability,
	type FanoutAnalysis,
	type FanoutBreakdownRow,
	type FanoutModelTotalRow,
	normTok,
	promptKeywords,
	type QueryTextSegmenter,
	summarizeFanoutRunExposure,
	tokenizeQueryText,
	UNAVAILABLE_SENTINEL,
} from "@/lib/fanout-analysis";

const fakeSegmenter: QueryTextSegmenter = {
	segment(input) {
		const words: Record<string, string[]> = {
			适合家庭出游的新能源: ["适合", "家庭", "出游", "的", "新能源"],
			北京: ["北京"],
			万: ["万"],
			推荐: ["推荐"],
			家庭: ["家庭"],
			家庭新能源: ["家庭", "新能源"],
			新能源: ["新能源"],
		};
		return (words[input] ?? Array.from(input)).map((segment) => ({ segment, isWordLike: true }));
	},
};

describe("tokenizeQueryText", () => {
	it("segments Chinese words through the injected segmenter and normalizes Latin tokens", () => {
		expect(tokenizeQueryText("适合家庭出游的新能源 SUV", fakeSegmenter)).toEqual([
			"适合",
			"家庭",
			"出游",
			"的",
			"新能源",
			"suv",
		]);
		expect(tokenizeQueryText("2026 北京 30万 SUV 推荐", fakeSegmenter)).toEqual([
			"2026",
			"北京",
			"30",
			"万",
			"suv",
			"推荐",
		]);
	});

	it("preserves source order across mixed punctuation and repeated spacing", () => {
		expect(tokenizeQueryText("CRM，家庭  2026/SUV", fakeSegmenter)).toEqual(["crm", "家庭", "2026", "suv"]);
	});

	it("uses a deterministic Unicode-code-point fallback when segmentation is explicitly unavailable", () => {
		expect(tokenizeQueryText("新能源 SUV", null)).toEqual(["新", "能", "源", "suv"]);
	});
});

describe("summarizeFanoutRunExposure", () => {
	it("separates exposed prompt echoes from genuine fan-out and unknown runs", () => {
		expect(
			summarizeFanoutRunExposure({
				totalRuns: 50,
				exposedQueryRuns: 48,
				fanoutRuns: 0,
			}),
		).toEqual({ exposedRuns: 48, unknownRuns: 2, fanoutRuns: 0 });
	});
});

const promptMap = new Map<string, string>([
	["p1", "crm software for startups"],
	["p2", "project management tool"],
]);

describe("promptKeywords", () => {
	it("keeps non-stop-word tokens, dropping stop words and punctuation", () => {
		const kw = promptKeywords("How do Acme widgets compare to other brands?");
		expect(kw.has("acme")).toBe(true);
		expect(kw.has("widgets")).toBe(true);
		expect(kw.has("brands")).toBe(true); // "?" stripped by normalization
		expect(kw.has("how")).toBe(false); // stop word
		expect(kw.has("to")).toBe(false); // stop word
	});

	it("matches a possessive prompt word against the bare form engines search for", () => {
		// Prompt: "How do Acme's formulas adapt to different skin types?"
		// Engines search "acme formula review" — "acme" must bold even though the
		// prompt only contains the possessive "Acme's".
		const kw = promptKeywords("How do Acme's formulas adapt to different skin types?");
		expect(kw.has("acme")).toBe(true); // bare form, from stripping 's
		expect(kw.has("acmes")).toBe(true); // raw normalized form still matches too
		// query-side words are normalized with normTok before lookup
		expect(kw.has(normTok("acme"))).toBe(true);
	});

	it("handles curly-apostrophe possessives and uppercase", () => {
		const kw = promptKeywords("What makes Vendor’s pricing competitive?");
		expect(kw.has("vendor")).toBe(true);
		expect(kw.has("pricing")).toBe(true);
	});
});

describe("computeFanoutAnalysis", () => {
	const breakdown: FanoutBreakdownRow[] = [
		{ prompt_id: "p1", model: "chatgpt", query: "best crm software 2026", count: 4, brand_mentions: 3 },
		{ prompt_id: "p1", model: "chatgpt", query: "crm reviews", count: 2, brand_mentions: 0 },
		{ prompt_id: "p1", model: "perplexity", query: "best crm software 2026", count: 1, brand_mentions: 1 },
		{ prompt_id: "p2", model: "chatgpt", query: "top project management tool 2026", count: 3, brand_mentions: 0 },
	];
	const modelTotals: FanoutModelTotalRow[] = [
		{ model: "chatgpt", runs: 10, raw_query_runs: 9, exposed_query_runs: 9, fanout_runs: 9, total_queries: 9 },
		{ model: "perplexity", runs: 4, raw_query_runs: 1, exposed_query_runs: 1, fanout_runs: 1, total_queries: 1 },
		{ model: "google-ai-mode", runs: 5, raw_query_runs: 0, exposed_query_runs: 0, fanout_runs: 0, total_queries: 0 },
	];

	const a = computeFanoutAnalysis(breakdown, modelTotals, promptMap);

	it("computes top queries with brand-mention rate", () => {
		const top = a.topQueries[0];
		expect(top.query).toBe("best crm software 2026");
		expect(top.count).toBe(5);
		expect(top.brandMentionRate).toBe(80); // 4 of 5
	});

	it("computes overall totals and coverage", () => {
		expect(a.totalQueries).toBe(10);
		expect(a.uniqueQueries).toBe(3);
		expect(a.coverageRate).toBe(40); // 4 brand mentions / 10 instances
		expect(a.totalRuns).toBe(19);
		expect(a.fanoutRuns).toBe(10);
		expect(a.avgPerExecution).toBe(1); // 10 / 10
	});

	it("classifies words engines add, drop, and preserve vs the prompt", () => {
		const added = Object.fromEntries(a.wordChanges.added.map((w) => [w.word, w.count]));
		expect(added.best).toBe(5);
		expect(added["2026"]).toBe(8); // both 2026 queries (5 + 3)
		expect(added.top).toBe(3);
		// prompt words aren't "added"
		expect(added.crm).toBeUndefined();
		expect(added.software).toBeUndefined();

		// "crm" is in p1's prompt and kept in all three p1 queries (4 + 2 + 1)
		const preserved = Object.fromEntries(a.wordChanges.preserved.map((w) => [w.word, w.count]));
		expect(preserved.crm).toBe(7);

		// p1 prompt is "crm software for startups"; "startups" is dropped from all three p1 queries
		const dropped = Object.fromEntries(a.wordChanges.dropped.map((w) => [w.word, w.count]));
		expect(dropped.startups).toBe(7);
	});

	it("breaks fan-out down per model, surfacing models that ran without fan-out as zero", () => {
		const byModel = Object.fromEntries(a.byModel.map((m) => [m.model, m]));
		expect(byModel.chatgpt.totalQueries).toBe(9);
		expect(byModel.chatgpt.avgPerExecution).toBe(1);
		// google-ai-mode ran (runs > 0) but produced no fan-out — listed with zeros.
		expect(byModel["google-ai-mode"]).toMatchObject({ totalQueries: 0, fanoutRuns: 0, avgPerExecution: 0 });
	});

	it("ranks queries by how many distinct prompts they reach", () => {
		// "best crm software 2026" appears for p1 only (two models, still 1 prompt);
		// the breadth metric counts prompts, not rows or runs.
		const top = a.topByPrompts.find((q) => q.query === "best crm software 2026")!;
		expect(top.prompts).toBe(1);
		expect(top.runs).toBe(5);
		// Highest runs wins the tie-break when prompt counts are equal.
		expect(a.topByPrompts[0].query).toBe("best crm software 2026");
	});

	it("counts a query spanning multiple prompts once per prompt, with per-prompt drill-down refs", () => {
		const spanning: FanoutBreakdownRow[] = [
			{ prompt_id: "p1", model: "chatgpt", query: "crm comparison", count: 1, brand_mentions: 0 },
			{ prompt_id: "p2", model: "chatgpt", query: "crm comparison", count: 3, brand_mentions: 1 },
			{ prompt_id: "p1", model: "perplexity", query: "crm comparison", count: 2, brand_mentions: 0 },
		];
		const b = computeFanoutAnalysis(spanning, modelTotals, promptMap);
		const top = b.topByPrompts[0];
		expect(top).toMatchObject({ query: "crm comparison", prompts: 2, runs: 6 });
		// Drill-down lists the prompts behind the query with per-prompt run counts
		// summed across models (p1: 1 + 2); equal runs tie-break alphabetically.
		expect(top.promptRefs).toEqual([
			{ promptId: "p1", promptValue: "crm software for startups", runs: 3 },
			{ promptId: "p2", promptValue: "project management tool", runs: 3 },
		]);
	});

	it("ranks topByRuns by run instances regardless of prompt spread", () => {
		// "2026" query: 5 runs / 1 prompt; project query: 3 runs / 1 prompt;
		// reviews: 2 runs. Runs ordering differs from the prompts list's tie-breaks.
		expect(a.topByRuns.map((q) => q.runs)).toEqual([5, 3, 2]);
		expect(a.topByRuns[0].query).toBe("best crm software 2026");
	});

	it("rolls up per-prompt fan-out volume and avg queries per prompt run", () => {
		const promptRuns = new Map([["p1", 5]]);
		const withRuns = computeFanoutAnalysis(breakdown, modelTotals, promptMap, { promptRuns });
		const p1 = withRuns.byPrompt.find((p) => p.promptId === "p1")!;
		expect(p1.totalQueries).toBe(7);
		expect(p1.uniqueQueries).toBe(2);
		expect(p1.runs).toBe(5);
		expect(p1.avgPerExecution).toBe(1.4); // 7 / 5
	});

	it("honors limit overrides (single-prompt mode returns full lists)", () => {
		// Default perModelTop is 8 and variations 25; cap them at 1 and verify the
		// override path actually slices, so raising them in single-prompt mode works.
		const capped = computeFanoutAnalysis(breakdown, modelTotals, promptMap, {
			limits: { perModelTop: 1, variations: 1, topQueries: 1 },
		});
		expect(capped.topQueries).toHaveLength(1);
		expect(capped.byModel.find((m) => m.model === "chatgpt")!.topQueries).toHaveLength(1);
		expect(capped.byPrompt.find((p) => p.promptId === "p1")!.variations).toHaveLength(1);
		// uniqueQueries still reports the full distinct count, not the capped list size.
		expect(capped.uniqueQueries).toBe(3);
	});

	it("aggregates CJK terms and word changes without depending on UI locale", () => {
		const cjkPromptMap = new Map([["p-zh", "家庭新能源 SUV"]]);
		const cjk = computeFanoutAnalysis(
			[
				{
					prompt_id: "p-zh",
					model: "gpt-5.6",
					query: "家庭 新能源 SUV 推荐",
					count: 2,
					brand_mentions: 1,
				},
			],
			[
				{
					model: "gpt-5.6",
					runs: 2,
					raw_query_runs: 2,
					exposed_query_runs: 2,
					fanout_runs: 2,
					total_queries: 2,
				},
			],
			cjkPromptMap,
			{ segmenter: fakeSegmenter },
		);

		expect(cjk.terms).toEqual([
			{ term: "suv", count: 2 },
			{ term: "家庭", count: 2 },
			{ term: "推荐", count: 2 },
			{ term: "新能源", count: 2 },
		]);
		expect(cjk.wordChanges.added).toEqual([{ word: "推荐", count: 2, share: 100, isStop: false }]);
		expect(cjk.wordChanges.preserved.map((word) => word.word).sort()).toEqual(["suv", "家庭", "新能源"]);
		expect(cjk.wordChanges.dropped).toEqual([]);
	});
});

describe("computeFanoutAnalysis: 'unavailable' sentinel", () => {
	// Some providers (OpenRouter always; BrightData/Olostep on extraction failure)
	// store ["unavailable"] in web_queries when a search happened but the strings
	// aren't exposed. It's not a real fan-out query and must never reach the page.
	const breakdown: FanoutBreakdownRow[] = [
		{ prompt_id: "p1", model: "openrouter-claude", query: UNAVAILABLE_SENTINEL, count: 6, brand_mentions: 2 },
		{ prompt_id: "p1", model: "openrouter-gpt", query: "Unavailable", count: 3, brand_mentions: 1 }, // mixed case
		{ prompt_id: "p1", model: "chatgpt", query: "best crm software 2026", count: 4, brand_mentions: 3 },
	];
	// The SQL excludes the sentinel from genuine fan-out while retaining raw-run coverage.
	const modelTotals: FanoutModelTotalRow[] = [
		{ model: "openrouter-claude", runs: 8, raw_query_runs: 6, exposed_query_runs: 0, fanout_runs: 0, total_queries: 0 },
		{ model: "openrouter-gpt", runs: 5, raw_query_runs: 3, exposed_query_runs: 0, fanout_runs: 0, total_queries: 0 },
		{ model: "chatgpt", runs: 4, raw_query_runs: 4, exposed_query_runs: 4, fanout_runs: 4, total_queries: 4 },
	];
	const a = computeFanoutAnalysis(breakdown, modelTotals, promptMap);

	it("excludes the sentinel (any case) from every query aggregate", () => {
		expect(a.totalQueries).toBe(4); // the sentinel's 6 + 3 are dropped
		expect(a.uniqueQueries).toBe(1);
		expect(a.topQueries.map((q) => q.query)).toEqual(["best crm software 2026"]);
		expect(a.terms.some((t) => t.term === UNAVAILABLE_SENTINEL)).toBe(false);
		expect(a.topByPrompts.some((q) => q.query === UNAVAILABLE_SENTINEL)).toBe(false);
		expect(a.byPrompt[0].variations.some((v) => v.query === UNAVAILABLE_SENTINEL)).toBe(false);
	});

	it("surfaces sentinel-only providers in the per-model breakdown with zero fan-out", () => {
		const byModel = Object.fromEntries(a.byModel.map((m) => [m.model, m]));
		expect(byModel["openrouter-claude"]).toMatchObject({ totalQueries: 0, fanoutRuns: 0 });
		expect(byModel["openrouter-gpt"]).toMatchObject({ totalQueries: 0, fanoutRuns: 0 });
		expect(byModel.chatgpt.totalQueries).toBe(4);
	});
});

describe("computeFanoutAnalysis: empty input", () => {
	it("returns zeroed totals and empty lists without NaN when nothing ran", () => {
		const a = computeFanoutAnalysis([], [], promptMap);
		expect(a.totalQueries).toBe(0);
		expect(a.uniqueQueries).toBe(0);
		expect(a.totalRuns).toBe(0);
		expect(a.fanoutRuns).toBe(0);
		expect(a.avgPerExecution).toBe(0);
		expect(a.coverageRate).toBe(0);
		expect(a.topQueries).toEqual([]);
		expect(a.terms).toEqual([]);
		expect(a.wordChanges).toEqual({ added: [], dropped: [], preserved: [] });
		expect(a.byModel).toEqual([]);
		expect(a.byPrompt).toEqual([]);
		expect(a.topByPrompts).toEqual([]);
		expect(a.topByRuns).toEqual([]);
	});

	it("zeroes per-query aggregates when runs exist but no breakdown rows survive filtering", () => {
		const modelTotals: FanoutModelTotalRow[] = [
			{ model: "chatgpt", runs: 6, raw_query_runs: 0, exposed_query_runs: 0, fanout_runs: 0, total_queries: 0 },
		];
		const a = computeFanoutAnalysis([], modelTotals, promptMap);
		expect(a.totalRuns).toBe(6);
		expect(a.totalQueries).toBe(0);
		expect(a.avgPerExecution).toBe(0); // no divide-by-zero
		expect(a.byModel).toEqual([
			{
				model: "chatgpt",
				runs: 6,
				rawQueryRuns: 0,
				exposedQueryRuns: 0,
				fanoutRuns: 0,
				totalQueries: 0,
				avgPerExecution: 0,
				topQueries: [],
			},
		]);
	});
});

describe("describeFanoutAvailability", () => {
	it("reports empty arrays and unavailable sentinels as queries not exposed", () => {
		expect(
			describeFanoutAvailability({
				totalRuns: 4,
				totalQueries: 0,
				rawQueryRuns: 0,
				exposedQueryRuns: 0,
			}),
		).toEqual({
			kind: "queries_not_exposed",
			unknownRuns: 4,
			rawQueryRuns: 0,
		});
		expect(
			describeFanoutAvailability({
				totalRuns: 4,
				totalQueries: 0,
				rawQueryRuns: 4,
				exposedQueryRuns: 0,
			}),
		).toEqual({
			kind: "queries_not_exposed",
			unknownRuns: 4,
			rawQueryRuns: 4,
		});
	});

	it("reports exposed prompt echoes without calling them unknown", () => {
		expect(
			describeFanoutAvailability({
				totalRuns: 5,
				totalQueries: 0,
				rawQueryRuns: 3,
				exposedQueryRuns: 3,
			}),
		).toEqual({
			kind: "query_exposed_no_fanout",
			exposedRuns: 3,
			unknownRuns: 2,
		});
	});

	it("keeps genuine fan-out separate from echo-only and unavailable runs", () => {
		const modelTotals = [
			{
				model: "perplexity",
				runs: 2,
				fanout_runs: 0,
				total_queries: 0,
				raw_query_runs: 2,
				exposed_query_runs: 2,
			},
			{
				model: "openrouter",
				runs: 2,
				fanout_runs: 0,
				total_queries: 0,
				raw_query_runs: 2,
				exposed_query_runs: 0,
			},
			{
				model: "chatgpt",
				runs: 1,
				fanout_runs: 1,
				total_queries: 1,
				raw_query_runs: 1,
				exposed_query_runs: 1,
			},
		];
		const analysis = computeFanoutAnalysis(
			[
				{
					prompt_id: "p1",
					model: "perplexity",
					query: " CRM SOFTWARE FOR STARTUPS ",
					count: 2,
					brand_mentions: 1,
				},
				{ prompt_id: "p2", model: "chatgpt", query: "best project management tools", count: 1, brand_mentions: 1 },
			],
			modelTotals,
			promptMap,
		) as FanoutAnalysis & { rawQueryRuns: number; exposedQueryRuns: number };

		expect(analysis.totalQueries).toBe(1);
		expect(analysis.rawQueryRuns).toBe(5);
		expect(analysis.exposedQueryRuns).toBe(3);
		expect(describeFanoutAvailability(analysis)).toEqual({ kind: "queries_available" });
	});
});
