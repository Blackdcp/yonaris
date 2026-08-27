import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import * as visualMatrix from "./site-06-visual-matrix.mjs";

const {
	CINEMATIC_PHOTO_SELECTOR,
	EXPECTED_BINDING_SHA256,
	FIDELITY_ROUTES,
	INTERACTION_SCENES,
	REFERENCE_VIEWS,
	VIEWPORTS,
	assertHumanHeaderMetrics,
	assertSceneContract,
	buildCapturePlan,
	buildReferenceCapturePlan,
	buildRouteUrl,
	loadPlaywrightChromium,
	parseCliArgs,
	renderContactIndex,
	renderPairIndex,
} = visualMatrix;

const siteCss = [
	readFileSync(new URL("../src/styles/experience/base.css", import.meta.url), "utf8"),
	readFileSync(new URL("../src/styles/experience/site-06.css", import.meta.url), "utf8"),
].join("\n");

test("passes Playwright a serialized route URL", () => {
	const routeUrl = buildRouteUrl("http://127.0.0.1:4173/", "/zh/product");
	assert.equal(routeUrl, "http://127.0.0.1:4173/zh/product");
	assert.equal(typeof routeUrl, "string");
});

test("targets the CinematicField image node used by production markup", () => {
	assert.equal(CINEMATIC_PHOTO_SELECTOR, '[data-scene-object="cinematic-field"] > img.site-06-cinematic__media');
});

test("binds interaction checks to the recomposed scene objects", () => {
	assert.deepEqual(INTERACTION_SCENES, {
		"/": '[data-scene-object="fixed-claim-reader"]',
		"/product": '[data-scene-object="trace-workbench"]',
		"/approach": '[data-scene-object="comparison-stage"]',
		"/company": '[data-scene-object="dual-reading-stage"]',
		"/zh": '[data-scene-object="anxiety-selector"]',
		"/zh/product": '[data-scene-object="system-field"]',
		"/zh/approach": '[data-scene-object="replay-stage"]',
		"/zh/company": '[data-scene-object="dual-reading-stage"]',
	});
});

test("renders a fully loadable, grouped contact index for visual inspection", () => {
	const plan = buildCapturePlan();
	const html = renderContactIndex({
		counts: { total: plan.length },
		artifacts: plan.map(({ relativeFile, ...capture }) => ({ ...capture, file: relativeFile })),
	});
	assert.equal((html.match(/<img /gu) ?? []).length, 156);
	assert.doesNotMatch(html, /loading="lazy"/u);
	for (const kind of ["first-view", "full-page", "reduced-motion"]) {
		assert.match(html, new RegExp(`<section data-kind="${kind}"`, "u"));
	}
});

