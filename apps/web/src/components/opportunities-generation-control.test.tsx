import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OpportunitiesGenerationControl, opportunityGenerationMessage } from "./opportunities-generation-control";

describe("OpportunitiesGenerationControl", () => {
	it("makes generation an explicit admin action for a brand and scope", () => {
		const markup = renderToStaticMarkup(<OpportunitiesGenerationControl onGenerate={vi.fn()} />);

		expect(markup).toContain("Generate opportunities report");
		expect(markup).toContain("Brand");
		expect(markup).toContain("Program");
		expect(markup).toContain("<select");
		expect(markup).not.toContain("Measurement scope ID");
		expect(markup).not.toContain("Brand ID");
	});
});

describe("opportunityGenerationMessage", () => {
	it("does not claim generation succeeded when the POST returns insufficient data", () => {
		expect(
			opportunityGenerationMessage({
				report: null,
				reason: "insufficient-data",
				generatedFor: null,
				lastEvaluatedAt: null,
			}),
		).toBe("No report was generated: this Program needs more tracking data.");
	});
});
