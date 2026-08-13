import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Page } from "playwright";
import {
	type PersistentContextLaunchOptions,
	runChromiumSandboxPreflight,
	sandboxedPersistentContext,
} from "./sandbox-preflight.js";

test("every persistent Chromium launch explicitly enables the Chromium sandbox", async () => {
	let actualOptions: PersistentContextLaunchOptions | undefined;
	const context = { pages: () => [{} as Page] } as BrowserContext;
	const launcher = async (_profileDirectory: string, options: PersistentContextLaunchOptions) => {
		actualOptions = options;
		return context;
	};

	assert.equal(await sandboxedPersistentContext("profile", { headless: true }, launcher), context);
	assert.equal(actualOptions?.chromiumSandbox, true);
});

test("host sandbox preflight opens about:blank and closes its disposable profile", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-sandbox-preflight-"));
	let navigatedTo = "";
	let closed = false;
	const page = {
		async goto(url: string) {
			navigatedTo = url;
		},
	} as unknown as Page;
	const context = {
		pages: () => [page],
		async close() {
			closed = true;
		},
	} as unknown as BrowserContext;
	try {
		await runChromiumSandboxPreflight(stateDirectory, async (_profileDirectory, options) => {
			assert.equal(options.chromiumSandbox, true);
			return context;
		});
		assert.equal(navigatedTo, "about:blank");
		assert.equal(closed, true);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});
