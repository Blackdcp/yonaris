import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
		id: "en",
		route: "/",
		lang: "en",
		h1: "See how AI is shaping your market.",
		category: "AI market evidence",
		vision: "Market evidence, built for teams and systems.",
		preview: "Illustrative diagnostic",
		previewNav: "Diagnostic views",
		website: "Website",
		submit: "Get a Free Diagnostic",
		menuOpen: "Open menu",
		menuClose: "Close menu",
		mobileNavigation: "Mobile navigation",
		links: {
			company: "/company",
			product: "/product",
			geo: "/geo",
			approach: "/approach",
			research: "/research",
			diagnostic: "/diagnostic",
		},
	},
	{
		id: "zh",
		route: "/zh",
		lang: "zh-CN",
		h1: "看清 AI 如何塑造你的市场",
		category: "AI 原生营销科技",
		vision: "重构 MarTech，同时面向人，也面向智能体。",
		preview: "示例诊断",
		previewNav: "诊断视图",
		website: "官网",
		submit: "获取免费诊断",
		menuOpen: "打开菜单",
		menuClose: "关闭菜单",
		mobileNavigation: "移动端导航",
		links: {
			company: "/zh/company",
			product: "/zh/product",
			geo: "/zh/geo",
			approach: "/zh/approach",
			research: "/zh/research",
			diagnostic: "/zh/diagnostic",
		},
	},
] as const;

const expectedStageOrder = ["product", "approach", "research", "diagnostic"];
const qaWidths = Object.values(QA_VIEWPORTS);
const visualRoot = fileURLToPath(new URL("../test-results-www/visual-qa/", import.meta.url));

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => document.fonts.status === "loaded" && !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function minimumTargetSize(locator: Locator): Promise<{ height: number; width: number }> {
	return locator.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return { height: bounds.height, width: bounds.width };
	});
}

test("the homepage composes the approved narrative and local destinations", async ({ page }) => {
	for (const locale of locales) {
		await page.goto(locale.route);
		await expect(page.locator(".site-shell")).toHaveAttribute("lang", locale.lang);
		await expect(page.getByRole("heading", { level: 1, name: locale.h1 })).toBeVisible();

		const identity = page.locator(".home-identity");
		await expect(identity.getByText(locale.category, { exact: true })).toBeVisible();
		await expect(identity.getByRole("link", { name: locale.vision })).toHaveAttribute("href", locale.links.company);
		expect(
			await identity.evaluate((element) => ({
				background: getComputedStyle(element).backgroundColor,
				border: getComputedStyle(element).borderTopWidth,
				className: element.className,
			})),
		).toEqual({ background: "rgba(0, 0, 0, 0)", border: "0px", className: "home-identity" });

		const preview = page.locator("figure.home-diagnostic-preview");
		await expect(preview.getByText(locale.preview, { exact: true })).toBeVisible();
		await expect(preview).toHaveAttribute("data-preview-status", "illustrative");
		await expect(preview.getByRole("complementary", { name: locale.previewNav }).getByRole("listitem")).toHaveCount(4);
		await expect(preview.getByText(/not live telemetry|不是实时遥测/)).toBeVisible();

		expect(
			await page
				.locator("main [data-home-stage]")
				.evaluateAll((stages) => stages.map((stage) => stage.getAttribute("data-home-stage"))),
		).toEqual(expectedStageOrder);
		for (const [key, href] of Object.entries(locale.links)) {
			await expect(page.locator(`main [data-home-context-link="${key}"]`)).toHaveAttribute("href", href);
		}
		await expect(page.locator('main [data-home-stage="company"], main [data-home-stage="geo"], main #company')).toHaveCount(0);
	}
});

test("homepage output excludes retired foundations, unaudited outcomes, and maturity theatre", async ({ page }) => {
	for (const locale of locales) {
		await page.goto(locale.route);
		const mainText = await page.locator("main").innerText();
		for (const prohibited of [
			"Four forms of intelligence",
			"四类情报",
			"Product Evidence Graph",
			"Market Learning",
			"0% → 93.3%",
			"DeepSeek brand mention",
			"DeepSeek 品牌提及率",
		]) {
			expect(mainText).not.toContain(prohibited);
		}
	}
});

