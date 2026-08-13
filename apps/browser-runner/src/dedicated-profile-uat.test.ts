import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Locator, Page } from "playwright";
import { dedicatedProfileDirectory } from "./dedicated-profile.js";
import {
	collectDedicatedDoubaoSelectorProbe,
	openDedicatedDoubaoLoginWindow,
	runAnonymousDoubaoUatOnce,
	runDedicatedDoubaoUatOnce,
	sanitizeSelectorCandidates,
} from "./dedicated-profile-uat.js";
import type { PersistentContextLaunchOptions } from "./sandbox-preflight.js";

const READY_MARKER = ".yonaris-dedicated-profile.json";

test("the manual login window is headed and sandboxed but never interacts with the page or marks the profile ready", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-login-window-"));
	let launchOptions: PersistentContextLaunchOptions | undefined;
	let destination = "";
	let interactions = 0;
	let waitedForClose = false;
	const page = {
		async goto(url: string) {
			destination = url;
		},
		async click() {
			interactions += 1;
		},
		async fill() {
			interactions += 1;
		},
	} as unknown as Page;
	const context = {
		pages: () => [page],
		async waitForEvent(event: string) {
			assert.equal(event, "close");
			waitedForClose = true;
		},
		async close() {},
	} as unknown as BrowserContext;
	try {
		const result = await openDedicatedDoubaoLoginWindow(stateDirectory, {
			launcher: async (_profileDirectory, options) => {
				launchOptions = options;
				return context;
			},
		});

		assert.deepEqual(result, { status: "login_window_closed" });
		assert.equal(launchOptions?.headless, false);
		assert.equal(launchOptions?.chromiumSandbox, true);
		assert.equal(destination, "https://www.doubao.com/chat/");
		assert.equal(waitedForClose, true);
		assert.equal(interactions, 0);
		await assert.rejects(access(path.join(dedicatedProfileDirectory(stateDirectory), READY_MARKER)));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the read-only probe returns only bounded neutral selector candidates and coarse state", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-selector-probe-"));
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: false });
	const context = contextDouble(page);
	try {
		const result = await collectDedicatedDoubaoSelectorProbe(stateDirectory, {
			launcher: async (_profileDirectory, options) => {
				assert.equal(options.headless, true);
				assert.equal(options.chromiumSandbox, true);
				return context;
			},
			collector: async () => [
				{ selector: '[data-testid="new-chat-button"]', count: 1, visibleCount: 1 },
				{ selector: '[data-testid="alice@example.com"]', count: 1, visibleCount: 1 },
				{ selector: "#account-13800138000", count: 1, visibleCount: 1 },
				{ selector: ".message-content", count: 2, visibleCount: 2 },
				{ selector: "body", count: 1, visibleCount: 1, text: "private answer" },
			],
		});

		assert.deepEqual(result, {
			status: "session_available",
			allowedHost: true,
			loginActionVisible: false,
			knownComposerCount: 1,
			knownComposerVisibleCount: 1,
			candidates: [
				{ selector: ".message-content", count: 2, visibleCount: 2 },
				{ selector: '[data-testid="new-chat-button"]', count: 1, visibleCount: 1 },
			],
		});
		assert.equal(JSON.stringify(result).includes("private answer"), false);
		assert.equal(JSON.stringify(result).includes("alice"), false);
		await assert.rejects(access(path.join(dedicatedProfileDirectory(stateDirectory), READY_MARKER)));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the read-only probe never scans selector attributes after navigation leaves Doubao", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-selector-probe-host-"));
	const page = pageDouble({
		composerCount: 0,
		composerVisible: false,
		loginVisible: false,
		url: "https://example.com/login?account=private",
	});
	let collectorCalls = 0;
	try {
		const result = await collectDedicatedDoubaoSelectorProbe(stateDirectory, {
			launcher: async () => contextDouble(page),
			collector: async () => {
				collectorCalls += 1;
				return [{ selector: ".account-avatar", count: 1, visibleCount: 1 }];
			},
		});
		assert.equal(collectorCalls, 0);
		assert.deepEqual(result, {
			status: "page_unverified",
			allowedHost: false,
			loginActionVisible: false,
			knownComposerCount: 0,
			knownComposerVisibleCount: 0,
			candidates: [],
		});
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the signed-out marker accepts exact visible login text when Doubao does not expose a button role", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-selector-login-text-"));
	try {
		const result = await collectDedicatedDoubaoSelectorProbe(stateDirectory, {
			launcher: async () =>
				contextDouble(
					pageDouble({
						composerCount: 1,
						composerVisible: true,
						loginVisible: true,
						loginRoleVisible: false,
					}),
				),
			collector: async () => [],
		});
		assert.equal(result.loginActionVisible, true);
		assert.equal(result.status, "login_required");
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the signed-out marker accepts one visible login node when duplicate text nodes exist", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-selector-login-duplicates-"));
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: false }) as Page & {
		getByText: () => Locator;
	};
	page.getByText = () =>
		({
			async count() {
				return 2;
			},
			nth(index: number) {
				return {
					async isVisible() {
						return index === 1;
					},
				} as unknown as Locator;
			},
		}) as unknown as Locator;
	try {
		const result = await collectDedicatedDoubaoSelectorProbe(stateDirectory, {
			launcher: async () => contextDouble(page),
			collector: async () => [],
		});
		assert.equal(result.loginActionVisible, true);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the default browser collector is a self-contained browser script without Node transform helpers", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-selector-script-"));
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: false }) as Page & {
		evaluate: (expression: unknown) => Promise<unknown>;
	};
	page.evaluate = async (expression: unknown) => {
		assert.equal(typeof expression, "string");
		assert.equal(String(expression).includes("__name"), false);
		return [{ selector: ".answer-content", count: 1, visibleCount: 1 }];
	};
	try {
		const result = await collectDedicatedDoubaoSelectorProbe(stateDirectory, {
			launcher: async () => contextDouble(page),
		});
		assert.deepEqual(result.candidates, [{ selector: ".answer-content", count: 1, visibleCount: 1 }]);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("candidate sanitization rejects PII-shaped, free-text, unbounded, and unknown fields", () => {
	assert.deepEqual(
		sanitizeSelectorCandidates([
			{ selector: '[data-qa="assistant-message"]', count: 3, visibleCount: 2 },
			{ selector: '[aria-label="Chaopeng Dou"]', count: 1, visibleCount: 1 },
			{ selector: '[data-testid="13800138000"]', count: 1, visibleCount: 1 },
			{ selector: ".secret-project", count: 1, visibleCount: 1 },
			{ selector: '[role="button"]', count: 100_000, visibleCount: -4 },
			{ selector: ".answer-content", count: 2, visibleCount: 1, html: "<p>answer</p>" },
		]),
		[
			{ selector: ".answer-content", count: 2, visibleCount: 1 },
			{ selector: '[data-qa="assistant-message"]', count: 3, visibleCount: 2 },
			{ selector: '[role="button"]', count: 10_000, visibleCount: 0 },
		],
	);
});

test("one-shot UAT durably records intent before one fixed prompt and reports only structural candidate changes", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-uat-once-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	let fills = 0;
	let presses = 0;
	const composer = {
		async count() {
			return 1;
		},
		async isVisible() {
			return true;
		},
		async fill(value: string) {
			fills += 1;
			assert.equal(value, "请仅回复：测试通过。");
			const intent = JSON.parse(await readFile(path.join(profileDirectory, ".yonaris-uat-once.intent.json"), "utf8"));
			assert.equal(intent.schemaVersion, 1);
			assert.equal(intent.purpose, "selector_discovery_non_scored");
			assert.match(intent.promptSha256, /^[a-f0-9]{64}$/);
			assert.equal("promptText" in intent, false);
		},
		async press(key: string) {
			presses += 1;
			assert.equal(key, "Enter");
		},
	} as unknown as Locator;
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: false, composer });
	const context = contextDouble(page);
	let snapshot = 0;
	const collector = async () => {
		snapshot += 1;
		if (snapshot === 1) return [{ selector: '[data-testid="new-chat-button"]', count: 1, visibleCount: 1 }];
		if (snapshot === 2)
			return [
				{ selector: '[data-testid="new-chat-button"]', count: 1, visibleCount: 1 },
				{ selector: ".user-message", count: 1, visibleCount: 1 },
				{ selector: ".generation-stop-button", count: 1, visibleCount: 1 },
			];
		return [
			{ selector: '[data-testid="new-chat-button"]', count: 1, visibleCount: 1 },
			{ selector: ".user-message", count: 1, visibleCount: 1 },
			{ selector: ".assistant-message", count: 1, visibleCount: 1 },
		];
	};
	try {
		const result = await runDedicatedDoubaoUatOnce(stateDirectory, {
			launcher: async (_profileDirectory, options) => {
				assert.equal(options.headless, false);
				assert.equal(options.chromiumSandbox, true);
				return context;
			},
			collector,
			sleep: async () => {},
			maximumPolls: 2,
		});

		assert.equal(fills, 1);
		assert.equal(presses, 1);
		assert.deepEqual(result, {
			status: "structural_change_observed",
			promptSubmitted: true,
			userMessageCandidates: [{ selector: ".user-message", count: 1, visibleCount: 1 }],
			answerCandidates: [{ selector: ".assistant-message", count: 1, visibleCount: 1 }],
			completionCandidates: [{ selector: ".generation-stop-button", count: 1, visibleCount: 1 }],
		});
		assert.equal(JSON.stringify(result).includes("测试通过"), false);
		await assert.rejects(access(path.join(profileDirectory, READY_MARKER)));

		await assert.rejects(
			runDedicatedDoubaoUatOnce(stateDirectory, {
				launcher: async () => context,
				collector,
				sleep: async () => {},
				maximumPolls: 1,
			}),
			/once|already/i,
		);
		assert.equal(fills, 1);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("one-shot UAT stops before durable intent or submission while a login action is visible", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-uat-login-wall-"));
	let fills = 0;
	const composer = {
		async count() {
			return 1;
		},
		async isVisible() {
			return true;
		},
		async fill() {
			fills += 1;
		},
	} as unknown as Locator;
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: true, composer });
	try {
		await assert.rejects(
			runDedicatedDoubaoUatOnce(stateDirectory, {
				launcher: async () => contextDouble(page),
				collector: async () => [],
			}),
			/login/i,
		);
		assert.equal(fills, 0);
		await assert.rejects(access(path.join(dedicatedProfileDirectory(stateDirectory), ".yonaris-uat-once.intent.json")));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("anonymous one-shot UAT requires the signed-out marker and uses a disposable profile exactly once", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-anonymous-uat-"));
	let profileDirectory = "";
	let fills = 0;
	let presses = 0;
	const composer = {
		async count() {
			return 1;
		},
		async isVisible() {
			return true;
		},
		async fill(value: string) {
			fills += 1;
			assert.equal(value, "请仅回复：测试通过。");
			const intent = JSON.parse(
				await readFile(path.join(stateDirectory, ".yonaris-anonymous-uat-once.intent.json"), "utf8"),
			);
			assert.equal(intent.sessionRequirement, "anonymous_clean");
			assert.match(intent.promptSha256, /^[a-f0-9]{64}$/);
			assert.equal("promptText" in intent, false);
		},
		async press(key: string) {
			presses += 1;
			assert.equal(key, "Enter");
		},
	} as unknown as Locator;
	const page = pageDouble({ composerCount: 1, composerVisible: true, loginVisible: true, composer });
	try {
		const result = await runAnonymousDoubaoUatOnce(stateDirectory, {
			launcher: async (launchedProfileDirectory, options) => {
				profileDirectory = launchedProfileDirectory;
				assert.equal(options.headless, false);
				assert.equal(options.chromiumSandbox, true);
				return contextDouble(page);
			},
			collector: async () => [
				{ selector: ".user-message", count: fills, visibleCount: fills },
				{ selector: ".assistant-message", count: presses, visibleCount: presses },
			],
			sleep: async () => {},
			maximumPolls: 1,
		});
		assert.equal(result.promptSubmitted, true);
		assert.equal(fills, 1);
		assert.equal(presses, 1);
		assert.match(profileDirectory, /anonymous-uat-profiles/);
		await assert.rejects(access(profileDirectory));
		await assert.rejects(
			runAnonymousDoubaoUatOnce(stateDirectory, {
				launcher: async () => contextDouble(page),
				collector: async () => [],
			}),
			/once|already/i,
		);
		assert.equal(fills, 1);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("anonymous one-shot UAT stops before intent when the page is no longer visibly signed out", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-anonymous-uat-auth-"));
	try {
		await assert.rejects(
			runAnonymousDoubaoUatOnce(stateDirectory, {
				launcher: async () =>
					contextDouble(pageDouble({ composerCount: 1, composerVisible: true, loginVisible: false })),
				collector: async () => [],
			}),
			/anonymous|signed.out/i,
		);
		await assert.rejects(access(path.join(stateDirectory, ".yonaris-anonymous-uat-once.intent.json")));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

function pageDouble(options: {
	composerCount: number;
	composerVisible: boolean;
	loginVisible: boolean;
	loginRoleVisible?: boolean;
	composer?: Locator;
	url?: string;
}): Page {
	const composer =
		options.composer ??
		({
			async count() {
				return options.composerCount;
			},
			async isVisible() {
				return options.composerVisible;
			},
		} as unknown as Locator);
	return {
		async goto() {},
		url() {
			return options.url ?? "https://www.doubao.com/chat/";
		},
		locator() {
			return composer;
		},
		getByRole() {
			return {
				async isVisible() {
					return options.loginRoleVisible ?? options.loginVisible;
				},
			} as unknown as Locator;
		},
		getByText() {
			return {
				async isVisible() {
					return options.loginVisible;
				},
			} as unknown as Locator;
		},
	} as unknown as Page;
}

function contextDouble(page: Page): BrowserContext {
	return {
		pages: () => [page],
		async close() {},
	} as unknown as BrowserContext;
}
