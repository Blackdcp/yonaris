import { expect, test, type Locator } from "@playwright/test";

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

async function contrastAgainstClosest(foreground: Locator, backgroundSelector: string) {
	return foreground.evaluate((element, selector) => {
		const background = element.closest(selector);
		if (!(background instanceof HTMLElement)) throw new Error(`Missing contrast background: ${selector}`);

		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("Canvas is unavailable");

		const rgba = (value: string) => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = value;
			context.fillRect(0, 0, 1, 1);
			const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
			return { red, green, blue, alpha: alpha / 255 };
		};
		const backgroundColor = rgba(getComputedStyle(background).backgroundColor);
		const foregroundColor = rgba(getComputedStyle(element).color);
		const composited = {
			red: foregroundColor.red * foregroundColor.alpha + backgroundColor.red * (1 - foregroundColor.alpha),
			green: foregroundColor.green * foregroundColor.alpha + backgroundColor.green * (1 - foregroundColor.alpha),
			blue: foregroundColor.blue * foregroundColor.alpha + backgroundColor.blue * (1 - foregroundColor.alpha),
		};
		const luminance = ({ red, green, blue }: { red: number; green: number; blue: number }) => {
			const channels = [red, green, blue].map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
		};
		const lighter = Math.max(luminance(composited), luminance(backgroundColor));
		const darker = Math.min(luminance(composited), luminance(backgroundColor));

		return (lighter + 0.05) / (darker + 0.05);
	}, backgroundSelector);
}

async function focusPresentation(focusTarget: Locator, indicator: Locator, backgroundSelector: string) {
	await focusTarget.focus();

	return indicator.evaluate((element, selector) => {
		const background = element.closest(selector);
		if (!(background instanceof HTMLElement)) throw new Error(`Missing focus background: ${selector}`);

		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("Canvas is unavailable");
		const rgb = (value: string) => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = value;
			context.fillRect(0, 0, 1, 1);
			return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
		};
		const luminance = (color: number[]) => {
			const channels = color.map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
		};
		const ratio = (first: number[], second: number[]) => {
			const lighter = Math.max(luminance(first), luminance(second));
			const darker = Math.min(luminance(first), luminance(second));
			return (lighter + 0.05) / (darker + 0.05);
		};
		const style = getComputedStyle(element);
		const signal = rgb(getComputedStyle(document.documentElement).getPropertyValue("--yonaris-signal"));
		const outlineVisible = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
		const indicatorColors = [
			...(outlineVisible ? [style.outlineColor] : []),
			...(style.boxShadow.match(/rgba?\([^)]*\)/g) ?? []),
		].map(rgb);
		const backgroundColor = rgb(getComputedStyle(background).backgroundColor);

		return {
			backgroundColor: getComputedStyle(background).backgroundColor,
			className: element.className,
			hasSignal: indicatorColors.some((color) => color.every((channel, index) => channel === signal[index])),
			hasVisibleGeometry: indicatorColors.length > 0,
			indicatorContrast: Math.max(...indicatorColors.map((color) => ratio(color, backgroundColor))),
			matchesPaperFocus: element.matches(".marketing-paper-focus:focus-visible"),
			outlineColor: style.outlineColor,
			outlineContrast: ratio(rgb(style.outlineColor), rgb(getComputedStyle(background).backgroundColor)),
			outlineStyle: style.outlineStyle,
			outlineWidth: Number.parseFloat(style.outlineWidth),
		};
	}, backgroundSelector);
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
	await expect(navigation.getByRole("link", { name: "Product" })).toHaveAttribute("href", "/product");
	await expect(navigation.getByRole("link", { name: "Approach" })).toHaveAttribute("href", "/approach");
	await expect(navigation.getByRole("link", { name: "Research" })).toHaveAttribute("href", "/research");
	await expect(navigation.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
	await expect(page.locator("header [data-site-diagnostic-action]:visible")).toHaveCount(1);
	await expect(page.getByRole("link", { name: "Portal" })).toBeVisible();

	for (const label of rejectedLabels) {
		await expect(page.getByText(label, { exact: true })).toHaveCount(0);
	}

	await expect(page.locator("#company")).toContainText("MarTech, rebuilt. For humans and agents.");
});