test("essential Product Stage content is visible at initial and completed motion states", async ({ page }) => {
	for (const locale of locales) {
		await page.goto(locale.route);
		await page.evaluate(() => {
			for (const animation of document.getAnimations()) {
				const target = (animation.effect as KeyframeEffect | null)?.target;
				if (!(target instanceof HTMLElement)) continue;
				if (target.matches(".home-hero-copy > *, .home-diagnostic-preview")) {
					animation.currentTime = 0;
					animation.pause();
				}
			}
		});
		const atStart = await page.locator(".home-product-stage").evaluate((stage) => ({
			headline: getComputedStyle(stage.querySelector("h1")!).opacity,
			form: getComputedStyle(stage.querySelector("form")!).opacity,
			preview: getComputedStyle(stage.querySelector("figure")!).opacity,
		}));
		expect(atStart).toEqual({ headline: "1", form: "1", preview: "1" });

		await page.reload();
		await page.evaluate(async () => {
			const relevant = document.getAnimations().filter((animation) => {
				const target = (animation.effect as KeyframeEffect | null)?.target;
				return target instanceof HTMLElement && target.matches(".home-hero-copy > *, .home-diagnostic-preview");
			});
			await Promise.all(relevant.map((animation) => animation.finished));
		});
		await expect(page.getByRole("heading", { level: 1, name: locale.h1 })).toBeVisible();
		await expect(page.locator(".home-domain-form")).toBeVisible();
		await expect(page.locator(".home-diagnostic-preview")).toBeVisible();
	}
});

test("reduced motion leaves the complete homepage legible and static", async ({ page }) => {
	for (const locale of locales) {
		await expectNoRunningAnimations(page, locale.route);
		const presentation = await page.locator(".home-product-stage").evaluate((stage) => {
			const read = (selector: string) => {
				const style = getComputedStyle(stage.querySelector(selector)!);
				return { opacity: style.opacity, transform: style.transform };
			};
			return { headline: read("h1"), form: read("form"), preview: read("figure") };
		});
		expect(presentation).toEqual({
			headline: { opacity: "1", transform: "none" },
			form: { opacity: "1", transform: "none" },
			preview: { opacity: "1", transform: "none" },
		});
	}
});

test("the hero GET form hands the website to the localized diagnostic", async ({ page }) => {
	for (const locale of locales) {
		await page.goto(locale.route);
		const form = page.locator("main form").first();
		await form.getByLabel(locale.website).fill("https://example.com");
		await form.getByRole("button", { name: locale.submit }).click();
		await expect(page).toHaveURL(new RegExp(`${locale.links.diagnostic}$`));
		await expect(page.getByLabel(locale.website)).toHaveValue("https://example.com");
	}
});

test("the bilingual mobile menu opens by keyboard and closes predictably", async ({ page }) => {
	for (const locale of locales) {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(locale.route);
		await waitForHydration(page);
		const trigger = page.getByRole("button", { name: locale.menuOpen });
		const triggerSize = await minimumTargetSize(trigger);
		expect(triggerSize.height).toBeGreaterThanOrEqual(44);
		expect(triggerSize.width).toBeGreaterThanOrEqual(44);

		await trigger.focus();
		await trigger.press("Enter");
		await expect(page.getByRole("button", { name: locale.menuClose })).toHaveAttribute("aria-expanded", "true");
		await expect(page.getByRole("navigation", { name: locale.mobileNavigation })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(trigger).toHaveAttribute("aria-expanded", "false");
		await expect(trigger).toBeFocused();
	}
});

test("homepage focus treatments and controls meet the interaction contract", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.desktop);
	await page.goto("/");
	await expectSignalFocusVisible(page, page.getByLabel("Website"), page.locator(".home-domain-form"));
	await expectSignalFocusVisible(page, page.locator('main [data-home-context-link="product"]'));

	for (const control of [page.getByLabel("Website"), page.getByRole("button", { name: "Get a Free Diagnostic" })]) {
		const size = await minimumTargetSize(control);
		expect(size.height).toBeGreaterThanOrEqual(44);
		expect(size.width).toBeGreaterThanOrEqual(44);
	}
	await page.setViewportSize({ width: 280, height: 720 });
	await page.goto("/");
	for (const control of [page.getByLabel("Website"), page.getByRole("button", { name: "Get a Free Diagnostic" })]) {
		const size = await minimumTargetSize(control);
		expect(size.height).toBeGreaterThanOrEqual(44);
		expect(size.width).toBeGreaterThanOrEqual(44);
	}
});

