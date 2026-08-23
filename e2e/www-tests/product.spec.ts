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
		boundaryKicker: "Product boundary",
		contextKicker: "Product in context",
		diagnosticLabel: "Get a Free Diagnostic",
		diagnosticPath: "/diagnostic",
		geoLabel: "See the GEO workflow",
		geoPath: "/geo",
		headline: "Make AI market answers observable.",
		illustrativeLabel: "Illustrative",
		knownLabel: "Known",
		managedLabel: "Managed delivery",
		route: "/product",
		tabLabels: ["Scope", "Answer", "Sources", "Next test"],
		tabListLabel: "Illustrative evidence views",
		unknownLabel: "Unknown",
		workspaceLabels: ["Customer workspace", "Yonaris-operated"],
	},
	{
		boundaryKicker: "产品边界",
		contextKicker: "产品与应用场景",
		diagnosticLabel: "获取免费诊断",
		diagnosticPath: "/zh/diagnostic",
		geoLabel: "查看 GEO 工作流程",
		geoPath: "/zh/geo",
		headline: "让 AI 形成的市场答案变得可观察",
		illustrativeLabel: "示例",
		knownLabel: "已知",
		managedLabel: "团队交付",
		route: "/zh/product",
		tabLabels: ["范围", "回答", "来源", "下一项测试"],
		tabListLabel: "示例证据视图",
		unknownLabel: "未知",
		workspaceLabels: ["客户工作区", "Yonaris 执行"],
	},
] as const;

async function expectAutomaticSelection(tabs: Locator, page: Page, index: number): Promise<Locator> {
	await expect(tabs).toHaveCount(4);
	await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
	await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);

	for (let tabIndex = 0; tabIndex < 4; tabIndex += 1) {
		const tab = tabs.nth(tabIndex);
		await expect(tab).toHaveAttribute("aria-selected", tabIndex === index ? "true" : "false");
		await expect(tab).toHaveAttribute("tabindex", tabIndex === index ? "0" : "-1");
	}

	const activeTab = tabs.nth(index);
	const panelId = await activeTab.getAttribute("aria-controls");
	const tabId = await activeTab.getAttribute("id");
	expect(panelId).toBeTruthy();
	expect(tabId).toBeTruthy();
	const activePanel = page.locator(`[role="tabpanel"]#${panelId}`);
	await expect(activePanel).toBeVisible();
	await expect(activePanel).toHaveAttribute("aria-labelledby", tabId ?? "");
	await expect(activePanel).toHaveAttribute("tabindex", "0");
	await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
	return activePanel;
}

async function readTypography(locator: Locator): Promise<{
	fontFamily: string;
	letterSpacing: number;
	textTransform: string;
}> {
	return locator.evaluate((element) => {
		const styles = getComputedStyle(element);
		return {
			fontFamily: styles.fontFamily.replaceAll('"', "").split(",")[0]?.trim() ?? "",
			letterSpacing: styles.letterSpacing === "normal" ? 0 : Number.parseFloat(styles.letterSpacing),
			textTransform: styles.textTransform,
		};
	});
}

for (const locale of locales) {
	test(`${locale.route} exposes a truthful Product evidence workbench`, async ({ page }) => {
		await page.goto(locale.route);
		await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);

		await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toHaveCount(1);
		await expect(page.getByText(locale.illustrativeLabel, { exact: true }).first()).toBeVisible();
		for (const label of locale.workspaceLabels) {
			await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
		}
		await expect(page.getByText(locale.boundaryKicker, { exact: true })).toBeVisible();
		await expect(page.getByText(locale.contextKicker, { exact: true })).toBeVisible();
		await expect(page.getByText(locale.managedLabel, { exact: true }).first()).toBeVisible();

		const tabList = page.getByRole("tablist", { name: locale.tabListLabel });
		const tabs = tabList.getByRole("tab");
		await expect(tabs).toHaveCount(4);
		for (const [index, label] of locale.tabLabels.entries()) {
			await expect(tabs.nth(index)).toHaveAccessibleName(label);
		}
		await expectAutomaticSelection(tabs, page, 0);

		await expect(page.getByText(locale.knownLabel, { exact: true }).first()).toBeVisible();
		await tabs.nth(2).click();
		await expect(page.getByText(locale.unknownLabel, { exact: true }).first()).toBeVisible();

		await expect(page.getByRole("link", { name: locale.geoLabel, exact: true })).toHaveAttribute(
			"href",
			locale.geoPath,
		);
		await expect(page.getByRole("link", { name: locale.diagnosticLabel, exact: true }).last()).toHaveAttribute(
			"href",
			locale.diagnosticPath,
		);
	});
}

test("Product tabs use automatic activation with reciprocal WAI-ARIA relationships", async ({ page }) => {
	await page.goto("/product");
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
	const tabs = page.getByRole("tablist", { name: "Illustrative evidence views" }).getByRole("tab");

	await tabs.first().focus();
	await tabs.first().press("ArrowLeft");
	await expect(tabs.last()).toBeFocused();
	await expectAutomaticSelection(tabs, page, 3);

	await tabs.last().press("ArrowRight");
	await expect(tabs.first()).toBeFocused();
	await expectAutomaticSelection(tabs, page, 0);
	await tabs.first().press("ArrowRight");
	await expect(tabs.nth(1)).toBeFocused();
	await expectAutomaticSelection(tabs, page, 1);

	await tabs.nth(1).press("End");
	await expect(tabs.last()).toBeFocused();
	await expectAutomaticSelection(tabs, page, 3);

	await tabs.last().press("Home");
	await expect(tabs.first()).toBeFocused();
	await expectAutomaticSelection(tabs, page, 0);

	await tabs.nth(2).click();
	await expect(tabs.nth(2)).toBeFocused();
	const activePanel = await expectAutomaticSelection(tabs, page, 2);
	await page.keyboard.press("Tab");
	await expect(activePanel).toBeFocused();
});

