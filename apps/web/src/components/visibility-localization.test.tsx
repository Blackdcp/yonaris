import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	selectedOrder: "default",
	chartContext: null as Record<string, unknown> | null,
}));

function hrefFor(to: string, params?: Record<string, string>, search?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	const query = new URLSearchParams(search).toString();
	return query ? `${href}?${query}` : href;
}

vi.mock("@tanstack/react-router", () => ({
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
	useNavigate: () => vi.fn(),
	useSearch: ({ select }: { select: (value: Record<string, string>) => unknown }) =>
		select({ order: mocks.selectedOrder }),
}));
vi.mock("recharts", () => ({
	Area: () => null,
	AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	YAxis: () => null,
}));
vi.mock("@/components/filter-bar", () => ({
	FilterTriggerButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
vi.mock("@/contexts/chart-data-context", () => ({
	useOptionalChartDataContext: () => mocks.chartContext,
}));
vi.mock("@/hooks/use-chart-export", () => ({
	useChartExport: () => ({ isExporting: false, handleExport: vi.fn(), portal: null }),
}));
vi.mock("./base-chart", () => ({ BaseChart: () => <div data-testid="base-chart" /> }));
vi.mock("./chart-actions-footer", () => ({ ChartActionsFooter: () => <div data-testid="chart-actions" /> }));

import { CachedPromptChart } from "./cached-prompt-chart";
import { HistoryButton } from "./history-button";
import { PromptOrderDropdown } from "./prompt-order-dropdown";
import { VisibilityBar, VisibilityBarEmpty } from "./visibility-bar";

function renderWithLocale(locale: UiLanguage, children: ReactNode) {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

const chartProps = {
	promptId: "prompt-raw-id",
	promptName: "Which AI IDE works in 中国?",
	brandId: "brand-raw-id",
	lookback: "1m" as const,
	selectedModel: "gpt-5.6",
	availableModels: ["gpt-5.6"],
};

describe("visibility component localization", () => {
	beforeEach(() => {
		mocks.selectedOrder = "default";
		mocks.chartContext = {
			isLoading: false,
			brand: { id: "brand-raw-id", name: "StepFun 原名" },
			competitors: [{ id: "competitor-raw-id", name: "DeepSeek 原名" }],
			getChartDataForPrompt: () => ({
				chartData: [],
				totalRuns: 0,
				hasVisibilityData: false,
				lastBrandVisibility: null,
			}),
		};
	});

	it("localizes populated and empty visibility summaries without changing computed values", () => {
		const populated = renderWithLocale(
			"zh-CN",
			<VisibilityBar
				currentVisibility={42}
				totalRuns={2}
				totalPrompts={1}
				totalCitations={3}
				visibilityTimeSeries={[{ date: "2026-08-15", visibility: 42 }]}
				lookback="1m"
			/>,
		);
		const empty = renderWithLocale("zh-CN", <VisibilityBarEmpty />);

		expect(populated).toContain("42");
		expect(populated).toContain("可见度");
		expect(populated).toContain("1 个提示词");
		expect(populated).toContain("2 次运行");
		expect(populated).toContain("3 条引用");
		expect(empty).toContain("所选时间范围和筛选条件下暂无可见度数据");
		expect(empty).not.toContain("No visibility data");
	});

	it("localizes first-evaluation and populated Prompt cards while preserving Prompt and model identity", () => {
		const firstEvaluation = renderWithLocale("zh-CN", <CachedPromptChart {...chartProps} />);
		mocks.chartContext = {
			...(mocks.chartContext ?? {}),
			getChartDataForPrompt: () => ({
				chartData: [{ date: "2026-08-15", "brand-raw-id": 42 }],
				totalRuns: 1,
				hasVisibilityData: true,
				lastBrandVisibility: 42,
			}),
		};
		const populated = renderWithLocale("zh-CN", <CachedPromptChart {...chartProps} />);

		expect(firstEvaluation).toContain("首次评估中");
		expect(firstEvaluation).toContain("Which AI IDE works in 中国?");
		expect(populated).toContain("42% 可见度");
		expect(populated).toContain("Which AI IDE works in 中国?");
		expect(populated).not.toContain("42% Visibility");
	});

	it("localizes history and sort controls while retaining href and query tokens", () => {
		mocks.selectedOrder = "brand-desc";
		const markup = renderWithLocale(
			"zh-CN",
			<>
				<HistoryButton
					brandId="brand-raw-id"
					promptId="prompt-raw-id"
					promptName="Which AI IDE works in 中国?"
					tab="web-queries"
				/>
				<PromptOrderDropdown />
			</>,
		);

		expect(markup).toContain("查看详情");
		expect(markup).toContain("品牌可见度 ↓");
		expect(markup).toContain('href="/app/brand-raw-id/prompts/prompt-raw-id?tab=web-queries"');
		expect(markup).not.toContain("View Details");
	});
});
