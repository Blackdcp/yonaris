import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	CORE_ROUTE_PAIRS,
	captureQa,
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	QA_VIEWPORTS,
	runWcagAa,
} from "./core-site";

test("publishes the complete bilingual core route and viewport matrices", () => {
	expect(CORE_ROUTE_PAIRS).toEqual([
		{ key: "home", en: "/", zh: "/zh" },
		{ key: "product", en: "/product", zh: "/zh/product" },
		{ key: "approach", en: "/approach", zh: "/zh/approach" },
		{ key: "research", en: "/research", zh: "/zh/research" },
		{ key: "company", en: "/company", zh: "/zh/company" },
		{ key: "geo", en: "/geo", zh: "/zh/geo" },
		{ key: "diagnostic", en: "/diagnostic", zh: "/zh/diagnostic" },
	]);
	expect(CORE_ROUTE_PAIRS.flatMap(({ en, zh }) => [en, zh])).toHaveLength(14);
	expect(QA_VIEWPORTS).toEqual({
		desktop: { width: 1440, height: 900 },
		wide: { width: 1280, height: 800 },
		tabletLandscape: { width: 1024, height: 768 },
		tabletPortrait: { width: 768, height: 1024 },
		mobile: { width: 390, height: 844 },
		mobileCompact: { width: 360, height: 800 },
		narrow: { width: 320, height: 740 },
	});
});

test("waits for hydration and stable layout before checking horizontal overflow", async ({ page }) => {
	await page.setContent(`
		<style id="late-layout">main { width: 200vw; }</style>
		<main>Settling layout</main>
		<script>
			window.$_TSR = { hydrating: true };
			requestAnimationFrame(() => requestAnimationFrame(() => {
				document.querySelector('#late-layout').remove();
				delete window.$_TSR;
			}));
		</script>
	`);

	await expectNoHorizontalOverflow(page);
	await page.evaluate(() => {
		const style = document.createElement("style");
		style.textContent = "main { width: 200vw; }";
		document.head.append(style);
	});
	await expect(expectNoHorizontalOverflow(page)).rejects.toThrow(/horizontal overflow/i);
});

test("sets reduced motion before navigation and rejects a running animation", async ({ page }) => {
	const reducedMotionDocument = `
		<!doctype html>
		<html lang="en">
			<head>
				<title>Reduced motion</title>
				<style>
					@keyframes drift { to { transform: translateX(20px); } }
					#target { animation: drift 10s linear infinite; }
					@media (prefers-reduced-motion: reduce) { #target { animation: none; } }
				</style>
			</head>
			<body data-reduced="pending">
				<div id="target">Stable</div>
				<script>document.body.dataset.reduced = String(matchMedia('(prefers-reduced-motion: reduce)').matches)</script>
			</body>
		</html>
	`;
	const reducedMotionUrl = `data:text/html,${encodeURIComponent(reducedMotionDocument)}`;

	await expectNoRunningAnimations(page, reducedMotionUrl);
	await expect(page.locator("body")).toHaveAttribute("data-reduced", "true");

	await page.evaluate(() => {
		document.querySelector("#target")?.animate([{ opacity: 1 }, { opacity: 0.5 }], {
			duration: 10_000,
			iterations: Number.POSITIVE_INFINITY,
		});
	});
	await expect(expectNoRunningAnimations(page)).rejects.toThrow(/running animation/i);
});

test("tabs to the requested control and evaluates composited focus edges", async ({ page }) => {
	await page.setContent(`
		<style>
			body { background: rgb(246, 244, 241); }
			button:focus-visible {
				outline: 2px solid rgba(11, 18, 32, 0.58);
				outline-offset: 3px;
				box-shadow: 0 0 0 2px rgb(255, 106, 0);
			}
			#weak:focus-visible {
				outline-color: rgba(11, 18, 32, 0.15);
			}
		</style>
		<a href="#skip">Skip</a>
		<button id="strong">Strong focus</button>
		<button id="weak">Weak focus</button>
	`);

	const strong = page.getByRole("button", { name: "Strong focus" });
	await expectSignalFocusVisible(page, strong);
	await expect(strong).toBeFocused();

	const weak = page.getByRole("button", { name: "Weak focus" });
	await expect(expectSignalFocusVisible(page, weak)).rejects.toThrow(/3:1|contrast/i);
});

test("does not credit permanent or distant shadows as focus perimeter paint", async ({ page }) => {
	await page.setContent(`
		<style>
			body { background: rgb(246, 244, 241); }
			#permanent {
				outline: none;
				box-shadow: 0 0 0 2px rgb(255, 106, 0), 0 0 0 4px rgb(11, 18, 32);
			}
			#distant:focus-visible {
				outline: none;
				box-shadow: 80px 80px 0 2px rgb(255, 106, 0), 100px 100px 0 4px rgb(11, 18, 32);
			}
		</style>
		<button id="permanent">Permanent shadow</button>
		<button id="distant">Distant shadow</button>
	`);

	await expect(expectSignalFocusVisible(page, page.getByRole("button", { name: "Permanent shadow" }))).rejects.toThrow(
		/focus|paint/i,
	);
	await expect(expectSignalFocusVisible(page, page.getByRole("button", { name: "Distant shadow" }))).rejects.toThrow(
		/perimeter|paint/i,
	);
});

test("reports actionable WCAG A and AA violations", async ({ page }) => {
	await page.setContent(`
		<!doctype html>
		<html lang="en">
			<head><title>Accessibility contract</title></head>
			<body><main><img id="hero" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></main></body>
		</html>
	`);

	await expect(runWcagAa(page)).rejects.toThrow(
		/image-alt[\s\S]*critical[\s\S]*#hero[\s\S]*https:\/\/dequeuniversity\.com\/rules\/axe\//i,
	);
});

test("captures a deterministic full-page QA artifact directly below the WWW output root", async ({ page }) => {
	await page.setViewportSize(QA_VIEWPORTS.mobile);
	await page.setContent(`
		<!doctype html>
		<html lang="zh-CN">
			<head>
				<title>Capture contract</title>
				<style>body { min-height: 1200px; } input { caret-color: red; }</style>
			</head>
			<body><main><input value="capture"><p>Visual QA</p></main></body>
		</html>
	`);

	const artifactPath = await captureQa(page, {
		route: "/zh/product",
		locale: "zh",
		viewport: "mobile",
		state: "contact",
	});
	const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
	expect(path.dirname(artifactPath)).toBe(path.join(e2eRoot, "test-results-www", "visual-qa"));
	expect(path.basename(artifactPath)).toMatch(/^zh-product--zh--mobile--contact--[a-f0-9]{12}\.png$/);

	const png = await readFile(artifactPath);
	expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
	expect(png.readUInt32BE(20)).toBeGreaterThan(QA_VIEWPORTS.mobile.height);
});

test("captures the helper visual baseline", { tag: "@visual" }, async ({ page }) => {
	await page.setContent(`
			<!doctype html>
			<html lang="en">
				<head><title>Visual helper contract</title></head>
				<body><main><h1>Visual QA is connected</h1></main></body>
			</html>
		`);
	const artifactPath = await captureQa(page, {
		route: "helper-contract",
		locale: "en",
		viewport: "narrow",
		state: "baseline",
	});
	expect(path.basename(artifactPath)).toMatch(/^helper-contract--en--narrow--baseline--[a-f0-9]{12}\.png$/);
});
