import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const legacyTemplates = [
	{ path: "/ai-search", archive: "research" },
	{ path: "/ai-search/chatgpt", archive: "research" },
	{ path: "/aeo-for", archive: "research" },
	{ path: "/aeo-for/agencies", archive: "research" },
	{ path: "/ai-visibility-tools", archive: "upstream" },
	{ path: "/ai-visibility-tools/elmo-vs-profound", archive: "upstream" },
	{ path: "/ai-visibility-tools/alternatives", archive: "upstream" },
	{ path: "/ai-visibility-tools/alternatives/profound", archive: "upstream" },
	{ path: "/ai-visibility-tools/category", archive: "upstream" },
	{ path: "/ai-visibility-tools/category/tracking", archive: "upstream" },
	{ path: "/ai-visibility-tools/category/open-source", archive: "upstream" },
	{ path: "/ai-visibility-tools/compare", archive: "upstream" },
	{ path: "/ai-visibility-tools/compare/profound-vs-peec-ai", archive: "upstream" },
	{ path: "/ai-visibility-tools/features", archive: "upstream" },
	{ path: "/ai-visibility-tools/features/multi-llm-tracking", archive: "upstream" },
] as const;

const invalidDynamicRoutes = [
	"/ai-search/not-a-real-engine",
	"/aeo-for/not-a-real-audience",
	"/ai-visibility-tools/not-a-real-tool",
	"/ai-visibility-tools/alternatives/not-a-real-tool",
	"/ai-visibility-tools/category/not-a-real-category",
	"/ai-visibility-tools/compare/not-a-real-comparison",
	"/ai-visibility-tools/features/not-a-real-feature",
] as const;

const qaRoutes = [
	{ key: "ai-search", path: "/ai-search" },
	{ key: "aeo-dynamic", path: "/aeo-for/agencies" },
	{ key: "ai-visibility", path: "/ai-visibility-tools" },
	{ key: "single-comparison", path: "/ai-visibility-tools/elmo-vs-profound" },
	{ key: "multi-comparison", path: "/ai-visibility-tools/compare/profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch" },
	{ key: "open-source", path: "/ai-visibility-tools/category/open-source" },
] as const;

const qaWidthRoutes = [
	...qaRoutes,
	{ key: "category-index", path: "/ai-visibility-tools/category" },
] as const;

const qaWidths = ["desktop", "wide", "tabletLandscape", "tabletPortrait", "mobile", "narrow", "micro"] as const;
const forbiddenRichTypes = ["SoftwareApplication", "ItemList", "Comparison", "FAQPage", "HowTo", "BreadcrumbList"];

async function structuredDataTypes(page: Page): Promise<string[]> {
	return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
		scripts.flatMap((script) => {
			try {
				const value = JSON.parse(script.textContent ?? "") as unknown;
				const types: string[] = [];
				const visit = (candidate: unknown): void => {
					if (Array.isArray(candidate)) {
						for (const item of candidate) visit(item);
						return;
					}
					if (!candidate || typeof candidate !== "object") return;
					for (const [key, nested] of Object.entries(candidate)) {
						if (key === "@type") {
							if (typeof nested === "string") types.push(nested);
							else if (Array.isArray(nested)) {
								for (const item of nested) if (typeof item === "string") types.push(item);
							}
						}
						visit(nested);
					}
				};
				visit(value);
				return types;
			} catch {
				return ["INVALID_JSON_LD"];
			}
		}),
	);
}

async function structuredIdentityNodes(page: Page): Promise<{ type: string; name?: string }[]> {
	return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => {
		const nodes: { type: string; name?: string }[] = [];
		const visit = (candidate: unknown): void => {
			if (Array.isArray(candidate)) {
				for (const item of candidate) visit(item);
				return;
			}
			if (!candidate || typeof candidate !== "object") return;
			const record = candidate as Record<string, unknown>;
			const types = typeof record["@type"] === "string" ? [record["@type"]] : Array.isArray(record["@type"]) ? record["@type"] : [];
			for (const type of types) if (typeof type === "string") nodes.push({ type, ...(typeof record.name === "string" ? { name: record.name } : {}) });
			for (const nested of Object.values(record)) visit(nested);
		};
		for (const script of scripts) visit(JSON.parse(script.textContent ?? ""));
		return nodes;
	});
}

