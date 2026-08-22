import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export const CORE_ROUTE_PAIRS = [
	{ key: "home", en: "/", zh: "/zh" },
	{ key: "product", en: "/product", zh: "/zh/product" },
	{ key: "approach", en: "/approach", zh: "/zh/approach" },
	{ key: "research", en: "/research", zh: "/zh/research" },
	{ key: "company", en: "/company", zh: "/zh/company" },
	{ key: "geo", en: "/geo", zh: "/zh/geo" },
	{ key: "diagnostic", en: "/diagnostic", zh: "/zh/diagnostic" },
] as const;

export const QA_VIEWPORTS = {
	desktop: { width: 1440, height: 900 },
	micro: { width: 280, height: 720 },
	wide: { width: 1280, height: 800 },
	tabletLandscape: { width: 1024, height: 768 },
	tabletPortrait: { width: 768, height: 1024 },
	mobile: { width: 390, height: 844 },
	mobileCompact: { width: 360, height: 800 },
	narrow: { width: 320, height: 740 },
} as const;

export interface QaCapture {
	route: string;
	locale: "en" | "zh";
	viewport: keyof typeof QA_VIEWPORTS;
	state?: string;
}

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const visualQaRoot = path.join(e2eRoot, "test-results-www", "visual-qa");

interface FocusStyleSnapshot {
	boxShadow: string;
	content: string;
	display: string;
	opacity: string;
	outlineColor: string;
	outlineStyle: string;
	outlineWidth: string;
	visibility: string;
}

async function readFocusStyleSnapshot(indicator: Locator): Promise<FocusStyleSnapshot[]> {
	return indicator.evaluate((element) =>
		["", "::before", "::after"].map((pseudo) => {
			const style = getComputedStyle(element, pseudo || null);
			return {
				boxShadow: style.boxShadow,
				content: style.content,
				display: style.display,
				opacity: style.opacity,
				outlineColor: style.outlineColor,
				outlineStyle: style.outlineStyle,
				outlineWidth: style.outlineWidth,
				visibility: style.visibility,
			};
		}),
	);
}

async function waitForSettledLayout(page: Page): Promise<void> {
	await page.waitForLoadState("domcontentloaded");
	await page.waitForFunction(
		() => document.fonts.status === "loaded" && !(window as Window & { $_TSR?: unknown }).$_TSR,
	);
	await page.evaluate(async () => {
		await document.fonts.ready;
		let previous = "";
		let stableFrames = 0;
		for (let frame = 0; frame < 12 && stableFrames < 2; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const root = document.documentElement;
			const body = document.body;
			const current = [
				root.clientWidth,
				root.scrollWidth,
				root.scrollHeight,
				body?.clientWidth ?? 0,
				body?.scrollWidth ?? 0,
				body?.scrollHeight ?? 0,
			].join(":");
			stableFrames = current === previous ? stableFrames + 1 : 0;
			previous = current;
		}
		if (stableFrames < 2) throw new Error("Page layout did not stabilize within 12 animation frames");
	});
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
	await waitForSettledLayout(page);
	const overflow = await page.evaluate(() => ({
		body: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
		document: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
	}));
	if (overflow.document > 0 || overflow.body > 0) {
		throw new Error(`Horizontal overflow detected: document=${overflow.document}px, body=${overflow.body}px`);
	}
}

export async function expectNoRunningAnimations(page: Page, route?: string): Promise<void> {
	await page.emulateMedia({ reducedMotion: "reduce" });
	if (route) await page.goto(route);
	await waitForSettledLayout(page);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
	const runningAnimations = await page.evaluate(() =>
		document
			.getAnimations()
			.filter((animation) => animation.playState === "running")
			.map((animation) => {
				const target = (animation.effect as KeyframeEffect | null)?.target;
				if (!(target instanceof Element)) return "unknown target";
				const id = target.id ? `#${target.id}` : "";
				return `${target.tagName.toLowerCase()}${id}`;
			}),
	);
	if (runningAnimations.length > 0) {
		throw new Error(`Running animation detected with reduced motion: ${runningAnimations.join(", ")}`);
	}
}

