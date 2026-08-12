import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunnerTask } from "../contracts.js";
import { runnerSessionIdForTask } from "../session-identity.js";
import {
	assertDoubaoUrl,
	assertProfileIdentity,
	initializeProfileIdentity,
	mapDoubaoAutomationError,
	safeChildDirectory,
} from "./doubao-live.js";

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
