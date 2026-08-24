import { expect, test } from "@playwright/test";

const retiredPaths = [
	"/resources",
	"/brand",
	"/status",
	"/og/status.png",
	"/recordranks-logo.svg",
	"/brand/architecture.svg",
	"/brand/banners/linkedin-banner.png",
	"/brand/banners/twitter-banner.png",
	"/blog",
	"/blog/ai-brand-sentiment",
	"/blog/rss.xml",
	"/glossary",
	"/docs",
	"/docs/getting-started",
	"/changelog",
	"/roadmap",
	"/ai-search",
	"/ai-search/google-ai-overviews",
	"/aeo-for",
	"/aeo-for/saas",
	"/api/openapi.json",
	"/api/search",
	"/repo-activity.svg",
] as const;

const retainedPublicPaths = [
	"/", "/zh", "/product", "/zh/product", "/approach", "/zh/approach", "/research", "/zh/research",
	"/company", "/zh/company", "/geo", "/zh/geo", "/diagnostic", "/zh/diagnostic", "/privacy",
	"/sitemap.xml", "/robots.txt",
] as const;

test("retired publication surfaces stay offline", async ({ request }) => {
	for (const path of retiredPaths) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(404);
		expect(response.headers().location, path).toBeUndefined();
	}
});

test("retained commercial and discovery surfaces remain available", async ({ request }) => {
	for (const path of retainedPublicPaths) expect((await request.get(path)).ok(), path).toBe(true);
});

test("discovery documents omit every named retired surface", async ({ request }) => {
	const discovery = `${await (await request.get("/sitemap.xml")).text()}\n${await (await request.get("/robots.txt")).text()}`;
	for (const path of retiredPaths) expect(discovery, path).not.toContain(path);
});
