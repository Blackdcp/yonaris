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

test("English homepage presents the Product Stage and real destinations", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("heading", { level: 1, name: "See how AI is shaping your market." })).toBeVisible();
	await expect(page.getByText("Illustrative diagnostic", { exact: true })).toBeVisible();
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

test("supporting marketing pages retain the dark shell", async ({ page }) => {
	await page.goto("/platform");
	const [red, green, blue, alpha] = await backgroundPixel(page, ".marketing-site > header");
	expect(Math.max(red, green, blue)).toBeLessThan(50);
	expect(alpha).toBeGreaterThan(240);
});