async function structuredDataRoots(page: Page): Promise<{ type?: unknown; name?: unknown }[]> {
	return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
		scripts.map((script) => {
			const value = JSON.parse(script.textContent ?? "") as Record<string, unknown>;
			return { type: value["@type"], name: value.name };
		}),
	);
}

test("all 15 legacy templates use governed shells, exact SEO policy, and archive context before H1", async ({ page }) => {
	for (const route of legacyTemplates) {
		await page.goto(route.path);
		await expect(page.locator("header.site-header")).toBeVisible();
		await expect(page.locator("footer.site-footer")).toBeVisible();
		await expect(page.locator("main")).toHaveCount(1);
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
		const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
		expect(new URL(canonical ?? "", page.url()).pathname).toBe(route.path);

		const context = page.locator(".site-archive-context");
		await expect(context).toHaveCount(1);
		await expect(context).toContainText("Archive boundary applied 2026-08-23");
		expect(
			await context.evaluate((node) => {
				const heading = document.querySelector("h1");
				return heading ? Boolean(node.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
			}),
		).toBe(true);

		if (route.archive === "research") {
			await expect(context).toContainText("Legacy research archive");
			await expect(context).toContainText("earlier Yonaris research");
			await expect(context.getByRole("link", { name: "Current product" })).toHaveAttribute("href", "/product");
			await expect(context.getByRole("link", { name: "Current GEO work" })).toHaveAttribute("href", "/geo");
		} else {
			await expect(context).toContainText("Upstream Elmo comparison archive");
			await expect(context).toContainText("not the current Yonaris product, company, or comparison position");
			await expect(context).toContainText("elmohq/elmo");
			await expect(context.getByRole("link", { name: "Current product" })).toHaveAttribute("href", "/product");
			await expect(context.getByRole("link", { name: "Current GEO work" })).toHaveAttribute("href", "/geo");
			await expect(context.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "/open-source");
			await expect(context.getByRole("link", { name: "elmohq/elmo" })).toHaveAttribute(
				"href",
				"https://github.com/elmohq/elmo",
			);
			const currentScope = page.locator("[data-legacy-current-scope]");
			await expect(currentScope).toHaveCount(1);
			await expect(currentScope.getByRole("link", { name: "Current product" })).toHaveAttribute("href", "/product");
			await expect(currentScope.getByRole("link", { name: "Current GEO work" })).toHaveAttribute("href", "/geo");
			await expect(currentScope.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "/open-source");
		}

		const archivedAnswers = page.locator("[data-legacy-archived-answers]");
		if ((await page.locator(".legacy-archive-faq").count()) > 0) {
			await expect(archivedAnswers).toContainText("Recorded source answers — not current Yonaris claims");
		}

		const types = await structuredDataTypes(page);
		expect(types).not.toContain("INVALID_JSON_LD");
		for (const forbidden of forbiddenRichTypes) expect(types, `${route.path}: ${forbidden}`).not.toContain(forbidden);
		expect(types.every((type) => ["Organization", "WebSite"].includes(type)), `${route.path}: ${types}`).toBe(true);
		const roots = await structuredDataRoots(page);
		expect(roots.length, route.path).toBeGreaterThan(0);
		expect(types.length, `${route.path}: nested or untyped structured data`).toBe(roots.length);
		for (const root of roots) {
			expect(["Organization", "WebSite"], `${route.path}: ${String(root.type)}`).toContain(root.type);
			expect(root.name, `${route.path}: ${String(root.type)}`).toBe("Yonaris");
		}
		const visible = await page.locator("main").innerText();
		expect(visible).not.toMatch(
			/Yonaris vs|The Yonaris approach|Where Yonaris fits|Ready to track your AI visibility|Why teams choose Elmo|Deploy Elmo|(?:Try|Start) tracking|Elmo Cloud/i,
		);
	}
});

test("legacy templates expose no rich route-owned JSON-LD at any nesting depth", async ({ page }) => {
	for (const route of legacyTemplates) {
		await page.goto(route.path);
		const types = await structuredDataTypes(page);
		expect(types).not.toContain("INVALID_JSON_LD");
		for (const forbidden of forbiddenRichTypes) expect(types, `${route.path}: ${forbidden}`).not.toContain(forbidden);
		expect(types.every((type) => ["Organization", "WebSite"].includes(type)), `${route.path}: ${types}`).toBe(true);
	}
});

test("global structured identity and OG ownership remain Yonaris while Elmo listing helpers are removed", async ({ page }) => {
	await page.goto("/ai-visibility-tools");
	const identities = (await structuredIdentityNodes(page)).filter(({ type }) => ["Organization", "WebSite"].includes(type));
	expect(identities.length).toBeGreaterThan(0);
	for (const identity of identities) expect(identity.name, identity.type).toBe("Yonaris");
	await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Yonaris");

	const seoSource = await readFile(path.resolve(process.cwd(), "../apps/www/src/lib/seo.ts"), "utf8");
	expect(seoSource).not.toContain("ELMO_LISTING");
	expect(seoSource).not.toContain("function comparisonJsonLd");
	expect(seoSource).not.toContain("function softwareApplicationJsonLd");
	const routeSource = await Promise.all(
		["../apps/www/src/routes/ai-visibility-tools/$slug.tsx", "../apps/www/src/routes/ai-visibility-tools/compare/$slug.tsx"].map((file) => readFile(path.resolve(process.cwd(), file), "utf8")),
	);
	for (const source of routeSource) expect(source).not.toMatch(/ELMO_LISTING|comparisonJsonLd|softwareApplicationJsonLd/);
});

test("legacy dynamic routes preserve valid bodies, reject invalid slugs, and keep the static open-source route", async ({ page, request }) => {
	for (const route of invalidDynamicRoutes) expect((await request.get(route)).status(), route).toBe(404);

	await page.goto("/ai-search/chatgpt");
	await expect(page.getByRole("heading", { level: 1, name: /ChatGPT/i })).toBeVisible();
	await expect(page.getByText(/ChatGPT answers from two places/i)).toBeVisible();

	await page.goto("/aeo-for/agencies");
	await expect(page.getByRole("heading", { level: 1, name: /agencies/i })).toBeVisible();
	await expect(page.getByText(/Agencies tend to feel the shift/i)).toBeVisible();

	await page.goto("/ai-visibility-tools/category/open-source");
	await expect(page.getByRole("heading", { level: 1, name: "Open-source AI visibility tools" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /Build it yourself/i })).toBeVisible();

	await page.goto("/ai-visibility-tools/elmo-vs-profound");
	await expect(page.getByRole("heading", { level: 1, name: /Elmo.*Profound/i })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /About Profound/i })).toBeVisible();

	await page.goto("/ai-visibility-tools/alternatives/profound");
	await expect(page.getByRole("heading", { level: 1, name: "Profound alternatives" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /Other Profound alternatives/i })).toBeVisible();
	expect(await page.locator("[data-competitor-row]").count()).toBeGreaterThan(0);
	await expect(page.locator('[data-competitor-row] a[href*="elmo-vs-"]').first()).toBeVisible();

	await page.goto("/ai-visibility-tools/category/tracking");
	await expect(page.getByRole("heading", { level: 1, name: "AI visibility tracking tools" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: "Tools in this category" })).toBeVisible();
	expect(await page.locator("[data-competitor-row]").count()).toBeGreaterThan(1);
	await expect(page.locator('[data-competitor-row] a[href*="elmo-vs-"]').first()).toBeVisible();

	await page.goto("/ai-visibility-tools/compare/profound-vs-peec-ai");
	await expect(page.getByRole("heading", { level: 1, name: "Profound vs Peec AI" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /Profound vs Peec AI vs Elmo/i })).toBeVisible();
	expect(await page.locator("[data-comparison-row]").count()).toBeGreaterThan(0);

	await page.goto("/ai-visibility-tools/compare/profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch");
	await expect(page.getByRole("heading", { level: 1, name: /Profound vs Ahrefs Brand Radar vs HubSpot AEO Grader vs Rankshift vs Scrunch/ })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: /vs Elmo/i })).toBeVisible();
	expect(await page.locator("[data-comparison-row]").count()).toBeGreaterThan(0);

	await page.goto("/ai-visibility-tools/features/multi-llm-tracking");
	await expect(page.getByRole("heading", { level: 1, name: "AI visibility tools with Multi-LLM tracking" })).toBeVisible();
	await expect(page.getByRole("heading", { level: 2, name: "Tools that offer this feature" })).toBeVisible();
	expect(await page.locator("[data-competitor-row]").count()).toBeGreaterThan(1);
	await expect(page.locator('[data-competitor-row] a[href*="elmo-vs-"]').first()).toBeVisible();
});

