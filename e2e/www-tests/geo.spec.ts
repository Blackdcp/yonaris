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
		boundary: "GEO is the first applied workflow—not Yonaris's category ceiling.",
		canonicalPath: "/geo",
		companyLabel: "Read the category thesis",
		diagnosticLabel: "Get a Free Diagnostic",
		diagnosticTimingBoundary:
			"Submitting a request begins a scope review with the Yonaris team before collection. It does not produce an immediate evidence result.",
		evidenceBoundary: "Evidence has edges.",
		headline: "GEO, grounded in evidence.",
		productLabel: "See the evidence product",
		route: "/geo",
		stageTitles: ["Discovery", "Description", "Comparison", "Citation", "Verification"],
		workflowLabel: "GEO applied evidence workflow",
	},
	{
		boundary: "GEO 是 Yonaris 第一项落地工作流，而不是公司的品类上限",
		canonicalPath: "/zh/geo",
		companyLabel: "阅读品类主张",
		diagnosticLabel: "获取免费诊断",
		diagnosticTimingBoundary: "提交请求会先进入范围审核，再开始采集，不会立即产生证据结果",
		evidenceBoundary: "证据有它的边界",
		headline: "让 GEO 建立在证据之上",
		productLabel: "查看证据产品",
		route: "/zh/geo",
		stageTitles: ["发现", "描述", "比较", "引用", "验证"],
		workflowLabel: "GEO 落地证据工作流",
	},
] as const;

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function expectTextFragmentOnOneLine(locator: Locator, fragment: string): Promise<void> {
	const rects = await locator.evaluate((element, expectedFragment) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node.textContent ?? "";
			const start = text.indexOf(expectedFragment);
			if (start < 0) continue;
			const range = document.createRange();
			range.setStart(node, start);
			range.setEnd(node, start + expectedFragment.length);
			return [...range.getClientRects()].map(({ left, right, top }) => ({ left, right, top }));
		}
		return [];
	}, fragment);
	expect(rects, `${JSON.stringify(fragment)} should resolve to one uninterrupted line`).toHaveLength(1);
}

async function expectFourColumnLane(lane: Locator): Promise<void> {
	const columns = lane.locator(":scope > [data-geo-column]");
	await expect(columns).toHaveCount(4);
	const boxes = await Promise.all(Array.from({ length: 4 }, (_, index) => columns.nth(index).boundingBox()));
	for (const box of boxes) {
		expect(box).toBeTruthy();
		expect(box?.width ?? 0).toBeGreaterThan(135);
	}
	for (let index = 1; index < boxes.length; index += 1) {
		const previous = boxes[index - 1];
		const current = boxes[index];
		expect(current?.x ?? 0).toBeGreaterThan((previous?.x ?? 0) + (previous?.width ?? 0) - 2);
		expect(Math.abs((current?.y ?? 0) - (boxes[0]?.y ?? 0))).toBeLessThanOrEqual(2);
	}
}

async function expectLinearLane(lane: Locator): Promise<void> {
	const columns = lane.locator(":scope > [data-geo-column]");
	await expect(columns).toHaveCount(4);
	const boxes = await Promise.all(Array.from({ length: 4 }, (_, index) => columns.nth(index).boundingBox()));
	for (const box of boxes) expect(box).toBeTruthy();
	for (let index = 1; index < boxes.length; index += 1) {
		const previous = boxes[index - 1];
		const current = boxes[index];
		expect(Math.abs((current?.x ?? 0) - (boxes[0]?.x ?? 0))).toBeLessThanOrEqual(2);
		expect(Math.abs((current?.width ?? 0) - (boxes[0]?.width ?? 0))).toBeLessThanOrEqual(2);
		expect(current?.y ?? 0).toBeGreaterThan((previous?.y ?? 0) + (previous?.height ?? 0));
	}
}

