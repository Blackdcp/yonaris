#!/usr/bin/env node

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");

export const CINEMATIC_PHOTO_SELECTOR = '[data-scene-object="cinematic-field"] > img.site-06-cinematic__media';

export const BINDING_SOURCE_PATH = "E:/Yonaris/.superpowers/brainstorm/1950-1787739192/content/site-system-multipage-agent-06.html";
export const EXPECTED_BINDING_SHA256 = "e26b204b528481ddd3274d4a546f1a9acd02a0f7f5e94de80b1070a1d05b46da";

export const REFERENCE_VIEWS = [
	{ sourceView: "en-home-page", preview: "english", productionRoute: "/", locale: "en", sourceScene: "English cinematic home and evidence sheet" },
	{ sourceView: "en-platform-page", preview: "english", productionRoute: "/product", locale: "en", sourceScene: "English platform trace document" },
	{ sourceView: "en-work-page", preview: "english", productionRoute: "/approach", locale: "en", sourceScene: "English evidence comparison" },
	{ sourceView: "en-human-agent-page", preview: "english", productionRoute: "/company", locale: "en", sourceScene: "English dual reading" },
	{ sourceView: "en-contact-page", preview: "english", productionRoute: "/diagnostic", locale: "en", sourceScene: "English contact cinematic" },
	{ sourceView: "zh-home-page", preview: "chinese", productionRoute: "/zh", locale: "zh", sourceScene: "Chinese cinematic anxiety composition" },
	{ sourceView: "zh-delivery-page", preview: "chinese", productionRoute: "/zh/product", locale: "zh", sourceScene: "Chinese six-node delivery field" },
	{ sourceView: "zh-practice-page", preview: "chinese", productionRoute: "/zh/approach", locale: "zh", sourceScene: "Chinese breakdown replay" },
	{ sourceView: "zh-contact-page", preview: "chinese", productionRoute: "/zh/diagnostic", locale: "zh", sourceScene: "Chinese contact cinematic" },
	{ sourceView: "agent", preview: "agent", productionRoute: "/agent", locale: "en", sourceScene: "Agent fact directory" },
];

const prototypeMappings = {
	"/": { relationship: "direct", sourceView: "en-home-page", sourceScene: "cinematic home, evidence sheet, Human/Agent reading" },
	"/product": { relationship: "direct", sourceView: "en-platform-page", sourceScene: "platform trace document and source relationships" },
	"/approach": { relationship: "direct", sourceView: "en-work-page", sourceScene: "fixed-question baseline/retest evidence" },
	"/company": { relationship: "direct", sourceView: "en-human-agent-page", sourceScene: "one fact with Human and Agent readings" },
	"/geo": { relationship: "derived", sourceView: "en-work-page", sourceScene: "paper-field market, language, question, and source conditions" },
	"/diagnostic": { relationship: "direct", sourceView: "en-contact-page", sourceScene: "cinematic three-field contact composition" },
	"/privacy": { relationship: "derived", sourceView: "en-contact-page", sourceScene: "three-field contact data boundary" },
	"/zh": { relationship: "direct", sourceView: "zh-home-page", sourceScene: "cinematic home, anxiety selector, public truth" },
	"/zh/product": { relationship: "direct", sourceView: "zh-delivery-page", sourceScene: "six connected system positions" },
	"/zh/approach": { relationship: "direct", sourceView: "zh-practice-page", sourceScene: "baseline, break, action, review replay" },
	"/zh/company": { relationship: "derived", sourceView: "en-human-agent-page", sourceScene: "localized dual reading plus Chinese public-truth record" },
	"/zh/geo": { relationship: "derived", sourceView: "zh-home-page", sourceScene: "localized market, language, source, and comparison conditions" },
	"/zh/diagnostic": { relationship: "direct", sourceView: "zh-contact-page", sourceScene: "cinematic three-field contact composition" },
	"/zh/privacy": { relationship: "derived", sourceView: "zh-contact-page", sourceScene: "three-field localized contact data boundary" },
};

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
		prototypeMapping: prototypeMappings[pathName],
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
			prototypeMapping: {
				relationship: pageKey === "home" && locale === "en" ? "direct" : "derived",
				sourceView: "agent",
				sourceScene:
					pageKey === "home"
						? "Agent question index, answer document, fact inspector, and directory"
						: `${locale === "zh" ? "localized " : ""}${pageKey} facts in the Agent directory composition`,
			},
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
		prototypeMapping: route.prototypeMapping,
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

