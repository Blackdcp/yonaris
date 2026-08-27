#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");

export const CINEMATIC_PHOTO_SELECTOR = '[data-scene-object="cinematic-field"] > img.site-06-cinematic__media';

export const INTERACTION_SCENES = {
	"/": '[data-scene-object="fixed-claim-reader"]',
	"/product": '[data-scene-object="trace-workbench"]',
	"/approach": '[data-scene-object="comparison-stage"]',
	"/company": '[data-scene-object="dual-reading-stage"]',
	"/zh": '[data-scene-object="anxiety-selector"]',
	"/zh/product": '[data-scene-object="system-field"]',
	"/zh/approach": '[data-scene-object="replay-stage"]',
	"/zh/company": '[data-scene-object="dual-reading-stage"]',
};

export const VIEWPORTS = {
	1440: { width: 1440, height: 900 },
	1280: { width: 1280, height: 800 },
	390: { width: 390, height: 844 },
	360: { width: 360, height: 800 },
};

const humanScenes = {
	"/": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["fixed-claim-reader", '[data-scene-object="fixed-claim-reader"]'],
		["inline-evidence-note", '[data-scene-object="inline-evidence-note"]'],
	],
	"/product": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["evidence-sheet", '[data-scene-object="evidence-sheet"]'],
		["trace-workbench", '[data-scene-object="trace-workbench"]'],
	],
	"/approach": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["comparison-stage", '[data-scene-object="comparison-stage"]'],
	],
	"/company": [["dual-reading-stage", '[data-scene-object="dual-reading-stage"]']],
	"/geo": [
		["market-editorial", ".site-06-market-editorial"],
		["market-condition-ledger", ".site-06-market-ledger"],
	],
	"/diagnostic": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["contact-form", "#contact-form"],
	],
	"/privacy": [["privacy-document", ".site-06-privacy-document"]],
	"/zh": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["anxiety-selector", '[data-scene-object="anxiety-selector"]'],
		["fact-disclosure", '[data-scene-object="fact-disclosure"]'],
	],
	"/zh/product": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["relationship-preview", '[data-scene-object="relationship-preview"]'],
		["system-field", '[data-scene-object="system-field"]'],
	],
	"/zh/approach": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["breakdown-preview", '[data-scene-object="breakdown-preview"]'],
		["replay-stage", '[data-scene-object="replay-stage"]'],
	],
	"/zh/company": [
		["dual-reading-stage", '[data-scene-object="dual-reading-stage"]'],
		["canonical-fact-record", '[data-scene-object="canonical-fact-record"]'],
		["company-close", '[data-scene-object="company-close"]'],
	],
	"/zh/geo": [
		["market-condition-ledger", '[data-scene-object="market-condition-ledger"]'],
		["market-evidence-lines", '[data-scene-object="market-evidence-lines"]'],
		["geo-close", '[data-scene-object="geo-close"]'],
	],
	"/zh/diagnostic": [
		["cinematic-field", '[data-scene-object="cinematic-field"]'],
		["contact-form", "#contact-form"],
	],
	"/zh/privacy": [["privacy-document", ".site-06-privacy-document"]],
};

const humanDefinitions = [
	["/", "en", "home", "cinematic-orbit", "50% 50%"],
	["/product", "en", "product", "evidence-workbench", "50% 50%"],
	["/approach", "en", "approach", "comparison-field", "50% 72%"],
	["/company", "en", "company", "dual-reading-field"],
	["/geo", "en", "geo", "market-editorial"],
	["/diagnostic", "en", "diagnostic", "contact-cinematic", "50% 50%"],
	["/privacy", "en", "privacy", "privacy-editorial"],
	["/zh", "zh", "home", "cinematic-anxiety", "50% 50%"],
	["/zh/product", "zh", "product", "system-field", "50% 50%"],
	["/zh/approach", "zh", "approach", "breakdown-replay", "50% 50%"],
	["/zh/company", "zh", "company", "dual-reading-field-zh"],
	["/zh/geo", "zh", "geo", "market-editorial-zh"],
	["/zh/diagnostic", "zh", "diagnostic", "contact-cinematic-zh", "50% 50%"],
	["/zh/privacy", "zh", "privacy", "privacy-editorial-zh"],
];

const agentScenes = [
	["question-index", '[data-scene-object="question-index"]'],
	["answer-document", '[data-scene-object="answer-document"]'],
	["fact-inspector", '[data-scene-object="fact-inspector"]'],
	["fact-directory", '[data-scene-object="fact-directory"]'],
];

const pageKeys = ["home", "product", "approach", "company", "geo", "diagnostic", "privacy"];

