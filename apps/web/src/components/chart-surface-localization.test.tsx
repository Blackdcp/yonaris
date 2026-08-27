import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import type { Brand, Competitor } from "@workspace/lib/db/schema";
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
	Bar: ({ children, label }: { children: ReactNode; label?: { formatter?: (value: unknown) => string } }) => (
		<div data-bar-label={label?.formatter?.(50)}>{children}</div>
	),
	BarChart: ({ children, data }: { children: ReactNode; data: { name: string; value: number }[] }) => (
		<div
			data-values={JSON.stringify(data.map((point) => point.value))}
			data-names={JSON.stringify(data.map((point) => point.name))}
		>
			{children}
		</div>
	),
	Cell: () => null,
	ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	XAxis: () => null,
	YAxis: ({ tickFormatter }: { tickFormatter: (value: number) => string }) => (
		<span data-y-axis={tickFormatter(1_234)}>axis</span>
	),
}));
vi.mock("@/hooks/use-chart-download", () => ({
	useChartDownload: () => ({ chartRef: { current: null }, isDownloading: false, handleDownload: vi.fn() }),
}));
vi.mock("./base-chart", () => ({
	BaseChart: ({
		outputLanguage,
		data,
		brand,
		competitors,
	}: {
		outputLanguage?: OutputLanguage;
		data: Array<Record<string, unknown>>;
		brand: Brand;
		competitors: Competitor[];
	}) => (
		<div
			data-testid="chart"
			data-output-language={outputLanguage}
			data-values={JSON.stringify(data)}
			data-brand={brand.name}
			data-competitors={competitors.map((item) => item.name).join("|")}
		/>
	),
}));
vi.mock("./history-button", () => ({ HistoryButton: () => null }));

import { BaseChartPrint } from "./base-chart-print";
import { ChartActionsFooter } from "./chart-actions-footer";
import { ChartDownloadFooter } from "./chart-download-footer";
import { ChartExportPreview } from "./chart-export-preview";
import { PromptChartPrint } from "./prompt-chart-print";