export function buildReferenceCapturePlan() {
	const captures = [];
	for (const view of REFERENCE_VIEWS) {
		for (const viewport of ["1440", "1280", "390", "360"]) {
			captures.push({
				...view,
				kind: "first-view",
				viewport,
				dimensions: VIEWPORTS[viewport],
				fullPage: false,
				relativeFile: `first-view/${viewport}/${view.sourceView}.png`,
			});
		}
		for (const viewport of ["1440", "390"]) {
			captures.push({
				...view,
				kind: "full-page",
				viewport,
				dimensions: VIEWPORTS[viewport],
				fullPage: true,
				relativeFile: `full-page/${viewport}/${view.sourceView}.png`,
			});
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

export async function verifyBindingSource(sourcePath = BINDING_SOURCE_PATH) {
	const source = await readFile(sourcePath);
	const sha256 = createHash("sha256").update(source).digest("hex");
	if (sha256 !== EXPECTED_BINDING_SHA256) {
		throw new Error(`Binding source SHA-256 mismatch: expected ${EXPECTED_BINDING_SHA256}, received ${sha256}`);
	}
	return { sourcePath, sourceRoot: path.dirname(sourcePath), sha256 };
}

function contentType(filePath) {
	const extension = path.extname(filePath).toLowerCase();
	if (extension === ".html") return "text/html; charset=utf-8";
	if (extension === ".png") return "image/png";
	if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
	return "application/octet-stream";
}

export async function startReferenceServer(sourcePath = BINDING_SOURCE_PATH) {
	const binding = await verifyBindingSource(sourcePath);
	const server = createServer(async (request, response) => {
		try {
			const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
			let filePath;
			if (requestUrl.pathname === "/" || requestUrl.pathname === "/reference.html") {
				filePath = binding.sourcePath;
			} else if (requestUrl.pathname.startsWith("/files/")) {
				const relative = decodeURIComponent(requestUrl.pathname.slice("/files/".length));
				filePath = path.resolve(binding.sourceRoot, relative);
				const allowedRoot = `${path.resolve(binding.sourceRoot)}${path.sep}`;
				if (!filePath.startsWith(allowedRoot)) throw new Error("Reference asset path escaped its source directory");
			} else {
				response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
				response.end("Not found");
				return;
			}
			const fileStat = await stat(filePath);
			if (!fileStat.isFile()) throw new Error("Reference target is not a file");
			response.writeHead(200, {
				"cache-control": "no-store",
				"content-length": fileStat.size,
				"content-type": contentType(filePath),
			});
			createReadStream(filePath).pipe(response);
		} catch (error) {
			response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			response.end(error instanceof Error ? error.message : "Not found");
		}
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Reference server did not bind a TCP port");
	return {
		baseUrl: `http://127.0.0.1:${address.port}/`,
		binding,
		close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
	};
}

export function buildRouteUrl(baseUrl, route) {
	return new URL(route, baseUrl).href;
}

function invariant(value, message) {
	if (!value) throw new Error(message);
}

export function assertHumanHeaderMetrics(metrics, width) {
	invariant(metrics.visibleModes === 1, `Human header at ${width}px must expose exactly one top-level mode control; received ${metrics.visibleModes}`);
	invariant(metrics.visibleLocales === 1, `Human header at ${width}px must expose exactly one top-level locale control; received ${metrics.visibleLocales}`);
	const maximumHeight = width <= 720 ? 125 : 90;
	invariant(metrics.headerHeight <= maximumHeight, `Human header at ${width}px is ${metrics.headerHeight}px high; maximum ${maximumHeight}px`);
}

export function assertHeaderControlGeometry(controlBoxes, width) {
	if (width > 720) return;
	for (const name of ["brand", "locale", "menu"]) {
		const box = controlBoxes[name];
		invariant(Boolean(box) && box.width > 0 && box.height > 0, `Human mobile header ${name} control must have non-zero geometry`);
	}
	for (const [leftName, rightName] of [
		["brand", "locale"],
		["brand", "menu"],
		["locale", "menu"],
	]) {
		const left = controlBoxes[leftName];
		const right = controlBoxes[rightName];
		const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
		const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
		invariant(overlapWidth * overlapHeight === 0, `Human mobile header ${leftName} and ${rightName} overlap by ${overlapWidth * overlapHeight}px²`);
	}
}

export function assertSceneGeometry(metrics, route, sceneName) {
	invariant(metrics.count > 0, `${route}: missing scene ${sceneName}`);
	invariant(metrics.visible, `${route}: scene ${sceneName} is not visible`);
	invariant(metrics.width > 0 && metrics.height > 0, `${route}: scene ${sceneName} must have non-zero geometry`);
}

export async function assertSceneContract(page, route, scenes) {
	for (const scene of scenes) {
		const metrics = await page.locator(scene.selector).evaluateAll((elements) => {
			const boxes = elements.map((element) => {
				const style = getComputedStyle(element);
				const box = element.getBoundingClientRect();
				return {
					visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0,
					width: box.width,
					height: box.height,
				};
			});
			const visible = boxes.find((box) => box.visible);
			return {
				count: elements.length,
				visible: Boolean(visible),
				width: visible?.width ?? boxes[0]?.width ?? 0,
				height: visible?.height ?? boxes[0]?.height ?? 0,
			};
		});
		assertSceneGeometry(metrics, route, scene.name);
	}
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
	const metrics = await page.locator(".site-06-header").evaluate((header) => {
		const visible = (element) => {
			const style = getComputedStyle(element);
			const box = element.getBoundingClientRect();
			return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
		};
		const controls = [
			...header.querySelectorAll(".site-06-header__actions [data-mode-switch], .site-06-header__mobile-mode [data-mode-switch], .site-06-header__actions .site-06-locale, .site-06-header__mobile-locale"),
		];
		const boxFor = (selector) => {
			const box = header.querySelector(selector)?.getBoundingClientRect();
			return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : undefined;
		};
		return {
			headerHeight: header.getBoundingClientRect().height,
			visibleModes: controls.filter((element) => element.matches("[data-mode-switch]") && visible(element)).length,
			visibleLocales: controls.filter((element) => element.matches(".site-06-locale") && visible(element)).length,
			controlBoxes: {
				brand: boxFor(".site-06-brand"),
				locale: boxFor(".site-06-header__mobile-locale"),
				menu: boxFor(".site-06-menu summary"),
			},
		};
	});
	const width = await page.evaluate(() => innerWidth);
	assertHumanHeaderMetrics(metrics, width);
	assertHeaderControlGeometry(metrics.controlBoxes, width);
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
	await assertSceneContract(page, route, definition.scenes);
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

export function renderPairIndex(manifest) {
	const pairs = manifest.pairs
		.map(
			(pair, index) => `<article data-pair="${index + 1}"><h2>${pair.productionRoute} · ${pair.viewport}px · ${pair.kind}</h2><p>${pair.sourceView} → ${pair.productionRoute} · ${pair.sourceScene}</p><div class="pair"><figure data-side="reference"><figcaption>Immutable binding source</figcaption><a href="${pair.referenceFile}"><img src="${pair.referenceFile}" alt="Binding source ${pair.sourceView} ${pair.viewport}"></a></figure><figure data-side="production"><figcaption>Production route</figcaption><a href="${pair.productionFile}"><img src="${pair.productionFile}" alt="Production ${pair.productionRoute} ${pair.viewport}"></a></figure></div></article>`,
		)
		.join("\n");
	return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Site 06 source versus production pairs</title><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#071724;color:#fbf8f1;font:13px system-ui}header{position:sticky;top:0;z-index:2;padding:10px 0;background:#071724}h1{margin:0;font-size:22px}header p,article>p{color:#b9c2c9}article{margin:18px 0;padding:14px;border:1px solid #43515d;background:#0d2232}h2{margin:0 0 4px;font-size:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;min-width:0}figcaption{padding:6px 0;color:#f0c49e}img{display:block;width:100%;height:300px;object-fit:contain;object-position:top;background:#050d14;border:1px solid #43515d}</style><header><h1>Binding source vs production · ${manifest.pairs.length} same-width pairs</h1><p>Binding SHA-256 ${manifest.bindingSha256}</p></header>${pairs}</html>`;
}

async function settleReferenceLayout(page) {
	await page.waitForFunction(() => document.fonts.status === "loaded" && [...document.images].every((image) => image.complete));
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		window.scrollTo(0, 0);
	});
}

async function activateReferenceView(page, capture) {
	if (capture.sourceView === "agent") return;
	const target = page.locator(`[data-site-page-target="${capture.sourceView}"]`).first();
	invariant((await target.count()) === 1, `Binding source is missing view control ${capture.sourceView}`);
	await target.click();
	const active = page.locator(`.view.active > .site-page.active[data-site-page="${capture.sourceView}"]`);
	await assertVisible(active, `Binding source view ${capture.sourceView}`);
	const box = await active.boundingBox();
	invariant(Boolean(box) && box.width > 0 && box.height > 0, `Binding source view ${capture.sourceView} has zero geometry`);
}

export async function runVisualMatrix({ baseUrl, output }) {
	const chromium = loadPlaywrightChromium();
	const referenceServer = await startReferenceServer();
	const browser = await chromium.launch({ headless: true });
	const outputRoot = path.resolve(repositoryRoot, output);
	const plan = buildCapturePlan();
	const artifacts = [];
	const sessions = new Map();
	const referenceSessions = new Map();
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
				prototypeMapping: capture.prototypeMapping,
				file: capture.relativeFile.replaceAll("\\", "/"),
			});
			process.stdout.write(`${artifacts.length}/${plan.length} ${capture.kind} ${capture.viewport} ${capture.route}\n`);
		}

		invariant(artifacts.length === 156, `Production matrix must remain exactly 156 artifacts; received ${artifacts.length}`);
		const manifest = {
			schemaVersion: 2,
			baseUrl,
			counts: { firstView: 112, fullPage: 24, reducedMotion: 20, total: 156 },
			artifacts,
		};
		await mkdir(outputRoot, { recursive: true });
		await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
		await writeFile(path.join(outputRoot, "index.html"), renderContactIndex(manifest), "utf8");

		const referenceArtifacts = [];
		const referencePlan = buildReferenceCapturePlan();
		for (const capture of referencePlan) {
			let session = referenceSessions.get(capture.viewport);
			if (!session) {
				const context = await browser.newContext({
					viewport: capture.dimensions,
					deviceScaleFactor: 1,
					colorScheme: "light",
					reducedMotion: "no-preference",
				});
				session = { context, page: await context.newPage() };
				referenceSessions.set(capture.viewport, session);
			}
			const sourceUrl = new URL("reference.html", referenceServer.baseUrl);
			sourceUrl.searchParams.set("preview", capture.preview);
			const response = await session.page.goto(sourceUrl.href, { waitUntil: "domcontentloaded" });
			invariant(response?.status() === 200, `${capture.sourceView}: binding source returned ${response?.status() ?? "no response"}`);
			await settleReferenceLayout(session.page);
			await activateReferenceView(session.page, capture);
			await settleReferenceLayout(session.page);
			if (capture.sourceView === "agent") {
				const agentRoot = session.page.locator("#agent.view.active");
				await assertVisible(agentRoot, "Binding source Agent view");
				const box = await agentRoot.boundingBox();
				invariant(Boolean(box) && box.width > 0 && box.height > 0, "Binding source Agent view has zero geometry");
			}
			const relativeFile = `reference/${capture.relativeFile}`;
			const artifactPath = path.join(outputRoot, relativeFile);
			await mkdir(path.dirname(artifactPath), { recursive: true });
			await session.page.screenshot({
				path: artifactPath,
				fullPage: capture.fullPage,
				animations: "disabled",
				caret: "hide",
			});
			referenceArtifacts.push({
				kind: capture.kind,
				sourceView: capture.sourceView,
				preview: capture.preview,
				productionRoute: capture.productionRoute,
				locale: capture.locale,
				viewport: capture.viewport,
				width: capture.dimensions.width,
				height: capture.dimensions.height,
				fullPage: capture.fullPage,
				sourceScene: capture.sourceScene,
				file: relativeFile.replaceAll("\\", "/"),
			});
			process.stdout.write(`${referenceArtifacts.length}/${referencePlan.length} reference ${capture.kind} ${capture.viewport} ${capture.sourceView}\n`);
		}

		const referenceManifest = {
			schemaVersion: 1,
			bindingSourcePath: referenceServer.binding.sourcePath.replaceAll("\\", "/"),
			bindingSha256: referenceServer.binding.sha256,
			counts: { firstView: 40, fullPage: 20, total: 60 },
			artifacts: referenceArtifacts,
		};
		const pairs = referenceArtifacts.map((reference) => {
			const production = artifacts.find(
				(artifact) =>
					artifact.route === reference.productionRoute &&
					artifact.kind === reference.kind &&
					artifact.viewport === reference.viewport,
			);
			invariant(Boolean(production), `Missing production pair for ${reference.sourceView} ${reference.kind} ${reference.viewport}`);
			return {
				kind: reference.kind,
				viewport: reference.viewport,
				width: reference.width,
				sourceView: reference.sourceView,
				sourceScene: reference.sourceScene,
				productionRoute: reference.productionRoute,
				referenceFile: `../${reference.file}`,
				productionFile: `../${production.file}`,
				prototypeMapping: production.prototypeMapping,
			};
		});
		const pairManifest = {
			schemaVersion: 1,
			bindingSha256: referenceServer.binding.sha256,
			count: pairs.length,
			pairs,
			contactSheetFile: "reference-pairs/contact-sheet.png",
		};
		const pairRoot = path.join(outputRoot, "reference-pairs");
		const pairIndexPath = path.join(pairRoot, "index.html");
		await mkdir(pairRoot, { recursive: true });
		await writeFile(path.join(outputRoot, "reference-manifest.json"), `${JSON.stringify(referenceManifest, null, 2)}\n`, "utf8");
		await writeFile(path.join(outputRoot, "pair-manifest.json"), `${JSON.stringify(pairManifest, null, 2)}\n`, "utf8");
		await writeFile(pairIndexPath, renderPairIndex(pairManifest), "utf8");

		await Promise.all([...sessions.values()].map(({ context }) => context.close()));
		sessions.clear();
		await Promise.all([...referenceSessions.values()].map(({ context }) => context.close()));
		referenceSessions.clear();
		const reviewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
		await reviewPage.goto(pathToFileURL(pairIndexPath).href, { waitUntil: "load" });
		await reviewPage.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 120_000 });
		await reviewPage.screenshot({
			path: path.join(pairRoot, "contact-sheet.png"),
			fullPage: true,
			animations: "disabled",
			caret: "hide",
		});
		await reviewPage.close();
		process.stdout.write(`Site 06 visual matrix complete: 156 production + 60 binding reference artifacts at ${outputRoot}\n`);
		return manifest;
	} finally {
		await Promise.all([...sessions.values()].map(({ context }) => context.close()));
		await Promise.all([...referenceSessions.values()].map(({ context }) => context.close()));
		await browser.close();
		await referenceServer.close();
	}
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
