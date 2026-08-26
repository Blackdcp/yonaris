import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("recharts", () => ({
	Area: () => null,
	AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CartesianGrid: () => null,
	Cell: () => null,
	Pie: ({ data }: { data: Array<{ name: string }> }) => <div>{data.map((item) => item.name).join("|")}</div>,
	PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	Tooltip: () => null,
	XAxis: ({ tickFormatter }: { tickFormatter: (value: string) => string }) => (
		<span data-testid="x-axis-date">{tickFormatter("2026-08-15")}</span>
	),
	YAxis: () => null,
}));
vi.mock("@workspace/ui/components/chart", () => ({
	ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	ChartTooltip: ({
		content,
	}: {
		content: (props: { active: boolean; payload: Array<{ value: number }>; label: string }) => ReactNode;
	}) => <div>{content({ active: true, payload: [{ value: 42 }], label: "2026-08-15" })}</div>,
}));

import { ShareOfVoiceDonut } from "./share-of-voice-donut";
import { TrendChart } from "./trend-chart";

describe("customer trend chart localization", () => {
	it("formats trend axis and tooltip dates with the selected UI language", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<TrendChart data={[{ date: "2026-08-15", value: 42 }]} label="可见度" color="#123456" />
			</I18nProvider>,
		);

		expect(markup).toContain("8月15日");
		expect(markup).toContain("2026年8月15日");
		expect(markup).toContain("可见度");
		expect(markup).not.toContain("August 15, 2026");
	});

	it("localizes only the aggregate donut bucket and preserves entity names", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<ShareOfVoiceDonut
					topN={1}
					entries={[
						{ name: "StepFun 原名", mentions: 8, prompts: 2, share: 0.8, isBrand: true },
						{ name: "DeepSeek 原名", mentions: 1, prompts: 1, share: 0.1, isBrand: false },
						{ name: "Moonshot AI 原名", mentions: 1, prompts: 1, share: 0.1, isBrand: false },
					]}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("DeepSeek 原名");
		expect(markup).toContain("其他");
		expect(markup).not.toContain("Others");
	});
});
