import { expect, test, type Page } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectVisualBaseline,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const globalPages = [
	{ key: "home", path: "/", scene: "answer-field", agent: "/agent" },
	{ key: "product", path: "/product", scene: "product-lens", agent: "/agent/product" },
	{ key: "approach", path: "/approach", scene: "change-path", agent: "/agent/approach" },
	{ key: "geo", path: "/geo", scene: "market-atlas", agent: "/agent/geo" },
	{ key: "company", path: "/company", scene: "company-constellation", agent: "/agent/company" },
	{ key: "diagnostic", path: "/diagnostic", scene: "contact-signal", agent: "/agent/diagnostic" },
	{ key: "privacy", path: "/privacy", scene: "data-route", agent: "/agent/privacy" },
] as const;

const chinaPages = [
	{ key: "home", path: "/zh", scene: "ai-answer-flow", agent: "/zh/agent" },
	{ key: "product", path: "/zh/product", scene: "brand-gap-console", agent: "/zh/agent/product" },
	{ key: "approach", path: "/zh/approach", scene: "service-route", agent: "/zh/agent/approach" },
	{ key: "geo", path: "/zh/geo", scene: "global-market-bridge", agent: "/zh/agent/geo" },
	{ key: "company", path: "/zh/company", scene: "company-network", agent: "/zh/agent/company" },
	{ key: "diagnostic", path: "/zh/diagnostic", scene: "consultation-brief", agent: "/zh/agent/diagnostic" },
	{ key: "privacy", path: "/zh/privacy", scene: "privacy-path", agent: "/zh/agent/privacy" },
] as const;

const humanPages = [...globalPages, ...chinaPages] as const;
const regionalPairs = [
	{ key: "home", en: "/", zh: "/zh" },
	{ key: "product", en: "/product", zh: "/zh/product" },
	{ key: "approach", en: "/approach", zh: "/zh/approach" },
	{ key: "geo", en: "/geo", zh: "/zh/geo" },
	{ key: "company", en: "/company", zh: "/zh/company" },
	{ key: "diagnostic", en: "/diagnostic", zh: "/zh/diagnostic" },
	{ key: "privacy", en: "/privacy", zh: "/zh/privacy" },
] as const;

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function visitHydrated(page: Page, path: string): Promise<void> {
	const response = await page.goto(path);
	expect(response?.status(), path).toBe(200);
	await waitForHydration(page);
}

test("all 14 regional Human routes publish the zero-one generation and their intended scene", async ({ page }) => {
	for (const fixture of humanPages) {
		const china = fixture.path.startsWith("/zh");
		await visitHydrated(page, fixture.path);

		const experience = page.locator(
			china
				? '.china-command[data-human-surface="true"][data-edition="zh-cn"]'
				: '.sf-shell[data-human-surface="true"][data-edition="global-en"]',
		);
		await expect(experience, fixture.path).toHaveAttribute("data-generation", "zero-one");
		await expect(page.locator(`[data-scene="${fixture.scene}"]`), fixture.path).toHaveCount(1);
		await expect(page.locator("main h1"), fixture.path).toHaveCount(1);
		await expect(page.locator('header img[src="/brand/logos/yonaris-wordmark-navy.png"]'), fixture.path).toHaveCount(1);
		await expect(page.locator('footer img[src="/brand/logos/yonaris-wordmark-white.png"]'), fixture.path).toHaveCount(1);
		await expect(page.locator(`.mode-link a[href="${fixture.agent}"]`).first(), fixture.path).toHaveCount(1);
		await expect(page.locator('head link[rel="canonical"]'), fixture.path).toHaveAttribute(
			"href",
			fixture.path,
		);
	}
});

test("regional switches preserve all seven topics and China navigation remains usable at both breakpoints", async ({
	page,
}) => {
	for (const pair of regionalPairs) {
		await visitHydrated(page, pair.en);
		await expect(page.locator(`[data-locale-switch="zh"][href="${pair.zh}"]`).first(), pair.key).toBeVisible();

		await visitHydrated(page, pair.zh);
		await expect(page.locator(`[data-locale-switch="en"][href="${pair.en}"]`).first(), pair.key).toBeVisible();
	}

	for (const width of [1080, 800]) {
		await page.setViewportSize({ width, height: 900 });
		await visitHydrated(page, "/zh/product");
		const menu = page.locator(".china-menu");
		await expect(menu.locator("summary"), `${width}px menu trigger`).toBeVisible();
		await menu.locator("summary").click();
		await expect(menu.getByRole("navigation", { name: "中国站移动导航" })).toBeVisible();
		await expect(menu.locator('.mode-link a[href="/zh/product"]')).toBeVisible();
		await expect(menu.locator('.mode-link a[href="/zh/agent/product"]')).toBeVisible();
		await expect(menu.locator('[data-locale-switch="en"][href="/product"]')).toBeVisible();
		await expectNoHorizontalOverflow(page);
	}
});