test("legacy guidance and old product wording carry adjacent publication boundaries", async ({ page }) => {
	await page.goto("/ai-search");
	await expect(page.getByRole("heading", { level: 2, name: "Recorded guidance at publication" })).toBeVisible();

	await page.goto("/aeo-for/agencies");
	await expect(page.getByText("Recorded Yonaris wording at publication — not a current product claim.")).toBeVisible();
	await expect(page.locator("[data-legacy-archived-answers]")).toContainText(
		"Recorded source answers — not current Yonaris claims",
	);

	for (const path of [
		"/ai-visibility-tools/elmo-vs-profound",
		"/ai-visibility-tools/compare/profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch",
	]) {
		await page.goto(path);
		await expect(page.locator("[data-legacy-archived-answers]")).toContainText(
			"Recorded source answers — not current Yonaris claims",
		);
	}
});

test("the root directory preserves the recorded per-feature supplier matrix", async ({ page }) => {
	await page.goto("/ai-visibility-tools");
	const featureRows = page.locator("[data-feature-row]");
	expect(await featureRows.count()).toBeGreaterThan(10);
	await expect(page.getByRole("columnheader", { name: "Elmo", exact: true })).toBeVisible();
	await expect(page.getByRole("columnheader", { name: "Profound", exact: true })).toBeVisible();
	const openSource = page.locator('[data-feature-row="openSource"]');
	await expect(openSource.getByRole("rowheader", { name: "Open Source", exact: true })).toBeVisible();
	await expect(openSource.getByText("Recorded as available", { exact: true }).first()).toBeAttached();
	await expect(openSource.getByText("Not recorded as available", { exact: true }).first()).toBeAttached();
});