export async function expectSignalFocusVisible(
	page: Page,
	target: Locator,
	indicator: Locator = target,
): Promise<void> {
	await expect(target).toHaveCount(1);
	await expect(target).toBeVisible();
	await expect(indicator).toHaveCount(1);

	if (await target.evaluate((element) => element === document.activeElement)) {
		await page.keyboard.press("Shift+Tab");
	}
	const unfocusedStyles = await readFocusStyleSnapshot(indicator);
	let reachedByKeyboard = false;
	for (let step = 0; step < 200; step += 1) {
		await page.keyboard.press("Tab");
		if (await target.evaluate((element) => element === document.activeElement)) {
			reachedByKeyboard = true;
			break;
		}
	}
	if (!reachedByKeyboard) throw new Error("Keyboard traversal did not reach the requested focus target");
	await expect(target).toBeFocused();

	const presentation = await indicator.evaluate((element, before) => {
		type Rgba = { red: number; green: number; blue: number; alpha: number };
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("Canvas is unavailable for focus contrast measurement");

		const parseColor = (value: string): Rgba => {
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = "rgba(0, 0, 0, 0)";
			context.fillStyle = value.trim();
			context.fillRect(0, 0, 1, 1);
			const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
			return { red, green, blue, alpha: alpha / 255 };
		};
		const composite = (foreground: Rgba, background: Rgba): Rgba => {
			const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
			if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
			return {
				red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
				green:
					(foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
				blue:
					(foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
				alpha,
			};
		};
		const luminance = (color: Rgba) => {
			const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
				const value = channel / 255;
				return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
			});
			return red * 0.2126 + green * 0.7152 + blue * 0.0722;
		};
		const contrast = (first: Rgba, second: Rgba) => {
			const lighter = Math.max(luminance(first), luminance(second));
			const darker = Math.min(luminance(first), luminance(second));
			return (lighter + 0.05) / (darker + 0.05);
		};

		const ancestors: Element[] = [];
		for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
			ancestors.unshift(ancestor);
		}
		const adjacentBackground = ancestors.reduce(
			(background, ancestor) => composite(parseColor(getComputedStyle(ancestor).backgroundColor), background),
			{ red: 255, green: 255, blue: 255, alpha: 1 } satisfies Rgba,
		);
		const elementOpacity = [element, ...ancestors].reduce(
			(opacity, current) => opacity * Number.parseFloat(getComputedStyle(current).opacity),
			1,
		);
		const styles = ["", "::before", "::after"].map((pseudo) => {
			const style = getComputedStyle(element, pseudo || null);
			return {
				effectiveOpacity: elementOpacity * (pseudo ? Number.parseFloat(style.opacity) : 1),
				isPseudo: Boolean(pseudo),
				style,
			};
		});
		const colors: Rgba[] = [];
		for (const [index, { effectiveOpacity, isPseudo, style }] of styles.entries()) {
			const previous = before[index];
			const visibilityChanged =
				style.content !== previous?.content ||
				style.display !== previous?.display ||
				style.opacity !== previous?.opacity ||
				style.visibility !== previous?.visibility;
			const isPainted =
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				effectiveOpacity > 0 &&
				(!isPseudo || (style.content !== "none" && style.content !== "normal"));
			const withEffectiveOpacity = (color: Rgba): Rgba => ({
				...color,
				alpha: color.alpha * effectiveOpacity,
			});
			const outlineChanged =
				visibilityChanged ||
				style.outlineColor !== previous?.outlineColor ||
				style.outlineStyle !== previous?.outlineStyle ||
				style.outlineWidth !== previous?.outlineWidth;
			if (
				isPainted &&
				outlineChanged &&
				style.outlineStyle !== "none" &&
				style.outlineStyle !== "hidden" &&
				Number.parseFloat(style.outlineWidth) > 0
			) {
				colors.push(withEffectiveOpacity(parseColor(style.outlineColor)));
			}
			if (!isPainted || (!visibilityChanged && style.boxShadow === previous?.boxShadow)) continue;
			for (const shadow of style.boxShadow.match(/rgba?\([^)]*\)[^,]*/g) ?? []) {
				const lengths = [...shadow.matchAll(/-?\d*\.?\d+px/g)].map(([length]) => Number.parseFloat(length));
				const [offsetX = 0, offsetY = 0, blur = 0, spread = 0] = lengths;
				const reach = Math.max(0, blur + spread);
				const paintsPerimeter = reach > 0 && Math.abs(offsetX) <= reach && Math.abs(offsetY) <= reach;
				if (!shadow.includes("inset") && paintsPerimeter) {
					const color = shadow.match(/rgba?\([^)]*\)/)?.[0];
					if (color) colors.push(withEffectiveOpacity(parseColor(color)));
				}
			}
		}

		const signalValue = getComputedStyle(document.documentElement).getPropertyValue("--yonaris-signal").trim();
		const signal = parseColor(signalValue || "rgb(255, 106, 0)");
		const measurements = colors
			.filter((color) => color.alpha > 0)
			.map((color) => ({
				compositedContrast: contrast(composite(color, adjacentBackground), adjacentBackground),
				isSignal:
					Math.abs(color.red - signal.red) <= 1 &&
					Math.abs(color.green - signal.green) <= 1 &&
					Math.abs(color.blue - signal.blue) <= 1,
				source: color,
			}));
		return {
			adjacentBackground,
			changedPerimeterColors: measurements.length,
			highestContrast: Math.max(0, ...measurements.map(({ compositedContrast }) => compositedContrast)),
			signalContrast: Math.max(
				0,
				...measurements.filter(({ isSignal }) => isSignal).map(({ compositedContrast }) => compositedContrast),
			),
		};
	}, unfocusedStyles);
	const evidence = JSON.stringify(presentation);
	if (presentation.changedPerimeterColors === 0) {
		throw new Error(`Focus did not paint a changed perimeter indicator: ${evidence}`);
	}
	if (presentation.signalContrast < 1.5) {
		throw new Error(`Signal Orange focus component is not visibly painted: ${evidence}`);
	}
	if (presentation.highestContrast < 3) {
		throw new Error(`Focus edge contrast must be at least 3:1 after alpha compositing: ${evidence}`);
	}
}

