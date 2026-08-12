import { describe, expect, it } from "vitest";
import { normalizeManualPrompts, normalizeManualPromptValues, REPORT_REQUEST_LIMITS } from "./report-request-policy";

describe("report request budget policy", () => {
	it("trims, removes empty lines, and de-duplicates equivalent prompts", () => {
		expect(normalizeManualPrompts("  First prompt  \r\n\nfirst prompt\nＦＯＯ\nfoo ")).toEqual([
			"First prompt",
			"ＦＯＯ",
		]);
	});

	it("limits the unique manual prompt count", () => {
		const input = Array.from({ length: REPORT_REQUEST_LIMITS.manualPromptCount + 1 }, (_, i) => `prompt ${i}`).join(
			"\n",
		);
		expect(() => normalizeManualPrompts(input)).toThrow(/at most 50 manual prompts/);
	});

	it("limits each prompt and the aggregate request budget", () => {
		expect(() => normalizeManualPrompts("x".repeat(REPORT_REQUEST_LIMITS.manualPromptCharacters + 1))).toThrow(
			/Each manual prompt/,
		);

		const input = Array.from({ length: 16 }, (_, i) => `${i}-${"x".repeat(995)}`).join("\n");
		expect(() => normalizeManualPrompts(input)).toThrow(/must total 15000 characters/);
	});

	it("applies the same count and aggregate budget to API prompt arrays", () => {
		expect(normalizeManualPromptValues([" First prompt ", "first prompt", "Second prompt"])).toEqual([
			"First prompt",
			"Second prompt",
		]);
		expect(() =>
			normalizeManualPromptValues(
				Array.from({ length: REPORT_REQUEST_LIMITS.manualPromptCount + 1 }, (_, index) => `prompt ${index}`),
			),
		).toThrow(/at most 50 manual prompts/);
	});
});
