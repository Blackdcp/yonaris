import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DecisionTraceScene, shouldAdvanceDecisionTrace } from "./decision-trace-scene";

describe("DecisionTraceScene", () => {
	it("keeps one question while exposing all four review states in SSR", () => {
		const html = renderToStaticMarkup(<DecisionTraceScene locale="en" />);

		expect(html.match(/Which partner can support this decision/g)?.length).toBe(1);
		for (const label of ["Observe", "Compare", "Inspect", "Decide"]) expect(html).toContain(label);
		expect(html).toContain("79%");
		expect(html).toContain("35%");
		expect(html).toContain("Sample workspace");
	});
});

describe("shouldAdvanceDecisionTrace", () => {
	it.each([
		["before hydration", { hydrated: false, visible: true, reducedMotion: false, directlySelected: false }],
		["while outside the viewport", { hydrated: true, visible: false, reducedMotion: false, directlySelected: false }],
		["when reduced motion is preferred", { hydrated: true, visible: true, reducedMotion: true, directlySelected: false }],
		["after a visitor directly selects a state", { hydrated: true, visible: true, reducedMotion: false, directlySelected: true }],
	] as const)("does not advance %s", (_reason, conditions) => {
		expect(shouldAdvanceDecisionTrace(conditions)).toBe(false);
	});

	it("advances only after hydration while visible and without a reduced-motion preference", () => {
		expect(
			shouldAdvanceDecisionTrace({ hydrated: true, visible: true, reducedMotion: false, directlySelected: false }),
		).toBe(true);
	});
});
