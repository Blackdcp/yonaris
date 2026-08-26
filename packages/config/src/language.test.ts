import { describe, expect, it } from "vitest";
import { isContentLanguage, parseContentLanguage } from "./language";

describe("content language", () => {
	for (const value of ["en", "zh-CN"] as const) {
		it(`accepts ${value}`, () => {
			expect(isContentLanguage(value)).toBe(true);
			expect(parseContentLanguage(value)).toBe(value);
		});
	}

	it("rejects markets, generic Chinese, and unknown values", () => {
		for (const value of ["CN", "SG", "zh", "zh-SG", "fr", ""]) {
			expect(isContentLanguage(value)).toBe(false);
		}
		expect(() => parseContentLanguage("zh")).toThrow("Unsupported language");
		expect(parseContentLanguage(undefined, "en")).toBe("en");
	});
});
