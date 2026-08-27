import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductProofScene } from "./product-proof-scene";

describe("ProductProofScene", () => {
	it("renders every accessible view and safe overview state in SSR", () => {
		const html = renderToStaticMarkup(<ProductProofScene locale="en" />);

		expect(html).toContain('role="tablist"');
		expect(html.match(/role="tab"/g)).toHaveLength(4);
		expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
		expect(html).toContain("<dd>79%</dd>");
		expect(html).toContain("<dd>35%</dd>");
		expect(html).toContain("3,120");
		expect(html).toContain("30-day AI Visibility trend");
		expect(html).toContain("30-day Share of Voice trend");
		expect(html.match(/<path[^>]+stroke="currentColor"/g)).toHaveLength(2);
		expect(html).toContain("Last updated within the displayed window.");
		expect(html).toContain("Sample workspace");
		expect(html).not.toMatch(/100 evaluations|customer result|guaranteed|benchmark/i);
	});

	it("renders the ordered comparison set and implemented opportunity categories", () => {
		const html = renderToStaticMarkup(<ProductProofScene locale="en" />);
		const comparisonOrder = ["Your brand", "Competitor A", "Competitor B", "Competitor C"].map((label) =>
			html.indexOf(label),
		);

		expect(comparisonOrder).toEqual([...comparisonOrder].sort((a, b) => a - b));
		for (const category of ["Creation", "Existing content", "Outreach", "Evidence expansion"]) {
			expect(html).toContain(category);
		}
		expect(html).not.toMatch(/mentions|citations|Competitor A\s*\d|Competitor B\s*\d|Competitor C\s*\d/i);
	});

	it("shows the prompt before realistic rewritten queries and their relationships", () => {
		const html = renderToStaticMarkup(<ProductProofScene locale="en" />);
		const promptIndex = html.indexOf("What should a buyer compare before choosing an analytics partner?");
		const firstQueryIndex = html.indexOf("analytics partner evaluation criteria");

		expect(promptIndex).toBeGreaterThan(-1);
		expect(firstQueryIndex).toBeGreaterThan(promptIndex);
		for (const relationship of ["Added", "Preserved", "Boundary"]) expect(html).toContain(relationship);
		expect(html).not.toMatch(/Answer surface [ABC]|model coverage/i);
	});

	it("renders independently localized Chinese product evidence", () => {
		const html = renderToStaticMarkup(<ProductProofScene locale="zh" />);

		expect(html).toContain("<dd>79%</dd>");
		expect(html).toContain("<dd>35%</dd>");
		for (const label of [
			"你的品牌",
			"竞品甲",
			"竞品乙",
			"竞品丙",
			"新建内容",
			"现有内容",
			"外部拓展",
			"证据扩展",
			"新增",
			"保留",
			"边界",
		]) {
			expect(html).toContain(label);
		}
		expect(html).not.toContain("What should");
	});
});
