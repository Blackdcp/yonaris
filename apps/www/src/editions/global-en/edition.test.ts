import { describe, expect, it } from "vitest";
import { GLOBAL_COPY } from "@/content/experience";
import { HUMAN_PAGE_KEYS } from "@/content/experience/types";
import { globalEnglishPageHead } from "./edition";

describe("global English SEO", () => {
	it("publishes every page with one title and reciprocal regional alternates", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			const head = globalEnglishPageHead(key);
			const canonical = head.links.find((link) => link.rel === "canonical");
			const ogImage = head.meta.find((item) => "property" in item && item.property === "og:image");
			const ogImageUrl = new URL(ogImage?.content ?? "", "https://www.yonaris.com");
			expect(head.meta).toContainEqual({ title: GLOBAL_COPY[key].metaTitle });
			expect(head.meta.some((item) => "name" in item && item.name === "description")).toBe(true);
			expect(head.meta).toContainEqual({ property: "og:locale", content: "en_US" });
			expect(head.meta).toContainEqual({ property: "og:type", content: "website" });
			expect(head.meta).toContainEqual({ property: "og:site_name", content: "Yonaris" });
			expect(head.meta).toContainEqual({ property: "og:url", content: canonical?.href });
			expect(ogImageUrl.pathname).toBe("/og.png");
			expect(ogImageUrl.searchParams.get("title")).toBe(GLOBAL_COPY[key].metaTitle);
			expect(ogImageUrl.searchParams.get("description")).toBe(GLOBAL_COPY[key].metaDescription);
			expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
			expect(head.meta).toContainEqual({ name: "twitter:image", content: ogImage?.content });
			expect(head.meta).toContainEqual({ name: "twitter:description", content: GLOBAL_COPY[key].metaDescription });
			expect(canonical).toBeDefined();
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "x-default")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "zh-CN")).toBe(true);
			expect(head.scripts.some((script) => script.children.includes('"inLanguage":"en"'))).toBe(true);
		}
	});
});
