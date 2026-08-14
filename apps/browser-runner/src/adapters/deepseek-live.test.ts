import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Page } from "playwright";
import type { PersistentContextLaunchOptions } from "../sandbox-preflight.js";
import {
	assertDeepSeekConversationUrl,
	buildDeepSeekSurfaceResponse,
	classifyDeepSeekPage,
	classifyDeepSeekSearch,
	DeepSeekPlaywrightSessionFactory,
	DeepSeekSubmissionGuard,
	openDeepSeekLoginWindow,
	validateDeepSeekSelectorContract,
} from "./deepseek-live.js";

const SELECTORS = {
	version: "deepseek-consumer-v1:test-fixture",
	composer: "textarea[data-testid='chat-input']",
	send: "button[data-testid='send']",
	newConversation: "button[data-testid='new-chat']",
	userMessage: "[data-testid='user-message']",
	answer: "[data-testid='assistant-message']",
	generating: "button[data-testid='stop-generating']",
	loginWall: "[data-testid='login-wall']",
	captcha: "iframe[src*='captcha']",
	rateLimit: "[data-testid='rate-limit']",
	searchUsed: "[data-testid='search-sources']",
	searchNotUsed: "[data-testid='search-disabled']",
	citationLink: "[data-testid='assistant-message'] a[href]",
	queryItem: "[data-testid='search-query']",
};

const READY_PAGE = {
	url: "https://chat.deepseek.com/a/chat/s/abcd1234",
	composerCount: 1,
	composerVisible: true,
	sendCount: 1,
	sendVisible: true,
	newConversationCount: 1,
	newConversationVisible: true,
	loginWallVisible: false,
	captchaVisible: false,
	rateLimitVisible: false,
};

test("accepts only a reviewed native CSS selector contract", () => {
	assert.deepEqual(validateDeepSeekSelectorContract(SELECTORS), SELECTORS);
	for (const composer of ["", "//textarea", "textarea:visible", "textarea:has-text('消息')", "*", "body textarea"]) {
		assert.throws(() => validateDeepSeekSelectorContract({ ...SELECTORS, composer }), /selector contract/);
	}
});

test("requires one visible composer, send action and new-conversation action", () => {
	assert.equal(classifyDeepSeekPage(READY_PAGE), "ready");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, composerCount: 0 }), "page_drift");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, composerCount: 2 }), "page_drift");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, sendVisible: false }), "page_drift");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, newConversationCount: 2 }), "page_drift");
});

test("stops on login, captcha and rate limiting before page interaction", () => {
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, loginWallVisible: true }), "login_required");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, captchaVisible: true }), "captcha");
	assert.equal(classifyDeepSeekPage({ ...READY_PAGE, rateLimitVisible: true }), "rate_limited");
});

test("maps reviewed search evidence without inventing false", () => {
	assert.equal(classifyDeepSeekSearch({ usedCount: 1, notUsedCount: 0 }), true);
	assert.equal(classifyDeepSeekSearch({ usedCount: 0, notUsedCount: 1 }), false);
	assert.equal(classifyDeepSeekSearch({ usedCount: 0, notUsedCount: 0 }), null);
	assert.throws(() => classifyDeepSeekSearch({ usedCount: 1, notUsedCount: 1 }), /page_drift/);
	assert.throws(() => classifyDeepSeekSearch({ usedCount: 2, notUsedCount: 0 }), /page_drift/);
});

test("persists durable intent before one submit and forbids a second submit", async () => {
	const events: string[] = [];
	const guard = new DeepSeekSubmissionGuard();
	await guard.submitOnce(
		async () => {
			events.push("intent");
		},
		async () => {
			events.push("submit");
		},
	);
	assert.deepEqual(events, ["intent", "submit"]);
	await assert.rejects(
		() =>
			guard.submitOnce(
				async () => undefined,
				async () => undefined,
			),
		/already submitted/,
	);
	assert.deepEqual(events, ["intent", "submit"]);
});

test("a failed durable intent prevents browser submission", async () => {
	let submitCount = 0;
	const guard = new DeepSeekSubmissionGuard();
	await assert.rejects(
		() =>
			guard.submitOnce(
				async () => {
					throw new Error("journal unavailable");
				},
				async () => {
					submitCount += 1;
				},
			),
		/journal unavailable/,
	);
	assert.equal(submitCount, 0);
});