const brand = { id: "brand-1", name: "Acme" } as Brand;
const competitor = { id: "competitor-1", name: "Rival" } as Competitor;

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

	it("localizes the report-context share-of-voice metric without changing computed values", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<PromptChartPrint
				outputLanguage="zh-CN"
				lookback="1m"
				promptName="Best CRM"
				promptId="prompt-1"
				brand={brand}
				competitors={[competitor]}
				category="strength"
				promptRuns={[
					{
						id: "run-1",
						promptId: "prompt-1",
						brandId: "brand-1",
						brandMentioned: true,
						competitorsMentioned: [],
						createdAt: new Date("2025-07-21T00:00:00Z"),
						model: "gpt-5",
						provider: "openai",
						version: "1",
						webSearchEnabled: false,
						rawOutput: null,
						webQueries: [],
					},
					{
						id: "run-2",
						promptId: "prompt-1",
						brandId: "brand-1",
						brandMentioned: false,
						competitorsMentioned: ["Rival"],
						createdAt: new Date("2025-07-21T00:00:00Z"),
						model: "gpt-5",
						provider: "openai",
						version: "1",
						webSearchEnabled: false,
						rawOutput: null,
						webQueries: [],
					},
				]}
			/>,
		);

		expect(markup).toContain("50% 声量份额");
		expect(markup).not.toContain("SoV");
		expect(markup).toContain('data-values="[50,50]"');
	});

	it.each([
		{ uiLanguage: "en", outputLanguage: "zh-CN", expected: "50% 声量份额", stale: "Share of Voice" },
		{ uiLanguage: "zh-CN", outputLanguage: "en", expected: "50% Share of Voice", stale: "声量份额" },
	] as const)(
		"renders report charts in $outputLanguage under $uiLanguage UI without translating evidence or metrics",
		({ uiLanguage, outputLanguage, expected, stale }) => {
			const rawPrompt = "RAW Prompt 原样 #42";
			const rawBrand = { ...brand, name: "Brand 原名 / RAW" } as Brand;
			const rawCompetitor = { ...competitor, name: "原始竞品 / Raw Rival" } as Competitor;
			const markup = renderWithLocale(
				uiLanguage,
				<PromptChartPrint
					outputLanguage={outputLanguage}
					lookback="1m"
					promptName={rawPrompt}
					promptId="prompt-1"
					brand={rawBrand}
					competitors={[rawCompetitor]}
					category="strength"
					promptRuns={[
						{
							id: "run-1",
							promptId: "prompt-1",
							brandId: rawBrand.id,
							brandMentioned: true,
							competitorsMentioned: [],
							createdAt: new Date("2026-08-20T00:00:00.000Z"),
							model: "model/raw",
							provider: "provider/raw",
							version: "raw-v1",
							webSearchEnabled: true,
							textContent: "RAW Answer 原样，保持字节不变",
							rawOutput: { citations: [{ title: "RAW Citation 原样", url: "https://raw.example/CN?q=A%2FB" }] },
							webQueries: ["RAW Query 原样 +ID"],
						},
						{
							id: "run-2",
							promptId: "prompt-1",
							brandId: rawBrand.id,
							brandMentioned: false,
							competitorsMentioned: [rawCompetitor.name],
							createdAt: new Date("2026-08-20T00:01:00.000Z"),
							model: "model/raw",
							provider: "provider/raw",
							version: "raw-v1",
							webSearchEnabled: true,
							textContent: "RAW Answer 2 原样",
							rawOutput: null,
							webQueries: ["RAW Query 2 原样"],
						},
					]}
				/>,
			);

			expect(markup).toContain(`lang="${outputLanguage}"`);
			expect(markup).toContain(expected);
			expect(markup).not.toContain(stale);
			expect(markup).toContain(rawPrompt);
			expect(markup).toContain(rawBrand.name);
			expect(markup).toContain(rawCompetitor.name);
			expect(markup).toContain('data-values="[50,50]"');
			expect(markup).toContain('data-names="[&quot;Brand 原名 / RAW&quot;,&quot;原始竞品 / Raw Rival&quot;]"');
		},
	);

	it("uses explicit report language for empty copy, download copy, and chart number formatting", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<>
				<BaseChartPrint outputLanguage="en" data={[]} brand={brand} competitors={[]} />
				<BaseChartPrint outputLanguage="en" data={[{ date: "sov", "brand-1": 1_234 }]} brand={brand} competitors={[]} />
				<ChartDownloadFooter outputLanguage="en" onDownload={vi.fn()} isDownloading={false} />
				<ChartDownloadFooter outputLanguage="en" onDownload={vi.fn()} isDownloading />
			</>,
		);

		expect(markup).toContain("No data available");
		expect(markup).not.toContain("暂无数据");
		expect(markup).toContain('title="Download chart as PNG"');
		expect(markup).toContain("Export (PNG)");
		expect(markup).toContain("Exporting…");
		expect(markup).toContain('data-y-axis="1,234%"');
		expect(markup).toContain('data-bar-label="50%"');
	});

	it("localizes exported visibility and logo accessibility without changing chart data", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<ChartExportPreview
				outputLanguage="zh-CN"
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

	it.each([
		{ uiLanguage: "en", outputLanguage: "zh-CN", expected: "42% 可见度", stale: "42% Visibility" },
		{ uiLanguage: "zh-CN", outputLanguage: "en", expected: "42% Visibility", stale: "42% 可见度" },
	] as const)(
		"binds the PNG capture root to $outputLanguage under $uiLanguage UI",
		({ uiLanguage, outputLanguage, expected, stale }) => {
			const rawBrand = { ...brand, name: "RAW Brand 原名" } as Brand;
			const rawCompetitor = { ...competitor, name: "原始竞品 / Raw Rival" } as Competitor;
			const markup = renderWithLocale(
				uiLanguage,
				<ChartExportPreview
					outputLanguage={outputLanguage}
					promptName="RAW Prompt 原样 #42"
					visibility={42}
					data={[{ date: "2025-07-21", "brand-1": 42, "competitor-1": 9 }]}
					lookback="all"
					brand={rawBrand}
					competitors={[rawCompetitor]}
					branding={{
						name: "Raw Portal 原名",
						icon: "/raw-icon.svg",
						url: "https://raw.example/CN",
						isWhitelabel: true,
						chartColors: ["#111111", "#222222"],
					}}
				/>,
			);

			expect(markup).toContain(`lang="${outputLanguage}"`);
			expect(markup).toContain(expected);
			expect(markup).not.toContain(stale);
			expect(markup).toContain("RAW Prompt 原样 #42");
			expect(markup).toContain(`data-output-language="${outputLanguage}"`);
			expect(markup).toContain('data-brand="RAW Brand 原名"');
			expect(markup).toContain('data-competitors="原始竞品 / Raw Rival"');
			expect(markup).toContain("raw.example/CN");
		},
	);
});
