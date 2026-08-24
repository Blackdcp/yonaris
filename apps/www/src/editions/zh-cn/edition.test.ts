import { describe, expect, it } from "vitest";
import { ZH_PAGE_CONTENT } from "@/content/site/zh-cn/experience";
import { zhPageHead } from "./edition";

describe("China edition SEO", () => {
	it("uses the rebuilt Chinese page copy and canonical Chinese routes", () => {
		for (const key of ["home", "product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const) {
			const head = zhPageHead(key);
			const canonical = head.links.find((link) => "rel" in link && link.rel === "canonical");

			expect(head.meta).toContainEqual({ name: "description", content: ZH_PAGE_CONTENT[key].lead });
			expect(canonical && "href" in canonical ? canonical.href : undefined).toMatch(
				key === "home" ? /\/zh$/ : new RegExp(`/zh/${key}$`),
			);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "zh-CN")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "x-default")).toBe(false);
		}
	});
});
