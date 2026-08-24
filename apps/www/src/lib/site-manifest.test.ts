import { describe, expect, test } from "vitest";

type ManifestModule = typeof import("./site-manifest");
type AuditModule = typeof import("../../scripts/audit-site-manifest");

async function loadModule<T>(specifier: string): Promise<T | undefined> {
	try {
		return (await import(/* @vite-ignore */ specifier)) as T;
	} catch {
		return undefined;
	}
}

const manifest = await loadModule<ManifestModule>("./site-manifest");
const audit = await loadModule<AuditModule>("../../scripts/audit-site-manifest");

function requireManifest(): ManifestModule | undefined {
	expect(manifest, "the public site manifest module must load").toBeDefined();
	return manifest;
}

const corePaths = {
	home: { en: "/", zh: "/zh" },
	product: { en: "/product", zh: "/zh/product" },
	approach: { en: "/approach", zh: "/zh/approach" },
	research: { en: "/research", zh: "/zh/research" },
	company: { en: "/company", zh: "/zh/company" },
	geo: { en: "/geo", zh: "/zh/geo" },
	diagnostic: { en: "/diagnostic", zh: "/zh/diagnostic" },
} as const;

describe("site manifest", () => {
	test("maps every core page to its approved bilingual canonical paths", () => {
		const subject = requireManifest();
		if (!subject) return;

		for (const [key, paths] of Object.entries(corePaths)) {
			expect(subject.getCorePath(key as keyof typeof corePaths, "en")).toBe(paths.en);
			expect(subject.getCorePath(key as keyof typeof corePaths, "zh")).toBe(paths.zh);
		}
	});

	test("keeps canonical paths unique", () => {
		const subject = requireManifest();
		if (!subject) return;

		const canonicals = subject.SITE_MANIFEST.flatMap((route) => Object.values(route.canonicals));
		expect(new Set(canonicals).size).toBe(canonicals.length);
	});

	test("contains exactly the declared route keys", () => {
		const subject = requireManifest();
		if (!subject) return;

		expect(subject.SITE_MANIFEST.map((route) => route.key).sort()).toEqual([...subject.SITE_ROUTE_KEYS].sort());
	});

	test("orders the four primary navigation destinations", () => {
		const subject = requireManifest();
		if (!subject) return;

		expect(
			subject.SITE_MANIFEST.filter((route) => route.navigation.some((location) => location === "primary")).map(
				(route) => route.key,
			),
		).toEqual(["product", "approach", "research", "company"]);
	});

	test("applies the approved indexing policy to each route family", () => {
		const subject = requireManifest();
		if (!subject) return;

		const policies = Object.fromEntries(subject.SITE_MANIFEST.map((route) => [route.key, route.indexPolicy]));
		expect(policies).toEqual({
			home: "index,follow",
			product: "index,follow",
			approach: "index,follow",
			research: "index,follow",
			company: "index,follow",
			geo: "index,follow",
			diagnostic: "index,follow",
			privacy: "index,follow",
			agent: "noindex,follow",
			llms: "noindex,follow",
			sitemap: "noindex,follow",
			robots: "noindex,follow",
			api: "noindex,follow",
			og: "noindex,follow",
			markdownInternal: "noindex,follow",
		});
	});

	test("maps each non-home core page to its Agent document", () => {
		const subject = requireManifest();
		if (!subject) return;

		expect(
			Object.fromEntries(
				(["product", "approach", "research", "company", "geo", "diagnostic"] as const).map((key) => [
					key,
					subject.getSiteRoute(key).agentPath,
				]),
			),
		).toEqual({
			product: "/agent/product",
			approach: "/agent/approach",
			research: "/agent/research",
			company: "/agent/company",
			geo: "/agent/geo",
			diagnostic: "/agent/diagnostic",
		});
	});

	test("resolves family patterns to their governance policy", () => {
		const subject = requireManifest();
		if (!subject) return;

		expect(subject.findSiteRoute("/ai-visibility-tools/example")).toBeUndefined();
		expect(subject.findSiteRoute("/docs/getting-started")).toBeUndefined();
		expect(subject.findSiteRoute("/api/search")?.key).toBe("api");
		expect(subject.findSiteRoute("/llms.mdx/site/en/product")?.key).toBe("markdownInternal");
	});

	test("keeps redirect targets classified and redirect chains acyclic", () => {
		const subject = requireManifest();
		if (!subject) return;

		expect(subject.SITE_REDIRECTS).toContainEqual({ from: "/platform", to: "/product", statusCode: 308 });
		for (const redirect of subject.SITE_REDIRECTS) {
			expect(subject.findSiteRoute(redirect.to), `${redirect.to} must be classified`).toBeDefined();
			const seen = new Set<string>();
			let path: string | undefined = redirect.from;
			while (path) {
				expect(seen.has(path), `redirect cycle includes ${path}`).toBe(false);
				seen.add(path);
				path = subject.getRedirect(path)?.to;
			}
		}
	});

	test("records valid release verification dates on all core pages", () => {
		const subject = requireManifest();
		if (!subject) return;

		for (const key of Object.keys(corePaths) as (keyof typeof corePaths)[]) {
			const value = subject.getCoreLastVerified(key);
			const [year, month, day] = value.split("-").map(Number);
			const parsed = new Date(Date.UTC(year, month - 1, day));
			expect(value).toBe("2026-08-22");
			expect([parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate()]).toEqual([year, month, day]);
		}
	});

	test("classifies every filesystem route pattern", async () => {
		const subject = requireManifest();
		expect(audit, "the filesystem manifest audit module must load").toBeDefined();
		if (!subject || !audit) return;

		const patterns = await audit.discoverRoutePatterns();
		const unclassified = patterns.filter((pattern) => !subject.findSiteRoute(pattern));
		expect(unclassified).toEqual([]);
	});
});