test("the new regional scenes expose real state-changing interactions", async ({ page }) => {
	await visitHydrated(page, "/");
	await page.locator('[data-answer-question="comparison"]').click();
	await expect(page.locator('[data-answer-question="comparison"]')).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("tabpanel", { name: "Comparison" })).toContainText("How should I compare");

	await visitHydrated(page, "/product");
	await page.locator('[data-product-step="compare"]').click();
	await expect(page.locator('[data-product-step="compare"]')).toHaveAttribute("aria-selected", "true");
	await expect(page.locator("#product-panel-compare")).toBeVisible();

	await visitHydrated(page, "/approach");
	await page.locator('[data-change-stage="return"] button').click();
	await expect(page.locator('[data-change-stage="return"] button')).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator(".sf-change-path__detail")).toContainText("Repeat the same question");

	await visitHydrated(page, "/geo");
	await page.locator('[data-market-choice="alternatives"]').click();
	await expect(page.locator('[data-market-choice="alternatives"]')).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator(".sf-market-atlas__question")).toContainText("Which named alternatives");

	await visitHydrated(page, "/company");
	await page.locator('[data-constellation-node="decisions"]').click();
	await expect(page.locator('[data-constellation-node="decisions"]')).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator(".sf-constellation__detail")).toContainText("deserves attention");

	await visitHydrated(page, "/zh");
	await page.locator('[data-situation-control="displaced"]').click();
	await expect(page.locator('[data-situation-control="displaced"]')).toHaveAttribute("aria-selected", "true");
	await expect(page.locator("#china-answer-panel")).toContainText("竞品");

	await visitHydrated(page, "/zh/product");
	await page.getByRole("tab", { name: /再次检查/ }).click();
	await expect(page.getByRole("tab", { name: /再次检查/ })).toHaveAttribute("aria-selected", "true");
	await expect(page.locator("#china-product-panel")).toContainText("后来怎么变");

	await visitHydrated(page, "/zh/approach");
	await page.getByRole("tab", { name: /出海后品牌定位失真/ }).click();
	await expect(page.getByRole("tab", { name: /出海后品牌定位失真/ })).toHaveAttribute("aria-selected", "true");
	await expect(page.locator("#china-service-panel")).toContainText("比较目标市场");

	await visitHydrated(page, "/zh/geo");
	await page.locator('[data-market-control="target-market"]').click();
	await expect(page.locator('[data-market-control="target-market"]')).toHaveAttribute("aria-selected", "true");
	await expect(page.locator("#china-market-panel")).toContainText("当地客户如何描述");
});

test("regional lead forms expose exactly the approved three fields", async ({ page }) => {
	await visitHydrated(page, "/diagnostic");
	const globalForm = page.locator("form");
	await expect(globalForm.locator('input:not([name="companyUrl"])')).toHaveCount(3);
	for (const label of ["Name", "Work email", "Company"]) await expect(globalForm.getByLabel(label, { exact: true })).toHaveCount(1);

	await visitHydrated(page, "/zh/diagnostic");
	const chinaForm = page.locator("form");
	await expect(chinaForm.locator('input:not([name="companyUrl"])')).toHaveCount(3);
	for (const label of ["姓名", "电话", "公司"]) await expect(chinaForm.getByLabel(label, { exact: true })).toHaveCount(1);
});

test("lead forms focus inline errors, confirm accepted delivery once, and preserve retry identity", async ({ page }) => {
	let acceptedRequests = 0;
	await page.route("**/api/diagnostic", async (route) => {
		acceptedRequests += 1;
		await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
	});
	await visitHydrated(page, "/diagnostic");
	const globalForm = page.locator("form.lead-form");
	const globalName = globalForm.getByLabel("Name", { exact: true });
	const normalBorder = await globalName.evaluate((input) => getComputedStyle(input).borderTopColor);
	await globalForm.getByRole("button", { name: "Talk to Yonaris", exact: true }).click();
	await expect(globalName).toBeFocused();
	await expect(globalName).toHaveAttribute("aria-invalid", "true");
	await expect(globalName).toHaveAttribute("aria-describedby", "lead-en-name-error");
	await expect(page.locator("#lead-en-name-error")).toHaveText("Enter your name.");
	const invalidBorder = await globalName.evaluate((input) => getComputedStyle(input).borderTopColor);
	expect(invalidBorder).not.toBe(normalBorder);

	await globalName.fill("Ava Chen");
	await globalForm.getByLabel("Work email", { exact: true }).fill("ava@acme.example");
	await globalForm.getByLabel("Company", { exact: true }).fill("Acme");
	await globalForm.getByRole("button", { name: "Talk to Yonaris", exact: true }).click();
	await expect(page.locator('[data-lead-state="success"]')).toContainText("Request accepted for delivery.");
	await expect(page.locator("form.lead-form")).toHaveCount(0);
	await page.keyboard.press("Enter");
	expect(acceptedRequests).toBe(1);

	await page.unroute("**/api/diagnostic");
	const retryKeys: string[] = [];
	await page.route("**/api/diagnostic", async (route) => {
		retryKeys.push(route.request().headers()["idempotency-key"] ?? "");
		await route.fulfill({
			status: 503,
			contentType: "application/json",
			body: '{"ok":false,"code":"delivery_unconfirmed"}',
		});
	});
	await visitHydrated(page, "/zh/diagnostic");
	const chinaForm = page.locator("form.lead-form");
	await chinaForm.getByLabel("姓名", { exact: true }).fill("陈晓");
	await chinaForm.getByLabel("电话", { exact: true }).fill("13800138000");
	await chinaForm.getByLabel("公司", { exact: true }).fill("示例科技");
	await chinaForm.getByRole("button", { name: "提交并预约沟通", exact: true }).click();
	await expect(chinaForm.getByRole("alert")).toContainText("投递尚未确认");
	await expect(chinaForm.getByLabel("电话", { exact: true })).toHaveValue("13800138000");
	await chinaForm.getByRole("button", { name: "重新发送", exact: true }).click();
	await expect.poll(() => retryKeys).toHaveLength(2);
	expect(new Set(retryKeys).size).toBe(1);
});

