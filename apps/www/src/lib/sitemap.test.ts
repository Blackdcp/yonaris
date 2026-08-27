import { describe, expect, test } from "vitest";
import { buildSitemapEntries, renderRobots, renderSitemap } from "./sitemap";

const approvedPaths = [
	"/",
	"/zh",
	"/product",
	"/zh/product",
	"/approach",
	"/zh/approach",
	"/geo",
	"/zh/geo",
	"/company",
	"/zh/company",
	"/diagnostic",
	"/zh/diagnostic",
	"/privacy",
	"/zh/privacy",
] as const;

describe("manifest-driven sitemap", () => {
	test("contains only approved indexable Human canonicals", () => {
		const entries = buildSitemapEntries();
		expect(entries).toHaveLength(14);
		expect(entries.map(({ path }) => path)).toEqual(approvedPaths);
		expect(entries.every((entry) => entry.lastVerified === "2026-08-27")).toBe(true);
		for (const retired of ["/research", "/zh/research", "/resources", "/agent", "/llms.txt"]) {
			expect(entries.map(({ path }) => path)).not.toContain(retired);
		}
	});

	test("renders one URL per approved path without alternate-link coupling", () => {
		const xml = renderSitemap("https://yonaris.example/");
		expect(xml.match(/<url>/g)).toHaveLength(approvedPaths.length);
		expect(xml.match(/<lastmod>2026-08-27<\/lastmod>/g)).toHaveLength(approvedPaths.length);
		expect(xml).not.toContain("/agent");
		expect(xml).not.toContain("xhtml:link");
	});

	test("renders a crawlable robots policy", () => {
		const robots = renderRobots("https://yonaris.example/");
		expect(robots).toContain("User-agent: *\nAllow: /");
		expect(robots).toContain("Sitemap: https://yonaris.example/sitemap.xml");
	});
});
