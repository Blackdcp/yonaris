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
		agentAnnotation:
			"An agent needs explicit facts, conditions, and evidence it can carry into another buying context.",
		agentLabel: "Software agent",
		canonicalPath: "/company",
		diagnosticLabel: "Get a Free Diagnostic",
		groupLabel: "Choose the market reader",
		headline: "MarTech, rebuilt. For humans and agents.",
		humanAnnotation: "A person can question the evidence, inspect its scope, and decide what to test next.",
		humanLabel: "Human decision-maker",
		marketTitle: "The market now has two readers.",
		route: "/company",
		stageTitle: "A real platform. A service-led beginning.",
	},
	{
		agentAnnotation: "软件智能体需要明确的事实、条件与证据，才能把理解带入下一个购买语境",
		agentLabel: "软件智能体",
		canonicalPath: "/zh/company",
		diagnosticLabel: "获取免费诊断",
		groupLabel: "选择市场读者",
		headline: "重构 MarTech，同时面向人，也面向智能体",
		humanAnnotation: "人可以追问证据、检查范围，并判断下一步值得测试什么",
		humanLabel: "人类决策者",
		marketTitle: "市场现在有两类读者",
		route: "/zh/company",
		stageTitle: "真实的平台，服务驱动的起点",
	},
] as const;

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

function readerButton(group: Locator, name: string): Locator {
	return group.getByRole("button", { name, exact: true });
}

async function expectOnePressed(group: Locator, label: string): Promise<void> {
	await expect(group.getByRole("button")).toHaveCount(2);
	await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
	await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
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

for (const locale of locales) {
	test(`${locale.route} renders an honest editorial category thesis`, async ({ page }) => {
		await page.goto(locale.route);
		await waitForHydration(page);

		const h1 = page.getByRole("heading", { level: 1, name: locale.headline, exact: true });
		await expect(h1).toHaveCount(1);
		await expect(page.getByRole("heading", { level: 2, name: locale.marketTitle, exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { level: 2, name: locale.stageTitle, exact: true })).toBeVisible();
		await expect(h1.locator("br")).toHaveCount(0);
		await expect(page.locator(".company-page h2 br")).toHaveCount(0);

		const group = page.getByRole("group", { name: locale.groupLabel });
		await expectOnePressed(group, locale.humanLabel);
		await expect(page.locator('[data-reader-description="human"]')).toBeVisible();
		await expect(page.locator('[data-reader-description="agent"]')).toBeVisible();
		await expect(page.locator('[data-company-reader-annotation]')).toHaveText(locale.humanAnnotation);
		await expect(group.locator('[role="tab"], [role="tablist"]')).toHaveCount(0);
		await expect(page.locator(".company-reader-field [hidden]")).toHaveCount(0);

		await expect(page.locator('[data-company-stage="service-led"]')).toContainText(
			/service-led|服务驱动/i,
		);
		await expect(page.locator('[data-company-stage="service-led"]')).toContainText(
			/customer-visible|客户可见/i,
		);
		await expect(page.locator('[data-company-stage="service-led"]')).toContainText(
			/Yonaris-operated|Yonaris 团队执行/i,
		);
		await expect(page.locator('[data-company-stage="service-led"]')).toContainText(
			/human-reviewed|人工审核/i,
		);

		await expect(page.locator("main")).not.toContainText(/upstream|上游/i);
		await expect(page.getByRole("link", { name: locale.diagnosticLabel, exact: true }).last()).toHaveAttribute(
			"href",
			locale.route.startsWith("/zh") ? "/zh/diagnostic" : "/diagnostic",
		);
		await expect(page.getByRole("link", { name: "black.dcp@outlook.com", exact: true })).toHaveAttribute(
			"href",
			"mailto:black.dcp@outlook.com",
		);

		await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", locale.canonicalPath);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", "/company");
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute(
			"href",
			"/zh/company",
		);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
			"href",
			"/company",
		);

		await expect(page.locator(".company-page article, .company-page img, .company-page svg, .company-page canvas")).toHaveCount(
			0,
		);
		await expect(page.locator(".company-principles__list > li")).toHaveCount(4);
		const principleRadius = await page
			.locator(".company-principles__list > li")
			.first()
			.evaluate((element) => getComputedStyle(element).borderRadius);
		expect(principleRadius).toBe("0px");
	});

	test(`${locale.route} keeps both readers visible while native buttons change only the annotation`, async ({ page }) => {
		await page.goto(locale.route);
		await waitForHydration(page);

		const group = page.getByRole("group", { name: locale.groupLabel });
		const human = readerButton(group, locale.humanLabel);
		const agent = readerButton(group, locale.agentLabel);
		const annotation = page.locator('[data-company-reader-annotation]');
		const hinge = page.locator("[data-company-hinge]");
		const before = await hinge.evaluate((element) => getComputedStyle(element).transform);

		await agent.click();
		await expect(agent).toBeFocused();
		await expectOnePressed(group, locale.agentLabel);
		await expect(annotation).toHaveText(locale.agentAnnotation);
		await expect(page.locator('[data-reader-description="human"]')).toBeVisible();
		await expect(page.locator('[data-reader-description="agent"]')).toBeVisible();
		await expect.poll(() => hinge.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);

		await human.focus();
		await page.keyboard.press("Space");
		await expectOnePressed(group, locale.humanLabel);
		await expect(annotation).toHaveText(locale.humanAnnotation);
		await agent.focus();
		await page.keyboard.press("Enter");
		await expectOnePressed(group, locale.agentLabel);
		await expect(annotation).toHaveText(locale.agentAnnotation);

		await page.waitForTimeout(650);
		await expectOnePressed(group, locale.agentLabel);
	});
}