export const FIDELITY_ROUTES = [
	...humanDefinitions.map(([pathName, locale, pageKey, composition, photoFocal]) => ({
		path: pathName,
		locale,
		surface: "human",
		pageKey,
		composition,
		scenes: humanScenes[pathName].map(([name, selector]) => ({ name, selector })),
		sceneMarkers: humanScenes[pathName].map(([name]) => name),
		photoFocal,
	})),
	...["en", "zh"].flatMap((locale) =>
		pageKeys.map((pageKey) => ({
			path:
				locale === "en"
					? pageKey === "home"
						? "/agent"
						: `/agent/${pageKey}`
					: pageKey === "home"
						? "/zh/agent"
						: `/zh/agent/${pageKey}`,
			locale,
			surface: "agent",
			pageKey,
			composition: "fact-directory",
			scenes: agentScenes.map(([name, selector]) => ({ name, selector })),
			sceneMarkers: agentScenes.map(([name]) => name),
		})),
	),
];

const fullPageIdentities = new Set([
	"en-human-home",
	"en-human-product",
	"en-human-approach",
	"en-human-company",
	"en-human-diagnostic",
	"zh-human-home",
	"zh-human-product",
	"zh-human-approach",
	"zh-human-company",
	"zh-human-diagnostic",
	"en-agent-home",
	"zh-agent-home",
]);

const reducedMotionIdentities = new Set([
	"en-human-home",
	"en-human-product",
	"en-human-approach",
	"en-human-diagnostic",
	"en-agent-home",
	"zh-human-home",
	"zh-human-product",
	"zh-human-approach",
	"zh-human-diagnostic",
	"zh-agent-home",
]);

function identity(route) {
	return `${route.locale}-${route.surface}-${route.pageKey}`;
}

function artifact(route, kind, viewport) {
	return {
		kind,
		route: route.path,
		locale: route.locale,
		surface: route.surface,
		pageKey: route.pageKey,
		viewport,
		dimensions: VIEWPORTS[viewport],
		fullPage: kind === "full-page",
		reducedMotion: kind === "reduced-motion",
		composition: route.composition,
		sceneMarkers: route.sceneMarkers,
		relativeFile: `${kind}/${viewport}/${route.locale}/${route.surface}/${route.pageKey}.png`,
		definition: route,
	};
}

export function buildCapturePlan() {
	const captures = [];
	for (const route of FIDELITY_ROUTES) {
		for (const viewport of ["1440", "1280", "390", "360"]) captures.push(artifact(route, "first-view", viewport));
		if (fullPageIdentities.has(identity(route))) {
			for (const viewport of ["1440", "390"]) captures.push(artifact(route, "full-page", viewport));
		}
		if (reducedMotionIdentities.has(identity(route))) {
			for (const viewport of ["1280", "360"]) captures.push(artifact(route, "reduced-motion", viewport));
		}
	}
	return captures;
}

export function parseCliArgs(args) {
	const values = new Map();
	for (let index = 0; index < args.length; index += 2) {
		const option = args[index];
		const value = args[index + 1];
		if (!option?.startsWith("--") || !value || value.startsWith("--")) throw new Error(`Missing value for ${option ?? "argument"}`);
		if (values.has(option)) throw new Error(`Duplicate option ${option}`);
		values.set(option, value);
	}
	const suppliedBaseUrl = values.get("--base-url");
	const output = values.get("--output");
	if (!suppliedBaseUrl) throw new Error("Missing required --base-url");
	if (!output) throw new Error("Missing required --output");
	if ([...values.keys()].some((key) => key !== "--base-url" && key !== "--output")) throw new Error("Unknown option");
	const baseUrl = new URL(suppliedBaseUrl);
	if (baseUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(baseUrl.hostname)) {
		throw new Error("--base-url must target a local HTTP loopback server");
	}
	baseUrl.pathname = "/";
	baseUrl.search = "";
	baseUrl.hash = "";
	return { baseUrl: baseUrl.href, output };
}

export function loadPlaywrightChromium() {
	const requireFromE2e = createRequire(pathToFileURL(path.join(repositoryRoot, "e2e/package.json")));
	return requireFromE2e("@playwright/test").chromium;
}

export function buildRouteUrl(baseUrl, route) {
	return new URL(route, baseUrl).href;
}

function invariant(value, message) {
	if (!value) throw new Error(message);
}

