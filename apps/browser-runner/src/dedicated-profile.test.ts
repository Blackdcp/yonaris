import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunnerTask } from "./contracts.js";
import {
	acquireDedicatedProfileSession,
	assertDedicatedProfileReady,
	assertDedicatedProfileSession,
	dedicatedProfileDirectory,
	initializeDedicatedProfile,
	releaseDedicatedProfileSession,
} from "./dedicated-profile.js";
import { runnerSessionIdForTask } from "./session-identity.js";

function runnerTask(id: string, leaseGeneration = 1): RunnerTask {
	return {
		id,
		batchId: "batch-1",
		brandId: "stepfun",
		promptText: "frozen prompt",
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sampleIndex: 1,
		sessionRequirement: "dedicated_sampling_profile",
		searchRequirement: "forbidden",
		evaluationRole: "scored",
		automationAttemptCount: 1,
		leaseGeneration,
	};
}

test("a dedicated task fails closed until the operator has initialized the exact Doubao profile", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-dedicated-missing-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	try {
		await assert.rejects(
			assertDedicatedProfileReady(profileDirectory),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_profile_missing",
		);
		await initializeDedicatedProfile(profileDirectory);
		await assert.doesNotReject(assertDedicatedProfileReady(profileDirectory));

		await writeFile(
			path.join(profileDirectory, ".yonaris-dedicated-profile.json"),
			`${JSON.stringify({ schemaVersion: 1, surface: "another-surface", purpose: "dedicated_sampling_profile" })}\n`,
			"utf8",
		);
		await assert.rejects(
			assertDedicatedProfileReady(profileDirectory),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_profile_mismatch",
		);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("a successful manual reauthentication accepts the existing valid ready marker but rejects a mismatched marker", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-dedicated-reauth-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	try {
		await initializeDedicatedProfile(profileDirectory);
		await assert.doesNotReject(initializeDedicatedProfile(profileDirectory));

		await writeFile(
			path.join(profileDirectory, ".yonaris-dedicated-profile.json"),
			`${JSON.stringify({ schemaVersion: 1, surface: "another-surface", purpose: "dedicated_sampling_profile" })}\n`,
			"utf8",
		);
		await assert.rejects(
			initializeDedicatedProfile(profileDirectory),
			(error: unknown) =>
				error instanceof Error && "code" in error && error.code === "dedicated_profile_initialization_failed",
		);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("one dedicated profile is reusable sequentially but rejects concurrent or stale task sessions", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-dedicated-session-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	const firstTask = runnerTask("task-1");
	const firstSession = runnerSessionIdForTask(firstTask);
	const secondTask = runnerTask("task-2");
	const secondSession = runnerSessionIdForTask(secondTask);
	try {
		await initializeDedicatedProfile(profileDirectory);
		await acquireDedicatedProfileSession(profileDirectory, firstTask, firstSession);
		await assert.doesNotReject(assertDedicatedProfileSession(profileDirectory, firstTask, firstSession));
		await assert.rejects(
			acquireDedicatedProfileSession(profileDirectory, secondTask, secondSession),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_profile_busy",
		);
		await assert.rejects(
			releaseDedicatedProfileSession(profileDirectory, secondTask, secondSession),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_session_mismatch",
		);
		await assert.doesNotReject(assertDedicatedProfileSession(profileDirectory, firstTask, firstSession));

		await releaseDedicatedProfileSession(profileDirectory, firstTask, firstSession);
		await acquireDedicatedProfileSession(profileDirectory, secondTask, secondSession);
		await assert.doesNotReject(assertDedicatedProfileSession(profileDirectory, secondTask, secondSession));
		await releaseDedicatedProfileSession(profileDirectory, secondTask, secondSession);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("the active marker binds exactly to the centrally-accounted session identity", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-dedicated-identity-"));
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	const task = runnerTask("task-1", 4);
	const sessionId = runnerSessionIdForTask(task);
	try {
		await initializeDedicatedProfile(profileDirectory);
		await acquireDedicatedProfileSession(profileDirectory, task, sessionId);
		const marker = JSON.parse(
			await readFile(path.join(profileDirectory, ".yonaris-active-browser-session.json"), "utf8"),
		) as Record<string, unknown>;
		assert.deepEqual(marker, { schemaVersion: 1, taskId: "task-1", sessionId });
		await assert.rejects(
			assertDedicatedProfileSession(profileDirectory, task, `${sessionId}-wrong`),
			(error: unknown) => error instanceof Error && "code" in error && error.code === "dedicated_session_mismatch",
		);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});
