import { describe, expect, it } from "vitest";
import { GLOBAL_COPY } from "@/content/experience";
import { HUMAN_PAGE_KEYS } from "@/content/experience/types";
import { agentCatalogPath, agentMarkdownPath, getAgentTopic } from "@/lib/machine-documents";
import { siteHref } from "@/lib/seo";
import { globalEnglishPageHead } from "./edition";

describe("global English SEO", () => {
	it("publishes every page with one title and reciprocal regional alternates", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			const head = globalEnglishPageHead(key);
			expect(head.meta).toContainEqual({ name: "theme-color", content: "#f2ede3" });
			expect(head.meta).not.toContainEqual({ name: "theme-color", content: "#f6f4f1" });
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
			expect(head.links).toContainEqual({
				rel: "alternate",
				type: "text/markdown",
				href: siteHref(agentMarkdownPath("en", key)),
			});
			expect(head.links).toContainEqual({
				rel: "alternate",
				type: "application/ld+json",
				href: siteHref(agentCatalogPath("en")),
			});
			expect(head.links).toContainEqual({ rel: "describedby", type: "text/plain", href: siteHref("/llms.txt") });
			const graph = head.scripts.map((script) => JSON.parse(script.children)).find((script) => script["@graph"]);
			const topic = getAgentTopic("en", key);
			expect(graph["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual([
				"Organization",
				"WebSite",
				"WebPage",
				"ItemList",
			]);
			expect(graph["@graph"][0]).not.toHaveProperty("inLanguage");
			expect(graph["@graph"][2]).toMatchObject({
				"@id": `${siteHref(topic.humanPath)}#webpage`,
				inLanguage: "en",
			});
			expect(graph["@graph"][3].itemListElement.map((item: { identifier: string }) => item.identifier)).toEqual(
				topic.groups.flatMap((group) => group.facts.map((fact) => fact.id)),
			);
		}
	});
});
