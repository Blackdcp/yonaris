import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { QA_VIEWPORTS } from "./helpers/core-site";

const BASELINE_REVISION = "4e3ad82a58bfe5b19450b1de01104f5e0bce0074";
const PROTECTED_PATHS = [
	"apps/www/src",
	"apps/www/public",
	"apps/www/package.json",
	"apps/www/vite.config.ts",
	"e2e/playwright.www.config.ts",
	"e2e/www-tests/helpers/core-site.ts",
] as const;
const PROTECTED_PATH_EXCLUDES = [
	":(exclude)apps/www/src/components/site/zh-cn-legacy-freeze.test.tsx",
] as const;
const ROUTES = [
	{ key: "home", path: "/zh", mainClass: "home-page" },
	{ key: "product", path: "/zh/product", mainClass: "product-page" },
	{ key: "approach", path: "/zh/approach", mainClass: "approach-page" },
	{ key: "research", path: "/zh/research", mainClass: "research-page" },
	{ key: "company", path: "/zh/company", mainClass: "company-page" },
	{ key: "geo", path: "/zh/geo", mainClass: "geo-page" },
	{ key: "diagnostic", path: "/zh/diagnostic", mainClass: "diagnostic-page" },
] as const;
const REQUEST_KEYS = [
	"locale",
	"website",
	"brand",
	"market",
	"question",
	"competitors",
	"name",
	"email",
	"consent",
	"companyUrl",
] as const;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const fixturePath = fileURLToPath(new URL("./fixtures/zh-cn-legacy/dom-text.v1.json", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const updateSnapshotsRequested = process.argv.some((argument) =>
	/^(?:-u|--update-snapshots)(?:=|$)/u.test(argument),
);
const generationIntent =
	process.env.ZH_CN_BASELINE_WRITE !== undefined ||
	process.env.ZH_CN_BASELINE_REVISION !== undefined ||
	updateSnapshotsRequested;
const generating =
	process.env.ZH_CN_BASELINE_WRITE === "1" && process.env.ZH_CN_BASELINE_REVISION === BASELINE_REVISION;

interface RouteContract {
	path: string;
	lang: string;
	mainClass: string;
	mainText: string;
	headings: Array<{ level: number; id: string; text: string; ariaLabel: string }>;
	sections: Array<{
		path: string;
		id: string;
		className: string;
		ariaLabel: string;
		ariaLabelledby: string;
	}>;
	links: Array<{
		scope: "header" | "main" | "footer";
		text: string;
		href: string;
		ariaLabel: string;
		lang: string;
	}>;
	forms: Array<{
		path: string;
		action: string;
		method: string;
		controls: Array<{
			tag: string;
			type: string;
			name: string;
			id: string;
			valueAttribute: string;
			required: boolean;
			disabled: boolean;
			tabIndex: number;
		}>;
	}>;
	dataAttributes: Array<{
		path: string;
		attributes: Array<{ name: string; value: string }>;
	}>;
	seo: {
		canonicals: string[];
		alternates: Array<{ hrefLang: string; href: string }>;
	};
}

interface DiagnosticContract {
	scopeFields: string[];
	contactFields: string[];
	honeypotField: string;
	privacyHref: string;
	request: {
		method: string;
		path: string;
		contentType: string;
		keys: string[];
		locale: string;
		valueTypes: Record<string, string>;
		idempotencyKeyFormat: "uuid-v4";
	};
}

interface ChineseBaseline {
	schemaVersion: 1;
	revision: string;
	normalization: "unicode-nfkc-whitespace-v1";
	routes: Record<(typeof ROUTES)[number]["key"], RouteContract>;
	diagnosticV1: DiagnosticContract;
}

function assertGenerationEnvironment(environment: NodeJS.ProcessEnv): void {
	if (environment.ZH_CN_BASELINE_WRITE !== "1") {
		throw new Error("Baseline generation requires ZH_CN_BASELINE_WRITE=1");
	}
	if (environment.ZH_CN_BASELINE_REVISION !== BASELINE_REVISION) {
		throw new Error(`Baseline generation requires the full pinned revision ${BASELINE_REVISION}`);
	}
}

function assertRevisionGuard(): void {
	try {
		execFileSync(
			"git",
			["diff", "--exit-code", BASELINE_REVISION, "--", ...PROTECTED_PATHS, ...PROTECTED_PATH_EXCLUDES],
			{
			cwd: repositoryRoot,
			stdio: "pipe",
			},
		);
	} catch {
		throw new Error(`Protected website files differ from pinned revision ${BASELINE_REVISION}; refusing baseline write`);
	}
}

function assertGenerationAuthorized(): void {
	assertGenerationEnvironment(process.env);
	assertRevisionGuard();
}

function readBaseline(): ChineseBaseline {
	return JSON.parse(readFileSync(fixturePath, "utf8")) as ChineseBaseline;
}

async function settle(page: Page): Promise<void> {
	await page.waitForLoadState("domcontentloaded");
	await page.waitForFunction(
		() => document.fonts.status === "loaded" && !(window as Window & { $_TSR?: unknown }).$_TSR,
	);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	});
}