test("single comparison keeps its source link without a remote screenshot dependency", async ({ page }) => {
	await page.goto("/ai-visibility-tools/elmo-vs-profound");
	await expect(page.getByRole("link", { name: "Visit recorded source ↗" })).toBeVisible();
	await expect(page.locator('img[src*="public.blob.vercel-storage.com/screenshots/"]')).toHaveCount(0);
	await expect(page.locator(".legacy-archive-screenshot")).toHaveCount(0);
});

test("single comparison preserves priced and free-tier supplier facts", async ({ page }) => {
	await page.goto("/ai-visibility-tools/elmo-vs-ahrefs-brand-radar");
	await expect(page.locator("[data-recorded-pricing]")).toContainText("From $129/mo");
	await expect(page.locator("[data-recorded-pricing]")).toContainText("Enterprise pricing recorded");

	await page.goto("/ai-visibility-tools/elmo-vs-hubspot-aeo-grader");
	await expect(page.locator("[data-recorded-pricing]")).toContainText("Free tier");
	await expect(page.locator("[data-recorded-pricing]")).toContainText("Enterprise pricing recorded");
});

test("pair comparison preserves recorded domains and source URLs", async ({ page }) => {
	await page.goto("/ai-visibility-tools/compare/profound-vs-peec-ai");
	await expect(page.getByRole("link", { name: "Visit tryprofound.com" })).toHaveAttribute(
		"href",
		"https://www.tryprofound.com/",
	);
	await expect(page.getByRole("link", { name: "Visit peec.ai" })).toHaveAttribute("href", "https://peec.ai/");
	await expect(page.locator("[data-recorded-pricing]")).toHaveCount(2);
	await expect(page.locator("[data-recorded-pricing]").first()).toContainText("Enterprise pricing recorded");
});

