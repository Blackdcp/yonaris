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
		canonicalPath: "/approach",
		evidenceRecordLabel: "Active evidence record",
		headline: "A repeatable evidence loop, not a generic score.",
		processLabel: "Six-step evidence loop",
		route: "/approach",
		stepTitles: [
			"Frame the decision",
			"Build the question set",
			"Declare and sample",
			"Compare the evidence",
			"Inspect the answers",
			"Change one bounded input",
		],
		zhPath: "/zh/approach",
	},
	{
		canonicalPath: "/zh/approach",
		evidenceRecordLabel: "当前证据记录",
		headline: "建立可重复的证据循环，而不是制造一个泛化分数",
		processLabel: "六步证据循环",
		route: "/zh/approach",
		stepTitles: ["确定决策问题", "建立问题集合", "声明范围并采样", "比较证据", "检查原始回答", "改变一个有限变量"],
		zhPath: "/zh/approach",
	},
] as const;

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function expectActiveStep(buttons: Locator, record: Locator, index: number): Promise<void> {
	await expect(buttons).toHaveCount(6);
	expect(await buttons.evaluateAll((elements) => elements.filter((element) => element.getAttribute("aria-current") === "step").length)).toBe(1);
	expect(await buttons.evaluateAll((elements) => elements.filter((element) => element.getAttribute("tabindex") === "0").length)).toBe(1);

	for (let stepIndex = 0; stepIndex < 6; stepIndex += 1) {
		await expect(buttons.nth(stepIndex)).toHaveAttribute("tabindex", stepIndex === index ? "0" : "-1");
		if (stepIndex === index) {
			await expect(buttons.nth(stepIndex)).toHaveAttribute("aria-current", "step");
		} else {
			await expect(buttons.nth(stepIndex)).not.toHaveAttribute("aria-current", "step");
		}
	}

	const active = buttons.nth(index);
	const activeId = await active.getAttribute("id");
	const recordId = await active.getAttribute("aria-controls");
	expect(activeId).toBeTruthy();
	expect(recordId).toBeTruthy();
	await expect(record).toHaveAttribute("id", recordId ?? "");
	await expect(record).toHaveAttribute("aria-labelledby", activeId ?? "");
}

for (const locale of locales) {
	test(`${locale.route} renders a truthful ordered evidence loop`, async ({ page }) => {
		await page.goto(locale.route);
		await waitForHydration(page);

		await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toHaveCount(1);
		const process = page.getByRole("list", { name: locale.processLabel });
		const items = process.getByRole("listitem");
		const buttons = process.getByRole("button");
		const record = page.locator(".evidence-loop__record");
		await expect(items).toHaveCount(6);
		await expect(buttons).toHaveCount(6);
		await expect(page.getByText(locale.evidenceRecordLabel, { exact: true })).toBeVisible();
		await expect(page.locator(".evidence-loop__summary:visible")).toHaveCount(6);
		for (const [index, title] of locale.stepTitles.entries()) {
			await expect(buttons.nth(index)).toHaveAccessibleName(new RegExp(title));
		}
		await expectActiveStep(buttons, record, 0);
		await expect(page.getByText(/Repeated observations show change over time|重复观察能够呈现变化/)).toBeVisible();

		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", locale.canonicalPath);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", "/approach");
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute(
			"href",
			locale.zhPath,
		);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
			"href",
			"/approach",
		);
	});

	test(`${locale.route} meets WCAG AA in every active evidence state`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize(QA_VIEWPORTS.desktop);
		await page.goto(locale.route);
		await waitForHydration(page);
		const buttons = page.getByRole("list", { name: locale.processLabel }).getByRole("button");
		const record = page.locator(".evidence-loop__record");

		for (let index = 0; index < 6; index += 1) {
			await buttons.nth(index).click();
			await expectActiveStep(buttons, record, index);
			await runWcagAa(page);
		}
	});
}

