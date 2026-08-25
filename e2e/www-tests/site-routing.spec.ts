import { expect, test, type Locator, type Page } from "@playwright/test";
import {
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	QA_VIEWPORTS,
	runWcagAa,
} from "./helpers/core-site";

const humanRedirects = [
	{ from: "/platform", to: "/product" },
	{ from: "/features", to: "/product" },
	{ from: "/zh/platform", to: "/zh/product" },
	{ from: "/methodology", to: "/approach" },
	{ from: "/zh/methodology", to: "/zh/approach" },
	{ from: "/results", to: "/product" },
	{ from: "/zh/results", to: "/zh/product" },
	{ from: "/vision", to: "/company" },
	{ from: "/pricing", to: "/diagnostic" },
	{ from: "/off-site-aeo", to: "/geo" },
] as const;

const agentRedirects = [
	{ from: "/agent/platform", to: "/agent/product" },
	{ from: "/agent/methodology", to: "/agent/approach" },
	{ from: "/agent/results", to: "/agent/product" },
] as const;

const query = "tag=one&tag=two&encoded=a%2Fb%3Fc&empty=";

const notFoundLocales = [
	{
		locale: "en" as const,
		path: "/not-on-the-current-map",
		language: "en",
		heading: "We can’t find that page.",
		homeLabel: "Back to home ↗",
		links: [["Back to home ↗", "/"]] as const,
	},
	{
		locale: "zh" as const,
		path: "/zh/not-on-the-current-map",
		language: "zh-CN",
		heading: "没有找到这个页面",
		homeLabel: "返回首页 ↗",
		links: [["返回首页 ↗", "/zh"]] as const,
	},
] as const;

async function expectMinimumTarget(target: Locator, label: string): Promise<void> {
	const box = await target.boundingBox();
	expect(box, `${label} should have a measurable target`).toBeTruthy();
	expect(box?.width ?? 0, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(44);
	expect(box?.height ?? 0, `${label} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
}

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

test("all human aliases are bodyless manifest redirects with lossless queries and live destinations", async ({ request }) => {
	for (const redirect of humanRedirects) {
		const response = await request.get(`${redirect.from}?${query}#ignored`, {
			headers: { Accept: "text/markdown" },
			maxRedirects: 0,
		});
		expect(response.status(), redirect.from).toBe(308);
		expect(response.headers().location, redirect.from).toBe(`${redirect.to}?${query}`);
		expect(response.headers()["content-type"], redirect.from).toBeUndefined();
		expect(await response.text(), redirect.from).toBe("");

		const destination = await request.get(redirect.to);
		expect(destination.ok(), redirect.to).toBe(true);
		expect(destination.headers()["content-type"], redirect.to).toContain("text/html");
	}

	const sitemap = await (await request.get("/sitemap.xml")).text();
	for (const redirect of humanRedirects) expect(sitemap, redirect.from).not.toContain(`<loc>https://yonaris.com${redirect.from}</loc>`);
});

test("the reviewed Agent aliases retain the same permanent redirect contract", async ({ request }) => {
	for (const redirect of agentRedirects) {
		const response = await request.get(`${redirect.from}?${query}`, { maxRedirects: 0 });
		expect(response.status(), redirect.from).toBe(308);
		expect(response.headers().location, redirect.from).toBe(`${redirect.to}?${query}`);
		expect(await response.text(), redirect.from).toBe("");
	}
});

for (const fixture of notFoundLocales) {
	test(`${fixture.path} is a real governed ${fixture.locale} 404`, async ({ page }) => {
		const response = await page.goto(fixture.path);
		expect(response?.status()).toBe(404);
		await waitForHydration(page);

		await expect(page.locator("html")).toHaveAttribute("lang", fixture.language);
		await expect(page.locator(`.zero-not-found[lang="${fixture.language}"]`)).toHaveCount(1);
		await expect(page.locator('img.zero-not-found__logo[src="/brand/logos/yonaris-wordmark-navy.png"]')).toHaveCount(1);
		await expect(page.locator("header, footer")).toHaveCount(0);
		await expect(page.locator("main")).toHaveCount(1);
		await expect(page.getByRole("heading", { level: 1, name: fixture.heading, exact: true })).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
		await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);

		const mainLinks = page.locator("main a");
		await expect(mainLinks).toHaveCount(fixture.links.length);
		for (const [label, href] of fixture.links) {
			await expect(page.getByRole("main").getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
		}
		await expect(page.getByRole("main")).not.toContainText(/Docs|Features|Pricing|Status|Portal|Research/);
		await expect(page.locator(".zero-not-found")).toHaveCSS("background-image", "none");
	});
}

test("the governed 404 is accessible, motionless, and overflow-free from 280 to 1440", async ({ page }) => {
	test.setTimeout(180_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const fixture of notFoundLocales) {
		for (const width of [1440, 1280, 1024, 768, 390, 320, 280]) {
			await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
			const response = await page.goto(fixture.path);
			expect(response?.status(), `${fixture.path} at ${width}px`).toBe(404);
			await waitForHydration(page);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
			const links = page.locator("main a");
			for (let index = 0; index < (await links.count()); index += 1) {
				await expectMinimumTarget(links.nth(index), `${fixture.path} link ${index} at ${width}px`);
			}
			await expectNoRunningAnimations(page);
		}
	}
});

test("the governed 404 exposes visible Signal focus in both locales", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.mobile);
	for (const fixture of notFoundLocales) {
		await page.goto(fixture.path);
		await waitForHydration(page);
		await expectSignalFocusVisible(page, page.getByRole("main").getByRole("link", { name: fixture.homeLabel, exact: true }));
	}
});

for (const fixture of notFoundLocales) {
	for (const viewport of fixture.locale === "en" ? (["desktop", "mobile", "micro"] as const) : (["mobile"] as const)) {
		test(`${fixture.locale} ${viewport} governed 404 visual evidence`, { tag: "@visual" }, async ({ page }) => {
			await page.setViewportSize(QA_VIEWPORTS[viewport]);
			const response = await page.goto(fixture.path);
			expect(response?.status()).toBe(404);
			const artifact = await captureQa(page, {
				route: fixture.path,
				locale: fixture.locale,
				viewport,
				state: "governed-404",
			});
			test.info().annotations.push({ type: "visual-artifact", description: artifact });
		});
	}
}