export async function runWcagAa(page: Page): Promise<void> {
	const { violations } = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();
	if (violations.length === 0) return;
	const report = violations
		.map((violation) => {
			const targets = violation.nodes.map((node) => `  - ${node.target.join(" > ")}`).join("\n");
			return `${violation.id} (${violation.impact ?? "impact unknown"})\nTargets:\n${targets}\nHelp: ${violation.helpUrl}`;
		})
		.join("\n\n");
	throw new Error(`WCAG A/AA violations detected:\n${report}`);
}

export async function captureQa(page: Page, capture: QaCapture): Promise<string> {
	await page.setViewportSize(QA_VIEWPORTS[capture.viewport]);
	await waitForSettledLayout(page);
	const state = capture.state ?? "default";
	const identity = JSON.stringify([capture.route, capture.locale, capture.viewport, state]);
	const fingerprint = createHash("sha256").update(identity).digest("hex").slice(0, 12);
	const slug = (value: string, fallback: string) =>
		value
			.normalize("NFKD")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || fallback;
	const route = slug(capture.route, "home");
	const fileName = [route, capture.locale, capture.viewport, slug(state, "default"), fingerprint].join("--");
	const artifactPath = path.join(visualQaRoot, `${fileName}.png`);
	await mkdir(visualQaRoot, { recursive: true });
	await page.screenshot({
		animations: "disabled",
		caret: "hide",
		fullPage: true,
		path: artifactPath,
	});
	return artifactPath;
}