test("Evidence Loop uses automatic activation and stops directional keys at both ends", async ({ page }) => {
	await page.goto("/approach");
	await waitForHydration(page);
	const buttons = page.getByRole("list", { name: "Six-step evidence loop" }).getByRole("button");
	const record = page.locator(".evidence-loop__record");

	await buttons.first().focus();
	await buttons.first().press("ArrowLeft");
	await expect(buttons.first()).toBeFocused();
	await expectActiveStep(buttons, record, 0);
	await buttons.first().press("ArrowUp");
	await expect(buttons.first()).toBeFocused();
	await expectActiveStep(buttons, record, 0);

	await buttons.first().press("ArrowRight");
	await expect(buttons.nth(1)).toBeFocused();
	await expectActiveStep(buttons, record, 1);
	await buttons.nth(1).press("ArrowDown");
	await expect(buttons.nth(2)).toBeFocused();
	await expectActiveStep(buttons, record, 2);

	await buttons.nth(2).press("End");
	await expect(buttons.last()).toBeFocused();
	await expectActiveStep(buttons, record, 5);
	await buttons.last().press("ArrowRight");
	await expect(buttons.last()).toBeFocused();
	await expectActiveStep(buttons, record, 5);
	await buttons.last().press("ArrowDown");
	await expect(buttons.last()).toBeFocused();
	await expectActiveStep(buttons, record, 5);

	await buttons.last().press("Home");
	await expect(buttons.first()).toBeFocused();
	await expectActiveStep(buttons, record, 0);
	await buttons.nth(3).click();
	await expect(buttons.nth(3)).toBeFocused();
	await expectActiveStep(buttons, record, 3);
});

test("Evidence Loop uses the shared Signal and Ink keyboard focus treatment", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/approach");
	await waitForHydration(page);
	const firstStep = page.getByRole("list", { name: "Six-step evidence loop" }).getByRole("button").first();
	await expectSignalFocusVisible(page, firstStep);
});

test("Evidence record remains below the sticky header while the process scrolls", async ({ page }) => {
	test.setTimeout(120_000);
	for (const viewportName of ["tabletPortrait", "tabletLandscape", "wide", "desktop"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/approach");
		await waitForHydration(page);
		const body = page.locator(".approach-loop__body");
		const record = page.locator(".evidence-loop__record");
		const header = page.locator(".site-header");

		await expect(record).toHaveCSS("position", "sticky");
		const bodyTop = await body.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
		await page.evaluate((top) => window.scrollTo(0, top + 180), bodyTop);
		await page.waitForTimeout(50);
		const firstTop = (await record.boundingBox())?.y;
		const headerBottom = (await header.boundingBox())?.height;
		expect(firstTop).toBeDefined();
		expect(headerBottom).toBeDefined();
		expect(firstTop ?? 0).toBeGreaterThanOrEqual((headerBottom ?? 0) + 12);
		await page.evaluate(() => window.scrollBy(0, 180));
		await page.waitForTimeout(50);
		const secondTop = (await record.boundingBox())?.y;
		expect(secondTop).toBeDefined();
		expect(Math.abs((secondTop ?? 0) - (firstTop ?? 0))).toBeLessThanOrEqual(2);
	}
});

test("Evidence record returns to normal document flow on all mobile widths", async ({ page }) => {
	for (const viewportName of ["narrow", "mobileCompact", "mobile"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/approach");
		await waitForHydration(page);
		const process = page.getByRole("list", { name: "Six-step evidence loop" });
		const record = page.locator(".evidence-loop__record");
		await expect(record).toHaveCSS("position", "static");
		const processBox = await process.boundingBox();
		const recordBox = await record.boundingBox();
		expect(processBox).toBeTruthy();
		expect(recordBox).toBeTruthy();
		expect(recordBox?.y ?? 0).toBeGreaterThanOrEqual((processBox?.y ?? 0) + (processBox?.height ?? 0));
	}
});

test("Approach recomposes without horizontal overflow at all seven QA widths", async ({ page }) => {
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

test("Approach leaves no running motion after the active step changes under reduced motion", async ({ page }) => {
	for (const locale of locales) {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(locale.route);
		await waitForHydration(page);
		const buttons = page.getByRole("list", { name: locale.processLabel }).getByRole("button");
		await buttons.nth(3).click();
		await expectNoRunningAnimations(page);
	}
});

for (const locale of locales) {
	for (const viewport of ["desktop", "mobile", "narrow"] as const) {
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

	for (const stepIndex of [3, 5] as const) {
		test(`${locale.route} active step ${stepIndex + 1} visual evidence`, { tag: "@visual" }, async ({ page }) => {
			await page.setViewportSize(QA_VIEWPORTS.desktop);
			await page.goto(locale.route);
			await waitForHydration(page);
			const buttons = page.getByRole("list", { name: locale.processLabel }).getByRole("button");
			await buttons.nth(stepIndex).click();
			await expectActiveStep(buttons, page.locator(".evidence-loop__record"), stepIndex);
			await page.evaluate(() => window.scrollTo(0, 0));
			await captureQa(page, {
				locale: locale.route.startsWith("/zh") ? "zh" : "en",
				route: locale.route,
				state: `step-${stepIndex + 1}`,
				viewport: "desktop",
			});
		});
	}
}
