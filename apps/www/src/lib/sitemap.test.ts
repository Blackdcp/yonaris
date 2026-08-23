import { describe, expect, test } from "vitest";

type SitemapModule = typeof import("./sitemap");

async function loadSitemap(): Promise<SitemapModule | undefined> {
	try {
		return (await import("./sitemap")) as SitemapModule;
	} catch {
		return undefined;
	}
}

const sitemap = await loadSitemap();

function requireSitemap(): SitemapModule | undefined {
	expect(sitemap, "the manifest-driven sitemap module must load").toBeDefined();
	return sitemap;
}

const corePairs = [
	["/", "/zh"],
	["/product", "/zh/product"],
	["/approach", "/zh/approach"],
	["/research", "/zh/research"],
	["/company", "/zh/company"],
	["/geo", "/zh/geo"],
	["/diagnostic", "/zh/diagnostic"],
] as const;

const approvedPaths = [
	"/",
	"/zh",
	"/product",
	"/zh/product",
	"/approach",
	"/zh/approach",
	"/research",
	"/zh/research",
	"/company",
	"/zh/company",
	"/geo",
	"/zh/geo",
	"/diagnostic",
	"/zh/diagnostic",
	"/resources",
	"/open-source",
	"/privacy",
	"/docs",
	"/status",
	"/brand",
	"/changelog",
] as const;

describe("manifest-driven sitemap", () => {
	test("contains only approved indexable canonical entries", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const paths = subject.buildSitemapEntries().map(({ path }) => path);
		expect(paths).toEqual(approvedPaths);
		expect(new Set(paths).size).toBe(paths.length);
	});

	test("excludes redirect, legacy, and machine URLs", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const paths = subject.buildSitemapEntries().map(({ path }) => path);
		for (const excluded of [
			"/platform",
			"/methodology",
			"/results",
			"/blog",
			"/glossary",
			"/roadmap",
			"/ai-search",
			"/aeo-for",
			"/ai-visibility-tools",
			"/agent",
			"/agent/company",
			"/agent/product",
			"/agent/approach",
			"/agent/research",
			"/agent/geo",
			"/agent/diagnostic",
			"/llms.txt",
			"/llms-full.txt",
			"/llms.mdx/site/en/product",
			"/sitemap.xml",
			"/robots.txt",
		]) {
			expect(paths).not.toContain(excluded);
		}
	});

	test("uses real core verification dates without inventing utility lastmod values", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const entries = subject.buildSitemapEntries();
		for (const path of corePairs.flat()) {
			expect(entries.find((entry) => entry.path === path)?.lastVerified).toBe("2026-08-22");
		}
		for (const path of ["/resources", "/open-source", "/privacy", "/docs", "/status", "/brand", "/changelog"]) {
			expect(entries.find((entry) => entry.path === path)?.lastVerified).toBeUndefined();
		}
	});

	test("adds reciprocal English, Chinese, and x-default alternates to every core entry", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const entries = subject.buildSitemapEntries();
		for (const [english, chinese] of corePairs) {
			const expected = [
				{ hreflang: "en", path: english },
				{ hreflang: "zh-CN", path: chinese },
				{ hreflang: "x-default", path: english },
			];
			expect(entries.find((entry) => entry.path === english)?.alternates).toEqual(expected);
			expect(entries.find((entry) => entry.path === chinese)?.alternates).toEqual(expected);
		}
	});

	test("renders the XHTML namespace and reciprocal alternate links", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const xml = subject.renderSitemap("https://yonaris.example/");
		expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
		expect(xml).toContain("<loc>https://yonaris.example/product</loc>");
		expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://yonaris.example/product" />');
		expect(xml).toContain('<xhtml:link rel="alternate" hreflang="zh-CN" href="https://yonaris.example/zh/product" />');
		expect(xml).toContain('<xhtml:link rel="alternate" hreflang="x-default" href="https://yonaris.example/product" />');
		expect(xml.match(/<lastmod>2026-08-22<\/lastmod>/g)).toHaveLength(14);
	});

	test("renders core sitemap elements before XHTML alternate extensions", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const xml = subject.renderSitemap("https://yonaris.example/");
		const entriesWithAlternates = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)]
			.map(([entry]) => entry)
			.filter((entry) => entry.includes("<xhtml:link"));

		expect(entriesWithAlternates).toHaveLength(14);
		for (const entry of entriesWithAlternates) {
			expect(entry.indexOf("<priority>")).toBeLessThan(entry.indexOf("<xhtml:link"));
		}
	});

	test("renders a crawlable robots policy pointing at the sitemap", () => {
		const subject = requireSitemap();
		if (!subject) return;

		const robots = subject.renderRobots("https://yonaris.example/");
		expect(robots).toContain("User-agent: *\nAllow: /");
		expect(robots).toContain("Sitemap: https://yonaris.example/sitemap.xml");
		expect(robots).not.toContain("Disallow:");
	});
});
