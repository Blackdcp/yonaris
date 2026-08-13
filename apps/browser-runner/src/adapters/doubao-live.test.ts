import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Locator, Page } from "playwright";
import type { RunnerTask } from "../contracts.js";
import { dedicatedProfileDirectory, initializeDedicatedProfile } from "../dedicated-profile.js";
import type { PersistentContextLaunchOptions } from "../sandbox-preflight.js";
import { runnerSessionIdForTask } from "../session-identity.js";
import {
	anonymousDoubaoPreflightError,
	assertDoubaoUrl,
	assertProfileIdentity,
	DOUBAO_COMPOSER_SELECTOR,
	DOUBAO_SEND_SELECTOR,
	DoubaoLiveSessionFactory,
	initializeProfileIdentity,
	mapDoubaoAutomationError,
	observedWebSearchState,
	prepareDedicatedConversation,
	safeChildDirectory,
} from "./doubao-live.js";

test("the approved Doubao composer matches the logged-in China host DOM", () => {
	assert.equal(DOUBAO_COMPOSER_SELECTOR, 'textarea.semi-input-textarea[placeholder="发消息或按住空格说话..."]');
	assert.equal(DOUBAO_SEND_SELECTOR, "#input-engine-container button.bg-dbx-text-highlight");
});

test("anonymous Doubao is fail-closed after the China UAT proved submission requires login", () => {
	const loginRequired = anonymousDoubaoPreflightError(true);
	assert.equal(loginRequired.code, "login_required");
	assert.equal(loginRequired.phase, "pre_submit");
	assert.equal(loginRequired.disposition, "needs_human");

	const unverified = anonymousDoubaoPreflightError(false);
	assert.equal(unverified.code, "anonymous_session_unverified");
	assert.equal(unverified.disposition, "needs_human");
});

test("native-auto search distinguishes used, explicit-not-used, neither, and conflicting markers", () => {
	assert.equal(observedWebSearchState(true, false), true);
	assert.equal(observedWebSearchState(false, true), false);
	assert.equal(observedWebSearchState(false, false), null);
	assert.equal(observedWebSearchState(true, true), null);
});

function runnerTask(overrides: Partial<RunnerTask> = {}): RunnerTask {
	return {
		id: "task-1",
		batchId: "batch-1",
		brandId: "stepfun",
		promptText: "frozen prompt",
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sampleIndex: 1,
		sessionRequirement: "anonymous_clean",
		searchRequirement: "forbidden",
		evaluationRole: "scored",
		automationAttemptCount: 7,
		leaseGeneration: 11,
		...overrides,
	};
}

test("profile paths are non-empty children even for empty and traversal-like task ids", () => {
	const root = path.resolve("browser-runner-profile-root");
	for (const taskId of ["", ".", "..", "../", "../../profiles", "\\..\\profiles", "/"]) {
		const child = safeChildDirectory(root, taskId);
		const relative = path.relative(root, child);
		assert.notEqual(child, root);
		assert.ok(relative);
		assert.ok(!relative.startsWith(".."));
		assert.ok(!path.isAbsolute(relative));
	}
});

test("session identity uses server attempt identity and ignores local loop counters", () => {
	const task = runnerTask();
	const id = runnerSessionIdForTask(task);
	assert.equal(id, runnerSessionIdForTask({ ...task }));
	assert.notEqual(id, runnerSessionIdForTask({ ...task, automationAttemptCount: 8, leaseGeneration: 12 }));
	assert.ok(id.length <= 300);
});

