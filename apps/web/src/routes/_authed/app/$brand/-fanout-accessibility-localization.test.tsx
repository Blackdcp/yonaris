import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const rawPrompt = "Raw Prompt 中国";
const rawQuery = "raw observed query 中国";

const mocks = vi.hoisted(() => ({
	tab: "fanout",
	data: null as unknown,
	navigate: vi.fn(),
}));

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
	FilterBar: () => <div />,
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
			{infoContent}
			{children}
		</main>
	),
}));
vi.mock("@/hooks/use-list-filters", () => ({
	useListFilters: () => ({
		scopeId: "scope-raw-id",
		isScopeResolving: false,
		model: "all",
		lookback: "1m",
		tags: [],
	}),
}));
vi.mock("@/hooks/use-prompts-summary", () => ({
	usePromptsSummary: () => ({ promptsSummary: { availableTags: [] } }),
}));
vi.mock("@/hooks/use-query-fanout", () => ({
	useQueryFanout: () => ({ data: mocks.data, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-scope-models", () => ({
	useScopeModels: () => ({ models: ["gpt-5.6"], isResolved: true }),
}));

import { Route as QueryFanoutRoute } from "./query-fan-out";

type TestRoute = {
	options: { component: React.ComponentType };
};

function populatedFanoutData() {
	const variation = { query: rawQuery, count: 2, brandMentionRate: 50 };
	const promptRef = { promptId: "prompt-raw-id", promptValue: rawPrompt, runs: 2 };
	const topQuery = { query: rawQuery, prompts: 1, runs: 2, promptRefs: [promptRef] };
	return {
		totalQueries: 2,
		uniqueQueries: 1,
		fanoutRuns: 2,
		totalRuns: 3,
		rawQueryRuns: 3,
		exposedQueryRuns: 2,
		avgPerExecution: 1,
		coverageRate: 50,
		topQueries: [variation],
		terms: [{ term: "raw", count: 2 }],
		wordChanges: {
			added: [{ word: "observed", count: 2, share: 100, isStop: false }],
			preserved: [],
			dropped: [],
		},
		byModel: [
			{
				model: "gpt-5.6",
				runs: 3,
				rawQueryRuns: 3,
				exposedQueryRuns: 2,
				fanoutRuns: 2,
				totalQueries: 2,
				avgPerExecution: 1,
				topQueries: [variation],
			},
		],
		byPrompt: [
			{
				promptId: "prompt-raw-id",
				promptValue: rawPrompt,
				totalQueries: 2,
				uniqueQueries: 1,
				runs: 2,
				avgPerExecution: 1,
				variations: [variation],
			},
		],
		topByPrompts: [topQuery],
		topByRuns: [topQuery],
	};
}

function renderRoute(locale: UiLanguage, tab: "fanout" | "top-queries" | "words") {
	mocks.tab = tab;
	const Component = (QueryFanoutRoute as unknown as TestRoute).options.component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function infoTipAccessibleNames(markup: string): Array<string | null> {
	const buttons = markup.match(/<button\b[^>]*cursor-help[^>]*>/g) ?? [];
	return buttons.map((button) => button.match(/aria-label="([^"]+)"/)?.[1] ?? null);
}

function textFromMarkup(markup: string): string {
	return markup.replace(/<[^>]+>/g, "");
}

const expectedNames = {
	en: {
		stats: [
			"About search prompt runs",
			"About prompt runs with unknown queries",
			"About prompt runs with exposed queries",
			"About average fan-out",
		],
		fanout: "About prompt fan-out",
		topQueries: "About top queries",
		words: "Words engines add that were not in your prompt.",
	},
	"zh-CN": {
		stats: [
			"AI 检索脉络：搜索运行次数说明",
			"AI 检索脉络：未公开衍生检索词的运行次数说明",
			"AI 检索脉络：已公开衍生检索词的运行次数说明",
			"AI 检索脉络：平均检索路径数量说明",
		],
		fanout: "AI 检索脉络：提示词检索路径说明",
		topQueries: "AI 检索脉络：热门衍生检索词说明",
		words: "引擎搜索时添加但原提示词中没有的词。",
	},
} as const;

describe("fan-out InfoTip accessibility localization", () => {
	beforeEach(() => {
		mocks.data = populatedFanoutData();
		mocks.tab = "fanout";
		mocks.navigate.mockClear();
	});

	for (const locale of ["en", "zh-CN"] as const) {
		it(`names every live Query Fan-Out InfoTip in ${locale} without changing visible evidence`, () => {
			const fanout = renderRoute(locale, "fanout");
			const topQueries = renderRoute(locale, "top-queries");
			const words = renderRoute(locale, "words");
			const expected = expectedNames[locale];

			expect(infoTipAccessibleNames(fanout)).toEqual([...expected.stats, expected.fanout]);
			expect(infoTipAccessibleNames(topQueries)).toEqual([...expected.stats, expected.topQueries]);
			expect(infoTipAccessibleNames(words)).toEqual([...expected.stats, expected.words]);
			expect(textFromMarkup(fanout)).toContain(rawQuery);
			expect(textFromMarkup(fanout)).toContain(rawPrompt);
			expect(textFromMarkup(fanout)).toContain(locale === "zh-CN" ? "AI 检索脉络" : "Query Fan-Out");
		});
	}
});
