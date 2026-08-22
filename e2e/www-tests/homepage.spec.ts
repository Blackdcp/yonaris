import { expect, test } from "@playwright/test";

const rejectedLabels = [
	"AI-NATIVE MARTECH",
	"Observe the answer",
	"Trace the evidence",
	"Find the opening",
	"Discover",
	"Compare",
	"Choose",
];

async function backgroundPixel(page: import("@playwright/test").Page, selector: string) {
	return page.locator(selector).evaluate((element) => {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas is unavailable");
		context.fillStyle = getComputedStyle(element).backgroundColor;
		context.fillRect(0, 0, 1, 1);
		return [...context.getImageData(0, 0, 1, 1).data];
	});
}

test("Product Stage content remains visible at the start of entrance motion", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => {
		for (const animation of document.getAnimations()) {
			const target = (animation.effect as KeyframeEffect | null)?.target;
			if (!(target instanceof HTMLElement)) continue;
			if (target.matches(".marketing-hero-copy > *, .marketing-product-preview")) {
				animation.currentTime = 0;
				animation.pause();
			}
		}
	});

	const opacities = await page.locator(".marketing-product-stage").evaluate((stage) => ({
		headline: getComputedStyle(stage.querySelector("h1")!).opacity,
		form: getComputedStyle(stage.querySelector("form")!).opacity,
		preview: getComputedStyle(stage.querySelector("figure")!).opacity,
	}));
	expect(opacities).toEqual({ headline: "1", form: "1", preview: "1" });
});

test("Product Stage content remains visible after entrance motion finishes", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(async () => {
		const relevantAnimations = document.getAnimations().filter((animation) => {
			const target = (animation.effect as KeyframeEffect | null)?.target;
			return target instanceof HTMLElement && target.matches(".marketing-hero-copy > *, .marketing-product-preview");
		});
		await Promise.all(relevantAnimations.map((animation) => animation.finished));
	});

	const opacities = await page.locator(".marketing-product-stage").evaluate((stage) => ({
		headline: getComputedStyle(stage.querySelector("h1")!).opacity,
		form: getComputedStyle(stage.querySelector("form")!).opacity,
		preview: getComputedStyle(stage.querySelector("figure")!).opacity,
	}));
	expect(opacities).toEqual({ headline: "1", form: "1", preview: "1" });
});

test("Product Stage content remains visible with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");

	const presentation = await page.locator(".marketing-product-stage").evaluate((stage) => {
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
});

test("English homepage presents the Product Stage and real destinations", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { level: 1, name: "See how AI is shaping your market." })).toBeVisible();
	await expect(page.getByText("Illustrative diagnostic", { exact: true })).toBeVisible();
	const diagnosticViews = page.getByRole("complementary", { name: "Diagnostic views" });
	await expect(diagnosticViews).toBeVisible();
	await expect(diagnosticViews.getByRole("listitem")).toHaveCount(4);
	await expect(page.getByRole("navigation", { name: "Diagnostic views" })).toHaveCount(0);
	expect(await backgroundPixel(page, ".marketing-site > header")).toEqual([246, 244, 241, 255]);

	const navigation = page.getByRole("navigation", { name: "Primary navigation" });
	await expect(navigation.getByRole("link", { name: "Product" })).toHaveAttribute("href", "/platform");
	await expect(navigation.getByRole("link", { name: "Approach" })).toHaveAttribute("href", "/methodology");
	await expect(navigation.getByRole("link", { name: "Research" })).toHaveAttribute("href", "/results");
	await expect(navigation.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/#company");

	for (const label of rejectedLabels) {
		await expect(page.getByText(label, { exact: true })).toHaveCount(0);
	}

	await expect(page.locator("#company")).toContainText("MarTech, rebuilt. For humans and agents.");
});

test("Chinese homepage localizes the Product Stage and destinations", async ({ page }) => {
	await page.goto("/zh");

	await expect(page.getByRole("heading", { level: 1, name: "看清 AI 如何塑造你的市场" })).toBeVisible();
	await expect(page.getByText("示例诊断", { exact: true })).toBeVisible();

	const navigation = page.getByRole("navigation", { name: "主导航" });
	await expect(navigation.getByRole("link", { name: "产品" })).toHaveAttribute("href", "/zh/platform");
	await expect(navigation.getByRole("link", { name: "方法" })).toHaveAttribute("href", "/zh/methodology");
	await expect(navigation.getByRole("link", { name: "研究" })).toHaveAttribute("href", "/zh/results");
	await expect(navigation.getByRole("link", { name: "公司" })).toHaveAttribute("href", "/zh#company");
	await expect(page.locator("h1 br")).toHaveCount(0);
});

test("Chinese mobile explanation avoids an orphan final line", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/zh");
	await page.evaluate(() => document.fonts.ready);

	const lines = await page.locator(".marketing-product-stage__lead").evaluate((lead) => {
		const text = lead.textContent ?? "";
		const groups = new Map<number, string>();
		for (let index = 0; index < text.length; index += 1) {
			const range = document.createRange();
			range.setStart(lead.firstChild!, index);
			range.setEnd(lead.firstChild!, index + 1);
			const top = Math.round(range.getBoundingClientRect().top);
			groups.set(top, `${groups.get(top) ?? ""}${text[index]}`);
		}
		return [...groups.values()];
	});
	expect(lines.at(-1)?.trim().length).toBeGreaterThanOrEqual(2);
});

test("homepage domain entry hands off to a prefilled diagnostic", async ({ page }) => {
	await page.goto("/");
	const heroForm = page.locator("main form").first();
	await heroForm.getByLabel("Website").fill("https://example.com");
	await heroForm.getByRole("button", { name: "Get a Free Diagnostic" }).click();

	await expect(page).toHaveURL(/\/diagnostic\?website=https%3A%2F%2Fexample\.com$/);
	await expect(page.getByLabel("Website")).toHaveValue("https://example.com");
});

test("homepage mobile menu works without horizontal overflow", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");

	await page.getByText("MENU", { exact: true }).click();
	await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Product" })).toHaveAttribute("href", "/platform");

	const overflow = await page.evaluate(() => ({
		document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		body: document.body.scrollWidth - document.body.clientWidth,
	}));
	expect(overflow).toEqual({ document: 0, body: 0 });
});

test("mobile diagnostic evidence remains readable", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");

	const firstAnswer = page.locator(".marketing-product-preview__answers article").first();
	const fontSizes = await firstAnswer.evaluate((answer) => ({
		status: Number.parseFloat(getComputedStyle(answer.querySelector("small")!).fontSize),
		body: Number.parseFloat(getComputedStyle(answer.querySelector(":scope > p")!).fontSize),
		source: Number.parseFloat(getComputedStyle(answer.querySelector("footer span")!).fontSize),
	}));

	expect(fontSizes.status).toBeGreaterThanOrEqual(12);
	expect(fontSizes.body).toBeGreaterThanOrEqual(13);
	expect(fontSizes.source).toBeGreaterThanOrEqual(11);
});

test("supporting marketing pages retain the dark shell", async ({ page }) => {
	await page.goto("/platform");
	const [red, green, blue, alpha] = await backgroundPixel(page, ".marketing-site > header");
	expect(Math.max(red, green, blue)).toBeLessThan(50);
	expect(alpha).toBeGreaterThan(240);
});
