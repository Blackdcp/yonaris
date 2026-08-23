import { expect, test } from "@playwright/test";

const retiredPaths = [
	"/resources",
	"/open-source",
	"/blog",
	"/blog/ai-brand-sentiment",
	"/blog/rss.xml",
	"/glossary",
	"/glossary/ai-visibility",
	"/docs",
	"/docs/getting-started",
	"/changelog",
	"/roadmap",
	"/ai-search",
	"/ai-search/google-ai-overviews",
	"/aeo-for",
	"/aeo-for/saas",
	"/ai-visibility-tools",
	"/ai-visibility-tools/retired-record",
	"/ai-visibility-tools/alternatives/profound",
	"/ai-visibility-tools/category/open-source",
	"/ai-visibility-tools/compare/profound-vs-peec-ai",
	"/ai-visibility-tools/features/multi-llm-tracking",
	"/api/openapi.json",
	"/api/search",
	"/repo-activity.svg",
] as const;

const retainedPublicPaths = [
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
	"/privacy",
	"/status",
	"/brand",
	"/agent",
	"/agent/product",
	"/agent/approach",
	"/agent/research",
	"/agent/company",
	"/agent/geo",
	"/agent/diagnostic",
	"/llms.txt",
	"/llms-full.txt",
	"/sitemap.xml",
	"/robots.txt",
] as const;

const provenanceDisclosure = /\belmo\b|elmohq|upstream(?:[- ]compatible|\s+(?:project|repository|archive|source))|open[- ]source (?:foundation|infrastructure|relationship)|(?:开源|上游)(?:基础设施|技术基础|项目|仓库|关系)/iu;

test("all provenance-bearing public sections are offline", async ({ request }) => {
	for (const path of retiredPaths) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(404);
		expect(response.headers().location, path).toBeUndefined();
	}
});

test("retained public and machine-readable surfaces disclose no upstream provenance", async ({ request }) => {
	for (const path of retainedPublicPaths) {
		const response = await request.get(path);
		expect(response.ok(), path).toBe(true);
		expect(await response.text(), path).not.toMatch(provenanceDisclosure);
	}
});

test("site discovery documents omit every retired surface", async ({ request }) => {
	const discovery = `${await (await request.get("/sitemap.xml")).text()}\n${await (await request.get("/robots.txt")).text()}`;
	for (const path of retiredPaths) expect(discovery, path).not.toContain(path);
	expect(discovery).not.toMatch(provenanceDisclosure);
});
