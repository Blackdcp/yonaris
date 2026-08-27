import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
	CINEMATIC_PHOTO_SELECTOR,
	FIDELITY_ROUTES,
	INTERACTION_SCENES,
	VIEWPORTS,
	buildCapturePlan,
	buildRouteUrl,
	loadPlaywrightChromium,
	parseCliArgs,
	renderContactIndex,
} from "./site-06-visual-matrix.mjs";

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
