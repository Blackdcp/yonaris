import { describe, expect, it } from "vitest";
import { productDemoFor } from "./product-demo";

describe("public product demo content", () => {
	it("keeps the overview within the approved public numeric boundary", () => {
		const en = productDemoFor("en");
		const zh = productDemoFor("zh");

		expect(en.overview).toMatchObject({ visibility: 79, share: 35, prompts: 42, evaluations: 3120 });
		expect(en.overview.evaluationWindow).toContain("30-day");
		expect(en.overview.frequencyNote).toMatch(/approximately once per day/i);
		expect(zh.overview.evaluationWindow).toContain("30 天");
		expect(zh.overview.frequencyNote).toMatch(/约每天.*一次/u);
		expect(JSON.stringify({ en, zh })).not.toMatch(/100 evaluations|100 次评估/i);
	});

	it("provides trend and safe freshness labels without adding metric values", () => {
		const en = productDemoFor("en");
		const zh = productDemoFor("zh");

		expect(en.overview.trends).toEqual({
			visibility: "30-day AI Visibility trend",
			share: "30-day Share of Voice trend",
		});
		expect(en.overview.lastUpdated).toBe("Last updated within the displayed window.");
		expect(zh.overview.trends).toEqual({ visibility: "30 天 AI 可见度趋势", share: "30 天声量份额趋势" });
		expect(zh.overview.lastUpdated).toBe("最近一次更新在当前显示时间窗内。");
	});

	it("keeps an ordered comparison set without granular competitor metrics", () => {
		const en = productDemoFor("en");
		const zh = productDemoFor("zh");

		expect(en.shareOfVoice.rows.map((row) => row.brand)).toEqual([
			"Your brand",
			"Competitor A",
			"Competitor B",
			"Competitor C",
		]);
		expect(zh.shareOfVoice.rows.map((row) => row.brand)).toEqual(["你的品牌", "竞品甲", "竞品乙", "竞品丙"]);
		expect(
			[...en.shareOfVoice.rows, ...zh.shareOfVoice.rows].every((row) =>
				Object.keys(row).every((key) => key === "brand"),
			),
		).toBe(true);
	});

	it("maps opportunities to the four implemented review categories", () => {
		expect(productDemoFor("en").opportunities.rows.map((row) => row.category)).toEqual([
			"Creation",
			"Existing content",
			"Outreach",
			"Evidence expansion",
		]);
		expect(productDemoFor("zh").opportunities.rows.map((row) => row.category)).toEqual([
			"新建内容",
			"现有内容",
			"外部拓展",
			"证据扩展",
		]);
	});

	it("models fan-out as prompt rewrites with Added, Preserved, and Boundary explanations", () => {
		const en = productDemoFor("en");
		const zh = productDemoFor("zh");

		expect(en.queryFanOut.lines.map((line) => line.relationship)).toEqual(["Added", "Preserved", "Boundary"]);
		expect(en.queryFanOut.lines.every((line) => line.query !== en.queryFanOut.prompt)).toBe(true);
		expect(zh.queryFanOut.lines.map((line) => line.relationship)).toEqual(["新增", "保留", "边界"]);
		expect(zh.queryFanOut.lines.every((line) => /[\u4e00-\u9fff]/u.test(line.query))).toBe(true);
		expect(JSON.stringify({ en: en.queryFanOut, zh: zh.queryFanOut })).not.toMatch(/Answer surface|答案界面/u);
	});

	it("localizes the Chinese evidence rather than wrapping English prompts", () => {
		const zh = productDemoFor("zh");
		expect(zh.labels.sampleWorkspace).toContain("示例工作区");
		expect(zh.queryFanOut.prompt).toMatch(/[\u4e00-\u9fff]/u);
		expect(zh.queryFanOut.prompt).not.toContain("What should");
	});
});
