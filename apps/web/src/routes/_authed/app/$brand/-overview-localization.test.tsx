import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	brand: {
		id: "brand-raw-id",
		name: "StepFun 原名",
		onboarded: true,
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
}));
vi.mock("@/components/prompt-wizard", () => ({ default: () => <div>prompt-wizard</div> }));
vi.mock("@/components/trend-chart", () => ({
	TrendChart: ({ label, data }: { label: string; data: unknown }) => (
		<div data-series={JSON.stringify(data)}>{label}</div>
	),
}));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: mocks.brand, isLoading: false }),
}));
vi.mock("@/hooks/use-brand-access", () => ({ useBrandAccess: () => ({ canManageBrand: true }) }));
vi.mock("@/hooks/use-dashboard-summary", () => ({
	useDashboardSummary: () => ({ dashboardSummary: mocks.dashboardSummary, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-share-of-voice", () => ({
	useShareOfVoice: () => ({ data: mocks.sovData, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-list-filters", () => ({ useListFilters: () => ({ scopeId: "scope-cn-literal" }) }));
vi.mock("@/lib/posthog", () => ({ setPersonProperties: vi.fn() }));

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

describe("customer overview localization", () => {
	beforeEach(() => {
		mocks.dashboardSummary = {
			totalRuns: 1234,
			totalPrompts: 1,
			nonBrandedVisibility: 27,
			lastUpdatedAt: null,
			visibilityTimeSeries: [{ date: "2026-08-25", overall: 42 }],
		};
		mocks.sovData = { shareTimeSeries: [{ date: "2026-08-25", share: 35 }] };
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