test("Company hero and reader field use a distinct full-bleed editorial composition", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.desktop);
	await page.goto("/company");
	await waitForHydration(page);

	const hero = await page.locator(".company-hero").boundingBox();
	const field = page.locator(".company-reader-field");
	const fieldBox = await field.boundingBox();
	expect(hero?.height ?? 0).toBeGreaterThan(720);
	expect(fieldBox?.x ?? -1).toBeLessThanOrEqual(1);
	expect(Math.abs((fieldBox?.width ?? 0) - QA_VIEWPORTS.desktop.width)).toBeLessThanOrEqual(1);
	expect(await field.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(11, 18, 32)");

	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/company");
	await waitForHydration(page);
	const desktopReaders = page.locator(".company-reader-field__description");
	const [desktopFirst, desktopSecond] = await Promise.all([
		desktopReaders.first().boundingBox(),
		desktopReaders.last().boundingBox(),
	]);
	expect(Math.abs((desktopFirst?.y ?? 0) - (desktopSecond?.y ?? 0))).toBeLessThanOrEqual(2);

	await page.setViewportSize(QA_VIEWPORTS.mobile);
	await page.goto("/company");
	await waitForHydration(page);
	const mobileReaders = page.locator(".company-reader-field__description");
	const [mobileFirst, mobileSecond] = await Promise.all([
		mobileReaders.first().boundingBox(),
		mobileReaders.last().boundingBox(),
	]);
	expect(mobileSecond?.y ?? 0).toBeGreaterThanOrEqual((mobileFirst?.y ?? 0) + (mobileFirst?.height ?? 0) + 20);
});

test("Company reader controls use a Signal and Paper keyboard focus edge on Ink", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/company");
	await waitForHydration(page);
	await expectSignalFocusVisible(
		page,
		page.getByRole("group", { name: locales[0].groupLabel }).getByRole("button", { name: locales[0].humanLabel }),
	);
});

test("Company reader state change leaves no running motion under reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/company");
	await waitForHydration(page);
	await page.getByRole("button", { name: locales[0].agentLabel, exact: true }).click();
	await expectNoRunningAnimations(page);
});

test("Company keeps both reader states accessible and overflow-free at all seven QA widths", async ({ page }) => {
	test.setTimeout(240_000);
	for (const viewport of Object.values(QA_VIEWPORTS)) {
		await page.setViewportSize(viewport);
		for (const locale of locales) {
			await page.goto(locale.route);
			await waitForHydration(page);
			const group = page.getByRole("group", { name: locale.groupLabel });
			for (const activeLabel of [locale.humanLabel, locale.agentLabel]) {
				await readerButton(group, activeLabel).click();
				await expectOnePressed(group, activeLabel);
				await expect(page.locator('[data-reader-description="human"]')).toBeVisible();
				await expect(page.locator('[data-reader-description="agent"]')).toBeVisible();
				await expectNoHorizontalOverflow(page);
				await runWcagAa(page);
			}
		}
	}
});

test("Chinese Company typography uses CJK-first text flow without English tracking", async ({ page }) => {
	for (const viewportName of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/zh/company");
		await waitForHydration(page);
		for (const locator of [
			page.locator(".company-hero h1"),
			page.locator(".company-kicker").first(),
			page.locator(".company-reader-field__control").first(),
			page.locator(".company-principles__title").first(),
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

test("Company stage thesis keeps meaningful English and Chinese phrases intact", async ({ page }) => {
	test.setTimeout(120_000);
	for (const viewportName of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
		await page.setViewportSize(QA_VIEWPORTS[viewportName]);
		await page.goto("/company");
		await waitForHydration(page);
		await expectTextFragmentOnOneLine(page.getByRole("heading", { level: 2, name: locales[0].stageTitle }), "service-led");

		await page.goto("/zh/company");
		await waitForHydration(page);
		const chineseStage = page.getByRole("heading", { level: 2, name: locales[1].stageTitle });
		await expectTextFragmentOnOneLine(chineseStage, "真实的平台");
		await expectTextFragmentOnOneLine(chineseStage, "服务驱动的起点");
	}
});

for (const semanticUnit of [
	{
		canonicalText: "不穷举每一个问题，构建答案生长的根系",
		fragment: "答案",
		name: "Forest answer",
		selector: "#company-forest-title",
	},
	{
		canonicalText: "从一个真正重要的问题开始",
		fragment: "真正",
		name: "Contact real",
		selector: "#company-contact-title",
	},
	{
		canonicalText: "人可以追问证据、检查范围，并判断下一步值得测试什么",
		fragment: "测试",
		name: "reader annotation test",
		selector: "[data-company-reader-annotation]",
	},
] as const) {
	test(`Chinese Company keeps ${semanticUnit.name} intact across editorial display widths`, async ({ page }) => {
		test.setTimeout(120_000);
		for (const viewportName of ["desktop", "tabletLandscape", "mobile", "narrow"] as const) {
			await page.setViewportSize(QA_VIEWPORTS[viewportName]);
			await page.goto("/zh/company");
			await waitForHydration(page);
			const target = page.locator(semanticUnit.selector);
			await expect(target).toHaveText(semanticUnit.canonicalText);
			await expectTextFragmentOnOneLine(target, semanticUnit.fragment);
		}
	});
}

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