async function settleLayout(page) {
	await page.waitForFunction(() => document.fonts.status === "loaded" && !window.$_TSR);
	await page.evaluate(async () => {
		await document.fonts.ready;
		let previous = "";
		let stableFrames = 0;
		for (let frame = 0; frame < 12 && stableFrames < 2; frame += 1) {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			const root = document.documentElement;
			const body = document.body;
			const current = [root.clientWidth, root.scrollWidth, root.scrollHeight, body.clientWidth, body.scrollWidth, body.scrollHeight].join(":");
			stableFrames = current === previous ? stableFrames + 1 : 0;
			previous = current;
		}
		if (stableFrames < 2) throw new Error("layout did not settle within 12 animation frames");
		window.scrollTo(0, 0);
	});
}

async function assertVisible(locator, message) {
	invariant((await locator.count()) === 1, `${message}: expected exactly one element`);
	invariant(await locator.isVisible(), `${message}: element is not visible`);
}

async function assertUniqueIds(page, route) {
	const duplicates = await page.locator("[id]").evaluateAll((elements) => {
		const counts = new Map();
		for (const element of elements) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
		return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
	});
	invariant(duplicates.length === 0, `${route}: duplicate DOM IDs: ${duplicates.join(", ")}`);
}

async function assertHumanHeader(page, route, mobile) {
	if (mobile) {
		await assertVisible(page.locator(".site-06-header__mobile-mode .mode-link"), `${route} mobile Human/Agent control`);
		await assertVisible(page.locator(".site-06-header__mobile-locale"), `${route} mobile locale control`);
	} else {
		await assertVisible(page.locator(".site-06-header__actions .mode-link"), `${route} Human/Agent control`);
		await assertVisible(page.locator(".site-06-header__actions .site-06-locale"), `${route} locale control`);
	}
}

async function assertAgentHeader(page, route, mobile) {
	await assertVisible(
		page.locator(mobile ? ".agent-experience__mode-mobile" : ".agent-experience__mode-desktop"),
		`${route} Agent/Human control`,
	);
	await assertVisible(page.locator(".agent-experience__actions [data-locale-switch]"), `${route} Agent locale control`);
}

async function assertEnding(page, route) {
	const endings = {
		"/product": ".site-06-dark-close",
		"/approach": ".site-06-editorial-close",
		"/diagnostic": ".site-06-cinematic",
		"/privacy": ".site-06-privacy-document",
		"/zh/product": ".site-06-editorial-close",
		"/zh/approach": ".site-06-zh-replay-stage",
		"/zh/diagnostic": ".site-06-cinematic",
		"/zh/privacy": ".site-06-privacy-document",
	};
	const expected = endings[route];
	if (!expected) return;
	const matches = await page.locator("[data-page-composition] > :last-child").evaluate((element, selector) => element.matches(selector), expected);
	invariant(matches, `${route}: route-specific ending must be ${expected}`);
}

async function assertForm(page, definition) {
	if (definition.pageKey !== "diagnostic" || definition.surface !== "human") return;
	const form = page.locator("form[data-lead-state]");
	await assertVisible(form, `${definition.path} lead form`);
	const fields = form.locator("[data-lead-field] input");
	invariant((await fields.count()) === 3, `${definition.path}: form must expose exactly three visible fields`);
	const names = await fields.evaluateAll((inputs) => inputs.map((input) => input.getAttribute("name")));
	const expected = definition.locale === "zh" ? ["name", "phone", "company"] : ["name", "email", "company"];
	invariant(JSON.stringify(names) === JSON.stringify(expected), `${definition.path}: unexpected form fields ${JSON.stringify(names)}`);
	invariant((await form.getAttribute("data-lead-state")) === "idle", `${definition.path}: visual runner must not submit the form`);
}

