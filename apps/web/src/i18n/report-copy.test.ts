import { describe, expect, it } from "vitest";
import { getReportCopy, parseReportRenderLanguage } from "./report-copy";

describe("printable report copy", () => {
	it("provides complete representative English and Simplified Chinese report language", () => {
		const english = getReportCopy("en");
		const chinese = getReportCopy("zh-CN");

		expect(english.reportTitle).toBe("AI Share of Voice Report");
		expect(chinese.reportTitle).toBe("AI 声量份额报告");
		expect(english.status("completed")).toBe("Completed");
		expect(chinese.status("completed")).toBe("已完成");
		expect(english.recommendation("high")).toBe("Prioritize content creation to establish AI presence");
		expect(chinese.recommendation("high")).toBe("优先构建高价值内容，夯实品牌在 AI 答案中的影响力");
		expect(english.chart.shareOfVoice).toBe("Share of Voice");
		expect(chinese.chart.shareOfVoice).toBe("声量份额");
		expect(english.chart.noDataAvailable).toBe("No data available");
		expect(chinese.chart.noDataAvailable).toBe("暂无数据");
		expect(english.chart.downloadPng).toBe("Download chart as PNG");
		expect(chinese.chart.downloadPng).toBe("下载 PNG 图表");
		expect(english.chart.logoAlt("Raw Brand 原名")).toBe("Raw Brand 原名 logo");
		expect(chinese.chart.logoAlt("Raw Brand 原名")).toBe("Raw Brand 原名 标志");
		expect(chinese.writeArticlesRecommendation(6, "RAW Prompt 原样 #42")).toBe(
			"围绕“RAW Prompt 原样 #42”创作 6 篇适配大模型检索与引用的内容",
		);
	});

	it("formats report dates and numbers from the explicit output language", () => {
		const instant = new Date("2026-08-20T12:00:00.000Z");
		const english = getReportCopy("en");
		const chinese = getReportCopy("zh-CN");

		expect(english.formatDate(instant)).toBe("August 20, 2026");
		expect(chinese.formatDate(instant)).toBe("2026年8月20日");
		expect(english.formatNumber(12_345)).toBe("12,345");
		expect(chinese.formatNumber(12_345)).toBe("12,345");
		expect(english.formatPercent(42)).toBe("42%");
		expect(chinese.formatPercent(42)).toBe("42%");
		expect(english.formatDate(instant, { month: "short", day: "numeric", timeZone: "UTC" })).toBe("Aug 20");
		expect(chinese.formatDate(instant, { month: "short", day: "numeric", timeZone: "UTC" })).toBe("8月20日");
	});

	it("keeps date-only artifact labels on their UTC calendar day outside UTC", () => {
		const previousTimeZone = process.env.TZ;
		process.env.TZ = "America/Los_Angeles";
		try {
			const utcMidnight = new Date(Date.UTC(2025, 6, 21));
			expect(getReportCopy("en").formatDate(utcMidnight, { month: "short", day: "numeric" })).toBe("Jul 21");
			expect(getReportCopy("zh-CN").formatDate(utcMidnight, { month: "short", day: "numeric" })).toBe("7月21日");
		} finally {
			if (previousTimeZone === undefined) delete process.env.TZ;
			else process.env.TZ = previousTimeZone;
		}
	});
});

describe("printable report language override", () => {
	it.each([
		{ value: undefined, persisted: "en", expected: "en" },
		{ value: undefined, persisted: "zh-CN", expected: "zh-CN" },
		{ value: "en", persisted: "zh-CN", expected: "en" },
		{ value: "zh-CN", persisted: "en", expected: "zh-CN" },
		{ value: "zh", persisted: "zh-CN", expected: "zh-CN" },
		{ value: "CN", persisted: "en", expected: "en" },
		{ value: "zh-SG", persisted: "zh-CN", expected: "zh-CN" },
		{ value: ["zh-CN"], persisted: "en", expected: "en" },
	] as const)("resolves $value over persisted $persisted to $expected", ({ value, persisted, expected }) => {
		expect(parseReportRenderLanguage(value, persisted)).toBe(expected);
	});
});