test("both home locales pass WCAG AA on desktop and mobile", async ({ page }) => {
	for (const locale of locales) {
		for (const viewport of [QA_VIEWPORTS.desktop, QA_VIEWPORTS.mobile]) {
			await page.setViewportSize(viewport);
			await page.goto(locale.route);
			await runWcagAa(page);
		}
	}
});

test("the homepage has no horizontal overflow across the full QA width matrix", async ({ page }) => {
	for (const locale of locales) {
		for (const viewport of [...qaWidths, { width: 280, height: 720 }]) {
			await page.setViewportSize(viewport);
			await page.goto(locale.route);
			await expectNoHorizontalOverflow(page);
		}
	}
});

test("Chinese homepage typography is CJK-first and avoids mechanical tracking", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.mobile);
	await page.goto("/zh");
	await page.evaluate(() => document.fonts.ready);
	for (const selector of [".home-product-stage__title", ".home-identity", ".home-stage-heading", ".home-stage-label"]) {
		const style = await page.locator(selector).first().evaluate((element) => {
			const computed = getComputedStyle(element);
			return {
				fontFamily: computed.fontFamily,
				letterSpacing: computed.letterSpacing,
				textTransform: computed.textTransform,
			};
		});
		expect(style.fontFamily).toMatch(/^("?PingFang SC|"?Microsoft YaHei)/);
		expect(style.letterSpacing).toBe("normal");
		expect(style.textTransform).toBe("none");
	}

	const finalLine = await page.locator(".home-product-stage__lead").evaluate((lead) => {
		const text = lead.textContent ?? "";
		const lines = new Map<number, string>();
		for (let index = 0; index < text.length; index += 1) {
			const range = document.createRange();
			range.setStart(lead.firstChild!, index);
			range.setEnd(lead.firstChild!, index + 1);
			const top = Math.round(range.getBoundingClientRect().top);
			lines.set(top, `${lines.get(top) ?? ""}${text[index]}`);
		}
		return [...lines.values()].at(-1)?.trim() ?? "";
	});
	expect(finalLine.length).toBeGreaterThanOrEqual(2);
});

test("the mobile diagnostic window remains readable through its final next move", async ({ page }) => {
	for (const locale of locales) {
		await page.setViewportSize(QA_VIEWPORTS.mobile);
		await page.goto(locale.route);
		const preview = page.locator(".home-diagnostic-preview");
		await expect(preview.locator(".home-diagnostic-preview__answers article")).toHaveCount(3);
		const finalMove = preview.locator(".home-diagnostic-preview__readout > div").last();
		await finalMove.scrollIntoViewIfNeeded();
		await expect(finalMove).toBeVisible();
		const sizes = await preview.locator(".home-diagnostic-preview__answers article").first().evaluate((answer) => ({
			body: Number.parseFloat(getComputedStyle(answer.querySelector(":scope > p")!).fontSize),
			source: Number.parseFloat(getComputedStyle(answer.querySelector("footer span")!).fontSize),
			status: Number.parseFloat(getComputedStyle(answer.querySelector("small")!).fontSize),
		}));
		expect(sizes.body).toBeGreaterThanOrEqual(13);
		expect(sizes.source).toBeGreaterThanOrEqual(11);
		expect(sizes.status).toBeGreaterThanOrEqual(12);
	}
});

test("@visual homepage captures EN and ZH at 1440, 390, and 280", { tag: "@visual" }, async ({ page }) => {
	await mkdir(visualRoot, { recursive: true });
	for (const locale of locales) {
		for (const viewport of ["desktop", "mobile"] as const) {
			await page.setViewportSize(QA_VIEWPORTS[viewport]);
			await page.goto(locale.route);
			await captureQa(page, { route: locale.route, locale: locale.id, viewport, state: "final-home" });
		}
		await page.setViewportSize({ width: 280, height: 720 });
		await page.goto(locale.route);
		await waitForHydration(page);
		await page.screenshot({
			animations: "disabled",
			caret: "hide",
			fullPage: true,
			path: `${visualRoot}home--${locale.id}--280--final-home.png`,
		});
	}
});
