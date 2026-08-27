import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import type { Brand, Competitor } from "@workspace/lib/db/schema";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@tanstack/react-router", () => ({ useRouteContext: () => ({}) }));

vi.mock("recharts", () => ({
	Bar: () => null,
	BarChart: ({ children, data }: { children: ReactNode; data: Record<string, unknown>[] }) => (
		<div data-values={JSON.stringify(data.map((point) => point["brand-1"]))}>{children}</div>
	),
	CartesianGrid: () => null,
	Line: () => null,
	LineChart: ({ children, data }: { children: ReactNode; data: Record<string, unknown>[] }) => (
		<div data-values={JSON.stringify(data.map((point) => point["brand-1"]))}>{children}</div>
	),
	XAxis: ({ tickFormatter }: { tickFormatter: (value: string) => string }) => (
		<span data-testid="date-axis">{tickFormatter("2025-07-21")}</span>
	),
	YAxis: ({ tickFormatter }: { tickFormatter: (value: number) => string }) => (
		<span data-testid="value-axis">{tickFormatter(42)}</span>
	),
}));

vi.mock("@workspace/ui/components/chart", () => ({
	ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	ChartLegend: () => null,
	ChartLegendContent: () => null,
	ChartTooltip: () => null,
	ChartTooltipContent: () => null,
}));

import { BaseChart } from "./base-chart";

const brand = { id: "brand-1", name: "Acme" } as Brand;
const competitor = { id: "competitor-1", name: "原始竞品 / Raw Rival" } as Competitor;

function renderChart(locale: UiLanguage, outputLanguage?: OutputLanguage): string {
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<BaseChart
				outputLanguage={outputLanguage}
				data={[{ date: "2025-07-21", "brand-1": 42, "competitor-1": 9 }]}
				lookback="all"
				brand={brand}
				competitors={[competitor]}
				chartColors={["#111111"]}
			/>
		</I18nProvider>,
	);
}

describe("BaseChart localization", () => {
	it("formats the same UTC chart point for the resolved UI locale without changing its value", () => {
		const english = renderChart("en");
		const chinese = renderChart("zh-CN");

		expect(english).toContain("Jul 21");
		expect(chinese).toContain("7月21日");
		expect(english).toContain('data-values="[42]"');
		expect(chinese).toContain('data-values="[42]"');
		expect(english).not.toBe(chinese);
	});

	it.each([
		{ uiLanguage: "en", outputLanguage: "zh-CN", expectedDate: "7月21日" },
		{ uiLanguage: "zh-CN", outputLanguage: "en", expectedDate: "Jul 21" },
	] as const)(
		"formats PNG chart axes from explicit $outputLanguage under $uiLanguage UI without changing values",
		({ uiLanguage, outputLanguage, expectedDate }) => {
			const markup = renderChart(uiLanguage, outputLanguage);

			expect(markup).toContain(expectedDate);
			expect(markup).toContain('data-values="[42');
			expect(markup).toContain('data-testid="value-axis">42%</span>');
		},
	);
});
