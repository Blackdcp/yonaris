import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { SurfaceResponse } from "./contracts.js";
import {
	approveDeepSeekUat,
	DeepSeekCaptureFailure,
	type DeepSeekCaptureSession,
	type DeepSeekCaptureSessionFactory,
	runDeepSeekCohort,
	runDeepSeekUatOnce,
} from "./deepseek-local-capture.js";

type Scenario = "success" | "pre_submit_navigation_once" | "post_submit_unknown_once";

class RecordingFactory implements DeepSeekCaptureSessionFactory {
	readonly scenarios: Map<string, Scenario>;
	readonly opens = new Map<string, number>();
	readonly submits = new Map<string, number>();
	readonly resumes = new Map<string, number>();

	constructor(scenarios: Record<string, Scenario> = {}) {
		this.scenarios = new Map(Object.entries(scenarios));
	}

	async create(externalId: string, promptText: string): Promise<DeepSeekCaptureSession> {
		this.opens.set(externalId, (this.opens.get(externalId) ?? 0) + 1);
		const attempt = this.opens.get(externalId) ?? 1;
		if (this.scenarios.get(externalId) === "pre_submit_navigation_once" && attempt === 1) {
			throw new DeepSeekCaptureFailure("navigation_timeout", "pre_submit", true);
		}
		return this.session(externalId, promptText, false);
	}

	async resume(externalId: string, promptText: string, pageUrl: string): Promise<DeepSeekCaptureSession> {
		assert.match(pageUrl, /^https:\/\/chat\.deepseek\.com\/a\/chat\/s\//);
		this.resumes.set(externalId, (this.resumes.get(externalId) ?? 0) + 1);
		return this.session(externalId, promptText, true);
	}

	private session(externalId: string, promptText: string, resumed: boolean): DeepSeekCaptureSession {
		return {
			openNewConversation: async () => undefined,
			prepare: async () => undefined,
			submit: async () => {
				this.submits.set(externalId, (this.submits.get(externalId) ?? 0) + 1);
				if (this.scenarios.get(externalId) === "post_submit_unknown_once" && !resumed) {
					throw new DeepSeekCaptureFailure("post_submit_unknown", "post_submit", false, {
						pageUrl: `https://chat.deepseek.com/a/chat/s/${externalId}`,
					});
				}
			},
			confirmSubmission: async (actualPrompt) => assert.equal(actualPrompt, promptText),
			collectResponse: async (): Promise<SurfaceResponse> => ({
				answerText: `有效回答 ${externalId}`,
				pageUrl: `https://chat.deepseek.com/a/chat/s/${externalId}`,
				observedAt: "2026-08-14T08:00:00.000Z",
				webSearchObserved: null,
				webQueries: [],
				citations: [],
			}),
			captureEvidence: async () => ({
				domSnapshot: "<!doctype html><html><body>redacted fixture</body></html>",
				screenshotPng: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]),
			}),
			close: async () => undefined,
		};
	}
}

async function approvedState(): Promise<string> {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-capture-"));
	await approveDeepSeekUat(stateDirectory, {
		selectorFingerprint: "deepseek-selector-contract-20260814",
		profileIdentityHash: "c".repeat(64),
		browserMajor: 140,
		approvedAt: "2026-08-14T07:00:00.000Z",
	});
	return stateDirectory;
}

test("runs the exact eighteen slots and writes a reviewed manifest only after all succeed", async () => {
	const stateDirectory = await approvedState();
	const outputPath = path.join(stateDirectory, "reviewed.json");
	const factory = new RecordingFactory();
	const receipt = await runDeepSeekCohort({
		stateDirectory,
		outputPath,
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: factory,
	});
	assert.deepEqual(
		{ status: receipt.status, planned: receipt.planned, captured: receipt.captured, needsHuman: receipt.needsHuman },
		{ status: "complete", planned: 18, captured: 18, needsHuman: 0 },
	);
	assert.equal(
		[...factory.opens.values()].reduce((sum, count) => sum + count, 0),
		18,
	);
	assert.equal(
		[...factory.submits.values()].reduce((sum, count) => sum + count, 0),
		18,
	);
	const manifest = JSON.parse(await readFile(outputPath, "utf8")) as { observations: unknown[] };
	assert.equal(manifest.observations.length, 18);
	assert.match(receipt.manifestFingerprint ?? "", /^[0-9a-f]{64}$/);
});

test("refuses the cohort before opening a page when UAT approval is missing or mismatched", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-no-uat-"));
	const factory = new RecordingFactory();
	await assert.rejects(
		() =>
			runDeepSeekCohort({
				stateDirectory,
				outputPath: path.join(stateDirectory, "reviewed.json"),
				selectorFingerprint: "deepseek-selector-contract-20260814",
				sessionFactory: factory,
			}),
		/approved DeepSeek UAT/,
	);
	assert.equal(factory.opens.size, 0);
});