async function openRoute(page: Page, path: string, mainClass: string): Promise<void> {
	await page.goto(path, { waitUntil: "domcontentloaded" });
	await expect(page.locator('.site-shell[lang="zh-CN"]')).toHaveCount(1);
	await expect(page.locator("header.site-header")).toHaveCount(1);
	await expect(page.locator(`main.${mainClass}`)).toHaveCount(1);
	await expect(page.locator("footer.site-footer")).toHaveCount(1);
	await expect(page.locator("main h1")).toHaveCount(1);
	await settle(page);
}

async function captureRoute(page: Page, path: string, mainClass: string): Promise<RouteContract> {
	await openRoute(page, path, mainClass);
	return page.evaluate(({ expectedPath }) => {
		const normalize = (value: string | null | undefined) =>
			(value ?? "")
				.normalize("NFKC")
				.replace(/\s+/gu, " ")
				.trim();
		const shell = document.querySelector<HTMLElement>(".site-shell");
		const main = document.querySelector<HTMLElement>("main");
		if (!shell || !main) throw new Error("Chinese site shell/main is missing");
		const elementPath = (element: Element, root: Element): string => {
			if (element === root) return root.tagName.toLowerCase();
			const segments: string[] = [];
			let current: Element | null = element;
			while (current && current !== root) {
				const parent: Element | null = current.parentElement;
				if (!parent) break;
				const tag = current.tagName.toLowerCase();
				const siblings = Array.from(parent.children).filter((candidate) => candidate.tagName === current?.tagName);
				const position = siblings.indexOf(current) + 1;
				segments.unshift(current.id ? `${tag}#${current.id}` : `${tag}:nth-of-type(${position})`);
				current = parent;
			}
			return `${root.tagName.toLowerCase()}>${segments.join(">")}`;
		};
		const headings = Array.from(main.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).map((heading) => ({
			level: Number(heading.tagName.slice(1)),
			id: heading.id,
			text: normalize(heading.innerText),
			ariaLabel: heading.getAttribute("aria-label") ?? "",
		}));
		const sections = Array.from(main.querySelectorAll<HTMLElement>("section")).map((section) => ({
			path: elementPath(section, main),
			id: section.id,
			className: section.getAttribute("class") ?? "",
			ariaLabel: section.getAttribute("aria-label") ?? "",
			ariaLabelledby: section.getAttribute("aria-labelledby") ?? "",
		}));
		const roots = [
			["header", document.querySelector<HTMLElement>("header.site-header")],
			["main", main],
			["footer", document.querySelector<HTMLElement>("footer.site-footer")],
		] as const;
		const links = roots.flatMap(([scope, root]) =>
			root
				? Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).map((link) => ({
						scope,
						text: normalize(link.innerText),
						href: link.getAttribute("href") ?? "",
						ariaLabel: link.getAttribute("aria-label") ?? "",
						lang: link.getAttribute("lang") ?? "",
					}))
				: [],
		);
		const forms = Array.from(main.querySelectorAll<HTMLFormElement>("form")).map((form) => ({
			path: elementPath(form, main),
			action: form.getAttribute("action") ?? "",
			method: (form.getAttribute("method") ?? "get").toLowerCase(),
			controls: Array.from(
				form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(
					"input,textarea,select,button",
				),
			).map((control) => ({
				tag: control.tagName.toLowerCase(),
				type: control instanceof HTMLInputElement || control instanceof HTMLButtonElement ? control.type : "",
				name: control.getAttribute("name") ?? "",
				id: control.id,
				valueAttribute: control.getAttribute("value") ?? "",
				required: control.hasAttribute("required"),
				disabled: control.hasAttribute("disabled"),
				tabIndex: control.tabIndex,
			})),
		}));
		const dataAttributes = [main, ...Array.from(main.querySelectorAll<HTMLElement>("*"))]
			.map((element) => ({
				path: elementPath(element, main),
				attributes: element
					.getAttributeNames()
					.filter((name) => name.startsWith("data-"))
					.sort()
					.map((name) => ({ name, value: element.getAttribute(name) ?? "" })),
			}))
			.filter(({ attributes }) => attributes.length > 0);
		return {
			path: expectedPath,
			lang: shell.lang,
			mainClass: main.getAttribute("class") ?? "",
			mainText: normalize(main.innerText),
			headings,
			sections,
			links,
			forms,
			dataAttributes,
			seo: {
				canonicals: Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')).map(
					(link) => link.getAttribute("href") ?? "",
				),
				alternates: Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')).map(
					(link) => ({ hrefLang: link.getAttribute("hreflang") ?? "", href: link.getAttribute("href") ?? "" }),
				),
			},
		};
	}, { expectedPath: path });
}

