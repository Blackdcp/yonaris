import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { calculateOverseasRunNowCallCount, OverseasRunNowDialog } from "./overseas-run-now-dialog";

describe("OverseasRunNowDialog", () => {
	it("defaults all six Bright Data channels and five samples for PPIO", () => {
		const markup = renderToStaticMarkup(
			<OverseasRunNowDialog
				brandId="ppio"
				programs={[{ id: "scope-1", name: "Global Market", promptCount: 10, timezone: "America/Los_Angeles" }]}
				cohorts={[]}
				onRun={vi.fn()}
			/>,
		);

		for (const label of ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Google AI Mode", "Google AI Overview"]) {
			expect(markup).toContain(label);
		}
		expect(markup).toContain("10 × 6 × 5 = 300 calls");
		expect(markup).toContain("Run 300 overseas calls now");
		expect(markup).not.toContain('type="number"');
	});

	it("uses the same fixed five samples for any selected channel count", () => {
		expect(calculateOverseasRunNowCallCount(10, 6)).toBe(300);
		expect(calculateOverseasRunNowCallCount(10, 1)).toBe(50);
	});
});