test("retries one transient pre-submit navigation failure and then continues the cohort", async () => {
	const stateDirectory = await approvedState();
	const externalId = "stepfun-local-pc-deepseek-20260814-01-p1-s1";
	const factory = new RecordingFactory({ [externalId]: "pre_submit_navigation_once" });
	const receipt = await runDeepSeekCohort({
		stateDirectory,
		outputPath: path.join(stateDirectory, "reviewed.json"),
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: factory,
	});
	assert.equal(receipt.status, "complete");
	assert.equal(factory.opens.get(externalId), 2);
	assert.equal(factory.submits.get(externalId), 1);
});

test("a post-submit unknown never resubmits and resumes only the retained conversation", async () => {
	const stateDirectory = await approvedState();
	const outputPath = path.join(stateDirectory, "reviewed.json");
	const externalId = "stepfun-local-pc-deepseek-20260814-01-p1-s1";
	const firstFactory = new RecordingFactory({ [externalId]: "post_submit_unknown_once" });
	const first = await runDeepSeekCohort({
		stateDirectory,
		outputPath,
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: firstFactory,
	});
	assert.equal(first.status, "incomplete");
	assert.equal(first.captured, 17);
	assert.equal(first.needsHuman, 1);
	assert.equal(firstFactory.submits.get(externalId), 1);
	await assert.rejects(() => readFile(outputPath, "utf8"), /ENOENT/);

	const recoveryFactory = new RecordingFactory();
	const second = await runDeepSeekCohort({
		stateDirectory,
		outputPath,
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: recoveryFactory,
	});
	assert.equal(second.status, "complete");
	assert.equal(recoveryFactory.submits.get(externalId) ?? 0, 0);
	assert.equal(recoveryFactory.resumes.get(externalId), 1);
});

test("the public receipt contains no prompts, answers, profile paths or secret labels", async () => {
	const stateDirectory = await approvedState();
	const receipt = await runDeepSeekCohort({
		stateDirectory,
		outputPath: path.join(stateDirectory, "reviewed.json"),
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: new RecordingFactory(),
	});
	const serialized = JSON.stringify(receipt);
	for (const forbidden of ["国内有哪些", "有效回答", "profile", "password", "token", "cookie", "storage"]) {
		assert.equal(serialized.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase()), false);
	}
});

test("rejects a captured slot whose prompt hash no longer matches the frozen contract", async () => {
	const stateDirectory = await approvedState();
	const outputPath = path.join(stateDirectory, "reviewed.json");
	await runDeepSeekCohort({
		stateDirectory,
		outputPath,
		selectorFingerprint: "deepseek-selector-contract-20260814",
		sessionFactory: new RecordingFactory(),
	});
	const statePath = path.join(stateDirectory, "slots", "stepfun-local-pc-deepseek-20260814-01-p1-s1.json");
	const state = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
	await writeFile(statePath, `${JSON.stringify({ ...state, promptSha256: "0".repeat(64) })}\n`, "utf8");
	await assert.rejects(
		() =>
			runDeepSeekCohort({
				stateDirectory,
				outputPath,
				selectorFingerprint: "deepseek-selector-contract-20260814",
				sessionFactory: new RecordingFactory(),
			}),
		/prompt hash does not match the frozen capture contract/,
	);
});

test("one-prompt UAT records intent before one submit and approves the exact selector fingerprint", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-uat-"));
	const factory = new RecordingFactory();
	const receipt = await runDeepSeekUatOnce({
		stateDirectory,
		selectorFingerprint: "deepseek-selector-contract-20260814",
		profileIdentityHash: "d".repeat(64),
		browserMajor: 140,
		sessionFactory: factory,
		now: () => new Date("2026-08-14T07:00:00.000Z"),
	});
	assert.deepEqual(receipt, { status: "approved", selectorFingerprint: "deepseek-selector-contract-20260814" });
	assert.equal(
		[...factory.submits.values()].reduce((sum, count) => sum + count, 0),
		1,
	);
	await assert.rejects(
		() =>
			runDeepSeekUatOnce({
				stateDirectory,
				selectorFingerprint: "deepseek-selector-contract-20260814",
				profileIdentityHash: "d".repeat(64),
				browserMajor: 140,
				sessionFactory: factory,
			}),
		/UAT intent already exists/,
	);
	assert.equal(
		[...factory.submits.values()].reduce((sum, count) => sum + count, 0),
		1,
	);
});

test("a failed UAT after intent never writes approval or resubmits", async () => {
	const stateDirectory = await mkdtemp(path.join(tmpdir(), "yonaris-deepseek-failed-uat-"));
	const uatId = "deepseek-nonscored-uat";
	const factory = new RecordingFactory({ [uatId]: "post_submit_unknown_once" });
	await assert.rejects(
		() =>
			runDeepSeekUatOnce({
				stateDirectory,
				selectorFingerprint: "deepseek-selector-contract-20260814",
				profileIdentityHash: "d".repeat(64),
				browserMajor: 140,
				sessionFactory: factory,
			}),
		/post_submit_unknown/,
	);
	assert.equal(factory.submits.get(uatId), 1);
	await assert.rejects(
		() =>
			runDeepSeekUatOnce({
				stateDirectory,
				selectorFingerprint: "deepseek-selector-contract-20260814",
				profileIdentityHash: "d".repeat(64),
				browserMajor: 140,
				sessionFactory: factory,
			}),
		/UAT intent already exists/,
	);
});
