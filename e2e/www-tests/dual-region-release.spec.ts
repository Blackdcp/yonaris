import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, expectNoRunningAnimations, runWcagAa } from "./helpers/core-site";

const englishPages = [
	{
		key: "home",
		path: "/",
		h1: "See what buyers are being told before the first conversation.",
		agent: "/agent",
	},
	{ key: "product", path: "/product", h1: "See what shaped the shortlist.", agent: "/agent/product" },
	{
		key: "approach",
		path: "/approach",
		h1: "Proof should be something your team can review.",
		agent: "/agent/approach",
	},
	{
		key: "geo",
		path: "/geo",
		h1: "Markets change the conditions around the decision.",
		agent: "/agent/geo",
	},
	{
		key: "company",
		path: "/company",
		h1: "The same company should remain clear to people and agents.",
		agent: "/agent/company",
	},
	{
		key: "diagnostic",
		path: "/diagnostic",
		h1: "Tell us who to contact. We’ll begin with the buying decision.",
		agent: "/agent/diagnostic",
	},
	{
		key: "privacy",
		path: "/privacy",
		h1: "Your contact request takes one short route.",
		agent: "/agent/privacy",
	},
] as const;

const chinesePages = [
	{ key: "home", path: "/zh", h1: "AI 正在替客户认识你、比较你，也可能误解你。", agent: "/zh/agent" },
	{
		key: "product",
		path: "/zh/product",
		h1: "不是再做一层内容，而是重建品牌被理解的基础设施。",
		agent: "/zh/agent/product",
	},
	{
		key: "approach",
		path: "/zh/approach",
		h1: "从一句 AI 答案，追到真正影响选择的那个断点。",
		agent: "/zh/agent/approach",
	},
	{
		key: "geo",
		path: "/zh/geo",
		h1: "换一个市场，先换判断条件，不是只换语言。",
		agent: "/zh/agent/geo",
	},
	{
		key: "company",
		path: "/zh/company",
		h1: "同一家公司，应该让人和 Agent 都读得清楚。",
		agent: "/zh/agent/company",
	},
	{
		key: "diagnostic",
		path: "/zh/diagnostic",
		h1: "带一道你最不想让 AI 答错的问题来。",
		agent: "/zh/agent/diagnostic",
	},
	{
		key: "privacy",
		path: "/zh/privacy",
		h1: "姓名、电话、公司，只用于回复这次咨询。",
		agent: "/zh/agent/privacy",
	},
] as const;

const humanPages = [...englishPages, ...chinesePages] as const;
const visualPages = [
	...englishPages.filter(({ key }) => ["home", "product", "approach", "company", "diagnostic"].includes(key)),
	...chinesePages.filter(({ key }) => ["home", "product", "approach", "diagnostic"].includes(key)),
] as const;
const qaViewports = [
	{ label: "1440", width: 1440, height: 1000 },
	{ label: "1280", width: 1280, height: 900 },
	{ label: "390", width: 390, height: 844 },
	{ label: "360", width: 360, height: 800 },
] as const;
const qaRoot = path.resolve(
	path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
	".superpowers/sdd/2026-08-27-yonaris-site-06/screenshots",
);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const execFileAsync = promisify(execFile);

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(
		() => document.fonts.status === "loaded" && !(window as Window & { $_TSR?: unknown }).$_TSR,
	);
}

async function visitHydrated(page: Page, route: string): Promise<void> {
	const response = await page.goto(route, { waitUntil: "domcontentloaded" });
	expect(response?.status(), route).toBe(200);
	await waitForHydration(page);
}

