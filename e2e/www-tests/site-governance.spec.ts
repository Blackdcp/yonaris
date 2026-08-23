import { expect, test, type Page } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	runWcagAa,
} from "./helpers/core-site";

const DOCS_DISCLOSURE =
	"These documents cover Elmo-compatible open-source infrastructure used and extended by Yonaris. They do not describe the current Yonaris managed product or its commercial promise.";

const publicationRoutes = [
	{ path: "/blog", heading: "Publication notes" },
	{ path: "/blog/ai-brand-sentiment", heading: null },
	{ path: "/glossary", heading: "The AI market glossary" },
	{ path: "/glossary/ai-visibility", heading: "AI visibility" },
] as const;

const utilityRoutes = [
	{ path: "/docs", shell: "Open-source Documentation", robots: null },
	{ path: "/docs/getting-started", shell: "Open-source Documentation", robots: null },
	{ path: "/status", shell: "Operational checks", robots: null },
	{ path: "/brand", shell: "Brand resources", robots: null },
	{ path: "/changelog", shell: "Open-source changelog", robots: null },
	{ path: "/roadmap", shell: "Open-source roadmap", robots: "noindex,follow" },
] as const;

const representativeRoutes = [
	{ key: "blog", path: "/blog/ai-brand-sentiment" },
	{ key: "glossary", path: "/glossary/ai-visibility" },
	{ key: "docs", path: "/docs" },
	{ key: "status", path: "/status" },
	{ key: "brand", path: "/brand" },
	{ key: "changelog", path: "/changelog" },
	{ key: "roadmap", path: "/roadmap" },
] as const;

async function structuredDataTypes(page: Page): Promise<string[]> {
	return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
		scripts.flatMap((script) => {
			try {
				const value = JSON.parse(script.textContent ?? "") as { "@type"?: string };
				return value["@type"] ? [value["@type"]] : [];
			} catch {
				return ["INVALID_JSON_LD"];
			}
		}),
	);
}

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

test("Publication routes use the shared shell, exact noindex policy, and reviewed structured data only", async ({ page }) => {
	for (const route of publicationRoutes) {
		await page.goto(route.path);
		await expect(page.locator("header.site-header")).toBeVisible();
		await expect(page.locator("footer.site-footer")).toBeVisible();
		await expect(page.locator("main")).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
		if (route.heading) await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();

		const types = await structuredDataTypes(page);
		expect(types).not.toContain("INVALID_JSON_LD");
		expect(types).not.toEqual(expect.arrayContaining(["BlogPosting", "FAQPage", "HowTo", "ItemList", "DefinedTermSet"]));
		expect(types.every((type) => ["Organization", "WebSite", "BreadcrumbList"].includes(type))).toBe(true);
	}
});

test("Utility routes use the shared shell and their exact index policy", async ({ page }) => {
	for (const route of utilityRoutes) {
		await page.goto(route.path);
		await expect(page.locator("header.site-header")).toBeVisible();
		await expect(page.locator("footer.site-footer")).toBeVisible();
		await expect(page.locator("main")).toHaveCount(1);
		await expect(page.locator(".site-utility-context")).toContainText(route.shell);
		const robots = page.locator('meta[name="robots"]');
		if (route.robots) await expect(robots).toHaveAttribute("content", route.robots);
		else await expect(robots).toHaveCount(0);
	}
});

test("Docs declares its open-source identity in HTML, negotiated Markdown, and OG metadata", async ({ page, request }) => {
	await page.goto("/docs");
	await expect(page.getByText(DOCS_DISCLOSURE, { exact: true })).toBeVisible();
	expect(await structuredDataTypes(page)).not.toContain("TechArticle");
	await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", DOCS_DISCLOSURE);

	for (const path of ["/docs", "/docs.md", "/docs/getting-started"]) {
		const response = await request.get(path, { headers: { Accept: "text/markdown" } });
		expect(response.ok(), path).toBe(true);
		expect(response.headers()["content-type"]).toContain("text/markdown");
		expect(await response.text()).toContain(`> ${DOCS_DISCLOSURE}`);
	}

	const og = await request.get("/og/docs/image.png");
	expect(og.ok()).toBe(true);
	expect(og.headers()["content-type"]).toContain("image/png");
});

test("Docs keeps navigation and search available on mobile", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/docs");
	const navigation = page.getByText("Browse and search documentation", { exact: true });
	await expect(navigation).toBeVisible();
	await navigation.click();
	await expect(page.getByRole("button", { name: /Search docs/i })).toBeVisible();
});

test("Status reports periodic checks and an honest unavailable state without SLA language", async ({ page, request }) => {
	await page.goto("/status");
	await expect(page.getByRole("heading", { level: 1, name: "Provider check ledger" })).toBeVisible();
	await expect(page.getByText(/Periodic checks run every six hours/i)).toBeVisible();
	await expect(page.getByText(/7-day check pass rate/i).first()).toBeVisible();
	await expect(page.getByText(/Check history is unavailable/i)).toBeVisible();
	const visible = await page.locator("main").innerText();
	expect(visible).not.toMatch(/real-time|all systems|uptime|SLA|service coverage/i);

	const og = await request.get("/og/status.png");
	expect(og.status()).toBe(200);
	expect(og.headers()["content-type"]).toContain("image/png");
});

