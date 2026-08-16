import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resumePostSubmitTask } from "./assist.js";
import type { ClaimedRunnerTask, HandoffMetadata, SurfaceSession } from "./contracts.js";
import { BrowserRunnerError } from "./errors.js";
import { RunJournal } from "./journal.js";

test("post-submit assist confirms and extracts without invoking submit", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-assist-"));
	const journal = await RunJournal.create(stateDirectory, "assist-test");
	let submitCalls = 0;
	let confirmCalls = 0;
	let completeCalls = 0;
	let uploadedEvidencePaths: string[] = [];
	const claimed: ClaimedRunnerTask = {
		task: {
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
			minimumEvidenceArtifacts: 2,
			automationAttemptCount: 1,
			leaseGeneration: 2,
		},
		submitConfirmed: false,
		postSubmitAssist: true,
		runnerSessionId: "old-session",
		claim: { leaseToken: "x".repeat(32), leaseGeneration: 2 },
	};
	const session: SurfaceSession = {
		id: "old-session",
		async open() {},
		async prepare() {},
		async submit() {
			submitCalls += 1;
		},
		async confirmSubmission(prompt) {
			assert.equal(prompt, "frozen prompt");
			confirmCalls += 1;
		},
		async collectResponse() {
			return {
				answerText: "StepFun answer",
				answerHtml: "<section>StepFun answer</section>",
				pageUrl: "https://www.doubao.com/chat/task-1",
				observedAt: new Date().toISOString(),
				citations: [],
				webQueries: [],
			};
		},
		async captureEvidence() {
			return {
				domSnapshot: "<!doctype html><p>StepFun answer</p>",
				screenshotPng: Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
					"base64",
				),
			};
		},
		async handoffMetadata() {
			return {
				sessionId: "resumed-session",
				profileDirectory: "profile",
				lastPageUrl: "https://www.doubao.com/chat/task-1",
				fixture: true,
			};
		},
		async close() {},
	};
	const handoff: HandoffMetadata = {
		taskId: "task-1",
		runId: "prior-run",
		surface: "doubao",
		sessionId: "old-session",
		profileDirectory: path.join(stateDirectory, "profiles", "task-1"),
		lastPageUrl: "https://www.doubao.com/chat/task-1",
		phase: "post_submit",
		code: "response_timeout",
		message: "response timeout",
		sessionRequirement: "anonymous_clean",
		createdAt: new Date().toISOString(),
		fixture: false,
	};
	try {
		await journal.writeHandoff(handoff);
		await resumePostSubmitTask({
			handoff,
			journal,
			remote: {
				async resume() {
					return claimed;
				},
				async confirmPromptSubmitted() {
					confirmCalls += 1;
				},
				async submit(observation) {
					completeCalls += 1;
					uploadedEvidencePaths = observation.evidence.map(({ path: evidencePath }) => evidencePath);
				},
				async markNeedsHuman() {},
			},
			sessionFactory: {
				async resume(_task, _profileDirectory, _lastPageUrl, expectedSessionId) {
					assert.equal(expectedSessionId, "old-session");
					return session;
				},
			},
		});
		assert.equal(submitCalls, 0);
		assert.equal(confirmCalls, 2);
		assert.equal(completeCalls, 1);
		assert.equal(uploadedEvidencePaths.length, 2);
		for (const evidencePath of uploadedEvidencePaths) assert.equal(await exists(evidencePath), false);
		assert.deepEqual(await readdir(path.join(stateDirectory, "handoffs")), []);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("post-submit assist verifies the frozen prompt even when the server already confirmed submission", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-assist-wrong-prompt-"));
	const journal = await RunJournal.create(stateDirectory, "assist-wrong-prompt");
	let browserSubmitCalls = 0;
	let promptChecks = 0;
	let collectCalls = 0;
	let completionCalls = 0;
	const task = {
		id: "task-wrong-prompt",
		batchId: "batch-1",
		brandId: "stepfun",
		promptText: "the exact frozen prompt",
		surfaceTargetKey: "doubao.consumer_web" as const,
		captureRouteKey: "browser_runner.doubao" as const,
		sampleIndex: 1,
		sessionRequirement: "anonymous_clean" as const,
		searchRequirement: "forbidden" as const,
		evaluationRole: "scored" as const,
		minimumEvidenceArtifacts: 2,
		automationAttemptCount: 1,
		leaseGeneration: 2,
	};
	const claimed: ClaimedRunnerTask = {
		task,
		submitConfirmed: true,
		postSubmitAssist: true,
		runnerSessionId: "bound-session",
		claim: { leaseToken: "x".repeat(32), leaseGeneration: 2 },
	};
	const handoff: HandoffMetadata = {
		taskId: task.id,
		runId: "prior-run",
		surface: "doubao",
		sessionId: "bound-session",
		profileDirectory: path.join(stateDirectory, "profiles", task.id),
		lastPageUrl: "https://www.doubao.com/chat/task-wrong-prompt",
		phase: "post_submit",
		code: "response_timeout",
		message: "response timeout",
		sessionRequirement: "anonymous_clean",
		createdAt: new Date().toISOString(),
		fixture: false,
	};
	const session: SurfaceSession = {
		id: "bound-session",
		async open() {},
		async prepare() {},
		async submit() {
			browserSubmitCalls += 1;
		},
		async confirmSubmission() {
			promptChecks += 1;
			throw new BrowserRunnerError(
				"submit_confirmation_timeout",
				"post_submit",
				"recover_same_session",
				"Frozen prompt is absent from this page",
			);
		},
		async collectResponse() {
			collectCalls += 1;
			throw new Error("must not collect from an unverified page");
		},
		async captureEvidence() {
			throw new Error("must not capture an unverified page");
		},
		async handoffMetadata() {
			return {
				sessionId: "bound-session",
				profileDirectory: handoff.profileDirectory,
				lastPageUrl: handoff.lastPageUrl,
				fixture: false,
			};
		},
		async close() {},
	};
	try {
		await assert.rejects(
			resumePostSubmitTask({
				handoff,
				journal,
				remote: {
					async resume() {
						return claimed;
					},
					async confirmPromptSubmitted() {
						throw new Error("server confirmation must not be repeated");
					},
					async submit() {
						completionCalls += 1;
					},
					async markNeedsHuman() {},
				},
				sessionFactory: {
					async resume() {
						return session;
					},
				},
			}),
			/absent from this page/,
		);
		assert.equal(promptChecks, 1);
		assert.equal(browserSubmitCalls, 0);
		assert.equal(collectCalls, 0);
		assert.equal(completionCalls, 0);
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
	}
});