test("Product tabs stay visible at 1024px and show an Ink plus Signal focus edge", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.tabletLandscape);
	await page.goto("/product");
	const tabList = page.getByRole("tablist", { name: "Illustrative evidence views" });
	const tabs = tabList.getByRole("tab");

	for (let index = 0; index < 4; index += 1) {
		await expect(tabs.nth(index)).toBeVisible();
	}
	const bounds = await tabs.evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return { left: box.left, right: box.right, width: box.width };
		}),
	);
	expect(bounds.every((box) => box.left >= 0 && box.right <= 1024 && box.width >= 120)).toBe(true);
	await expectSignalFocusVisible(page, tabs.first());
});

test("Product recomposes readably without horizontal overflow at all seven QA widths", async ({ page }) => {
	test.setTimeout(120_000);
	for (const viewport of Object.values(QA_VIEWPORTS)) {
		await page.setViewportSize(viewport);
		for (const locale of locales) {
			await page.goto(locale.route);
			await expectNoHorizontalOverflow(page);

			if (viewport.width <= 390) {
				const presentation = await page.locator(".product-workbench").evaluate((workbench) => {
					const bounds = workbench.getBoundingClientRect();
					const field = workbench.querySelector<HTMLElement>(".product-workbench__field");
					return {
						fieldFontSize: field ? Number.parseFloat(getComputedStyle(field).fontSize) : 0,
						left: bounds.left,
						right: bounds.right,
						viewport: window.innerWidth,
					};
				});
				expect(presentation.fieldFontSize).toBeGreaterThanOrEqual(13);
				expect(presentation.left).toBeGreaterThanOrEqual(0);
				expect(presentation.right).toBeLessThanOrEqual(presentation.viewport);
			}
		}
	}
});

test("Product has no running animation when reduced motion is requested", async ({ page }) => {
	for (const locale of locales) {
		await expectNoRunningAnimations(page, locale.route);
	}
});

test("Chinese Product labels use locale-appropriate tracking", async ({ page }) => {
	await page.goto("/zh/product");
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);

	const headingSelectors = [
		".product-hero h1",
		".product-section-heading h2",
		".product-workbench__heading h2",
		".product-workbench__record-heading h3",
	];
	const labelSelectors = [
		".product-kicker",
		".product-claim__status",
		".product-workbench__illustrative",
		".product-workbench__record-heading p",
		".product-workbench__field dt",
		".product-workbench__field-state",
	];

	for (const selector of headingSelectors) {
		const typography = await readTypography(page.locator(selector).first());
		expect.soft(typography.fontFamily, `${selector} should prefer a CJK sans face`).toBe("PingFang SC");
		expect.soft(Math.abs(typography.letterSpacing), `${selector} should use natural CJK tracking`).toBeLessThanOrEqual(0.5);
		expect.soft(typography.textTransform, `${selector} should preserve natural Chinese casing`).toBe("none");
	}

	for (const selector of labelSelectors) {
		const typography = await readTypography(page.locator(selector).first());
		expect.soft(typography.fontFamily, `${selector} should prefer a CJK sans face`).toBe("PingFang SC");
		expect.soft(Math.abs(typography.letterSpacing), `${selector} should use natural CJK tracking`).toBeLessThanOrEqual(0.5);
		expect.soft(typography.textTransform, `${selector} should preserve natural Chinese casing`).toBe("none");
	}
});

for (const locale of locales) {
	for (const viewport of ["desktop", "mobile"] as const) {
		for (const [tabIndex, tabLabel] of locale.tabLabels.entries()) {
			test(`${locale.route} ${viewport} ${tabLabel} tab meets WCAG AA`, async ({ page }) => {
				await page.setViewportSize(QA_VIEWPORTS[viewport]);
				await page.goto(locale.route);
				await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
				const tabs = page.getByRole("tablist", { name: locale.tabListLabel }).getByRole("tab");
				await tabs.nth(tabIndex).click();
				await expectAutomaticSelection(tabs, page, tabIndex);
				await runWcagAa(page);
			});
		}
	}
}

for (const locale of locales) {
	for (const viewport of ["desktop", "mobile", "narrow"] as const) {
		test(
			`${locale.route} ${viewport} visual evidence`,
			{ tag: "@visual" },
			async ({ page }) => {
				await page.setViewportSize(QA_VIEWPORTS[viewport]);
				await page.goto(locale.route);
				await expect(page.getByRole("heading", { level: 1, name: locale.headline, exact: true })).toBeVisible();
				await captureQa(page, {
					locale: locale.route.startsWith("/zh") ? "zh" : "en",
					route: locale.route,
					viewport,
				});
			},
		);
	}
}
