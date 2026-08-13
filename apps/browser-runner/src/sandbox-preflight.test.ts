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

test("every persistent Chromium launch uses the fixed local egress proxy when configured", async () => {
	let actualOptions: PersistentContextLaunchOptions | undefined;
	const context = { pages: () => [{} as Page] } as BrowserContext;
	await sandboxedPersistentContext(
		"profile",
		{ headless: true },
		async (_profileDirectory, options) => {
			actualOptions = options;
			return context;
		},
		{ BROWSER_EGRESS_PROXY_URL: "http://127.0.0.1:17777" },
	);
	assert.deepEqual(actualOptions?.proxy, { server: "http://127.0.0.1:17777" });
});

test("rejects a non-fixed browser proxy before Chromium launches", () => {
	let launched = false;
	assert.throws(
		() =>
			sandboxedPersistentContext(
				"profile",
				{ headless: true },
				async () => {
					launched = true;
					return { pages: () => [] } as unknown as BrowserContext;
				},
				{ BROWSER_EGRESS_PROXY_URL: "http://example.com:17777" },
			),
		/fixed local/i,
	);
	assert.equal(launched, false);
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