test("post-submit assist immediately persists a needs-human result when same-session recovery fails", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "browser-runner-assist-failure-"));
	const journal = await RunJournal.create(stateDirectory, "assist-failure");
	const task = {
		id: "task-recovery-failure",
		batchId: "batch-1",
		brandId: "stepfun",
		promptText: "the exact frozen prompt",
		surfaceTargetKey: "doubao.consumer_web" as const,
		captureRouteKey: "browser_runner.doubao" as const,
		sampleIndex: 1,
		sessionRequirement: "dedicated_sampling_profile" as const,
		searchRequirement: "platform_default" as const,
		evaluationRole: "scored" as const,
		minimumEvidenceArtifacts: 2,
		automationAttemptCount: 1,
		leaseGeneration: 2,
	};
	const claimed: ClaimedRunnerTask = {
		task,
		submitConfirmed: true,
		postSubmitAssist: true,
		runnerSessionId: "bound-session",
		claim: { leaseToken: "x".repeat(32), leaseGeneration: 2 },
	};
	const handoff: HandoffMetadata = {
		taskId: task.id,
		runId: "prior-run",
		surface: "doubao",
		sessionId: "bound-session",
		profileDirectory: path.join(stateDirectory, "profiles", task.id),
		lastPageUrl: "https://www.doubao.com/chat/task-recovery-failure",
		phase: "post_submit",
		code: "response_timeout",
		message: "response timeout",
		sessionRequirement: "dedicated_sampling_profile",
		createdAt: new Date().toISOString(),
		fixture: false,
	};
	let browserSubmitCalls = 0;
	let needsHumanReason: { code: string; message: string; phase: string } | undefined;
	try {
		await assert.rejects(
			resumePostSubmitTask({
				handoff,
				journal,
				remote: {
					async resume() {
						return claimed;
					},
					async confirmPromptSubmitted() {},
					async submit() {
						throw new Error("must not complete a failed recovery");
					},
					async markNeedsHuman(_claimed, reason) {
						needsHumanReason = reason;
					},
				},
				sessionFactory: {
					async resume() {
						return {
							id: "bound-session",
							async open() {},
							async prepare() {},
							async submit() {
								browserSubmitCalls += 1;
							},
							async confirmSubmission() {},
							async collectResponse() {
								throw new BrowserRunnerError(
									"response_timeout",
									"post_submit",
									"needs_human",
									"The retained response did not finish",
								);
							},
							async captureEvidence() {
								throw new Error("must not capture after response failure");
							},
							async handoffMetadata() {
								throw new Error("must not create another handoff");
							},
							async close() {},
						};
					},
				},
			}),
			/retained response did not finish/,
		);
		assert.equal(browserSubmitCalls, 0);
		assert.deepEqual(needsHumanReason, {
			code: "response_timeout",
			message: "The retained response did not finish",
			phase: "post_submit",
		});
	} finally {
		await rm(stateDirectory, { recursive: true, force: true });
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
