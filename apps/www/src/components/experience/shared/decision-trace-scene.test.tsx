import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionTraceScene, shouldAdvanceDecisionTrace } from "./decision-trace-scene";

function panelMarkup(html: string, state: "compare") {
	const panel = html.match(new RegExp(`<section[^>]+id="[^"]+-${state}"[^>]*>(.*?)</section>`))?.[1];
	expect(panel).toBeDefined();
	return panel ?? "";
}

describe("DecisionTraceScene", () => {
	it("keeps one question while exposing all four causal review states in SSR", () => {
		const html = renderToStaticMarkup(<DecisionTraceScene locale="en" />);

		expect(html.match(/Which partner can support this decision/g)?.length).toBe(1);
		for (const label of ["Observe", "Compare", "Inspect", "Decide"]) expect(html).toContain(label);
		expect(html.match(/role="tab"/g)).toHaveLength(4);
		expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
		for (const fact of ["79%", "35%", "42", "3,120", "30-day evaluation window", "approximately once per day"]) {
			expect(html).toContain(fact);
		}
	});

	it("moves causally from comparison through the evidence gap to one comparable next action", () => {
		const html = renderToStaticMarkup(<DecisionTraceScene locale="en" />);
		const compare = panelMarkup(html, "compare");
		const comparisonOrder = ["Your brand", "Competitor A", "Competitor B", "Competitor C"].map((label) =>
			compare.indexOf(label),
		);

		expect(compare).toContain("Share of Voice: 35%");
		expect(compare).toMatch(
			/<ol><li>Your brand<\/li><li>Competitor A<\/li><li>Competitor B<\/li><li>Competitor C<\/li><\/ol>/,
		);
		expect(comparisonOrder).toEqual([...comparisonOrder].sort((a, b) => a - b));
		expect(html).toContain("Public evidence gap");
		expect(html).toContain("Selected observation boundary");
		expect(html).toContain("Next action: Review one public comparison brief for the selected buying question.");
		expect(html).toContain(
			"Comparable retest: Run the same question against the same tracked comparison set and observation boundary.",
		);
		expect(html).toContain("not a recommendation");
		expect(html).not.toMatch(/Answer surface [ABC]/i);
	});

	it("does not expose automatic state changes as a live announcement channel", () => {
		const html = renderToStaticMarkup(<DecisionTraceScene locale="en" />);

		expect(html).not.toContain("aria-live");
	});

	it("localizes the fixed question, evidence gap, boundary, action, and retest", () => {
		const html = renderToStaticMarkup(<DecisionTraceScene locale="zh" />);
		const compare = panelMarkup(html, "compare");

		expect(html.match(/哪位合作伙伴能够支持这项决策/g)?.length).toBe(1);
		expect(compare).toContain("声量份额：35%");
		expect(compare).toMatch(/<ol><li>你的品牌<\/li><li>竞品甲<\/li><li>竞品乙<\/li><li>竞品丙<\/li><\/ol>/u);
		for (const label of ["公开证据缺口", "选定观测边界", "下一步行动", "可比复测", "不构成推荐"])
			expect(html).toContain(label);
	});
});

describe("shouldAdvanceDecisionTrace", () => {
	it.each([
		[
			"before hydration",
			{ hydrated: false, visible: true, reducedMotion: false, directlySelected: false, focusWithin: false },
		],
		[
			"while outside the viewport",
			{ hydrated: true, visible: false, reducedMotion: false, directlySelected: false, focusWithin: false },
		],
		[
			"when reduced motion is preferred",
			{ hydrated: true, visible: true, reducedMotion: true, directlySelected: false, focusWithin: false },
		],
		[
			"after a visitor directly selects a state",
			{ hydrated: true, visible: true, reducedMotion: false, directlySelected: true, focusWithin: false },
		],
		[
			"while focus is inside the scene",
			{ hydrated: true, visible: true, reducedMotion: false, directlySelected: false, focusWithin: true },
		],
	] as const)("does not advance %s", (_reason, conditions) => {
		expect(shouldAdvanceDecisionTrace(conditions)).toBe(false);
	});

	it("advances only after hydration while visible and without a reduced-motion preference", () => {
		expect(
			shouldAdvanceDecisionTrace({
				hydrated: true,
				visible: true,
				reducedMotion: false,
				directlySelected: false,
				focusWithin: false,
			}),
		).toBe(true);
	});
});
