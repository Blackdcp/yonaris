import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const rawCitationUrl = "https://evidence.example/raw?q=CN&model=gpt-5.6";
const rawOpportunityUrl = "https://rival.example/roundup?market=CN";
const rawPrompt = "Best AI IDE for 中国 teams?";

const mocks = vi.hoisted(() => ({
	sov: { data: null as unknown, isLoading: false, isError: false },
	citations: { citations: null as unknown, isLoading: false, isError: false },
	opportunities: { data: undefined as unknown, isLoading: false, isError: false },
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
	useSearch: ({ select }: { select: (value: Record<string, unknown>) => unknown }) =>
		select({ scope: "scope-cn-literal" }),
}));
vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/components/filter-bar", () => ({
	ALL_MODELS_VALUE: "all",
	getAvailableModels: (models: string[]) => ["all", ...models],
	FilterBar: () => <div data-testid="filter-bar" />,
}));
vi.mock("@/components/prompts-display", () => ({
	PromptsDisplay: ({
		pageTitle,
		pageDescription,
		pageInfoContent,
		editLink,
		exportLanguageSurface,
	}: {
		pageTitle: string;
		pageDescription: string;
		pageInfoContent: ReactNode;
		editLink?: string;
		exportLanguageSurface: string;
	}) => (
		<section data-edit-link={editLink} data-export-language-surface={exportLanguageSurface}>
			<h1>{pageTitle}</h1>
			<p>{pageDescription}</p>
			<div>{pageInfoContent}</div>
		</section>
	),
}));
vi.mock("@/components/share-of-voice-donut", () => ({
	ShareOfVoiceDonut: ({ entries }: { entries: Array<{ name: string }> }) => (
		<div>{entries.map((entry) => entry.name).join("|")}</div>
	),
}));
vi.mock("@/components/trend-chart", () => ({
	TrendChart: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/hooks/use-brand-access", () => ({ useBrandAccess: () => ({ canManageBrand: true }) }));
vi.mock("@/hooks/use-artifact-language-selection", () => ({
	useArtifactLanguageSelection: () => ({
		outputLanguage: "zh-CN",
		isResolved: true,
		setOutputLanguage: vi.fn(),
	}),
}));
vi.mock("@/hooks/use-brands", () => ({
	brandKeys: { competitors: vi.fn(), detail: vi.fn() },
	useBrand: () => ({ brand: { id: "brand-raw-id", name: "StepFun 原名" } }),
}));
vi.mock("@/hooks/use-citations", () => ({ useCitations: () => ({ ...mocks.citations, revalidate: vi.fn() }) }));
vi.mock("@/hooks/use-dashboard-summary", () => ({ dashboardKeys: { all: ["dashboard"] } }));
vi.mock("@/hooks/use-list-filters", () => ({
	useListFilters: () => ({
		scopeId: "scope-cn-literal",
		isScopeResolving: false,
		model: "all",
		lookback: "1m",
		tags: [],
		search: "",
		isFiltered: false,
		clearFilters: vi.fn(),
	}),
}));
vi.mock("@/hooks/use-opportunities", () => ({ useOpportunities: () => mocks.opportunities }));
vi.mock("@/hooks/use-prompts-summary", () => ({
	usePromptsSummary: () => ({ promptsSummary: { availableTags: [] } }),
}));
vi.mock("@/hooks/use-scope-models", () => ({
	useScopeModels: () => ({ models: ["gpt-5.6"], isResolved: true }),
}));
vi.mock("@/hooks/use-share-of-voice", () => ({ useShareOfVoice: () => mocks.sov }));
vi.mock("@/server/brands", () => ({
	addDomainToBrandFn: vi.fn(),
	addDomainToCompetitorFn: vi.fn(),
	createCompetitorFromDomainFn: vi.fn(),
}));

import { Route as CitationsRoute } from "./citations";
import { Route as OpportunitiesRoute } from "./opportunities";
import { Route as ShareOfVoiceRoute } from "./share-of-voice";
import { Route as VisibilityRoute } from "./visibility";

type TestRoute = {
	component: React.ComponentType;
	head: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
};

function renderRoute(route: unknown, locale: UiLanguage = "zh-CN") {
	const Component = (route as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function categoryCounts(brand = 0, competitor = 0) {
	return {
		brand,
		competitor,
		editorial: 0,
		reviews: 0,
		ecommerce: 0,
		social: 0,
		developer: 0,
		pr: 0,
		reference: 0,
		institutional: 0,
		other: 0,
	};
}

function populatedCitations() {
	return {
		totalCitations: 7,
		uniqueDomains: 1,
		categoryCounts: categoryCounts(7, 0),
		domainDistribution: [{ domain: "evidence.example", count: 7, category: "brand" }],
		specificUrls: [
			{
				url: rawCitationUrl,
				title: "Raw Evidence 标题",
				domain: "evidence.example",
				count: 7,
				category: "brand",
				pageType: "article",
			},
		],
		pageTypeDistribution: [{ pageType: "article", count: 7 }],
		competitors: [{ id: "competitor-raw-id", name: "DeepSeek 原名", domains: ["deepseek.com"] }],
		competitorOnlyPrompts: [],
		citationAvailability: { kind: "available" },
		evaluatedRuns: 9,
		searchEnabledRuns: 8,
		availableTags: [],
	};
}

function populatedOpportunityData() {
	return {
		reason: null,
		generatedFor: { brandName: "StepFun 原名" },
		lastEvaluatedAt: "2026-08-15T00:00:00.000Z",
		outputLanguage: "zh-CN" as const,
		report: {
			summary: ["Generated summary must stay verbatim 原文"],
			opportunities: [
				{
					category: "creation",
					title: "Publish the raw comparison angle 原文",
					why: "Model-authored rationale remains unchanged.",
					relatedPrompts: [{ text: rawPrompt, promptId: "prompt-raw-id" }],
					yourCitations: [],
					competitorCitations: [{ title: "Rival Roundup 原文", domain: "rival.example", url: rawOpportunityUrl }],
				},
			],
			risks: ["Generated risk stays verbatim."],
		},
	};
}

describe("customer analytical page localization", () => {
	beforeEach(() => {
		mocks.sov = { data: null, isLoading: false, isError: false };
		mocks.citations = { citations: null, isLoading: false, isError: false };
		mocks.opportunities = { data: undefined, isLoading: false, isError: false };
	});

	it("renders populated Share of Voice data in Chinese without translating entity names or model keys", () => {
		mocks.sov = {
			isLoading: false,
			isError: false,
			data: {
				brandName: "StepFun 原名",
				totalRuns: 12,
				entries: [
					{ name: "StepFun 原名", mentions: 8, prompts: 3, share: 0.8, isBrand: true },
					{ name: "DeepSeek 原名", mentions: 2, prompts: 1, share: 0.2, isBrand: false },
				],
				shareTimeSeries: [{ date: "2026-08-15", share: 80 }],
			},
		};

		const markup = renderRoute(ShareOfVoiceRoute);

		expect(markup).toContain("声量份额");
		expect(markup).toContain("当前份额");
		expect(markup).toContain("声量份额排行榜");
		expect(markup).toContain("提及次数");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("DeepSeek 原名");
		expect(markup).not.toContain("Share of Voice Leaderboard");
	});

	it("renders the empty and error Share of Voice states in Chinese", () => {
		mocks.sov = {
			isLoading: false,
			isError: false,
			data: { brandName: "StepFun 原名", totalRuns: 0, entries: [], shareTimeSeries: [] },
		};
		const emptyMarkup = renderRoute(ShareOfVoiceRoute);
		mocks.sov = { data: undefined, isLoading: false, isError: true };
		const errorMarkup = renderRoute(ShareOfVoiceRoute);

		expect(emptyMarkup).toContain("所选筛选条件下暂无提及数据");
		expect(errorMarkup).toContain("无法加载声量份额数据，请重试");
		expect(errorMarkup).not.toContain("No mention data yet");
	});

	it("keeps literal cached Share of Voice data visible during a transient polling error", () => {
		mocks.sov = {
			isLoading: false,
			isError: true,
			data: {
				brandName: "StepFun 原名",
				totalRuns: 12,
				entries: [
					{ name: "StepFun 原名", mentions: 8, prompts: 3, share: 0.8, isBrand: true },
					{ name: "DeepSeek 原名", mentions: 2, prompts: 1, share: 0.2, isBrand: false },
				],
				shareTimeSeries: [{ date: "2026-08-15", share: 80 }],
			},
		};

		const markup = renderRoute(ShareOfVoiceRoute);

		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("DeepSeek 原名");
		expect(markup).toContain("80%");
		expect(markup).not.toContain("无法加载声量份额数据，请重试");
	});

	it("renders populated citation evidence in Chinese while preserving the literal URL and title", () => {
		mocks.citations = { citations: populatedCitations(), isLoading: false, isError: false };
		const markup = renderRoute(CitationsRoute);

		expect(markup).toContain("引用");
		expect(markup).toContain("品牌引用份额");
		expect(markup).toContain("热门引用域名");
		expect(markup).toContain("热门引用网址");
		expect(markup).toContain("Raw Evidence 标题");
		expect(markup).toContain(`href="${rawCitationUrl.replaceAll("&", "&amp;")}"`);
		expect(markup).toContain("evidence.example");
		expect(markup).not.toContain("Top Cited URLs");
	});

	it("renders citation error and no-run states in Chinese with a safe generic failure", () => {
		mocks.citations = { citations: null, isLoading: false, isError: true };
		const errorMarkup = renderRoute(CitationsRoute);
		mocks.citations = {
			citations: {
				...populatedCitations(),
				totalCitations: 0,
				uniqueDomains: 0,
				categoryCounts: categoryCounts(),
				domainDistribution: [],
				specificUrls: [],
				pageTypeDistribution: [],
				citationAvailability: { kind: "no_evaluated_runs" },
				evaluatedRuns: 0,
				searchEnabledRuns: 0,
			},
			isLoading: false,
			isError: false,
		};
		const emptyMarkup = renderRoute(CitationsRoute);

		expect(errorMarkup).toContain("无法加载引用数据，请重试");
		expect(errorMarkup).not.toContain("Failed to load citation data");
		expect(emptyMarkup).toContain("此项目和时间范围内暂无匹配的提示词运行记录");
	});

	it("keeps literal cached citation evidence visible during a transient polling error", () => {
		mocks.citations = { citations: populatedCitations(), isLoading: false, isError: true };

		const markup = renderRoute(CitationsRoute);

		expect(markup).toContain("Raw Evidence 标题");
		expect(markup).toContain(`href="${rawCitationUrl.replaceAll("&", "&amp;")}"`);
		expect(markup).toContain("evidence.example");
		expect(markup).not.toContain("无法加载引用数据，请重试");
	});

	it("localizes Opportunity presentation without translating generated artifacts, Prompts, URLs, or href identity", () => {
		mocks.opportunities = { data: populatedOpportunityData(), isLoading: false, isError: false };
		const markup = renderRoute(OpportunitiesRoute);

		expect(markup).toContain("优化机会");
		expect(markup).toContain("摘要");
		expect(markup).toContain("内容创作");
		expect(markup).toContain("相关提示词");
		expect(markup).toContain("竞争对手引用");
		expect(markup).toContain('lang="zh-CN"');
		expect(markup).toContain("Generated summary must stay verbatim 原文");
		expect(markup).toContain("Publish the raw comparison angle 原文");
		expect(markup).toContain(rawPrompt);
		expect(markup).toContain('href="/app/brand-raw-id/prompts/prompt-raw-id"');
		expect(markup).toContain(`href="${rawOpportunityUrl.replaceAll("&", "&amp;")}"`);
	});

	it("renders Opportunity empty and error states in Chinese", () => {
		mocks.opportunities = {
			data: {
				reason: "not_generated",
				report: null,
				generatedFor: null,
				lastEvaluatedAt: null,
				outputLanguage: "zh-CN",
			},
			isLoading: false,
			isError: false,
		};
		const emptyMarkup = renderRoute(OpportunitiesRoute);
		mocks.opportunities = { data: undefined, isLoading: false, isError: true };
		const errorMarkup = renderRoute(OpportunitiesRoute);

		expect(emptyMarkup).toContain("管理员尚未为此项目生成优化机会");
		expect(errorMarkup).toContain("目前无法加载建议，请重新加载页面后重试");
		expect(errorMarkup).not.toContain("Couldn't generate recommendations");
	});

	it("localizes the Visibility route copy while preserving settings and competitor hrefs", () => {
		const markup = renderRoute(VisibilityRoute);

		expect(markup).toContain("可见度");
		expect(markup).toContain("查看大语言模型如何评估与你的品牌相关的提示词");
		expect(markup).toContain("竞争对手");
		expect(markup).toContain('href="/app/brand-raw-id/settings/competitors"');
		expect(markup).toContain('data-edit-link="/app/brand-raw-id/settings/prompts"');
		expect(markup).toContain('data-export-language-surface="visibility-chart-export"');
		expect(markup).not.toContain("See how LLMs are evaluating");
	});

	it("localizes all analytical route heads from context and preserves brand and app names", () => {
		for (const [route, expectedTitle] of [
			[VisibilityRoute, "可见度"],
			[ShareOfVoiceRoute, "声量份额"],
			[CitationsRoute, "引用"],
			[OpportunitiesRoute, "优化机会"],
		] as const) {
			const head = (route as unknown as TestRoute).head({
				match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
				matches: [{ loaderData: { brandName: "StepFun 原名" } }],
			});
			expect(JSON.stringify(head.meta)).toContain(`${expectedTitle} | StepFun 原名 · Evidence Portal`);
		}
	});
});
