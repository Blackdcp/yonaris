import { describe, expect, it } from "vitest";
import { globalEnglishPageHead } from "./edition";

describe("global English SEO", () => {
	it("publishes canonical English and x-default without unreviewed Chinese alternates", () => {
		for (const key of ["home", "product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const) {
			const links = globalEnglishPageHead(key).links;
			expect(links.some((link) => link.rel === "canonical")).toBe(true);
			expect(links.some((link) => "hrefLang" in link && link.hrefLang === "x-default")).toBe(true);
			expect(links.some((link) => "hrefLang" in link && link.hrefLang === "zh-CN")).toBe(false);
		}
	});
});
