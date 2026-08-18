import { describe, expect, it } from "vitest";
import { describeCitationAvailability } from "@/server/citations";

describe("describeCitationAvailability", () => {
	it("distinguishes runs without extracted links from no evaluated runs", () => {
		expect(
			describeCitationAvailability({ evaluatedRuns: 13, searchEnabledRuns: 13, extractedCitationRuns: 0 }),
		).toEqual({ kind: "no_extracted_links" });
		expect(describeCitationAvailability({ evaluatedRuns: 0, searchEnabledRuns: 0, extractedCitationRuns: 0 })).toEqual({
			kind: "no_evaluated_runs",
		});
	});

	it("identifies runs without web search separately from runs with extracted links", () => {
		expect(describeCitationAvailability({ evaluatedRuns: 4, searchEnabledRuns: 0, extractedCitationRuns: 0 })).toEqual({
			kind: "no_search_enabled_runs",
		});
		expect(describeCitationAvailability({ evaluatedRuns: 4, searchEnabledRuns: 4, extractedCitationRuns: 2 })).toEqual({
			kind: "links_extracted",
		});
	});
});
