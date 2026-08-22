import { describe, expect, test } from "vitest";

type SiteSeoModule = typeof import("./site-seo");

async function loadSiteSeo(): Promise<SiteSeoModule | undefined> {
	try {
		return (await import("./site-seo")) as SiteSeoModule;
	} catch {
		return undefined;
	}
}

const siteSeo = await loadSiteSeo();

function requireSiteSeo(): SiteSeoModule | undefined {
	expect(siteSeo, "the manifest-driven site SEO module must load").toBeDefined();
	return siteSeo;
}

function pathnameOf(href: unknown): string | undefined {
	return typeof href === "string" ? new URL(href, "https://local.test").pathname : undefined;
}

function linkPaths(head: { links: object[] }): Record<string, string | undefined> {
	return Object.fromEntries(
		head.links.map((link) => {
			const value = link as { href?: unknown; hrefLang?: string; rel?: string };
			return [value.rel === "canonical" ? "canonical" : (value.hrefLang ?? "unknown"), pathnameOf(value.href)];
		}),
	);
}

describe("manifest-driven site SEO", () => {
	test("publishes reciprocal core canonicals with an English x-default", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		expect(linkPaths(subject.corePageHead("product", "en"))).toEqual({
			canonical: "/product",
			en: "/product",
			"zh-CN": "/zh/product",
			"x-default": "/product",
		});
		expect(linkPaths(subject.corePageHead("product", "zh"))).toEqual({
			canonical: "/zh/product",
			en: "/product",
			"zh-CN": "/zh/product",
			"x-default": "/product",
		});
	});

	test("uses the bilingual core fact source for page metadata", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		expect(subject.corePageHead("product", "zh").meta).toEqual(
			expect.arrayContaining([
				{ title: "让 AI 形成的市场答案变得可观察 | Yonaris" },
				{
					name: "description",
					content: "先界定市场范围，再检查 AI 回答样本及其可用证据，最后选择一个边界清晰的下一步测试。",
				},
			]),
		);
	});

	test("publishes Company metadata and reciprocal bilingual canonicals", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		expect(subject.corePageHead("company", "en").meta).toEqual(
			expect.arrayContaining([
				{ title: "MarTech, rebuilt. For humans and agents. | Yonaris" },
				{
					name: "description",
					content:
						"Yonaris is an early, service-led AI-native MarTech company building a real evidence platform for AI-mediated markets.",
				},
			]),
		);
		expect(linkPaths(subject.corePageHead("company", "en"))).toEqual({
			canonical: "/company",
			en: "/company",
			"zh-CN": "/zh/company",
			"x-default": "/company",
		});
		expect(linkPaths(subject.corePageHead("company", "zh"))).toEqual({
			canonical: "/zh/company",
			en: "/company",
			"zh-CN": "/zh/company",
			"x-default": "/company",
		});
	});

	test("publishes GEO metadata and reciprocal bilingual canonicals", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		expect(subject.corePageHead("geo", "en").meta).toEqual(
			expect.arrayContaining([
				{ title: "GEO, grounded in evidence. | Yonaris" },
				{
					name: "description",
					content:
						"Observe how configured AI systems discover, describe, compare, cite, and recommend a brand—then choose a bounded, human-reviewed next test.",
				},
			]),
		);
		expect(linkPaths(subject.corePageHead("geo", "en"))).toEqual({
			canonical: "/geo",
			en: "/geo",
			"zh-CN": "/zh/geo",
			"x-default": "/geo",
		});
		expect(linkPaths(subject.corePageHead("geo", "zh"))).toEqual({
			canonical: "/zh/geo",
			en: "/geo",
			"zh-CN": "/zh/geo",
			"x-default": "/geo",
		});
	});

	test("publishes Diagnostic metadata and reciprocal bilingual canonicals from the shared offer", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		expect(subject.corePageHead("diagnostic", "en").meta).toEqual(
			expect.arrayContaining([
				{ title: "See what AI sees before you decide what to change. | Yonaris" },
				{
					name: "description",
					content:
						"Request a free diagnostic working session; Yonaris confirms scope before evidence collection begins.",
				},
			]),
		);
		expect(linkPaths(subject.corePageHead("diagnostic", "en"))).toEqual({
			canonical: "/diagnostic",
			en: "/diagnostic",
			"zh-CN": "/zh/diagnostic",
			"x-default": "/diagnostic",
		});
		expect(linkPaths(subject.corePageHead("diagnostic", "zh"))).toEqual({
			canonical: "/zh/diagnostic",
			en: "/diagnostic",
			"zh-CN": "/zh/diagnostic",
			"x-default": "/diagnostic",
		});
	});

	test("keeps supporting page metadata and canonicals specific to the route", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		const head = subject.supportingPageHead("resources");
		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: "Resources | Yonaris" },
				{
					name: "description",
					content: "Research notes, documentation, terminology, service status, brand assets, and open-source context.",
				},
			]),
		);
		expect(linkPaths(head)).toEqual({ canonical: "/resources" });
	});

	test("publishes Open Source metadata from its factual content under one English canonical", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		const head = subject.supportingPageHead("openSource");
		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: "Open-source infrastructure | Yonaris" },
				{
					name: "description",
					content:
						"How Yonaris uses and extends Elmo-compatible infrastructure while keeping the upstream project distinct from the company and its product promise.",
				},
			]),
		);
		expect(linkPaths(head)).toEqual({ canonical: "/open-source" });
		expect(head.links).not.toEqual(expect.arrayContaining([expect.objectContaining({ rel: "alternate" })]));
	});

	test("publishes the Privacy content metadata under one canonical without language alternates", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		const head = subject.supportingPageHead("privacy");
		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: "How we handle diagnostic request data | Yonaris" },
				{
					name: "description",
					content: "How Yonaris handles information submitted with a diagnostic request.",
				},
			]),
		);
		expect(linkPaths(head)).toEqual({ canonical: "/privacy" });
		expect(head.links).not.toEqual(expect.arrayContaining([expect.objectContaining({ rel: "alternate" })]));
	});

	test("adds the exact manifest robots policy without replacing publication metadata", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		const head = subject.siteRouteHead("blog", {
			canonicalPath: "/blog/a-content-specific-title",
			title: "A content-specific title | Yonaris",
			description: "A content-specific description.",
		});

		expect(head.meta).toEqual(
			expect.arrayContaining([
				{ title: "A content-specific title | Yonaris" },
				{ name: "description", content: "A content-specific description." },
				{ name: "robots", content: "noindex,follow" },
			]),
		);
		expect(linkPaths(head)).toEqual({ canonical: "/blog/a-content-specific-title" });
		expect(subject.routeRobotsMeta("blog")).toEqual({ name: "robots", content: "noindex,follow" });
		expect(subject.routeRobotsMeta("docs")).toBeUndefined();
	});

	test("keeps Organization and WebSite structured data Yonaris-only", () => {
		const subject = requireSiteSeo();
		if (!subject) return;

		const scripts = subject.corePageHead("home", "en").scripts ?? [];
		const structuredData = scripts.map((script) => JSON.parse((script as { children: string }).children));
		expect(structuredData.map((entry) => entry["@type"])).toEqual(["Organization", "WebSite"]);
		expect(structuredData.every((entry) => entry.name === "Yonaris")).toBe(true);
		const serialized = JSON.stringify(structuredData);
		expect(serialized).not.toMatch(/Elmo|elmohq/i);
	});
});