test("multi comparison preserves recorded pricing, domains, and source URLs", async ({ page }) => {
	await page.goto(
		"/ai-visibility-tools/compare/profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch",
	);
	await expect(page.locator("[data-recorded-pricing]", { hasText: "From $129/mo" })).toBeVisible();
	await expect(page.locator("[data-recorded-pricing]", { hasText: "Free tier" })).toBeVisible();
	await expect(page.getByRole("link", { name: "Visit ahrefs.com" })).toHaveAttribute(
		"href",
		"https://ahrefs.com/brand-radar",
	);
	await expect(page.getByRole("link", { name: "Visit hubspot.com" })).toHaveAttribute(
		"href",
		"https://www.hubspot.com/products/marketing/aeo-grader",
	);
});

test("category hierarchy is complete and current-scope navigation landmarks are distinct", async ({ page }) => {
	await page.goto("/ai-visibility-tools/category");
	const categoriesHeading = page.getByRole("heading", { level: 2, name: "Archived categories" });
	const firstCategory = page.getByRole("heading", { level: 3 }).first();
	await expect(categoriesHeading).toBeVisible();
	await expect(firstCategory).toBeVisible();
	expect(
		await categoriesHeading.evaluate((heading) => {
			const category = document.querySelector(".legacy-archive-ledger h3");
			return category ? Boolean(heading.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
		}),
	).toBe(true);
	const scopeLabels = await page.locator('nav[aria-label*="Yonaris scope"]').evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute("aria-label")),
	);
	expect(scopeLabels).toEqual(["Archive boundary and current Yonaris scope", "Continue in current Yonaris scope"]);
});

test("legacy routes stay outside the sitemap and crawlable in robots", async ({ request }) => {
	const sitemap = await (await request.get("/sitemap.xml")).text();
	for (const prefix of ["/ai-search", "/aeo-for", "/ai-visibility-tools"]) expect(sitemap).not.toContain(prefix);

	const robots = await (await request.get("/robots.txt")).text();
	for (const prefix of ["/ai-search", "/aeo-for", "/ai-visibility-tools"]) {
		expect(robots).not.toMatch(new RegExp(`Disallow:\\s*${prefix.replaceAll("/", "\\/")}`, "i"));
	}
});

test("directory filters stay inert until hydration attaches their handlers", async ({ page, request }) => {
	const response = await request.get("/ai-visibility-tools");
	expect(response.ok()).toBe(true);
	const html = await response.text();
	const filterTag = html.match(/<button(?=[^>]*legacy-archive-filter)[^>]*>/)?.[0];
	expect(filterTag).toBeDefined();
	expect(filterTag).toMatch(/\sdisabled(?:="")?(?:\s|>)/);

	await page.goto("/ai-visibility-tools");
	const filters = page.locator("button.legacy-archive-filter");
	await expect(filters).not.toHaveCount(0);
	await expect(filters.first()).toBeEnabled();
});

