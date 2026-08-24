import { expect, test } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const globalPages = [
	{ path: "/", graphic: "answer-studio", agent: "/agent" },
	{ path: "/product", graphic: "product-workbench", agent: "/agent/product" },
	{ path: "/approach", graphic: "evidence-journey", agent: "/agent/approach" },
	{ path: "/research", graphic: "evidence-explorer", agent: "/agent/research" },
	{ path: "/geo", graphic: "answer-relationship-map", agent: "/agent/geo" },
	{ path: "/company", graphic: "verified-trust", agent: "/agent/company" },
	{ path: "/diagnostic", graphic: "request-timeline", agent: "/agent/diagnostic" },
	{ path: "/privacy", graphic: "privacy-state", agent: "/agent" },
] as const;

const chinaPages = [
	{ path: "/zh", graphic: "zh-answer-scene", agent: "/zh/agent" },
	{ path: "/zh/product", graphic: "zh-product-architecture", agent: "/zh/agent/product" },
	{ path: "/zh/approach", graphic: "zh-delivery-summary", agent: "/zh/agent/approach" },
	{ path: "/zh/research", graphic: "zh-evidence-record", agent: "/zh/agent/research" },
	{ path: "/zh/geo", graphic: "zh-answer-map", agent: "/zh/agent/geo" },
	{ path: "/zh/company", graphic: "zh-market-context", agent: "/zh/agent/company" },
	{ path: "/zh/diagnostic", graphic: "zh-diagnostic-preview", agent: "/zh/agent/diagnostic" },
	{ path: "/zh/privacy", graphic: "zh-privacy-flow", agent: "/zh/agent/privacy" },
] as const;

async function waitForHydration(page: import("@playwright/test").Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

test("both regional Human editions publish complete branded pages", async ({ page }) => {
	for (const fixture of [...globalPages, ...chinaPages]) {
		const china = fixture.path.startsWith("/zh");
		const response = await page.goto(fixture.path);
		expect(response?.status(), fixture.path).toBe(200);
		await expect(page.locator(china ? '.zh-site[data-edition="zh-cn"]' : '.global-en[data-edition="global-en"]')).toHaveCount(1);
		await expect(page.locator("main#main-content h1")).toHaveCount(1);
		await expect(page.locator(`[data-graphic="${fixture.graphic}"]`).first()).toBeVisible();
		await expect(page.locator('header img[src="/brand/logos/yonaris-wordmark-navy.png"]')).toHaveCount(1);
		await expect(page.locator('footer img[src="/brand/logos/yonaris-wordmark-white.png"]')).toHaveCount(1);
		await expect(page.locator(`a[href="${fixture.agent}"]`).first()).toHaveCount(1);
		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
			"href",
			fixture.path,
		);
	}
});

test("the regional interactions change the evidence shown", async ({ page }) => {
	await page.goto("/");
	await waitForHydration(page);
	await page.getByRole("tab", { name: "Why is a competitor being preferred?" }).click();
	await expect(page.locator('[role="tabpanel"][data-question="competitor"]')).toBeVisible();

	await page.goto("/product");
	await waitForHydration(page);
	await page.getByRole("tab", { name: "Evidence" }).click();
	await expect(page.locator('[role="tabpanel"][data-module="evidence"]')).toBeVisible();

	await page.goto("/zh");
	await waitForHydration(page);
	await page.getByRole("tab", { name: /为什么更偏向竞品/ }).click();
	await expect(page.locator('[role="tabpanel"][data-question="competitor"]')).toBeVisible();

	await page.goto("/zh/product");
	await waitForHydration(page);
	await page.getByRole("tab", { name: /依据核验/ }).click();
	await expect(page.locator('[role="tabpanel"][data-module="evidence"]')).toBeVisible();
});

test("regional lead forms expose exactly the approved three fields", async ({ page }) => {
	await page.goto("/diagnostic");
	const globalForm = page.locator("form");
	await expect(globalForm.locator('input:not([name="companyUrl"])')).toHaveCount(3);
	for (const label of ["Name", "Work email", "Company"]) await expect(globalForm.getByLabel(label, { exact: true })).toHaveCount(1);

	await page.goto("/zh/diagnostic");
	const chinaForm = page.locator("form");
	await expect(chinaForm.locator('input:not([name="companyUrl"])')).toHaveCount(3);
	for (const label of ["姓名", "电话", "公司"]) await expect(chinaForm.getByLabel(label, { exact: true })).toHaveCount(1);
});

test("Human and Agent pages remain paired in both regions", async ({ page, request }) => {
	for (const fixture of [
		{ path: "/agent/product", human: "/product" },
		{ path: "/zh/agent/product", human: "/zh/product" },
	] as const) {
		const response = await page.goto(fixture.path);
		expect(response?.status()).toBe(200);
		await expect(page.locator('.global-agent[data-view="agent"]')).toHaveCount(1);
		await expect(page.locator(`a[href="${fixture.human}"]`).first()).toHaveCount(1);
		await expect(page.locator('img[src="/brand/logos/yonaris-wordmark-white.png"]')).toHaveCount(1);

		const markdown = await request.get(fixture.path, { headers: { Accept: "text/markdown" } });
		expect(markdown.status()).toBe(200);
		expect(markdown.headers()["content-type"]).toContain("text/markdown");
		expect(await markdown.text()).toContain(`https://yonaris.com${fixture.human}`);
	}
});

test("all regional pages are accessible and overflow-free on desktop and mobile", async ({ page }) => {
	test.setTimeout(240_000);
	for (const viewport of [QA_VIEWPORTS.desktop, QA_VIEWPORTS.mobile]) {
		await page.setViewportSize(viewport);
		for (const fixture of [...globalPages, ...chinaPages]) {
			await page.goto(fixture.path);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
		}
	}
});

test("reduced motion settles every regional Human and representative Agent page", async ({ page }) => {
	for (const path of [...globalPages.map(({ path }) => path), ...chinaPages.map(({ path }) => path), "/agent", "/zh/agent"]) {
		await expectNoRunningAnimations(page, path);
	}
});

for (const fixture of [...globalPages, ...chinaPages]) {
	for (const viewport of ["desktop", "mobile"] as const) {
		test(`${fixture.path} ${viewport} release visual`, { tag: "@visual" }, async ({ page }) => {
			await page.goto(fixture.path);
			const artifact = await captureQa(page, {
				route: fixture.path,
				locale: fixture.path.startsWith("/zh") ? "zh" : "en",
				viewport,
				state: "dual-region-release",
			});
			test.info().annotations.push({ type: "visual-artifact", description: artifact });
		});
	}
}

for (const fixture of [
	{ path: "/agent", locale: "en" as const },
	{ path: "/agent/product", locale: "en" as const },
	{ path: "/zh/agent", locale: "zh" as const },
	{ path: "/zh/agent/product", locale: "zh" as const },
]) {
	for (const viewport of ["desktop", "mobile"] as const) {
		test(`${fixture.path} ${viewport} Agent visual`, { tag: "@visual" }, async ({ page }) => {
			await page.goto(fixture.path);
			const artifact = await captureQa(page, {
				route: fixture.path,
				locale: fixture.locale,
				viewport,
				state: "agent-release",
			});
			test.info().annotations.push({ type: "visual-artifact", description: artifact });
		});
	}
}