test("extracts only the newest completed answer and current-answer source details", () => {
	const response = buildDeepSeekSurfaceResponse({
		pageUrl: "https://chat.deepseek.com/a/chat/s/abcd1234",
		observedAt: "2026-08-14T08:00:00.000Z",
		answers: ["旧回答", "当前完整回答"],
		usedCount: 1,
		notUsedCount: 0,
		webQueries: ["主流大模型公司", "阶跃星辰 StepFun"],
		citations: [
			{ url: "https://www.stepfun.com/", title: "阶跃星辰" },
			{ url: "https://www.stepfun.com/", title: "重复阶跃星辰" },
			{ url: "https://example.com/report", title: "行业报告" },
		],
	});
	assert.equal(response.answerText, "当前完整回答");
	assert.equal(response.webSearchObserved, true);
	assert.deepEqual(response.webQueries, ["主流大模型公司", "阶跃星辰 StepFun"]);
	assert.deepEqual(response.citations, [
		{ url: "https://www.stepfun.com/", title: "阶跃星辰", citationIndex: 0 },
		{ url: "https://example.com/report", title: "行业报告", citationIndex: 1 },
	]);
});

test("allows a valid answer without citations and preserves unknown search", () => {
	const response = buildDeepSeekSurfaceResponse({
		pageUrl: "https://chat.deepseek.com/a/chat/s/abcd1234",
		observedAt: "2026-08-14T08:00:00.000Z",
		answers: ["这是一个没有引用的有效回答。"],
		usedCount: 0,
		notUsedCount: 0,
		webQueries: [],
		citations: [],
	});
	assert.equal(response.webSearchObserved, null);
	assert.deepEqual(response.citations, []);
});

test("accepts only clean durable DeepSeek conversation URLs", () => {
	assert.equal(
		assertDeepSeekConversationUrl("https://chat.deepseek.com/a/chat/s/abcd1234"),
		"https://chat.deepseek.com/a/chat/s/abcd1234",
	);
	for (const url of [
		"http://chat.deepseek.com/a/chat/s/abcd1234",
		"https://chat.deepseek.com/",
		"https://deepseek.com/a/chat/s/abcd1234",
		"https://user@chat.deepseek.com/a/chat/s/abcd1234",
		"https://chat.deepseek.com:8443/a/chat/s/abcd1234",
		"https://chat.deepseek.com/a/chat/s/abcd1234?share=1",
	]) {
		assert.throws(() => assertDeepSeekConversationUrl(url), /DeepSeek conversation URL/);
	}
});

test("the login window uses one private persistent sandboxed profile without automated input", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-login-"));
	const events: string[] = [];
	const closeWaitOptions: unknown[] = [];
	const launches: Array<{ profileDirectory: string; options: PersistentContextLaunchOptions }> = [];
	const page = {
		async goto(url: string) {
			events.push(`goto:${url}`);
		},
		async fill() {
			events.push("fill");
		},
		async click() {
			events.push("click");
		},
	} as unknown as Page;
	const launcher = async (profileDirectory: string, options: PersistentContextLaunchOptions) => {
		launches.push({ profileDirectory, options });
		return {
			pages: () => [page],
			async waitForEvent(event: string, options: unknown) {
				assert.equal(event, "close");
				closeWaitOptions.push(options);
			},
			async close() {},
		} as unknown as BrowserContext;
	};
	try {
		const result = await openDeepSeekLoginWindow(stateDirectory, launcher);
		assert.equal(result.status, "closed");
		assert.match(result.profileIdentityHash, /^[0-9a-f]{64}$/);
		assert.deepEqual(events, ["goto:https://chat.deepseek.com/sign_in"]);
		assert.equal(launches.length, 1);
		assert.equal(launches[0]?.options.headless, false);
		assert.equal(launches[0]?.options.chromiumSandbox, true);
		assert.match(launches[0]?.profileDirectory ?? "", /deepseek-profile$/);
		assert.deepEqual(closeWaitOptions, [{ timeout: 0 }]);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the live factory reuses the dedicated profile sequentially and always launches sandboxed", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-factory-"));
	const launches: PersistentContextLaunchOptions[] = [];
	const launcher = async (_profileDirectory: string, options: PersistentContextLaunchOptions) => {
		launches.push(options);
		return {
			pages: () => [{} as Page],
			async close() {},
		} as unknown as BrowserContext;
	};
	try {
		const factory = new DeepSeekPlaywrightSessionFactory(stateDirectory, SELECTORS, launcher);
		const first = await factory.create("slot-1", "prompt-1");
		await first.close();
		const second = await factory.create("slot-2", "prompt-2");
		await second.close();
		assert.equal(launches.length, 2);
		assert.ok(launches.every((options) => options.chromiumSandbox === true));
		assert.ok(launches.every((options) => options.locale === "zh-CN"));
		assert.ok(launches.every((options) => options.timezoneId === "Asia/Shanghai"));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});
