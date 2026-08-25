import { describe, expect, it } from "vitest";
import { CHINA_COPY, HUMAN_PAGE_KEYS } from "@/content/experience";
import { agentCatalogPath, agentMarkdownPath, getAgentTopic } from "@/lib/machine-documents";
import { siteHref } from "@/lib/seo";
import { zhPageHead } from "./edition";

describe("China edition SEO", () => {
	it("uses native Chinese copy and canonical China routes", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			const head = zhPageHead(key);
			const canonical = head.links.find((link) => link.rel === "canonical");
			const ogImage = head.meta.find((item) => "property" in item && item.property === "og:image");
			const ogImageUrl = new URL(ogImage?.content ?? "", "https://www.yonaris.com");
			expect(head.meta).toContainEqual({ title: CHINA_COPY[key].metaTitle });
			expect(head.meta).toContainEqual({ name: "description", content: CHINA_COPY[key].metaDescription });
			expect(head.meta).toContainEqual({ property: "og:locale", content: "zh_CN" });
			expect(head.meta).toContainEqual({ property: "og:type", content: "website" });
			expect(head.meta).toContainEqual({ property: "og:site_name", content: "Yonaris" });
			expect(head.meta).toContainEqual({ property: "og:url", content: canonical?.href });
			expect(ogImageUrl.pathname).toBe("/og.png");
			expect(ogImageUrl.searchParams.get("title")).toBe(CHINA_COPY[key].metaTitle);
			expect(ogImageUrl.searchParams.get("description")).toBe(CHINA_COPY[key].metaDescription);
			expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
			expect(head.meta).toContainEqual({ name: "twitter:image", content: ogImage?.content });
			expect(head.meta).toContainEqual({ name: "twitter:description", content: CHINA_COPY[key].metaDescription });
			expect(canonical?.href).toMatch(key === "home" ? /\/zh$/ : new RegExp(`/zh/${key}$`));
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "zh-CN")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "en")).toBe(true);
			expect(head.links.some((link) => "hrefLang" in link && link.hrefLang === "x-default")).toBe(true);
			expect(head.links).toContainEqual({
				rel: "alternate",
				type: "text/markdown",
				href: siteHref(agentMarkdownPath("zh", key)),
			});
			expect(head.links).toContainEqual({
				rel: "alternate",
				type: "application/ld+json",
				href: siteHref(agentCatalogPath("zh")),
			});
			expect(head.links).toContainEqual({ rel: "describedby", type: "text/plain", href: siteHref("/llms.txt") });
			const graph = head.scripts.map((script) => JSON.parse(script.children)).find((script) => script["@graph"]);
			const topic = getAgentTopic("zh", key);
			expect(graph["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual([
				"Organization",
				"WebSite",
				"WebPage",
				"ItemList",
			]);
			expect(graph["@graph"][0]).not.toHaveProperty("inLanguage");
			expect(graph["@graph"][2]).toMatchObject({
				"@id": `${siteHref(topic.humanPath)}#webpage`,
				inLanguage: "zh-CN",
			});
			expect(graph["@graph"][3].itemListElement.map((item: { identifier: string }) => item.identifier)).toEqual(
				topic.groups.flatMap((group) => group.facts.map((fact) => fact.id)),
			);
		}
	});
});