test("builds the literal 28-route, 156-artifact Site 06 review matrix", () => {
	assert.equal(FIDELITY_ROUTES.length, 28);
	assert.equal(new Set(FIDELITY_ROUTES.map(({ path }) => path)).size, 28);
	assert.deepEqual(
		Object.fromEntries(
			["en", "zh"].flatMap((locale) =>
				["human", "agent"].map((surface) => [
					`${locale}-${surface}`,
					FIDELITY_ROUTES.filter((route) => route.locale === locale && route.surface === surface).length,
				]),
			),
		),
		{ "en-human": 7, "en-agent": 7, "zh-human": 7, "zh-agent": 7 },
	);

	const plan = buildCapturePlan();
	assert.deepEqual(
		Object.fromEntries(
			["first-view", "full-page", "reduced-motion"].map((kind) => [
				kind,
				plan.filter((capture) => capture.kind === kind).length,
			]),
		),
		{ "first-view": 112, "full-page": 24, "reduced-motion": 20 },
	);
	assert.equal(plan.length, 156);
	assert.equal(new Set(plan.map(({ relativeFile }) => relativeFile)).size, 156);
	assert.equal(plan.filter(({ kind, viewport }) => kind === "first-view" && viewport === "1440").length, 28);
	assert.equal(plan.filter(({ kind, viewport }) => kind === "first-view" && viewport === "1280").length, 28);
	assert.equal(plan.filter(({ kind, viewport }) => kind === "first-view" && viewport === "390").length, 28);
	assert.equal(plan.filter(({ kind, viewport }) => kind === "first-view" && viewport === "360").length, 28);
	for (const capture of plan) {
		assert.ok(capture.composition);
		assert.ok(capture.sceneMarkers.length > 0);
		assert.deepEqual(capture.dimensions, VIEWPORTS[capture.viewport]);
		assert.match(capture.relativeFile, /^(?:first-view|full-page|reduced-motion)\//u);
	}
	assert.equal(FIDELITY_ROUTES.find(({ path }) => path === "/")?.photoFocal, "50% 50%");
	assert.equal(FIDELITY_ROUTES.find(({ path }) => path === "/approach")?.photoFocal, "50% 72%");
});

test("parses only an explicit loopback base URL and output directory", () => {
	assert.deepEqual(
		parseCliArgs([
			"--base-url",
			"http://127.0.0.1:4173",
			"--output",
			".superpowers/sdd/site-06/task-5-captures",
		]),
		{
			baseUrl: "http://127.0.0.1:4173/",
			output: ".superpowers/sdd/site-06/task-5-captures",
		},
	);
	assert.throws(() => parseCliArgs([]), /--base-url/u);
	assert.throws(
		() => parseCliArgs(["--base-url", "https://yonaris.com", "--output", "captures"]),
		/loopback/u,
	);
});

test("loads the installed Chromium runtime through the e2e workspace boundary", () => {
	const chromium = loadPlaywrightChromium();
	assert.equal(chromium.name(), "chromium");
	assert.equal(existsSync(chromium.executablePath()), true);
});

test("keeps exactly one top-level Human mode and locale visible without a desktop header wrap", async () => {
	const chromium = loadPlaywrightChromium();
	const browser = await chromium.launch({ headless: true });
	try {
		for (const width of [1440, 1280, 390, 360]) {
			const page = await browser.newPage({ viewport: { width, height: width > 720 ? 900 : 844 } });
			await page.setContent(`<style>${siteCss}</style><header class="site-06-header"><div class="site-06-header__inner"><a class="site-06-brand">Yonaris</a><nav class="site-06-primary-nav"><a>Platform</a><a>Evidence</a><a>Human + Agent</a><a>Contact</a></nav><div class="site-06-header__actions"><div class="mode-link site-06-mode" data-mode-switch="true">Mode</div><a class="site-06-locale">中</a></div><div class="site-06-header__mobile-mode"><div class="mode-link site-06-mode" data-mode-switch="true">Mode</div></div><a class="site-06-header__mobile-locale site-06-locale">中</a><details class="site-06-menu"><summary>Menu</summary></details></div></header>`);
			const metrics = await page.locator(".site-06-header").evaluate((header) => {
				const visible = (element) => {
					const style = getComputedStyle(element);
					const box = element.getBoundingClientRect();
					return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
				};
				const topLevelControls = [
					...header.querySelectorAll(".site-06-header__actions [data-mode-switch], .site-06-header__mobile-mode [data-mode-switch], .site-06-header__actions .site-06-locale, .site-06-header__mobile-locale"),
				];
				const boxFor = (selector) => {
					const box = header.querySelector(selector)?.getBoundingClientRect();
					return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined;
				};
				return {
					headerHeight: header.getBoundingClientRect().height,
					visibleModes: topLevelControls.filter((element) => element.matches("[data-mode-switch]") && visible(element)).length,
					visibleLocales: topLevelControls.filter((element) => element.matches(".site-06-locale") && visible(element)).length,
					controlBoxes: {
						brand: boxFor(".site-06-brand"),
						locale: boxFor(".site-06-header__mobile-locale"),
						menu: boxFor(".site-06-menu summary"),
					},
				};
			});
			assert.doesNotThrow(() => assertHumanHeaderMetrics(metrics, width));
			assert.doesNotThrow(() => visualMatrix.assertHeaderControlGeometry(metrics.controlBoxes, width));
			await page.close();
		}
	} finally {
		await browser.close();
	}
});

test("rejects hidden, zero-size, and replaced route-specific scenes", async () => {
	assert.throws(
		() => visualMatrix.assertSceneGeometry({ count: 1, visible: false, width: 320, height: 180 }, "/product", "trace-workbench"),
		/not visible/u,
	);
	assert.throws(
		() => visualMatrix.assertSceneGeometry({ count: 1, visible: true, width: 0, height: 180 }, "/product", "trace-workbench"),
		/non-zero/u,
	);

	const chromium = loadPlaywrightChromium();
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: VIEWPORTS[1280] });
		await page.setContent('<main><section data-scene-object="trace-workbench" style="width:320px;height:180px">Trace</section></main>');
		await assert.doesNotReject(() => assertSceneContract(page, "/product", [{ name: "trace-workbench", selector: '[data-scene-object="trace-workbench"]' }]));
		await page.addStyleTag({ content: '[data-scene-object="trace-workbench"] { display: none !important; }' });
		await assert.rejects(
			() => assertSceneContract(page, "/product", [{ name: "trace-workbench", selector: '[data-scene-object="trace-workbench"]' }]),
			/not visible/u,
		);
		await page.setContent('<main><section class="site-06-hero">Generic replacement</section></main>');
		await assert.rejects(
			() => assertSceneContract(page, "/product", [{ name: "trace-workbench", selector: '[data-scene-object="trace-workbench"]' }]),
			/missing/u,
		);
	} finally {
		await browser.close();
	}
});

