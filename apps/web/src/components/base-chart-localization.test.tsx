import type { UiLanguage } from "@workspace/config/language";
import type { Brand } from "@workspace/lib/db/schema";
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

function renderChart(locale: UiLanguage): string {
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<BaseChart
				data={[{ date: "2025-07-21", "brand-1": 42 }]}
				lookback="all"
				brand={brand}
				competitors={[]}
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
});