async function assertRouteContract(page, capture) {
	const { definition, route, dimensions } = capture;
	await assertVisible(
		page.locator(definition.surface === "human" ? ".site-06" : '[data-agent-surface="true"]'),
		`${route} ${definition.surface} surface root`,
	);
	const composition = page.locator(`[data-page-composition="${definition.composition}"]`);
	await assertVisible(composition, `${route} composition ${definition.composition}`);
	for (const scene of definition.scenes) {
		invariant((await page.locator(scene.selector).count()) > 0, `${route}: missing scene ${scene.name} (${scene.selector})`);
	}
	const h1 = page.locator("main h1");
	await assertVisible(h1, `${route} H1`);
	const h1Size = Number.parseFloat(await h1.evaluate((element) => getComputedStyle(element).fontSize));
	const mobile = dimensions.width <= 720;
	if (definition.surface === "human") {
		invariant(h1Size >= (mobile ? 35.5 : 37.5) && h1Size <= (mobile ? 46.5 : 48.5), `${route}: Human H1 ${h1Size}px is outside the approved range`);
		invariant((await page.locator(".site-06-hero__media, .site-06-hero__copy, .site-06-hero__record").count()) === 0, `${route}: retired generic hero card returned`);
		await assertHumanHeader(page, route, mobile);
		await assertEnding(page, route);
		await assertForm(page, definition);
		if (definition.photoFocal) {
			const photo = page.locator(CINEMATIC_PHOTO_SELECTOR).first();
			await assertVisible(photo, `${route} cinematic photo`);
			const focal = await photo.evaluate((element) => getComputedStyle(element).objectPosition);
			invariant(focal === definition.photoFocal, `${route}: expected photo focal ${definition.photoFocal}, received ${focal}`);
		}
	} else {
		invariant(h1Size >= 31.5 && h1Size <= (mobile ? 40.5 : 70.5), `${route}: Agent H1 ${h1Size}px is outside the approved range`);
		await assertAgentHeader(page, route, mobile);
		const robots = (await page.locator('meta[name="robots"]').getAttribute("content"))?.replaceAll(" ", "").toLowerCase();
		invariant(robots === "noindex,follow", `${route}: Agent surface must remain noindex,follow`);
		if (definition.pageKey !== "home") {
			const directory = page.locator(".agent-experience__directory-layout");
			const box = await directory.boundingBox();
			invariant(Boolean(box) && box.y < dimensions.height && box.y + box.height > 0, `${route}: inner Agent directory is not exposed in the first viewport`);
		}
	}
	const overflow = await page.evaluate(() => ({
		document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		body: document.body.scrollWidth - document.body.clientWidth,
	}));
	invariant(overflow.document <= 0 && overflow.body <= 0, `${route}: horizontal overflow document=${overflow.document}px body=${overflow.body}px`);
	await assertUniqueIds(page, route);
}

async function visiblePanelText(container) {
	const panels = container.locator('[role="tabpanel"]');
	for (let index = 0; index < (await panels.count()); index += 1) {
		const panel = panels.nth(index);
		if (await panel.isVisible()) return (await panel.innerText()).trim();
	}
	return "";
}

async function assertTabInteraction(page, route, containerSelector) {
	const container = page.locator(containerSelector).first();
	const tabs = container.locator('[role="tab"]');
	invariant((await tabs.count()) >= 2, `${route}: interaction ${containerSelector} needs at least two tabs`);
	const before = await visiblePanelText(container);
	await tabs.nth(1).click();
	await page.waitForFunction(
		([selector]) => [...document.querySelectorAll(`${selector} [role="tab"]`)].some((tab, index) => index === 1 && tab.getAttribute("aria-selected") === "true"),
		[containerSelector],
	);
	const pointer = await visiblePanelText(container);
	invariant(pointer && pointer !== before, `${route}: pointer selection did not visibly update ${containerSelector}`);
	await tabs.nth(1).focus();
	await page.keyboard.press("Home");
	const keyboard = await visiblePanelText(container);
	invariant(keyboard && keyboard !== pointer, `${route}: keyboard selection did not visibly update ${containerSelector}`);
}

async function assertAgentInteraction(page) {
	const directory = page.locator(".agent-experience__directory-layout");
	const tabs = directory.locator('.agent-experience__question-index [role="tab"]');
	invariant((await tabs.count()) >= 2, "/agent: fact directory needs multiple canonical questions");
	const inspector = directory.locator(".agent-experience__fact-inspector");
	const before = (await inspector.innerText()).trim();
	await tabs.nth(1).click();
	const claim = directory.locator('.agent-experience__answer-document [role="tabpanel"]:not([hidden]) a').first();
	await claim.click();
	const after = (await inspector.innerText()).trim();
	invariant(after && after !== before, "/agent: pointer navigation did not update the fact inspector");
	invariant((await page.evaluate(() => location.hash)).startsWith("#yonaris."), "/agent: fact navigation did not expose a stable hash");
	await tabs.nth(1).focus();
	await page.keyboard.press("Home");
	invariant((await tabs.first().getAttribute("aria-selected")) === "true", "/agent: keyboard navigation did not restore the first question");
}

async function runInteractionContract(page, route) {
	if (INTERACTION_SCENES[route]) await assertTabInteraction(page, route, INTERACTION_SCENES[route]);
	if (route === "/agent") await assertAgentInteraction(page);
}