test("Paper-side focus indicators retain Signal Orange with an Ink contrast edge", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	const header = page.locator(".site-header");
	const primaryNavigationLink = header
		.getByRole("navigation", { name: "Primary navigation" })
		.getByRole("link", { name: "Product" });
	const desktopControls = [
		{ label: "home", control: header.getByRole("link", { name: "Yonaris home" }) },
		{ label: "primary navigation", control: primaryNavigationLink },
		{
			label: "portal",
			control: header.locator('.site-header__desktop-actions a[href="https://portal.yonaris.com"]'),
		},
		{ label: "locale switch", control: header.locator(".site-header__desktop-actions a[lang]") },
		{ label: "diagnostic", control: header.locator('[data-site-diagnostic-action="desktop"]') },
	];

	for (const { label, control } of desktopControls) {
		const presentation = await focusPresentation(control, control, ".site-header");
		const evidence = `${label}: ${JSON.stringify(presentation)}`;
		expect.soft(presentation.hasVisibleGeometry, evidence).toBe(true);
		expect.soft(presentation.indicatorContrast, evidence).toBeGreaterThanOrEqual(3);
		expect.soft(presentation.hasSignal, evidence).toBe(true);
	}
	await page.reload();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Tab");
	await expect(primaryNavigationLink).toBeFocused();
	expect(await contrastAgainstClosest(primaryNavigationLink, ".site-header")).toBeGreaterThanOrEqual(4.5);

	const domainInput = page.getByLabel("Website");
	const domainForm = page.locator(".marketing-domain-form");
	const domainPresentation = await focusPresentation(domainInput, domainForm, ".marketing-product-stage");
	expect.soft(domainPresentation.hasVisibleGeometry).toBe(true);
	expect.soft(domainPresentation.indicatorContrast).toBeGreaterThanOrEqual(3);
	expect.soft(domainPresentation.hasSignal).toBe(true);
	const paperLink = page.getByRole("link", { name: "Explore Recursive Forest" });
	const paperLinkPresentation = await focusPresentation(paperLink, paperLink, "section");
	expect.soft(paperLinkPresentation.hasVisibleGeometry).toBe(true);
	expect
		.soft(paperLinkPresentation.indicatorContrast, JSON.stringify(paperLinkPresentation))
		.toBeGreaterThanOrEqual(3);
	expect.soft(paperLinkPresentation.hasSignal).toBe(true);
	await page.goto("/diagnostic");
	for (const control of [page.getByLabel("Website"), page.getByRole("button", { name: "Continue" })]) {
		const presentation = await focusPresentation(control, control, "section");
		expect.soft(presentation.hasVisibleGeometry).toBe(true);
		expect.soft(presentation.indicatorContrast, JSON.stringify(presentation)).toBeGreaterThanOrEqual(3);
		expect.soft(presentation.hasSignal).toBe(true);
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	const menuTrigger = page.getByRole("button", { name: "Open menu" });
	const menuPresentation = await focusPresentation(menuTrigger, menuTrigger, ".site-header");
	expect.soft(menuPresentation.hasVisibleGeometry).toBe(true);
	expect.soft(menuPresentation.indicatorContrast).toBeGreaterThanOrEqual(3);
	expect.soft(menuPresentation.hasSignal).toBe(true);
});

test("meaningful small text meets normal-text contrast", async ({ page }) => {
	await page.goto("/");
	const foundations = page
		.getByRole("heading", { level: 2, name: "Four forms of intelligence. One compounding system." })
		.locator("xpath=ancestor::section[1]");
	const checks = [
		{
			label: "illustrative diagnostic finding",
			text: page.getByText("The broader MarTech position is not carrying.", { exact: true }),
			background: ".marketing-product-preview__readout",
		},
		{ label: "foundation index", text: foundations.getByText("01", { exact: true }), background: "section" },
		{ label: "foundation status", text: foundations.getByText("What is true", { exact: true }), background: "section" },
		{
			label: "engagement outcome label",
			text: page.getByText("DeepSeek brand mention", { exact: true }),
			background: "section",
		},
		{
			label: "engagement note",
			text: page.getByText(
				"An anonymized engagement. Scope and outcome are drawn from completed delivery evidence; results vary by market and starting point.",
				{ exact: true },
			),
			background: "section",
		},
	] as const;

	for (const check of checks) {
		const ratio = await contrastAgainstClosest(check.text, check.background);
		expect.soft(ratio, check.label).toBeGreaterThanOrEqual(4.5);
	}
});

test("Chinese homepage localizes the Product Stage and destinations", async ({ page }) => {
	await page.goto("/zh");

	await expect(page.getByRole("heading", { level: 1, name: "看清 AI 如何塑造你的市场" })).toBeVisible();
	await expect(page.getByText("示例诊断", { exact: true })).toBeVisible();

	const navigation = page.getByRole("navigation", { name: "主导航" });
	await expect(navigation.getByRole("link", { name: "产品" })).toHaveAttribute("href", "/zh/product");
	await expect(navigation.getByRole("link", { name: "方法" })).toHaveAttribute("href", "/zh/approach");
	await expect(navigation.getByRole("link", { name: "研究" })).toHaveAttribute("href", "/zh/research");
	await expect(navigation.getByRole("link", { name: "公司" })).toHaveAttribute("href", "/zh/company");
	await expect(page.locator("h1 br")).toHaveCount(0);
});