test("builds immutable-source reference and same-width pair evidence without changing the 156 production captures", () => {
	assert.equal(EXPECTED_BINDING_SHA256, "e26b204b528481ddd3274d4a546f1a9acd02a0f7f5e94de80b1070a1d05b46da");
	assert.equal(REFERENCE_VIEWS.length, 10);
	assert.deepEqual(
		REFERENCE_VIEWS.map(({ sourceView, productionRoute }) => [sourceView, productionRoute]),
		[
			["en-home-page", "/"],
			["en-platform-page", "/product"],
			["en-work-page", "/approach"],
			["en-human-agent-page", "/company"],
			["en-contact-page", "/diagnostic"],
			["zh-home-page", "/zh"],
			["zh-delivery-page", "/zh/product"],
			["zh-practice-page", "/zh/approach"],
			["zh-contact-page", "/zh/diagnostic"],
			["agent", "/agent"],
		],
	);
	const referencePlan = buildReferenceCapturePlan();
	assert.equal(referencePlan.filter(({ kind }) => kind === "first-view").length, 40);
	assert.equal(referencePlan.filter(({ kind }) => kind === "full-page").length, 20);
	assert.equal(referencePlan.length, 60);
	assert.equal(buildCapturePlan().length, 156);
	for (const route of FIDELITY_ROUTES) assert.ok(route.prototypeMapping?.sourceView, `${route.path} needs a prototype mapping`);

	const pairHtml = renderPairIndex({
		bindingSha256: EXPECTED_BINDING_SHA256,
		pairs: referencePlan.map((capture) => ({
			...capture,
			referenceFile: `reference/${capture.relativeFile}`,
			productionFile: `production/${capture.relativeFile}`,
		})),
	});
	assert.equal((pairHtml.match(/data-pair=/gu) ?? []).length, 60);
	assert.equal((pairHtml.match(/data-side="reference"/gu) ?? []).length, 60);
	assert.equal((pairHtml.match(/data-side="production"/gu) ?? []).length, 60);
});

test("raises local contact evidence text above the AA edge without changing the global palette", async () => {
	const chromium = loadPlaywrightChromium();
	const browser = await chromium.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: VIEWPORTS[1280] });
		await page.setContent(`<style>${siteCss}</style><aside class="site-06-contact-scene__record">Evidence</aside>`);
		const style = await page.locator("aside").evaluate((element) => ({
			color: getComputedStyle(element).color,
			fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
		}));
		const alpha = Number(style.color.match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/u)?.[1] ?? 1);
		assert.ok(alpha >= 0.78, `expected local white alpha >= .78, received ${style.color}`);
		assert.ok(style.fontSize >= 12, `expected at least 12px evidence copy, received ${style.fontSize}px`);
	} finally {
		await browser.close();
	}
});