test("all 14 Human routes pair with a bilingual, mobile-safe Agent fact interface", async ({ page, request }) => {
	for (const fixture of humanPages) {
		const locale = fixture.path.startsWith("/zh") ? "zh" : "en";
		const otherLocale = locale === "en" ? "zh" : "en";
		const otherAgent =
			otherLocale === "zh"
				? fixture.key === "home"
					? "/zh/agent"
					: `/zh/agent/${fixture.key}`
				: fixture.key === "home"
					? "/agent"
					: `/agent/${fixture.key}`;
		await visitHydrated(page, fixture.agent);
		await expect(
			page.locator(
				`.agent-experience[data-agent-surface="true"][data-agent-locale="${locale}"][data-page-key="${fixture.key}"]`,
			),
			fixture.agent,
		).toHaveCount(1);
		await expect(page.locator(`a[data-human-canonical="true"][href="${fixture.path}"]`), fixture.agent).toHaveCount(1);
		await expect(page.locator(`.mode-link a[href="${fixture.agent}"][aria-current="page"]`), fixture.agent).toHaveCount(1);
		await expect(
			page.locator(`[data-locale-switch="${otherLocale}"][href="${otherAgent}"]`),
			fixture.agent,
		).toHaveCount(1);
		await expect(page.locator('img[src="/brand/logos/yonaris-wordmark-white.png"]'), fixture.agent).toHaveCount(1);

		const markdown = await request.get(fixture.agent, { headers: { Accept: "text/markdown" } });
		expect(markdown.status(), fixture.agent).toBe(200);
		expect(markdown.headers()["content-type"], fixture.agent).toContain("text/markdown");
		if (fixture.key !== "home") expect(await markdown.text(), fixture.agent).toContain(`https://yonaris.com${fixture.path}`);
	}

	await page.setViewportSize(QA_VIEWPORTS.mobile);
	for (const fixture of humanPages) {
		await visitHydrated(page, fixture.agent);
		await expectNoHorizontalOverflow(page);
	}
});

test("all regional Human pages are accessible and overflow-free on desktop and mobile", async ({ page }) => {
	test.setTimeout(240_000);
	const issues: string[] = [];
	for (const viewport of [QA_VIEWPORTS.desktop, QA_VIEWPORTS.mobile]) {
		await page.setViewportSize(viewport);
		for (const fixture of humanPages) {
			await test.step(`${fixture.path} at ${viewport.width}px`, async () => {
				await visitHydrated(page, fixture.path);
				try {
					await expectNoHorizontalOverflow(page);
					await runWcagAa(page);
				} catch (error) {
					issues.push(`${fixture.path} at ${viewport.width}px\n${error instanceof Error ? error.message : String(error)}`);
				}
			});
		}
	}
	if (issues.length > 0) throw new Error(`Regional accessibility regressions:\n\n${issues.join("\n\n")}`);
});

test("reduced motion settles every regional Human and representative Agent page", async ({ page }) => {
	for (const path of [...humanPages.map(({ path }) => path), "/agent", "/zh/agent"]) {
		await expectNoRunningAnimations(page, path);
	}
});

test("global visual baseline", { tag: "@visual-baseline" }, async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.desktop);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await expectVisualBaseline(page, "global-human-home-desktop.png");
});

test("Chinese visual baseline", { tag: "@visual-baseline" }, async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.desktop);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/zh");
	await expectVisualBaseline(page, "chinese-human-home-desktop.png");
});

for (const fixture of humanPages) {
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