test("legacy comparison scrollers and directory filters expose keyboard state and Signal focus", async ({ page }) => {
	for (const viewport of ["desktop", "mobile", "micro"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewport]);
		await page.emulateMedia({ reducedMotion: "reduce" });
		for (const path of [
			"/ai-visibility-tools",
			"/ai-visibility-tools/elmo-vs-profound",
			"/ai-visibility-tools/compare/profound-vs-peec-ai",
			"/ai-visibility-tools/compare/profound-vs-ahrefs-brand-radar-vs-hubspot-aeo-grader-vs-rankshift-vs-scrunch",
			"/ai-visibility-tools/category/open-source",
		]) {
			await page.goto(path);
			const scroller = page.locator('[data-comparison-scroller="true"]');
			await expect(scroller).toHaveCount(1);
			await expect(scroller).toHaveJSProperty("tagName", "SECTION");
			await expect(scroller).toHaveAttribute("tabindex", "0");
			await expect(scroller).toHaveAttribute("aria-label", /comparison/i);
			await expectSignalFocusVisible(page, scroller);
		}

		await page.goto("/ai-visibility-tools");
		await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
		const filters = page.locator('button[aria-pressed]');
		expect(await filters.count()).toBeGreaterThan(1);
		const initialCount = await page.locator("[data-competitor-entry]").count();
		expect(initialCount).toBeGreaterThan(1);
		const category = filters.nth(1);
		await expect(category).toHaveAttribute("aria-pressed", "false");
		await category.click();
		await expect(category).toHaveAttribute("aria-pressed", "true");
		await expect(filters.first()).toHaveAttribute("aria-pressed", "false");
		expect(await page.locator("[data-competitor-entry]").count()).toBeLessThan(initialCount);
		for (const filter of await filters.all()) {
			const box = await filter.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
			expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		}
		await expectSignalFocusVisible(page, category);
		await expectNoRunningAnimations(page);

		await page.goto("/ai-visibility-tools/category/open-source");
		const currentScopeLinks = page.locator("[data-legacy-current-scope] a");
		await expect(currentScopeLinks).toHaveCount(3);
		for (const link of await currentScopeLinks.all()) {
			const box = await link.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
			expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
		}
		const scopeLayout = await page.locator("[data-legacy-current-scope]").evaluate((node) => {
			const style = getComputedStyle(node);
			return { display: style.display, flexWrap: style.flexWrap, gap: Number.parseFloat(style.columnGap) };
		});
		expect(scopeLayout.display).toBe("flex");
		expect(scopeLayout.flexWrap).toBe("wrap");
		expect(scopeLayout.gap).toBeGreaterThan(0);
	}
});

test("representative legacy pages keep editorial VI constraints across seven widths", async ({ page }) => {
	test.setTimeout(120_000);
	for (const route of qaWidthRoutes) {
		for (const viewport of qaWidths) {
			await page.setViewportSize(QA_VIEWPORTS[viewport]);
			await page.goto(route.path);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
			const violations = await page.locator("main").evaluate((main) => {
				const elements = [main, ...main.querySelectorAll<HTMLElement>("*")];
				return {
					backgroundImages: elements.filter((element) => getComputedStyle(element).backgroundImage !== "none").length,
					legacyCardGrids: main.querySelectorAll("ul.grid, .grid.rounded-md, .rounded-xl, .rounded-2xl").length,
				};
			});
			expect(violations).toEqual({ backgroundImages: 0, legacyCardGrids: 0 });
		}
	}
});

test("legacy routes leave no running motion under reduced motion", async ({ page }) => {
	for (const route of qaRoutes) await expectNoRunningAnimations(page, route.path);
});

test.describe("legacy governance visual evidence", () => {
	test.describe.configure({ mode: "serial" });
	for (const route of qaRoutes) {
		for (const viewport of ["desktop", "mobile", "micro"] as const) {
			test(`${route.key} ${viewport} @visual`, async ({ page }) => {
				await page.setViewportSize(QA_VIEWPORTS[viewport]);
				await page.goto(route.path);
				const artifact = await captureQa(page, {
					route: route.path,
					locale: "en",
					viewport,
					state: "legacy-governed",
				});
				test.info().annotations.push({ type: "visual-artifact", description: artifact });
			});
		}
	}
});
