import type { UiLanguage } from "@workspace/config/language";
import type { Brand } from "@workspace/lib/db/schema";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@tanstack/react-router", () => ({
	useRouteContext: () => ({
		clientConfig: {
			mode: "local",
			features: { showOptimizeButton: false },
			branding: { chartColors: ["#111111"] },
		},
	}),
}));
vi.mock("recharts", () => ({
	Bar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	Cell: () => null,
	ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	XAxis: () => null,
	YAxis: () => null,
}));
vi.mock("@/hooks/use-chart-download", () => ({
	useChartDownload: () => ({ chartRef: { current: null }, isDownloading: false, handleDownload: vi.fn() }),
}));
vi.mock("./base-chart", () => ({ BaseChart: () => <div data-testid="chart" /> }));
vi.mock("./history-button", () => ({ HistoryButton: () => null }));

import { BaseChartPrint } from "./base-chart-print";
import { ChartActionsFooter } from "./chart-actions-footer";
import { ChartDownloadFooter } from "./chart-download-footer";
import { ChartExportPreview } from "./chart-export-preview";
import { PromptChartPrint } from "./prompt-chart-print";

const brand = { id: "brand-1", name: "Acme" } as Brand;

function renderWithLocale(locale: UiLanguage, children: ReactNode): string {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

describe("chart surface localization", () => {
	it("localizes chart empty states and download controls", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<>
				<BaseChartPrint data={[]} brand={brand} competitors={[]} />
				<ChartDownloadFooter onDownload={vi.fn()} isDownloading={false} />
				<ChartDownloadFooter onDownload={vi.fn()} isDownloading />
				<ChartActionsFooter promptId="prompt-1" brandId="brand-1" onDownload={vi.fn()} />
			</>,
		);

		expect(markup).toContain("暂无数据");
		expect(markup).toContain('title="下载 PNG 图表"');
		expect(markup).toContain("导出 (PNG)");
		expect(markup).toContain("正在导出…");
		expect(markup).not.toContain("Download chart as PNG");
	});

	it("localizes prompt-chart evaluation and no-mention outcomes", () => {
		const commonProps = {
			lookback: "1m" as const,
			promptName: "Best CRM",
			promptId: "prompt-1",
			brand,
			competitors: [],
			promptRuns: [],
		};
		const firstRun = renderWithLocale("zh-CN", <PromptChartPrint {...commonProps} />);
		const emptyRange = renderWithLocale("zh-CN", <PromptChartPrint {...commonProps} hasEverBeenEvaluated />);

		expect(firstRun).toContain("首次评估中…");
		expect(emptyRange).toContain("所选时间范围内没有数据");
	});

	it("localizes exported visibility and logo accessibility without changing chart data", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<ChartExportPreview
				promptName="Best CRM"
				visibility={42}
				data={[{ date: "2025-07-21", "brand-1": 42 }]}
				lookback="all"
				brand={brand}
				competitors={[]}
				branding={{
					name: "Acme Portal",
					icon: "/icon.svg",
					url: "https://portal.example.com",
					isWhitelabel: true,
					chartColors: ["#111111"],
				}}
			/>,
		);

		expect(markup).toContain("42% 可见度");
		expect(markup).toContain('alt="Acme Portal 标志"');
		expect(markup).toContain('data-testid="chart"');
		expect(markup).toContain("portal.example.com");
	});
});
