#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const requireFromE2e = createRequire(path.join(repositoryRoot, "e2e/package.json"));
const { chromium } = requireFromE2e("@playwright/test");
const suppliedBaseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const baseUrl = new URL(suppliedBaseUrl);
assert.equal(baseUrl.protocol, "http:");
assert.ok(["127.0.0.1", "localhost"].includes(baseUrl.hostname));

const cases = [
	{
		path: "/diagnostic",
		privacyHeading: "Ask Yonaris to review a previous contact request.",
		consultationHeading: "Tell us where we should reach you.",
	},
	{
		path: "/zh/diagnostic",
		privacyHeading: "请 Yonaris 核对此前的联系申请。",
		consultationHeading: "怎么联系你？",
	},
];

const hydrationPattern = /hydration|hydrating|server rendered html|didn't match|does not match/iu;
const browser = await chromium.launch({ headless: true });
try {
	for (const testCase of cases) {
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		const failures = { initial: [], reload: [] };
		let phase = "initial";
		page.on("pageerror", (error) => failures[phase].push(`pageerror: ${error.message}`));
		page.on("console", (message) => {
			if (message.type() === "error" && hydrationPattern.test(message.text())) {
				failures[phase].push(`console: ${message.text()}`);
			}
		});

		await page.goto(new URL(`${testCase.path}?intent=privacy`, baseUrl).href);
		await page.waitForFunction(
			(pathName) =>
				location.pathname === pathName &&
				location.search === "" &&
				history.state?.__yonarisDiagnosticIntent === "privacy" &&
				!window.$_TSR,
			testCase.path,
		);
		await page.getByRole("heading", { level: 1, name: testCase.privacyHeading, exact: true }).waitFor();
		assert.equal(await page.locator("form [data-lead-field]").count(), 3);
		assert.equal(await page.locator('form input[name="requestType"]').inputValue(), "privacy");
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
		assert.deepEqual(failures.initial, [], `${testCase.path} emitted hydration failures on the initial privacy-query load`);

		phase = "reload";
		await page.reload();
		await page.waitForFunction(() => !window.$_TSR);
		await page.getByRole("heading", { level: 1, name: testCase.privacyHeading, exact: true }).waitFor();
		assert.equal(await page.locator("form [data-lead-field]").count(), 3);
		assert.equal(await page.locator('form input[name="requestType"]').inputValue(), "privacy");
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
		assert.deepEqual(failures.reload, [], `${testCase.path} emitted hydration failures after a queryless privacy reload`);

		await page.close();

		const directPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		await directPage.goto(new URL(testCase.path, baseUrl).href);
		await directPage.waitForFunction(() => !window.$_TSR);
		await directPage.getByRole("heading", { level: 2, name: testCase.consultationHeading, exact: true }).waitFor();
		assert.equal(await directPage.locator('form input[name="requestType"]').inputValue(), "consultation");
		await directPage.close();
		process.stdout.write(`${testCase.path}: privacy reload hydrates cleanly; direct route remains consultation\n`);
	}
} finally {
	await browser.close();
}