test("illustrative previews avoid model-coverage and rejected hero claims", async ({ page }) => {
	for (const locale of [
		{ route: "/", prohibited: "across AI models" },
		{ route: "/zh", prohibited: "在 AI 模型中" },
	] as const) {
		await page.goto(locale.route);
		const previewText = await page.locator(".marketing-product-preview").innerText();
		expect(previewText).not.toContain(locale.prohibited);
		expect(previewText).not.toContain("AI-NATIVE MARTECH");
	}
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

	await expect(page).toHaveURL(/\/diagnostic$/);
	await expect(page.getByLabel("Website")).toHaveValue("https://example.com");
});

test("Chinese homepage domain entry hands off to a prefilled diagnostic", async ({ page }) => {
	await page.goto("/zh");
	const heroForm = page.locator("main form").first();
	await heroForm.getByLabel("官网").fill("https://example.com");
	await heroForm.getByRole("button", { name: "获取免费诊断" }).click();

	await expect(page).toHaveURL(/\/zh\/diagnostic$/);
	await expect(page.getByLabel("官网")).toHaveValue("https://example.com");
});

test("homepage mobile menu supports keyboard open, predictable close, and no overflow", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);

	await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
	const trigger = page.locator('button[aria-controls="site-mobile-navigation-en"]');
	const triggerSize = await trigger.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		return { height: bounds.height, width: bounds.width };
	});
	expect(triggerSize.height).toBeGreaterThanOrEqual(44);
	expect(triggerSize.width).toBeGreaterThanOrEqual(44);

	await trigger.focus();
	await trigger.press("Enter");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
	await expect(page.locator("header [data-site-diagnostic-action]:visible")).toHaveCount(1);

	await page.keyboard.press("Escape");
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await expect(trigger).toBeFocused();

	await trigger.press("Space");
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const productLink = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Product" });
	await expect(productLink).toHaveAttribute("href", "/product");
	await productLink.evaluate((link) => link.addEventListener("click", (event) => event.preventDefault(), { once: true }));
	await productLink.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await expect(page).toHaveURL(/\/$/);

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

test("mobile diagnostic chain reaches the localized next move without overflow", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const locales = [
		{
			route: "/",
			answers: ["Illustrative answer", "Company narrative", "Observed mismatch"],
			finalLabel: "Next move",
			finalValue: "Align company, product and portal metadata.",
		},
		{
			route: "/zh",
			answers: ["示例答案", "公司叙事", "观察到的不一致"],
			finalLabel: "下一步",
			finalValue: "统一公司、产品与门户元数据。",
		},
	] as const;

	for (const locale of locales) {
		await page.goto(locale.route);
		await page.evaluate(() => document.fonts.ready);
		const preview = page.locator(".marketing-product-preview");
		const answers = preview.locator(".marketing-product-preview__answers article");
		await expect(answers).toHaveCount(3);

		for (const [index, answerLabel] of locale.answers.entries()) {
			await expect(answers.nth(index)).toContainText(answerLabel);
			await answers.nth(index).scrollIntoViewIfNeeded();
			await expect(answers.nth(index)).toBeVisible();
		}

		const finalMove = preview.getByText(locale.finalValue, { exact: true });
		await finalMove.scrollIntoViewIfNeeded();
		await expect(preview.getByText(locale.finalLabel, { exact: true })).toBeVisible();
		await expect(finalMove).toBeVisible();

		const presentation = await finalMove.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return {
				fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
				left: bounds.left,
				right: bounds.right,
				viewportWidth: window.innerWidth,
			};
		});
		expect(presentation.fontSize).toBeGreaterThanOrEqual(11);
		expect(presentation.left).toBeGreaterThanOrEqual(0);
		expect(presentation.right).toBeLessThanOrEqual(presentation.viewportWidth);

		const overflow = await page.evaluate(() => {
			const preview = document.querySelector<HTMLElement>(".marketing-product-preview")!;
			return {
				document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
				body: document.body.scrollWidth - document.body.clientWidth,
				preview: preview.scrollWidth - preview.clientWidth,
			};
		});
		expect(overflow).toEqual({ document: 0, body: 0, preview: 0 });
	}
});
