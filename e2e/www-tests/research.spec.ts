import { expect, test, type Locator, type Page } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const locales = [
	{
		canonicalPath: "/research",
		citationState: "Known",
		headline: "Every finding should show its scope.",
		illustrativeLabel: "Illustrative",
		measurementTitle: "Declare the frame before reading the finding.",
		route: "/research",
		unknownState: "Unknown",
		zhPath: "/zh/research",
	},
	{
		canonicalPath: "/zh/research",
		citationState: "已知",
		headline: "每一项结论，都应说明它成立的范围",
		illustrativeLabel: "示例",
		measurementTitle: "先声明观察框架，再阅读结论",
		route: "/zh/research",
		unknownState: "未知",
		zhPath: "/zh/research",
	},
] as const;

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function expectTwoColumns(layout: Locator): Promise<void> {
	const items = layout.locator(":scope > *");
	await expect(items).toHaveCount(2);
	const [first, second] = await Promise.all([items.first().boundingBox(), items.last().boundingBox()]);
	expect(first).toBeTruthy();
	expect(second).toBeTruthy();
	expect(first?.width ?? 0).toBeGreaterThan(250);
	expect(second?.width ?? 0).toBeGreaterThan(350);
	expect(second?.x ?? 0).toBeGreaterThanOrEqual((first?.x ?? 0) + (first?.width ?? 0) + 20);
	expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThanOrEqual(2);
}

async function expectLinearFlow(layout: Locator): Promise<void> {
	const items = layout.locator(":scope > *");
	await expect(items).toHaveCount(2);
	const [first, second] = await Promise.all([items.first().boundingBox(), items.last().boundingBox()]);
	expect(first).toBeTruthy();
	expect(second).toBeTruthy();
	expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeLessThanOrEqual(2);
	expect(Math.abs((first?.width ?? 0) - (second?.width ?? 0))).toBeLessThanOrEqual(2);
	expect(second?.y ?? 0).toBeGreaterThanOrEqual((first?.y ?? 0) + (first?.height ?? 0) + 20);
}

for (const locale of locales) {
	test(`${locale.route} renders one complete editorial measurement ledger`, async ({ page }) => {
		await page.goto(locale.route);
		await waitForHydration(page);

		await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toHaveCount(1);
		await expect(page.getByRole("heading", { level: 2, name: locale.measurementTitle, exact: true })).toBeVisible();

		const metricArticles = page.locator('article[data-metric-id]');
		await expect(metricArticles).toHaveCount(2);
		for (let index = 0; index < 2; index += 1) {
			const article = metricArticles.nth(index);
			await expect(article.locator("dl")).toHaveCount(1);
			await expect(article.locator("dt")).toHaveCount(4);
			await expect(article.locator("dd")).toHaveCount(4);
		}

		const record = page.locator('article[data-record-status="illustrative"]');
		await expect(record).toHaveCount(1);
		await expect(record.getByText(locale.illustrativeLabel, { exact: true })).toBeVisible();
		await expect(record.locator(".research-ledger__metadata dl")).toHaveCount(1);
		await expect(record.locator('time[datetime="2026-08-12"]')).toBeVisible();
		for (const section of ["question", "answer", "citations", "exposed-queries", "findings", "unknowns"]) {
			await expect(record.locator(`[data-record-section="${section}"]`)).toBeVisible();
		}
		await expect(record.locator('[data-record-section="citations"]')).toContainText(locale.citationState);
		await expect(record.locator('[data-record-section="exposed-queries"]')).toContainText(locale.unknownState);
		await expect(record.getByText(/\.example/, { exact: false })).toHaveCount(2);
		await expect(record.locator('[data-record-section="exposed-queries"]')).toContainText(
			/does not establish that no search occurred|不能证明没有发生搜索/,
		);

		await expect(record.locator("[hidden]")).toHaveCount(0);
		await expect(record.locator("details, select, canvas, svg, button, [role=tab], [role=tablist]")).toHaveCount(0);
		await expect(page.locator(".research-dashboard, .research-kpi, .research-scorecard, .research-chart")).toHaveCount(0);

		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", locale.canonicalPath);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", "/research");
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute(
			"href",
			locale.zhPath,
		);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
			"href",
			"/research",
		);
	});

	test(`${locale.route} meets WCAG AA in desktop and mobile reading layouts`, async ({ page }) => {
		test.setTimeout(120_000);
		for (const viewportName of ["desktop", "mobile"] as const) {
			await page.setViewportSize(QA_VIEWPORTS[viewportName]);
			await page.goto(locale.route);
			await waitForHydration(page);
			await runWcagAa(page);
		}
	});

	test(`${locale.route} leaves no running motion with reduced motion enabled`, async ({ page }) => {
		await expectNoRunningAnimations(page, locale.route);
	});
}

test("Research holds a readable two-column ledger at 1024", async ({ page }) => {
	for (const locale of locales) {
		await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
		await page.goto(locale.route);
		await waitForHydration(page);
		await expectTwoColumns(page.locator(".research-ledger__layout"));
	}
});

test("Research returns to ordered document flow at 768 and below", async ({ page }) => {
	for (const viewportName of ["tabletPortrait", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		for (const locale of locales) {
			await page.goto(locale.route);
			await waitForHydration(page);
			await expectLinearFlow(page.locator(".research-ledger__layout"));
		}
	}
});

test("Research recomposes without horizontal overflow at all seven QA widths", async ({ page }) => {
	test.setTimeout(120_000);
	for (const viewport of Object.values(QA_VIEWPORTS)) {
		await page.setViewportSize(viewport);
		for (const locale of locales) {
			await page.goto(locale.route);
			await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	}
});

test("Chinese Research typography removes English tracking and casing", async ({ page }) => {
	for (const viewportName of ["desktop", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/zh/research");
		await waitForHydration(page);
		for (const locator of [
			page.locator(".research-hero h1"),
			page.locator(".research-kicker").first(),
			page.locator(".metric-method-card h3").first(),
			page.locator(".research-ledger__section-label").first(),
		]) {
			const typography = await locator.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					fontFamily: style.fontFamily,
					letterSpacing: style.letterSpacing,
					textTransform: style.textTransform,
				};
			});
			expect(typography.fontFamily).toMatch(/PingFang SC|Microsoft YaHei/);
			expect(typography.letterSpacing).toBe("normal");
			expect(typography.textTransform).toBe("none");
		}
	}
});

test("Research diagnostic action uses the shared Signal and Ink keyboard focus treatment", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/research");
	await waitForHydration(page);
	await expectSignalFocusVisible(page, page.locator(".research-next__links a").last());
});

for (const locale of locales) {
	for (const viewport of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
		test(`${locale.route} ${viewport} visual evidence`, { tag: "@visual" }, async ({ page }) => {
			await page.setViewportSize(QA_VIEWPORTS[viewport]);
			await page.goto(locale.route);
			await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toBeVisible();
			await captureQa(page, {
				locale: locale.route.startsWith("/zh") ? "zh" : "en",
				route: locale.route,
				viewport,
			});
		});
	}
}
