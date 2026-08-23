import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
	expectNoHorizontalOverflow,
	expectNoRunningAnimations,
	expectSignalFocusVisible,
	runWcagAa,
} from "./helpers/core-site";

const SUPPORTING_VIEWPORTS = {
	wide: { width: 1440, height: 900 },
	desktop: { width: 1024, height: 768 },
	tablet: { width: 768, height: 1024 },
	mobile: { width: 390, height: 844 },
	narrow: { width: 320, height: 740 },
	micro: { width: 280, height: 653 },
} as const;

const resourceLinks = [
	["Research notes", "/research"],
	["Open-source documentation", "/docs"],
	["Glossary", "/glossary"],
	["Status", "/status"],
	["Brand", "/brand"],
	["Open source", "/open-source"],
] as const;

const sourceLinks = [
	["Yonaris repository", "https://github.com/Blackdcp/yonaris"],
	["Elmo upstream", "https://github.com/elmohq/elmo"],
	["MIT license notice", "https://github.com/Blackdcp/yonaris/blob/main/LICENSE.md"],
	["Open-source documentation", "/docs"],
] as const;

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const visualRoot = path.join(e2eRoot, "test-results-www", "visual-qa");

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => !(window as Window & { $_TSR?: unknown }).$_TSR);
}

async function expectMinimumTarget(locator: Locator): Promise<void> {
	const box = await locator.boundingBox();
	expect(box, "interactive target should have a measurable box").toBeTruthy();
	expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
	expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

async function captureSupporting(page: Page, route: string, viewport: "wide" | "mobile" | "micro") {
	await page.setViewportSize(SUPPORTING_VIEWPORTS[viewport]);
	await page.goto(route);
	await waitForHydration(page);
	const expectedHeading =
		route === "/resources" ? "A field index for reading the market." : "Infrastructure, not identity.";
	await expect(page.getByRole("heading", { level: 1, name: expectedHeading, exact: true })).toBeVisible();
	const id = createHash("sha256").update(`${route}:${viewport}`).digest("hex").slice(0, 12);
	await mkdir(visualRoot, { recursive: true });
	await page.screenshot({
		animations: "disabled",
		caret: "hide",
		fullPage: true,
		path: path.join(visualRoot, `supporting-${route.slice(1).replaceAll("/", "-")}-${viewport}-${id}.png`),
	});
}

test("Resources is one semantic editorial index with the six approved destinations", async ({ page }) => {
	await page.goto("/resources");
	await waitForHydration(page);

	await expect(page.locator("main")).toHaveCount(1);
	await expect(page.getByRole("heading", { level: 1, name: "A field index for reading the market." })).toHaveCount(1);
	await expect(page.locator("main h1")).toHaveCount(1);
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", "/resources");
	await expect(page.locator('head link[rel="alternate"]')).toHaveCount(0);
	const index = page.locator(".resources-index");
	await expect(index.locator(":scope > li")).toHaveCount(6);
	for (const [label, href] of resourceLinks) {
		await expect(index.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
	}
	await expect(page.locator(".resources-page")).not.toHaveCSS("background-image", /gradient/i);
	await expect(index.locator(":scope > li").first()).toHaveCSS("border-radius", "0px");
});

test("Open Source separates infrastructure compatibility from Yonaris identity and promise", async ({ page }) => {
	await page.setViewportSize(SUPPORTING_VIEWPORTS.wide);
	await page.goto("/open-source");
	await waitForHydration(page);

	await expect(page.locator("main")).toHaveCount(1);
	await expect(page.getByRole("heading", { level: 1, name: "Infrastructure, not identity." })).toHaveCount(1);
	await expect(page.locator("main h1")).toHaveCount(1);
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute("href", "/open-source");
	await expect(page.locator('head link[rel="alternate"]')).toHaveCount(0);
	await expect(page.getByText(/uses and extends Elmo-compatible infrastructure/i)).toBeVisible();
	await expect(page.getByText(/does not define the Yonaris company/i)).toBeVisible();
	await expect(page.getByText(/not a Yonaris product promise/i)).toBeVisible();
	for (const identifier of [
		"@elmohq/cli",
		"elmo",
		"~/.elmo",
		"elmo.yaml",
		"elmohq/elmo-*",
		"ELMO_ENCRYPTION_KEY",
		"ELMO_ENCRYPTION_KEY_OLD",
	]) {
		await expect(page.getByText(identifier, { exact: true })).toBeVisible();
	}
	for (const [label, href] of sourceLinks) {
		await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
	}
	const sourceRows = page.locator(".open-source-sources li");
	const firstSourceBox = await sourceRows.nth(0).boundingBox();
	const secondSourceBox = await sourceRows.nth(1).boundingBox();
	expect(firstSourceBox, "the first source row should be measurable").toBeTruthy();
	expect(secondSourceBox, "the second source row should be measurable").toBeTruthy();
	expect(secondSourceBox?.y ?? 0, "primary sources must form one vertical editorial ledger").toBeGreaterThanOrEqual(
		(firstSourceBox?.y ?? 0) + (firstSourceBox?.height ?? 0) - 1,
	);
	await expect(page.locator("main")).not.toContainText(/\bstars?\b|\busers?\b|roadmap/i);
	await expect(page.locator(".open-source-page")).not.toHaveCSS("background-image", /gradient/i);
});

test("supporting pages meet the complete width, accessibility, overflow, and target matrix", async ({ page }) => {
	test.setTimeout(240_000);
	for (const viewport of Object.values(SUPPORTING_VIEWPORTS)) {
		await page.setViewportSize(viewport);
		for (const route of ["/resources", "/open-source"] as const) {
			await page.goto(route);
			await waitForHydration(page);
			await expectNoHorizontalOverflow(page);
			await runWcagAa(page);
			const links = page.locator("main a");
			for (let index = 0; index < (await links.count()); index += 1) {
				await expectMinimumTarget(links.nth(index));
			}
		}
	}
});

test("supporting page links expose a visible Signal focus edge", async ({ page }) => {
	await page.setViewportSize(SUPPORTING_VIEWPORTS.desktop);
	await page.goto("/resources");
	await waitForHydration(page);
	await expectSignalFocusVisible(page, page.getByRole("link", { name: "Research notes", exact: true }));

	await page.goto("/open-source");
	await waitForHydration(page);
	await expectSignalFocusVisible(page, page.getByRole("link", { name: "Yonaris repository", exact: true }));
});

test("supporting pages leave no running motion under reduced motion", async ({ page }) => {
	for (const route of ["/resources", "/open-source"] as const) {
		await expectNoRunningAnimations(page, route);
	}
});

for (const route of ["/resources", "/open-source"] as const) {
	for (const viewport of ["wide", "mobile", "micro"] as const) {
		test(`${route} ${viewport} visual evidence`, { tag: "@visual" }, async ({ page }) => {
			await captureSupporting(page, route, viewport);
		});
	}
}