for (const locale of locales) {
	test(`${locale.route} renders one truthful, static applied workflow`, async ({ page }) => {
		await page.goto(locale.route);
		await waitForHydration(page);

		await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toHaveCount(1);
		await expect(page.getByText(locale.boundary, { exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { level: 3, name: locale.evidenceBoundary, exact: true })).toBeVisible();

		const workflow = page.getByRole("list", { name: locale.workflowLabel });
		const lanes = workflow.locator(":scope > li[data-geo-stage]");
		await expect(lanes).toHaveCount(5);
		for (const [index, stageId] of ["discovery", "description", "comparison", "citation", "verification"].entries()) {
			await expect(lanes.nth(index)).toHaveAttribute("data-geo-stage", stageId);
		}
		for (let index = 0; index < 5; index += 1) {
			const lane = lanes.nth(index);
			await expect(lane.getByRole("heading", { level: 3, name: locale.stageTitles[index], exact: true })).toBeVisible();
			await expect(lane.locator("[data-geo-observed-signal]")).toBeVisible();
			await expect(lane.locator("[data-geo-bounded-action]")).toBeVisible();
			await expect(lane.locator("[data-geo-capability-context]")).toBeVisible();
			await expect(lane.locator("[data-geo-limitation]").first()).toBeVisible();
		}

		await expect(workflow.locator("[hidden], button, details, select, [role=tab], [role=tablist], [aria-current=step]"))
			.toHaveCount(0);
		await expect(page.locator(".geo-page button")).toHaveCount(0);
		const positioned = await workflow.locator("*").evaluateAll((elements) =>
			elements.filter((element) => ["sticky", "fixed"].includes(getComputedStyle(element).position)).length,
		);
		expect(positioned).toBe(0);

		await expect(page.getByRole("link", { name: locale.productLabel, exact: true })).toHaveAttribute(
			"href",
			locale.route.startsWith("/zh") ? "/zh/product" : "/product",
		);
		await expect(page.getByRole("link", { name: locale.companyLabel, exact: true })).toHaveAttribute(
			"href",
			locale.route.startsWith("/zh") ? "/zh/company" : "/company",
		);
		await expect(page.getByRole("link", { name: locale.diagnosticLabel, exact: true }).last()).toHaveAttribute(
			"href",
			locale.route.startsWith("/zh") ? "/zh/diagnostic" : "/diagnostic",
		);
		await expect(page.getByText(locale.diagnosticTimingBoundary, { exact: true })).toBeVisible();

		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", locale.canonicalPath);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", "/geo");
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute(
			"href",
			"/zh/geo",
		);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", "/geo");
	});

	test(`${locale.route} keeps all five lanes accessible and overflow-free at all seven QA widths`, async ({ page }) => {
		test.setTimeout(180_000);
		for (const viewport of Object.values(QA_VIEWPORTS)) {
			await page.setViewportSize(viewport);
			await page.goto(locale.route);
			await waitForHydration(page);
			const lanes = page.locator("[data-geo-stage]");
			await expect(lanes).toHaveCount(5);
			for (let index = 0; index < 5; index += 1) await expect(lanes.nth(index)).toBeVisible();
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
		}
	});

	test(`${locale.route} leaves no running motion with reduced motion enabled`, async ({ page }) => {
		await expectNoRunningAnimations(page, locale.route);
	});
}

test("GEO applied evidence field is full-bleed and keeps four readable columns at 1024", async ({ page }) => {
	for (const locale of locales) {
		await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
		await page.goto(locale.route);
		await waitForHydration(page);
		const field = page.locator(".geo-applied-field");
		const box = await field.boundingBox();
		expect(box?.x ?? -1).toBeLessThanOrEqual(1);
		expect(Math.abs((box?.width ?? 0) - QA_VIEWPORTS.tabletLandscape.width)).toBeLessThanOrEqual(1);
		expect(await field.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(11, 18, 32)");
		for (const lane of await field.locator("[data-geo-stage]").all()) await expectFourColumnLane(lane);
	}
});

test("GEO lanes become complete linear records on mobile", async ({ page }) => {
	for (const viewportName of ["mobile", "mobileCompact", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		for (const locale of locales) {
			await page.goto(locale.route);
			await waitForHydration(page);
			for (const lane of await page.locator("[data-geo-stage]").all()) await expectLinearLane(lane);
		}
	}
});

test("GEO contextual links use the shared Signal and Ink keyboard focus treatment", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/geo");
	await waitForHydration(page);
	for (const link of await page.locator(".geo-context-link").all()) await expectSignalFocusVisible(page, link);
});

test("Chinese GEO typography removes English tracking and casing", async ({ page }) => {
	for (const viewportName of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/zh/geo");
		await waitForHydration(page);
		for (const locator of [
			page.locator(".geo-hero h1"),
			page.locator(".geo-kicker").first(),
			page.locator(".geo-workflow__label").first(),
			page.locator(".geo-lane__status").first(),
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

test("Chinese GEO keeps the evidence phrase intact and display headings free of forced punctuation", async ({ page }) => {
	for (const viewportName of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/zh/geo");
		await waitForHydration(page);
		await expectTextFragmentOnOneLine(page.locator(".geo-hero h1"), "证据之上");
		for (const heading of await page.locator(".geo-hero__boundary h2, .geo-workflow__heading h2, .geo-beyond h2").all()) {
			await expect(heading).not.toContainText(/[，。]/);
		}
	}
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