async function expectShell(page: Page, fixture: (typeof humanPages)[number]): Promise<void> {
	const locale = fixture.path === "/zh" || fixture.path.startsWith("/zh/") ? "zh-CN" : "en";
	const edition = locale === "en" ? "global-en" : "zh-cn";
	await expect(page.locator(`.site-06[data-generation="site-06"][data-edition="${edition}"]`)).toHaveCount(1);
	await expect(page.getByRole("heading", { level: 1, name: fixture.h1, exact: true })).toBeVisible();
	await expect(page.locator("main h1")).toHaveCount(1);
	await expect(page.locator("header img[alt='Yonaris']")).toBeVisible();
	await expect(page.locator("footer img[alt='Yonaris']")).toBeVisible();
	await expect(page.locator(`header .site-06-header__actions .site-06-mode a[href="${fixture.agent}"]`)).toBeVisible();
	expect(await page.locator("html").getAttribute("lang")).toBe(locale);
}

async function expectRestrainedOrange(page: Page): Promise<void> {
	const result = await page.evaluate(() => {
		const orange = "rgb(239, 90, 26)";
		const largeSurfaces = [...document.querySelectorAll("main, .site-06-hero, .site-06-section")].filter(
			(element) => getComputedStyle(element).backgroundColor === orange,
		).length;
		const orangeArea = [...document.querySelectorAll(".site-06 *")].reduce((total, element) => {
			if (getComputedStyle(element).backgroundColor !== orange) return total;
			const bounds = element.getBoundingClientRect();
			return total + Math.max(0, bounds.width) * Math.max(0, bounds.height);
		}, 0);
		return { largeSurfaces, ratio: orangeArea / Math.max(1, innerWidth * innerHeight) };
	});
	expect(result.largeSurfaces).toBe(0);
	expect(result.ratio).toBeLessThan(0.08);
}