async function assertReducedMotion(page, capture) {
	if (!capture.reducedMotion) return;
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
	const running = await page.evaluate(() =>
		document
			.getAnimations()
			.filter((animation) => animation.playState === "running")
			.map((animation) => animation.effect?.target?.className || animation.effect?.target?.tagName || "unknown"),
	);
	invariant(running.length === 0, `${capture.route}: reduced motion left running animations: ${running.join(", ")}`);
	await runInteractionContract(page, capture.route);
	await settleLayout(page);
}

export function renderContactIndex(manifest) {
	const sections = ["first-view", "full-page", "reduced-motion"]
		.map((kind) => {
			const cards = manifest.artifacts
				.filter((artifact) => artifact.kind === kind)
				.map(
					(artifact) => `<figure><a href="${artifact.file}"><img src="${artifact.file}" alt="${artifact.route} ${artifact.kind} ${artifact.viewport}"></a><figcaption>${artifact.route} · ${artifact.viewport} · ${artifact.composition}</figcaption></figure>`,
				)
				.join("\n");
			return `<section data-kind="${kind}"><h2>${kind}</h2><div class="grid">${cards}</div></section>`;
		})
		.join("\n");
	return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Site 06 Task 5 captures</title><style>body{margin:0;padding:24px;background:#071724;color:#fbf8f1;font:14px system-ui}h1{font-size:24px}h2{margin:32px 0 16px;text-transform:uppercase;letter-spacing:.12em}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:20px}figure{margin:0;border:1px solid #43515d;background:#0d2232}img{display:block;width:100%;height:220px;object-fit:contain;object-position:top;background:#07111a}figcaption{padding:10px;line-height:1.45}</style><h1>Site 06 Task 5 · ${manifest.counts.total} inspected artifacts</h1>${sections}</html>`;
}

export async function runVisualMatrix({ baseUrl, output }) {
	const chromium = loadPlaywrightChromium();
	const browser = await chromium.launch({ headless: true });
	const outputRoot = path.resolve(repositoryRoot, output);
	const plan = buildCapturePlan();
	const artifacts = [];
	const sessions = new Map();
	try {
		for (const capture of plan) {
			const preference = capture.reducedMotion ? "reduce" : "no-preference";
			const sessionKey = `${capture.viewport}-${preference}`;
			let session = sessions.get(sessionKey);
			if (!session) {
				const context = await browser.newContext({
					viewport: capture.dimensions,
					deviceScaleFactor: 1,
					colorScheme: "light",
					reducedMotion: preference,
				});
				session = { context, page: await context.newPage() };
				sessions.set(sessionKey, session);
			}
			const response = await session.page.goto(buildRouteUrl(baseUrl, capture.route), { waitUntil: "domcontentloaded" });
			invariant(response?.status() === 200, `${capture.route}: expected 200, received ${response?.status() ?? "no response"}`);
			await settleLayout(session.page);
			if (capture.kind === "first-view") await assertRouteContract(session.page, capture);
			if (capture.kind === "first-view" && capture.viewport === "1280") await runInteractionContract(session.page, capture.route);
			await assertReducedMotion(session.page, capture);
			const artifactPath = path.join(outputRoot, capture.relativeFile);
			await mkdir(path.dirname(artifactPath), { recursive: true });
			await session.page.screenshot({
				path: artifactPath,
				fullPage: capture.fullPage,
				animations: "disabled",
				caret: "hide",
			});
			artifacts.push({
				kind: capture.kind,
				route: capture.route,
				locale: capture.locale,
				surface: capture.surface,
				viewport: capture.viewport,
				width: capture.dimensions.width,
				height: capture.dimensions.height,
				fullPage: capture.fullPage,
				reducedMotion: capture.reducedMotion,
				composition: capture.composition,
				sceneMarkers: capture.sceneMarkers,
				file: capture.relativeFile.replaceAll("\\", "/"),
			});
			process.stdout.write(`${artifacts.length}/${plan.length} ${capture.kind} ${capture.viewport} ${capture.route}\n`);
		}
	} finally {
		await Promise.all([...sessions.values()].map(({ context }) => context.close()));
		await browser.close();
	}
	const manifest = {
		schemaVersion: 1,
		baseUrl,
		counts: { firstView: 112, fullPage: 24, reducedMotion: 20, total: 156 },
		artifacts,
	};
	await mkdir(outputRoot, { recursive: true });
	await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	await writeFile(path.join(outputRoot, "index.html"), renderContactIndex(manifest), "utf8");
	process.stdout.write(`Site 06 visual matrix complete: ${artifacts.length} artifacts at ${outputRoot}\n`);
	return manifest;
}

function isDirectExecution() {
	return typeof process.argv[1] === "string" && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectExecution()) {
	try {
		await runVisualMatrix(parseCliArgs(process.argv.slice(2)));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