async function captureDiagnostic(page: Page): Promise<DiagnosticContract> {
	await openRoute(page, "/zh/diagnostic", "diagnostic-page");
	const stageFields = () =>
		page
			.locator(".diagnostic-fields [name]")
			.evaluateAll((controls) => controls.map((control) => control.getAttribute("name") ?? ""));
	const scopeFields = await stageFields();
	const honeypotField = await page.locator(".diagnostic-honeypot input").getAttribute("name");
	const privacyHref = await page.locator(".diagnostic-privacy a").getAttribute("href");
	await page.locator("#diagnostic-website").fill("https://example.invalid");
	await page.locator("#diagnostic-brand").fill("示例品牌");
	await page.locator("#diagnostic-market").fill("中国");
	await page.locator("#diagnostic-question").fill("目标受众如何理解这个品牌？");
	await page.locator(".diagnostic-form button[type=submit]").click();
	await expect(page.locator("#diagnostic-competitors")).toBeVisible();
	const contactFields = await stageFields();
	await page.locator("#diagnostic-competitors").fill("示例对手");
	await page.locator("#diagnostic-name").fill("测试联系人");
	await page.locator("#diagnostic-email").fill("baseline@example.invalid");
	await page.locator("#diagnostic-consent").check();
	await page.route("**/api/diagnostic", async (route) => {
		await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) });
	});
	const requestPromise = page.waitForRequest(
		(request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/diagnostic",
	);
	await page.locator(".diagnostic-form button[type=submit]").click();
	const request = await requestPromise;
	const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
	const keys = Object.keys(body);
	const headers = request.headers();
	const contentType = headers["content-type"] ?? "";
	const idempotencyKey = headers["idempotency-key"] ?? "";
	expect(scopeFields).toEqual(["website", "brand", "market", "question"]);
	expect(contactFields).toEqual(["competitors", "name", "email", "consent"]);
	expect(honeypotField).toBe("companyUrl");
	expect(privacyHref).toBe("/privacy");
	expect(keys).toEqual(REQUEST_KEYS);
	expect(body.locale).toBe("zh");
	expect(body.consent).toBe(true);
	expect(contentType).toBe("application/json");
	expect(idempotencyKey).toMatch(UUID_V4);
	return {
		scopeFields,
		contactFields,
		honeypotField: honeypotField ?? "",
		privacyHref: privacyHref ?? "",
		request: {
			method: request.method(),
			path: new URL(request.url()).pathname,
			contentType,
			keys,
			locale: String(body.locale),
			valueTypes: Object.fromEntries(keys.map((key) => [key, typeof body[key]])),
			idempotencyKeyFormat: "uuid-v4",
		},
	};
}

