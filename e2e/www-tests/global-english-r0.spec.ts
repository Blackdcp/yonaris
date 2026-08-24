import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, expectNoRunningAnimations, runWcagAa } from "./helpers/core-site";

const pages = [
	{ path: "/", headline: "Know how AI represents your brand—and what to do next.", graphic: "evidence-window" },
	{ path: "/product", headline: "Make AI market answers observable.", graphic: "scope-rings" },
	{ path: "/approach", headline: "Move from uncertainty to a reviewable next test.", graphic: "evidence-path" },
	{ path: "/research", headline: "Evidence needs a scope, denominator, and boundary.", graphic: "evidence-ledger" },
	{ path: "/geo", headline: "See where your brand enters an AI answer.", graphic: "entry-map" },
	{ path: "/company", headline: "Evidence before conclusion.", graphic: "operating-model" },
	{ path: "/diagnostic", headline: "Request a focused AI market diagnostic.", graphic: "diagnostic-preview" },
	{ path: "/privacy", headline: "Privacy facts must be verified before collection starts.", graphic: "privacy-flow" },
] as const;

const retiredDestinations = ["/resources", "/brand", "/status", "/agent", "/llms.txt"] as const;

test("the eight-route global edition owns complete graphical pages and independent metadata", async ({ page }) => {
	for (const fixture of pages) {
		const response = await page.goto(fixture.path);
		expect(response?.status(), fixture.path).toBe(200);
		await expect(page.locator('.global-en[data-edition="global-en"]')).toHaveCount(1);
		await expect(page.locator("main#main-content")).toHaveCount(1);
		await expect(page.getByRole("heading", { level: 1, name: fixture.headline, exact: true })).toHaveCount(1);
		await expect(page.locator(`[data-graphic="${fixture.graphic}"]`).first()).toBeVisible();
		await expect(page.locator("main [data-graphic]")).not.toHaveCount(0);

		const canonical = fixture.path;
		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", canonical);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", canonical);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", canonical);
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveCount(0);

		const publicChrome = `${await page.locator("header").innerHTML()}${await page.locator("footer").innerHTML()}`;
		for (const destination of retiredDestinations) expect(publicChrome).not.toContain(`href="${destination}"`);
	}
});

test("the global edition is overflow-free and accessible on desktop and mobile", async ({ page }) => {
	test.setTimeout(180_000);
	for (const viewport of [
		{ width: 1440, height: 1000 },
		{ width: 390, height: 844 },
	]) {
		await page.setViewportSize(viewport);
		for (const fixture of pages) {
			await page.goto(fixture.path);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
		}
	}
});

test("the mobile menu exposes the approved commercial map and closes natively", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/product");
	const menu = page.locator("details.global-en__menu");
	const summary = menu.locator("summary");
	await expect(menu).not.toHaveAttribute("open", "");
	await summary.click();
	await expect(menu).toHaveAttribute("open", "");
	await expect(menu.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
	for (const destination of ["/product", "/approach", "/research", "/company", "/diagnostic", "/zh"])
		await expect(menu.locator(`a[href="${destination}"]`)).toHaveCount(1);
	await summary.click();
	await expect(menu).not.toHaveAttribute("open", "");
});

test("diagnostic collection remains visibly fail closed", async ({ page }) => {
	await page.goto("/diagnostic");
	const form = page.locator('form[data-submission-state="disabled"]');
	await expect(form).toHaveCount(1);
	await expect(form.locator("fieldset")).toHaveAttribute("disabled", "");
	await expect(form.getByRole("button", { name: "Submit diagnostic request" })).toBeDisabled();
	await expect(page.getByText("No lead data is collected by this disabled surface.")).toBeVisible();
});

test("reduced motion leaves every global page settled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const fixture of pages) {
		await page.goto(fixture.path);
		await expectNoRunningAnimations(page);
	}
});
