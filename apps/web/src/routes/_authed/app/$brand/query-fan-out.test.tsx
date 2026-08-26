import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/provider";

const rawPrompt = "家 SUV 选择：Tesla Model Y 还是蔚来 ES6?";
const rawQuery = "2026 北京，家SUV  推荐";

const mocks = vi.hoisted(() => ({
	tab: "fanout",
	query: { data: null as unknown, isLoading: false, isError: false },
	isScopeResolving: false,
	expandTopQuery: false,
	navigate: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		useState: <T,>(initial: T | (() => T)) => {
			const state = actual.useState(initial);
			if (mocks.expandTopQuery && initial instanceof Set) {
				return [new Set([rawQuery]), state[1]] as typeof state;
			}
			return state;
		},
	};
});

function hrefFor(to: string, params?: Record<string, string>, search?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	const query = new URLSearchParams(search).toString();
	return query ? `${href}?${query}` : href;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => ({ brand: "brand-raw-id" }),
		useSearch: ({ select }: { select: (value: Record<string, string>) => unknown }) => select({ tab: mocks.tab }),
		useNavigate: () => mocks.navigate,
	}),
	Link: ({
		children,
		to,
		params,
		search,
	}: {
		children: ReactNode;
		to: string;
		params?: Record<string, string>;
		search?: Record<string, string>;
	}) => <a href={hrefFor(to, params, search)}>{children}</a>,
}));

vi.mock("@/components/filter-bar", () => ({
	ALL_MODELS_VALUE: "all",
	FilterBar: () => <div data-testid="filter-bar" />,
	getAvailableModels: (models: string[]) => models,
}));
vi.mock("@/components/page-header", () => ({
	FilterSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PageHeader: ({
		title,
		subtitle,
		infoContent,
		children,
	}: {
		title: string;
		subtitle: string;
		infoContent: ReactNode;
		children: ReactNode;
	}) => (
		<main>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			<div>{infoContent}</div>
			{children}
		</main>
	),
}));
vi.mock("@/hooks/use-list-filters", () => ({
	useListFilters: () => ({
		scopeId: "scope-raw-id",
		isScopeResolving: mocks.isScopeResolving,
		model: "all",
		lookback: "1m",
		tags: [],
	}),
}));
vi.mock("@/hooks/use-prompts-summary", () => ({
	usePromptsSummary: () => ({ promptsSummary: { availableTags: [] } }),
}));
vi.mock("@/hooks/use-query-fanout", () => ({
	useQueryFanout: () => mocks.query,
}));
vi.mock("@/hooks/use-scope-models", () => ({
	useScopeModels: () => ({ models: ["gpt-5.6"], isResolved: true }),
}));

import { Route as QueryFanoutRoute } from "./query-fan-out";

type TestRoute = {
	component: React.ComponentType;
	head: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
	validateSearch: (search: Record<string, unknown>) => { tab?: string };
};

function populatedFanoutData() {
	const variation = { query: rawQuery, count: 12_345, brandMentionRate: 50 };
	const promptRef = { promptId: "prompt-raw-id", promptValue: rawPrompt, runs: 12_345 };
	const topQuery = { query: rawQuery, prompts: 1, runs: 12_345, promptRefs: [promptRef] };
	return {
		totalQueries: 12_345,
		uniqueQueries: 1,
		fanoutRuns: 12_345,
		totalRuns: 12_346,
		rawQueryRuns: 12_346,
		exposedQueryRuns: 12_345,
		avgPerExecution: 1,
		coverageRate: 50,
		topQueries: [variation],
		terms: [{ term: "新能源", count: 12_345 }],
		wordChanges: {
			added: [{ word: "推荐", count: 12_345, share: 100, isStop: false }],
			preserved: [],
			dropped: [],
		},
		byModel: [
			{
				model: "gpt-5.6",
				runs: 12_346,
				rawQueryRuns: 12_346,
				exposedQueryRuns: 12_345,
				fanoutRuns: 12_345,
				totalQueries: 12_345,
				avgPerExecution: 1,
				topQueries: [variation],
			},
		],
		byPrompt: [
			{
				promptId: "prompt-raw-id",
				promptValue: rawPrompt,
				totalQueries: 12_345,
				uniqueQueries: 1,
				runs: 12_345,
				avgPerExecution: 1,
				variations: [variation],
			},
		],
		topByPrompts: [topQuery],
		topByRuns: [topQuery],
	};
}

function emptyAnalysis(overrides: Record<string, number> = {}) {
	return {
		totalQueries: 0,
		uniqueQueries: 0,
		fanoutRuns: 0,
		totalRuns: 0,
		rawQueryRuns: 0,
		exposedQueryRuns: 0,
		avgPerExecution: 0,
		coverageRate: 0,
		topQueries: [],
		terms: [],
		wordChanges: { added: [], preserved: [], dropped: [] },
		byModel: [],
		byPrompt: [],
		topByPrompts: [],
		topByRuns: [],
		...overrides,
	};
}

