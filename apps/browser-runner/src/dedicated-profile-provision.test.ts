import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Locator, Page } from "playwright";
import { assertDedicatedProfileReady } from "./dedicated-profile.js";
import { provisionDedicatedDoubaoProfile } from "./dedicated-profile-provision.js";
import type { PersistentContextLaunchOptions } from "./sandbox-preflight.js";

test("provisioning waits for a human-authenticated page before marking a sandboxed dedicated profile ready", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-profile-provision-"));
	const priorSelector = process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
	process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = "[data-authenticated]";
	let gotoUrl = "";
	let waitCalls = 0;
	let clickCalls = 0;
	let launchOptions: PersistentContextLaunchOptions | undefined;
	const authenticated = {
		async waitFor() {
			waitCalls += 1;
		},
		async count() {
			return 1;
		},
		async isVisible() {
			return true;
		},
		async click() {
			clickCalls += 1;
		},
	} as unknown as Locator;
	const page = {
		async goto(url: string) {
			gotoUrl = url;
		},
		locator() {
			return authenticated;
		},
		getByRole() {
			return {
				async isVisible() {
					return false;
				},
			} as unknown as Locator;
		},
	} as unknown as Page;
	const context = {
		pages: () => [page],
		async close() {},
	} as unknown as BrowserContext;
	try {
		const profileDirectory = await provisionDedicatedDoubaoProfile(
			stateDirectory,
			async (_profileDirectory: string, options: PersistentContextLaunchOptions) => {
				launchOptions = options;
				return context;
			},
		);
		assert.equal(launchOptions?.headless, false);
		assert.equal(launchOptions?.chromiumSandbox, true);
		assert.equal(gotoUrl, "https://www.doubao.com/chat/");
		assert.equal(waitCalls, 1);
		assert.equal(clickCalls, 0);
		await assert.doesNotReject(assertDedicatedProfileReady(profileDirectory));
	} finally {
		if (priorSelector === undefined) delete process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
		else process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = priorSelector;
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("provisioning never marks a profile ready when the positive authenticated marker is absent", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-profile-provision-fail-"));
	const priorSelector = process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
	process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = "[data-authenticated]";
	const page = {
		async goto() {},
		locator() {
			return {
				async waitFor() {
					throw new Error("timeout");
				},
				async count() {
					return 0;
				},
				async isVisible() {
					return false;
				},
			} as unknown as Locator;
		},
	} as unknown as Page;
	const context = {
		pages: () => [page],
		async close() {},
	} as unknown as BrowserContext;
	try {
		await assert.rejects(
			provisionDedicatedDoubaoProfile(stateDirectory, async () => context),
			(error: unknown) =>
				error instanceof Error && "code" in error && error.code === "dedicated_profile_not_authenticated",
		);
	} finally {
		if (priorSelector === undefined) delete process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
		else process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = priorSelector;
		await rm(stateDirectory, { recursive: true, force: true });
	}
});
