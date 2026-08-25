import { describe, expect, it } from "vitest";
import { CHINA_COPY, HUMAN_PAGE_KEYS } from "@/content/experience";
import { zhPageHead } from "./edition";

describe("China edition SEO", () => {
	it("uses native Chinese copy and canonical China routes", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			const head = zhPageHead(key);
			const canonical = head.links.find((link) => link.rel === "canonical");
			expect(head.meta).toContainEqual({ title: CHINA_COPY[key].metaTitle });
			expect(head.meta).toContainEqual({ name: "description", content: CHINA_COPY[key].metaDescription });
			expect(head.meta).toContainEqual({ property: "og:locale", content: "zh_CN" });
			expect(head.meta).toContainEqual({ name: "twitter:description", content: CHINA_COPY[key].metaDescription });
			expect(canonical?.href).toMatch(key === "home" ? /\/zh$/ : new RegExp(`/zh/${key}$`));
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "zh-CN")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "en")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "x-default")).toBe(true);
			expect(head.scripts.some((script) => script.children.includes('"inLanguage":"zh-CN"'))).toBe(true);
		}
	});
});