test("Brand publishes the complete VI and downloadable assets without decorative checkerboard", async ({ page, request }) => {
	await page.goto("/brand");
	for (const value of ["#0B1220", "#F6F4F1", "#1E2A39", "#8A95A3", "#DDE2E8", "#FF6A00", "#2F3E50"]) {
		await expect(page.getByText(value, { exact: true })).toBeVisible();
	}
	await expect(page.locator('[data-brand-asset="wordmark"]')).toHaveCount(2);
	const transparentPreviews = page.locator('[data-brand-preview="transparent"]');
	await expect(transparentPreviews).toHaveCount(2);
	for (const preview of await transparentPreviews.all()) await expect(preview).toHaveCSS("background-image", "none");

	const manifest = await request.get("/site.webmanifest");
	expect(manifest.ok()).toBe(true);
	const body = (await manifest.json()) as { name: string; theme_color: string; background_color: string };
	expect(body).toEqual(expect.objectContaining({
		name: "Yonaris — AI-native MarTech",
		theme_color: "#0B1220",
		background_color: "#F6F4F1",
	}));
});

test("Brand reports clipboard failure instead of claiming a copy", async ({ page }) => {
	await page.goto("/brand");
	await waitForHydration(page);
	await page.evaluate(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: async () => Promise.reject(new Error("denied")) },
		});
	});
	await page.getByRole("button", { name: "Copy Signal Orange #FF6A00" }).click();
	await expect(page.getByText("Copy failed", { exact: true })).toBeVisible();
	await expect(page.getByText("Copied", { exact: true })).toHaveCount(0);
});

test("Changelog and Roadmap identify upstream data without creating commercial commitments", async ({ page }) => {
	await page.goto("/changelog");
	await expect(page.getByText(/upstream Elmo-compatible open-source repository/i).first()).toBeVisible();
	await expect(page.getByText(/not Yonaris commercial product releases/i).first()).toBeVisible();
	await expect(page.getByText(/Upstream activity is unavailable here right now/i)).toBeVisible();

	await page.goto("/roadmap");
	await expect(page.getByText(/upstream open-source project/i).first()).toBeVisible();
	await expect(page.getByText(/not a Yonaris delivery commitment/i).first()).toBeVisible();
	await expect(page.getByText(/Upstream issue data is unavailable here right now/i)).toBeVisible();
	const visible = await page.locator("main").innerText();
	expect(visible).not.toMatch(/what's coming next|upcoming features/i);
});

test("Blog RSS stays operational and explicitly unreviewed", async ({ request }) => {
	const response = await request.get("/blog/rss.xml");
	expect(response.ok()).toBe(true);
	expect(response.headers()["content-type"]).toContain("application/xml");
	expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
	expect(await response.text()).toContain("Yonaris publication archive");
});

test("representative Publication and Utility routes meet the accessibility and overflow matrix", async ({ page }) => {
	for (const route of representativeRoutes) {
		for (const viewport of [
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 },
			{ width: 280, height: 720 },
		]) {
			await page.setViewportSize(viewport);
			await page.goto(route.path);
			await expect(page.locator("main")).toHaveCount(1);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
		}
	}
});

test("Publication and Utility interactions expose Signal focus and 44px targets", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/brand");
	await waitForHydration(page);
	const copy = page.getByRole("button", { name: "Copy Signal Orange #FF6A00" });
	await expectSignalFocusVisible(page, copy);
	const copyBox = await copy.boundingBox();
	expect(copyBox?.height ?? 0).toBeGreaterThanOrEqual(44);
	expect(copyBox?.width ?? 0).toBeGreaterThanOrEqual(44);

	await page.goto("/blog/ai-brand-sentiment");
	const back = page.getByRole("link", { name: "Publication notes" });
	await expectSignalFocusVisible(page, back);
	const backBox = await back.boundingBox();
	expect(backBox?.height ?? 0).toBeGreaterThanOrEqual(44);

	await page.goto("/docs");
	await waitForHydration(page);
	for (const label of ["Yes", "No"]) {
		const feedback = page.getByRole("button", { name: label, exact: true });
		const feedbackBox = await feedback.boundingBox();
		expect(feedbackBox?.height ?? 0).toBeGreaterThanOrEqual(44);
	}
	await page.getByRole("button", { name: "Yes", exact: true }).click();
	const submitFeedback = page.getByRole("button", { name: "Submit Feedback" });
	const submitBox = await submitFeedback.boundingBox();
	expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("Publication and Utility routes leave no running motion under reduced motion", async ({ page }) => {
	for (const route of representativeRoutes) await expectNoRunningAnimations(page, route.path);
});

test.describe("representative Publication and Utility visual evidence", () => {
	test.describe.configure({ mode: "serial" });
	for (const route of representativeRoutes) {
		for (const viewport of ["desktop", "mobile", "micro"] as const) {
			test(`${route.key} ${viewport} @visual`, async ({ page }) => {
				await page.setViewportSize(
					viewport === "desktop"
						? { width: 1440, height: 900 }
						: viewport === "mobile"
							? { width: 390, height: 844 }
							: { width: 280, height: 720 },
				);
				await page.goto(route.path);
				const artifact = await captureQa(page, {
					route: route.path,
					locale: "en",
					viewport,
					state: "governed",
				});
				test.info().annotations.push({ type: "visual-artifact", description: artifact });
			});
		}
	}
});