async function screenshot(locator: Locator, name: string, testInfo: TestInfo): Promise<void> {
	if (!generating) {
		expect(existsSync(testInfo.snapshotPath(name)), `Missing ${name}; use the guarded baseline generator`).toBe(true);
	}
	await expect(locator).toHaveScreenshot(name, { animations: "disabled", caret: "hide", scale: "css" });
}

test.describe.configure({ mode: "serial" });
test.use({
	locale: "zh-CN",
	timezoneId: "Asia/Shanghai",
	colorScheme: "light",
	deviceScaleFactor: 1,
	...({ reducedMotion: "reduce" as const }),
});

test.describe("zh-CN legacy freeze", () => {
	test.beforeAll(({}, testInfo) => {
		const resolvedSnapshotMutation =
			testInfo.config.updateSnapshots === "all" || testInfo.config.updateSnapshots === "changed";
		if (generationIntent || resolvedSnapshotMutation) assertGenerationAuthorized();
	});
	test("generation requires write=1 and the exact full revision", () => {
		expect(() => assertGenerationEnvironment({})).toThrow("ZH_CN_BASELINE_WRITE=1");
		expect(() =>
			assertGenerationEnvironment({ ZH_CN_BASELINE_WRITE: "1", ZH_CN_BASELINE_REVISION: "4e3ad82a" }),
		).toThrow("full pinned revision");
	});

	test("matches normalized DOM text, ordered structure, metadata, and diagnostic v1", async ({ page }) => {
		const routes = {} as ChineseBaseline["routes"];
		for (const route of ROUTES) routes[route.key] = await captureRoute(page, route.path, route.mainClass);
		const captured: ChineseBaseline = {
			schemaVersion: 1,
			revision: BASELINE_REVISION,
			normalization: "unicode-nfkc-whitespace-v1",
			routes,
			diagnosticV1: await captureDiagnostic(page),
		};
		if (generating) {
			assertGenerationAuthorized();
			writeFileSync(fixturePath, `${JSON.stringify(captured, null, "\t")}\n`, "utf8");
			return;
		}
		expect(captured).toEqual(readBaseline());
	});

	for (const route of ROUTES) {
		for (const viewportName of ["desktop", "mobile"] as const) {
			test(`${route.path} main matches ${viewportName}`, async ({ page }, testInfo) => {
				await page.setViewportSize(QA_VIEWPORTS[viewportName]);
				await openRoute(page, route.path, route.mainClass);
				await screenshot(page.locator("main"), `zh-cn-${route.key}-main-${viewportName}.png`, testInfo);
			});
		}
	}

	for (const viewportName of ["desktop", "mobile"] as const) {
		test(`/zh header matches ${viewportName}`, async ({ page }, testInfo) => {
			await page.setViewportSize(QA_VIEWPORTS[viewportName]);
			await openRoute(page, "/zh", "home-page");
			await screenshot(page.locator("header.site-header"), `zh-cn-home-header-${viewportName}.png`, testInfo);
		});
	}
});
