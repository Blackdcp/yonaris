import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	brand: {
		id: "brand-raw-id",
		name: "StepFun 原名",
		website: "https://evidence.example.cn/path?q=CN",
		onboarded: true as boolean,
		prompts: [{ id: "prompt-raw-id", value: "Which AI IDE works in 中国?" }],
		delayOverrideHours: 24,
	},
	dashboardSummary: {
		totalRuns: 1234,
		totalPrompts: 1,
		nonBrandedVisibility: 27,
		lastUpdatedAt: null as string | null,
		visibilityTimeSeries: [{ date: "2026-08-25", overall: 42 }],
	},
	sovData: {
		shareTimeSeries: [{ date: "2026-08-25", share: 35 }],
	},
	brandError: false,
	summaryError: false,
	sovError: false,
}));

function hrefFor(to: string, params?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	return href;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => ({ brand: "brand-raw-id" }),
	}),
	Link: ({ children, to, params }: { children: ReactNode; to: string; params?: Record<string, string> }) => (
		<a href={hrefFor(to, params)}>{children}</a>
	),
	useRouteContext: () => ({
		clientConfig: {
			mode: "local",
			defaultDelayHours: 24,
			branding: { name: "Evidence Portal", chartColors: ["#123456"] },
		},
	}),
	useRouter: () => ({ invalidate: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({ mutate: vi.fn(), isSuccess: false }),
	useQuery: () => ({ data: undefined }),
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
		removeQueries: vi.fn(),
	}),
}));
vi.mock("@/components/trend-chart", () => ({
	TrendChart: ({ label, data }: { label: string; data: unknown }) => (
		<div data-series={JSON.stringify(data)}>{label}</div>
	),
}));
vi.mock("@/hooks/use-brands", () => ({
	brandKeys: { all: ["brands"] },
	useBrand: () => ({ brand: mocks.brand, isLoading: false, isError: mocks.brandError }),
}));
vi.mock("@/hooks/use-brand-access", () => ({ useBrandAccess: () => ({ canManageBrand: true }) }));
vi.mock("@/hooks/use-dashboard-summary", () => ({
	dashboardKeys: { all: ["dashboard"] },
	useDashboardSummary: () => ({
		dashboardSummary: mocks.dashboardSummary,
		isLoading: false,
		isError: mocks.summaryError,
	}),
}));
vi.mock("@/hooks/use-citations", () => ({ citationKeys: { all: ["citations"] } }));
vi.mock("@/hooks/use-prompts-summary", () => ({ promptsSummaryKeys: { all: ["prompts-summary"] } }));
vi.mock("@/hooks/use-share-of-voice", () => ({
	useShareOfVoice: () => ({ data: mocks.sovData, isLoading: false, isError: mocks.sovError }),
}));
vi.mock("@/hooks/use-list-filters", () => ({ useListFilters: () => ({ scopeId: "scope-cn-literal" }) }));
vi.mock("@/lib/posthog", () => ({ setPersonProperties: vi.fn(), trackEvent: vi.fn() }));
vi.mock("@/server/onboarding", () => ({
	cancelAnalyzeBrandFn: vi.fn(),
	getAnalyzeBrandStatusFn: vi.fn(),
	startAnalyzeBrandFn: vi.fn(),
	updateOnboardedBrandFn: vi.fn(),
}));

import { Route as OverviewRoute } from "./index";

type TestRoute = {
	component: React.ComponentType;
	head: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
};

function renderOverview(locale: UiLanguage) {
	const Component = (OverviewRoute as unknown as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function textFromMarkup(markup: string): string {
	return markup.replace(/<[^>]+>/g, "");
}

describe("customer overview localization", () => {
	beforeEach(() => {
		mocks.brand.onboarded = true;
		mocks.dashboardSummary = {
			totalRuns: 1234,
			totalPrompts: 1,
			nonBrandedVisibility: 27,
			lastUpdatedAt: null,
			visibilityTimeSeries: [{ date: "2026-08-25", overall: 42 }],
		};
		mocks.sovData = { shareTimeSeries: [{ date: "2026-08-25", share: 35 }] };
		mocks.brandError = false;
		mocks.summaryError = false;
		mocks.sovError = false;
	});

	it("renders the real Chinese onboarding route and Wizard initial state for a not-onboarded brand", () => {
		mocks.brand.onboarded = false;

		const markup = renderOverview("zh-CN");

		expect(markup).toContain("研究品牌数据");
		expect(markup).toContain("分析网站并找出最适合追踪的生成式 AI 提示词");
		expect(markup).toContain("https://evidence.example.cn/path?q=CN");
		expect(markup).toContain("分析品牌");
		expect(markup).not.toContain("Research Brand Data");
		expect(markup).not.toContain("Analyze brand");
	});

	it("renders populated overview analytics in Chinese with stable route hrefs and values", () => {
		const markup = renderOverview("zh-CN");

		expect(markup).toContain("AI 回答呈现");
		expect(markup).toContain("当前可见度");
		expect(markup).toContain("声量份额");
		expect(markup).toContain("当前份额");
		expect(markup).toContain("追踪的提示词");
		expect(markup).toContain("1,234");
		expect(markup).toContain('href="/app/brand-raw-id/visibility"');
		expect(markup).toContain('href="/app/brand-raw-id/share-of-voice"');
		expect(markup).not.toContain("View Visibility");
	});

	it("keeps literal cached dashboard and share data visible during transient polling errors", () => {
		mocks.brandError = true;
		mocks.summaryError = true;
		mocks.sovError = true;

		const markup = renderOverview("zh-CN");

		expect(textFromMarkup(markup)).toContain("42%");
		expect(textFromMarkup(markup)).toContain("35%");
		expect(markup).toContain("1,234");
		expect(markup).toContain('data-series="[{&quot;date&quot;:&quot;2026-08-25&quot;,&quot;value&quot;:42}]"');
		expect(markup).not.toContain("无法加载概览数据，请重试");
	});

	it("keeps the localized full error state when dashboard data is absent", () => {
		mocks.summaryError = true;
		mocks.dashboardSummary = null as never;

		const markup = renderOverview("zh-CN");

		expect(markup).toContain("无法加载概览数据，请重试");
		expect(markup).not.toContain("Unable to load overview data");
	});

	it("renders the first-evaluation empty state in Chinese without changing the settings href", () => {
		mocks.dashboardSummary = {
			...mocks.dashboardSummary,
			totalRuns: 0,
			totalPrompts: 1,
			visibilityTimeSeries: [],
		};
		mocks.sovData = { shareTimeSeries: [] };

		const markup = renderOverview("zh-CN");

		expect(markup).toContain("等待首次评估");
		expect(markup).toContain("提示词已配置并启用");
		expect(markup).toContain("几分钟后刷新此页面");
		expect(markup).toContain('href="/app/brand-raw-id/settings/prompts"');
		expect(markup).not.toContain("Waiting for First Evaluation");
	});

	it("uses the explicit route language for metadata while preserving the brand name", () => {
		const head = (OverviewRoute as unknown as TestRoute).head({
			match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
			matches: [{ loaderData: { brandName: "StepFun 原名" } }],
		});
		const metadata = JSON.stringify(head.meta);

		expect(metadata).toContain("概览 | StepFun 原名 · Evidence Portal");
		expect(metadata).toContain("AI 回答呈现和引用概览");
	});
});