function renderRoute(locale: UiLanguage = "zh-CN", tab: "fanout" | "top-queries" | "words" = "fanout") {
	mocks.tab = tab;
	const Component = (QueryFanoutRoute as unknown as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function textFromMarkup(markup: string): string {
	return markup.replace(/<[^>]+>/g, "");
}

describe("Query Fan-Out route localization", () => {
	beforeEach(() => {
		mocks.tab = "fanout";
		mocks.query = { data: populatedFanoutData(), isLoading: false, isError: false };
		mocks.isScopeResolving = false;
		mocks.expandTopQuery = false;
		mocks.navigate.mockClear();
	});

	it("renders exact Chinese terminology and preserves raw Prompt, query slices, route, and search identity", () => {
		const markup = renderRoute("zh-CN", "fanout");
		const text = textFromMarkup(markup);

		expect(text).toContain("AI 检索脉络");
		expect(text).toContain("检索路径");
		expect(text).toContain("衍生检索词");
		expect(text).toContain("未公开搜索输入的提示词运行次数");
		expect(text).toContain("已公开搜索输入的提示词运行次数");
		expect(text).toContain("查看 AI 为回答当前问题而展开的实际联网搜索词。");
		expect(text).toContain(rawPrompt);
		expect(text).toContain(rawQuery);
		expect(markup).toContain('<span class="text-foreground font-semibold">家</span>');
		expect(markup).toContain('href="/app/brand-raw-id/prompts/prompt-raw-id?tab=web-queries"');
		expect((QueryFanoutRoute as unknown as TestRoute).validateSearch({ tab: "top-queries" })).toEqual({
			tab: "top-queries",
		});
		expect((QueryFanoutRoute as unknown as TestRoute).validateSearch({ tab: "machine-value" })).toEqual({});
		expect(text).not.toContain("Prompt Fan-Out");

		const english = textFromMarkup(renderRoute("en", "fanout"));
		expect(english).toContain("Query Fan-Out");
		expect(english).toContain("Search Paths");
		expect(english).toContain("Derived Queries");
		expect(english).toContain("Prompt Runs w/ Unexposed Search Inputs");
		expect(english).toContain("Prompt Runs w/ Exposed Search Inputs");
		expect(english).toContain("Average Search Paths");
		expect(english).toContain("The web searches AI engines run when answering your prompts.");
	});

	it("localizes the Chinese route head from context without changing brand or app names", () => {
		const head = (QueryFanoutRoute as unknown as TestRoute).head({
			match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
			matches: [{ loaderData: { brandName: "StepFun 原名" } }],
		});
		const meta = JSON.stringify(head.meta);

		expect(meta).toContain("AI 检索脉络 | StepFun 原名 · Evidence Portal");
		expect(meta).toContain("查看 AI 为回答当前问题而展开的实际联网搜索词。");
		expect(meta).not.toContain("Query Fan-Out");
	});

	it("localizes loading, error, no-search, query-hidden, and echo-only states", () => {
		mocks.query = { data: null, isLoading: true, isError: false };
		expect(renderRoute()).toContain('aria-label="正在加载 AI 检索脉络…"');

		mocks.query = { data: null, isLoading: false, isError: true };
		expect(textFromMarkup(renderRoute())).toContain("目前无法加载 AI 检索脉络，请重新加载页面后重试。");
		expect(textFromMarkup(renderRoute("en"))).toContain(
			"Query Fan-Out cannot be loaded right now. Reload the page to try again.",
		);

		mocks.query = { data: emptyAnalysis(), isLoading: false, isError: false };
		expect(textFromMarkup(renderRoute())).toContain("所选筛选条件下没有启用联网搜索的运行记录");
		expect(textFromMarkup(renderRoute("en"))).toContain(
			"No runs with web search enabled for the selected filters. Search Paths appear once your prompts have been run by an engine with web search.",
		);

		mocks.query = {
			data: emptyAnalysis({ totalRuns: 3, rawQueryRuns: 3 }),
			isLoading: false,
			isError: false,
		};
		expect(textFromMarkup(renderRoute())).toContain("平台未公开可验证的衍生检索词");
		expect(textFromMarkup(renderRoute("en"))).toContain(
			"The platform did not expose verifiable derived queries for these prompt runs.",
		);

		mocks.query = {
			data: emptyAnalysis({ totalRuns: 2, rawQueryRuns: 1, exposedQueryRuns: 1 }),
			isLoading: false,
			isError: false,
		};
		const singularChineseMarkup = renderRoute();
		const singularEnglishMarkup = renderRoute("en");
		const singularChinese = textFromMarkup(singularChineseMarkup);
		const singularEnglish = textFromMarkup(singularEnglishMarkup);
		expect(singularChinese).toContain("未公开搜索输入的提示词运行次数1");
		expect(singularChinese).toContain("已公开搜索输入的提示词运行次数1");
		expect(singularChineseMarkup).toContain('aria-label="AI 检索脉络：未公开搜索输入的运行次数说明"');
		expect(singularChineseMarkup).toContain('aria-label="AI 检索脉络：已公开搜索输入的运行次数说明"');
		expect(singularChinese).toContain(
			"1 次提示词运行仅公开了原提示词的完全重复；未在其检索路径中观察到真正的衍生检索词。",
		);
		expect(singularChinese).toContain("另有 1 次运行未公开衍生检索词或原提示词重复。");
		expect(singularEnglish).toContain("Prompt Runs w/ Unexposed Search Inputs1");
		expect(singularEnglish).toContain("Prompt Runs w/ Exposed Search Inputs1");
		expect(singularEnglishMarkup).toContain('aria-label="About prompt runs with unexposed search inputs"');
		expect(singularEnglishMarkup).toContain('aria-label="About prompt runs with exposed search inputs"');
		expect(singularEnglish).toContain(
			"1 prompt run exposed only an exact prompt echo; no genuine derived query was observed in its search path.",
		);
		expect(singularEnglish).toContain("1 other run did not expose a derived query or prompt echo.");

		mocks.query = {
			data: emptyAnalysis({ totalRuns: 4, rawQueryRuns: 2, exposedQueryRuns: 2 }),
			isLoading: false,
			isError: false,
		};
		const pluralChinese = textFromMarkup(renderRoute());
		const pluralEnglish = textFromMarkup(renderRoute("en"));
		expect(pluralChinese).toContain(
			"2 次提示词运行仅公开了原提示词的完全重复；未在其检索路径中观察到真正的衍生检索词。",
		);
		expect(pluralChinese).toContain("另有 2 次运行未公开衍生检索词或原提示词重复。");
		expect(pluralEnglish).toContain(
			"2 prompt runs exposed only exact prompt echoes; no genuine derived queries were observed in their search paths.",
		);
		expect(pluralEnglish).toContain("2 other runs did not expose derived queries or prompt echoes.");
	});

	it("defines exposed and unexposed Search Inputs without classifying Prompt echoes as Derived Queries", () => {
		expect(translate("en", "fanout.stats.unknownRunsDetail")).toBe(
			"Search-enabled prompt runs where the platform did not expose a usable search input. This is not evidence that no web search occurred.",
		);
		expect(translate("en", "fanout.stats.exposedRunsDetail")).toBe(
			"Prompt runs where the platform exposed at least one usable search input. This can include exact prompt echoes, which are not Derived Queries.",
		);
		expect(translate("zh-CN", "fanout.stats.unknownRunsDetail")).toBe(
			"已启用联网搜索，但平台未公开可用搜索输入的提示词运行。这并不表示没有发生联网搜索。",
		);
		expect(translate("zh-CN", "fanout.stats.exposedRunsDetail")).toBe(
			"平台至少公开了一个可用搜索输入的提示词运行。这可能包括与原提示词完全相同的输入，而这类输入不属于衍生检索词。",
		);
	});

	it("localizes top-query labels, accessibility copy, counts, and word-cloud states", () => {
		mocks.expandTopQuery = true;
		const topQueries = renderRoute("zh-CN", "top-queries");
		const englishTopQueries = renderRoute("en", "top-queries");
		const words = renderRoute("zh-CN", "words");

		expect(topQueries).toContain('aria-label="AI 检索脉络：热门衍生检索词说明"');
		expect(topQueries).toContain("热门衍生检索词");
		expect(topQueries).toContain("提示词运行次数");
		expect(topQueries).toContain("12,345");
		expect(topQueries).toContain('title="发出此衍生检索词的提示词运行次数"');
		expect(englishTopQueries).toContain('title="Runs of this prompt that issued this derived query"');
		expect(words).toContain('title="新能源 · 12,345"');

		mocks.query = {
			data: { ...populatedFanoutData(), terms: [] },
			isLoading: false,
			isError: false,
		};
		expect(textFromMarkup(renderRoute("zh-CN", "words"))).toContain("此期间没有可分析的词语。");
	});

	it("uses exact Derived Queries terminology for capped counts and query count titles", () => {
		const populated = populatedFanoutData();
		populated.byPrompt[0].uniqueQueries = 3;
		mocks.query = { data: populated, isLoading: false, isError: false };

		const english = renderRoute("en", "fanout");
		expect(textFromMarkup(english)).toContain("Top 1 of 3 derived queries shown");
		expect(english).toContain('title="Times engines ran this derived query"');
		expect(english).not.toContain("variations shown");

		const chinese = renderRoute("zh-CN", "fanout");
		expect(textFromMarkup(chinese)).toContain("仅显示前 1 条，共 3 条衍生检索词");
		expect(chinese).toContain('title="引擎运行此衍生检索词的次数"');
	});

	it("formats word-change counts through the UI locale instead of the ambient runtime locale", () => {
		const ambientFormatter = vi.spyOn(Number.prototype, "toLocaleString").mockReturnValue("AMBIENT_LOCALE");
		try {
			const words = renderRoute("zh-CN", "words");
			expect(words).toContain("12,345");
			expect(words).not.toContain("AMBIENT_LOCALE");
		} finally {
			ambientFormatter.mockRestore();
		}
	});
});