test("resume requires an existing profile marker bound to the exact server task and session", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "doubao-profile-identity-"));
	const task = runnerTask();
	const sessionId = runnerSessionIdForTask(task);
	const profile = safeChildDirectory(root, task.id);
	try {
		await assert.rejects(
			assertProfileIdentity(profile, task, sessionId),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "assist_profile_missing",
		);
		await initializeProfileIdentity(profile, task, sessionId);
		await assert.doesNotReject(assertProfileIdentity(profile, task, sessionId));
		await assert.doesNotReject(assertProfileIdentity(profile, { ...task, leaseGeneration: 12 }, sessionId));
		await assert.rejects(
			assertProfileIdentity(profile, { ...task, id: "different-task" }, sessionId),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "assist_session_mismatch",
		);
		await assert.rejects(
			assertProfileIdentity(profile, task, `${sessionId}-wrong`),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "assist_session_mismatch",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("recognized Playwright failures retry only before durable submit intent", () => {
	const timeout = Object.assign(new Error("page.goto: Timeout 30000ms exceeded"), { name: "TimeoutError" });
	const before = mapDoubaoAutomationError(timeout, "session_open", false);
	assert.equal(before.code, "navigation_timeout");
	assert.equal(before.disposition, "safe_pre_submit_retry");

	const after = mapDoubaoAutomationError(timeout, "post_submit", true);
	assert.equal(after.code, "post_submit_timeout");
	assert.equal(after.disposition, "recover_same_session");
	assert.notEqual(after.disposition, "safe_pre_submit_retry");
});

test("browser crashes and transient network errors are fail-safe around submit", () => {
	const crash = Object.assign(new Error("Target page, context or browser has been closed"), {
		name: "TargetClosedError",
	});
	assert.equal(mapDoubaoAutomationError(crash, "pre_submit", false).code, "browser_crash_before_submit");
	assert.equal(mapDoubaoAutomationError(crash, "submit", true).disposition, "needs_human");

	const network = new Error("page.goto: net::ERR_CONNECTION_RESET at https://www.doubao.com/chat/");
	assert.equal(mapDoubaoAutomationError(network, "pre_submit", false).code, "network_transient");
	assert.equal(mapDoubaoAutomationError(network, "submit", true).disposition, "recover_same_session");
});

test("Doubao navigation accepts only HTTPS on the standard port without userinfo", () => {
	assert.equal(assertDoubaoUrl("https://www.doubao.com/chat/abc"), "https://www.doubao.com/chat/abc");
	for (const url of [
		"http://www.doubao.com/chat/abc",
		"https://user@www.doubao.com/chat/abc",
		"https://www.doubao.com:8443/chat/abc",
		"https://doubao.com.evil.example/chat/abc",
	]) {
		assert.throws(() => assertDoubaoUrl(url), /HTTPS Doubao URL/);
	}
});

test("factory reuses the operator profile sequentially without deleting it and always launches sandboxed", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "doubao-dedicated-factory-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	const launches: Array<{ profileDirectory: string; options: PersistentContextLaunchOptions }> = [];
	const launcher = async (actualProfileDirectory: string, options: PersistentContextLaunchOptions) => {
		launches.push({ profileDirectory: actualProfileDirectory, options });
		return {
			pages: () => [{} as Page],
			async close() {},
		} as unknown as BrowserContext;
	};
	try {
		await initializeDedicatedProfile(profileDirectory);
		const factory = new DoubaoLiveSessionFactory(stateDirectory, launcher);
		const first = await factory.create(runnerTask({ sessionRequirement: "dedicated_sampling_profile" }), 1);
		await first.close("succeeded");
		assert.equal(await exists(profileDirectory), true);

		const secondTask = runnerTask({ id: "task-2", sessionRequirement: "dedicated_sampling_profile" });
		const second = await factory.create(secondTask, 1);
		await second.close("succeeded");
		assert.equal(launches.length, 2);
		assert.ok(launches.every(({ profileDirectory: value }) => value === profileDirectory));
		assert.ok(launches.every(({ options }) => options.chromiumSandbox === true));
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("factory never launches a dedicated task when the operator profile marker is absent", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "doubao-dedicated-factory-missing-"));
	let launches = 0;
	try {
		const factory = new DoubaoLiveSessionFactory(stateDirectory, async () => {
			launches += 1;
			throw new Error("must not launch");
		});
		await assert.rejects(
			factory.create(runnerTask({ sessionRequirement: "dedicated_sampling_profile" }), 1),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_profile_missing",
		);
		assert.equal(launches, 0);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("a dedicated pre-submit handoff releases the shared profile so the batch can continue", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "doubao-dedicated-pre-submit-release-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	const launcher = async () =>
		({
			pages: () => [{} as Page],
			async close() {},
		}) as unknown as BrowserContext;
	try {
		await initializeDedicatedProfile(profileDirectory);
		const factory = new DoubaoLiveSessionFactory(stateDirectory, launcher);
		const first = await factory.create(runnerTask({ sessionRequirement: "dedicated_sampling_profile" }), 1);
		await first.close("needs_human");
		const second = await factory.create(
			runnerTask({ id: "task-after-pre-submit-handoff", sessionRequirement: "dedicated_sampling_profile" }),
			1,
		);
		await second.close("succeeded");
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("dedicated preparation requires a positive authenticated marker and creates a blank new conversation", async () => {
	const priorAuthenticated = process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
	const priorNewConversation = process.env.BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR;
	const priorAnswer = process.env.BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR;
	const priorUserMessage = process.env.BROWSER_RUNNER_DOUBAO_USER_MESSAGE_SELECTOR;
	process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = "[data-authenticated]";
	process.env.BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR = "[data-new-conversation]";
	process.env.BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR = "[data-answer]";
	process.env.BROWSER_RUNNER_DOUBAO_USER_MESSAGE_SELECTOR = "[data-user-message]";
	let answerCount = 1;
	let userMessageCount = 1;
	const clicked: string[] = [];
	const locator = (selector: string) =>
		({
			async count() {
				if (selector === "[data-answer]") return answerCount;
				if (selector === "[data-user-message]") return userMessageCount;
				return 1;
			},
			async isVisible() {
				return true;
			},
			async click() {
				clicked.push(selector);
				answerCount = 0;
				userMessageCount = 0;
			},
		}) as unknown as Locator;
	const page = {
		locator,
		getByRole() {
			return {
				async isVisible() {
					return false;
				},
			} as unknown as Locator;
		},
		async waitForFunction() {},
	} as unknown as Page;
	try {
		await prepareDedicatedConversation(page);
		assert.deepEqual(clicked, ["[data-new-conversation]"]);
		assert.equal(answerCount, 0);
		assert.equal(userMessageCount, 0);
	} finally {
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR", priorAuthenticated);
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR", priorNewConversation);
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR", priorAnswer);
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_USER_MESSAGE_SELECTOR", priorUserMessage);
	}
});

test("dedicated preparation does not click login or continue without the authenticated marker", async () => {
	const priorAuthenticated = process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR;
	const priorNewConversation = process.env.BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR;
	process.env.BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR = "[data-authenticated]";
	process.env.BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR = "[data-new-conversation]";
	let clicks = 0;
	const page = {
		locator(selector: string) {
			return {
				async count() {
					return selector === "[data-authenticated]" ? 0 : 1;
				},
				async isVisible() {
					return false;
				},
				async click() {
					clicks += 1;
				},
			} as unknown as Locator;
		},
		getByRole() {
			return {
				async isVisible() {
					return true;
				},
			} as unknown as Locator;
		},
	} as unknown as Page;
	try {
		await assert.rejects(
			prepareDedicatedConversation(page),
			(error: unknown) =>
				error instanceof Error && "code" in error && error.code === "dedicated_profile_not_authenticated",
		);
		assert.equal(clicks, 0);
	} finally {
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR", priorAuthenticated);
		restoreEnvironment("BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR", priorNewConversation);
	}
});

async function exists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}

function restoreEnvironment(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}