test("production raw responses satisfy the marketing smoke contract", async () => {
	const baseURL = test.info().project.use.baseURL;
	expect(typeof baseURL).toBe("string");
	const smokeEnvironment = { ...process.env };
	delete smokeEnvironment.FORCE_COLOR;
	delete smokeEnvironment.NO_COLOR;
	const { stdout, stderr } = await execFileAsync(
		process.execPath,
		[path.join(repositoryRoot, "apps/www/scripts/smoke-marketing.mjs"), String(baseURL)],
		{ cwd: repositoryRoot, env: smokeEnvironment, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
	);
	expect(stderr).toBe("");
	expect(stdout).toContain("49 routes, 13 redirects");
});

test("all seven route pairs publish exact Site 06 page identity and a prominent Agent control", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	for (const fixture of humanPages) {
		await visitHydrated(page, fixture.path);
		await expectShell(page, fixture);
		await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
		await expect(page.locator('head link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
		await expect(page.locator('head link[rel="alternate"][hreflang="zh-CN"]')).toHaveCount(1);
		await expect(page.locator('head link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
		await expect(page.locator('head link[rel="alternate"][type="text/markdown"]')).toHaveCount(1);
		expect(await page.locator('head script[type="application/ld+json"]').count()).toBeGreaterThan(0);
	}
});

test("English routes keep the approved buyer path", async ({ page }) => {
	await visitHydrated(page, "/");
	await expect(page.getByRole("heading", { level: 1, name: englishPages[0].h1 })).toBeVisible();
	await page.getByRole("link", { name: "Platform", exact: true }).first().click();
	await waitForHydration(page);
	await expect(page.getByRole("heading", { level: 1, name: "See what shaped the shortlist." })).toBeVisible();
	await page.goto("/zh");
	await expect(page.getByRole("heading", { level: 1, name: chinesePages[0].h1 })).toBeVisible();
});

test("English Site 06 interactions change evidence and remain keyboard operable", async ({ page }) => {
	await visitHydrated(page, "/");
	const homeLens = page.locator(".site-06-reading").first();
	const category = homeLens.getByRole("tab", { name: "Category", exact: true });
	await category.focus();
	await page.keyboard.press("ArrowRight");
	await expect(homeLens.getByRole("tab", { name: "Purpose", exact: true })).toHaveAttribute("aria-selected", "true");
	await homeLens.getByRole("tab", { name: "For agents", exact: true }).click();
	await expect(homeLens.getByRole("tabpanel", { name: "For agents", exact: true })).toContainText("Stable ID");

	await visitHydrated(page, "/product");
	const inspector = page.locator(".site-06-inspector").first();
	await inspector.getByRole("tab", { name: "credible authority", exact: true }).click();
	await expect(inspector.getByRole("tabpanel", { name: "credible authority", exact: true })).toContainText(
		"first-party source",
	);

	await visitHydrated(page, "/approach");
	const review = page.locator(".site-06-review").first();
	await review.getByRole("tab", { name: "Retest", exact: true }).click();
	await expect(review.getByRole("tabpanel", { name: "Retest", exact: true })).toContainText("comparable");

	await visitHydrated(page, "/company");
	const companyLens = page.locator(".site-06-reading").first();
	await companyLens.getByRole("tab", { name: "Scope", exact: true }).click();
	await companyLens.getByRole("tab", { name: "For agents", exact: true }).click();
	await expect(companyLens.getByRole("tabpanel", { name: "For agents", exact: true })).toContainText(
		"yonaris.scope.martech-system",
	);
});

test("Chinese Site 06 interactions start from business anxiety and preserve review meaning", async ({ page }) => {
	await visitHydrated(page, "/zh");
	const anxiety = page.locator("[data-anxiety-selector]");
	await anxiety.getByRole("tab", { name: "竞品先被推荐", exact: true }).click();
	await expect(anxiety.getByRole("tabpanel", { name: "竞品先被推荐", exact: true })).toContainText(
		"少了一个继续被评估的理由",
	);

	await visitHydrated(page, "/zh/product");
	const system = page.locator("[data-system-map]");
	await system.getByRole("tab", { name: "行动与复核", exact: true }).click();
	await expect(system.getByRole("tabpanel", { name: "行动与复核", exact: true })).toContainText("下一笔预算");

	await visitHydrated(page, "/zh/approach");
	const review = page.locator(".site-06-review").first();
	await review.getByRole("tab", { name: "复核", exact: true }).click();
	await expect(review.getByRole("tabpanel", { name: "复核", exact: true })).toContainText("无法归因");
});

test("both contact forms expose three fields, focus errors, and show accepted customer-facing copy", async ({ page }) => {
	let accepted = 0;
	await page.route("**/api/diagnostic", async (route) => {
		accepted += 1;
		await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
	});

	await visitHydrated(page, "/diagnostic");
	const englishForm = page.locator("form.lead-form");
	await expect(englishForm.locator("[data-lead-field] input:visible")).toHaveCount(3);
	await englishForm.getByRole("button", { name: "Talk to Yonaris", exact: true }).click();
	await expect(englishForm.getByLabel("Name", { exact: true })).toBeFocused();
	await englishForm.getByLabel("Name", { exact: true }).fill("Ava Chen");
	await englishForm.getByLabel("Work email", { exact: true }).fill("ava@acme.example");
	await englishForm.getByLabel("Company", { exact: true }).fill("Acme");
	await englishForm.getByRole("button", { name: "Talk to Yonaris", exact: true }).click();
	await expect(page.locator('[data-lead-state="success"]')).toContainText(
		"Thanks. We received your request and will be in touch.",
	);

	await visitHydrated(page, "/zh/diagnostic");
	const chineseForm = page.locator("form.lead-form");
	await expect(chineseForm.locator("[data-lead-field] input:visible")).toHaveCount(3);
	await chineseForm.getByLabel("姓名", { exact: true }).fill("陈晓");
	await chineseForm.getByLabel("电话", { exact: true }).fill("13800138000");
	await chineseForm.getByLabel("公司", { exact: true }).fill("示例科技");
	await chineseForm.getByRole("button", { name: "提交并预约沟通", exact: true }).click();
	await expect(page.locator('[data-lead-state="success"]')).toContainText("已收到，我们会尽快联系你。");
	expect(accepted).toBe(2);
});

test("mobile navigation keeps the Agent control visible after one explicit menu action", async ({ page }) => {
	for (const fixture of [englishPages[0], chinesePages[0]]) {
		await page.setViewportSize({ width: 360, height: 800 });
		await visitHydrated(page, fixture.path);
		const menu = page.locator(".site-06-menu");
		await menu.locator("summary").click();
		await expect(menu.locator(`a[href="${fixture.agent}"]`)).toBeVisible();
		await expectNoHorizontalOverflow(page);
	}
});

test("reduced motion removes photo and orbit movement", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await visitHydrated(page, "/");
	const photo = page.locator(".site-06-hero__media img").first();
	await photo.hover();
	await expect.poll(() => photo.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
	const orbit = page.locator(".site-06-orbit").first();
	await orbit.hover({ position: { x: 40, y: 40 } });
	await expect
		.poll(() => orbit.locator(".site-06-orbit__rings").evaluate((element) => getComputedStyle(element).transform))
		.toBe("none");
	await expectNoRunningAnimations(page);
});

test("all Human pages remain accessible and overflow-free at desktop and mobile widths", async ({ page }) => {
	test.setTimeout(300_000);
	const issues: string[] = [];
	for (const viewport of [qaViewports[0], qaViewports[2]]) {
		await page.setViewportSize(viewport);
		for (const fixture of humanPages) {
			await visitHydrated(page, fixture.path);
			try {
				await expectNoHorizontalOverflow(page);
				await runWcagAa(page);
			} catch (error) {
				issues.push(`${fixture.path} at ${viewport.width}px: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
	if (issues.length > 0) throw new Error(`Site 06 accessibility regressions:\n\n${issues.join("\n\n")}`);
});

test("captures the production Site 06 acceptance matrix and manifest", async ({ page }) => {
	test.setTimeout(360_000);
	await mkdir(qaRoot, { recursive: true });
	const artifacts: Array<Record<string, string | number>> = [];
	await page.emulateMedia({ reducedMotion: "reduce" });

	for (const viewport of qaViewports) {
		await page.setViewportSize(viewport);
		for (const fixture of visualPages) {
			await visitHydrated(page, fixture.path);
			await expectNoHorizontalOverflow(page);
			await expect(page.locator("header img[alt='Yonaris']")).toBeVisible();
			await expect(page.locator("footer img[alt='Yonaris']")).toBeVisible();
			const headlineSize = await page
				.locator("main h1")
				.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
			expect(headlineSize).toBeLessThanOrEqual(viewport.width <= 720 ? 46 : 48);
			await expectRestrainedOrange(page);

			if (viewport.width <= 720) {
				const menu = page.locator(".site-06-menu");
				await menu.locator("summary").click();
				await expect(menu.locator(`a[href="${fixture.agent}"]`)).toBeVisible();
				await menu.locator("summary").click();
			} else {
				await expect(
					page.locator(`header .site-06-header__actions .site-06-mode a[href="${fixture.agent}"]`),
				).toBeVisible();
			}

			if (fixture.key === "diagnostic") {
				await expect(page.locator("form.lead-form [data-lead-field] input:visible")).toHaveCount(3);
			}

			const slug = fixture.path === "/" ? "en-home" : fixture.path.replace(/^\//u, "").replaceAll("/", "-");
			const fileName = `${slug}--${viewport.label}.png`;
			const artifactPath = path.join(qaRoot, fileName);
			await page.screenshot({ path: artifactPath, fullPage: true, animations: "disabled", caret: "hide" });
			artifacts.push({
				path: fixture.path,
				viewport: viewport.label,
				width: viewport.width,
				height: viewport.height,
				h1: fixture.h1,
				headlineSize,
				file: artifactPath,
			});
		}
	}

	const manifest = {
		baseURL: test.info().project.use.baseURL,
		createdAt: new Date().toISOString(),
		reducedMotion: "reduce",
		count: artifacts.length,
		artifacts,
	};
	await writeFile(path.join(qaRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	expect(artifacts).toHaveLength(36);
});
