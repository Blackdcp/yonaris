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
