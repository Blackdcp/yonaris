import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { DoubaoFixtureSessionFactory } from "./adapters/doubao-fixture.js";
import type { FixtureScenario, FixtureTask, SurfaceSessionFactory } from "./contracts.js";
import { RunJournal } from "./journal.js";
import { runBatch } from "./run-batch.js";
import { LocalObservationSink } from "./sink.js";
import { FixtureTaskSource } from "./task-source.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("a pre-submit transient failure is centrally accounted and retried once", async () => {
	const task = fixtureTask("pre-submit", "pre_submit_transient_then_success");
	const { summary, factory, events } = await execute([task]);

	assert.equal(summary.succeeded, 1);
	assert.equal(summary.needsHuman, 0);
	assert.equal(summary.retryQueued, 0);
	assert.match(
		summary.results[0]?.status === "succeeded" ? summary.results[0].observation.response.answerText : "",
		/StepFun/,
	);
	assert.equal(factory.calls.filter(({ operation }) => operation === "submit").length, 1);
	assert.deepEqual(
		events.filter(({ type }) => type === "attempt_started").map(({ attempt }) => attempt),
		[1, 2],
	);
	assert.equal(events.filter(({ type }) => type === "pre_submit_retry_scheduled").length, 1);
});

test("a post-submit timeout recovers in the same session and never resubmits", async () => {
	const task = fixtureTask("post-submit", "post_submit_transient_then_success");
	const { summary, factory, events } = await execute([task]);

	assert.equal(summary.succeeded, 1);
	const submitCalls = factory.calls.filter(({ operation }) => operation === "submit");
	const collectCalls = factory.calls.filter(({ operation }) => operation === "collect");
	assert.equal(submitCalls.length, 1);
	assert.equal(collectCalls.length, 2);
	assert.equal(new Set([...submitCalls, ...collectCalls].map(({ sessionId }) => sessionId)).size, 1);
	assert.equal(events.filter(({ type }) => type === "attempt_started").length, 1);
	assert.ok(events.some(({ type, data }) => type === "post_submit_recovery" && data?.submitCalledAgain === false));
});

test("an unknown submit result is confirmed in the same session with at most one submit", async () => {
	const task = fixtureTask("unknown-submit", "submit_unknown_then_confirmed");
	const { summary, factory, events } = await execute([task]);

	assert.equal(summary.succeeded, 1);
	assert.equal(factory.calls.filter(({ operation }) => operation === "submit").length, 1);
	assert.equal(factory.calls.filter(({ operation }) => operation === "confirm").length, 1);
	assert.equal(events.filter(({ type }) => type === "attempt_started").length, 1);
	assert.ok(events.some(({ type }) => type === "post_submit_recovery"));
});

test("submit intent is durably recorded before the click and confirmation follows the click", async () => {
	const task = fixtureTask("submit-order", "success");
	const order: string[] = [];
	const source = new FixtureTaskSource([task]);
	const trackedSource = {
		claimNext: source.claimNext.bind(source),
		retryPreSubmit: source.retryPreSubmit.bind(source),
		async recordSubmitIntent() {
			order.push("intent");
		},
		async confirmPromptSubmitted() {
			order.push("confirmed");
		},
	};
	const baseFactory = new DoubaoFixtureSessionFactory([task]);
	const trackedFactory: SurfaceSessionFactory = {
		async create(runnerTask, attempt) {
			const session = await baseFactory.create(runnerTask, attempt);
			return new Proxy(session, {
				get(target, property, receiver) {
					if (property !== "submit") {
						const value = Reflect.get(target, property, receiver) as unknown;
						return typeof value === "function" ? value.bind(target) : value;
					}
					return async (prompt: string) => {
						order.push("submit");
						return target.submit(prompt);
					};
				},
			});
		},
	};
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "submit-order-run");
	await runBatch({
		taskSource: trackedSource,
		sessionFactory: trackedFactory,
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
	});

	assert.deepEqual(order, ["intent", "submit", "confirmed"]);
});

test("a failed durable submit intent prevents any browser submit", async () => {
	const task = fixtureTask("intent-failure", "success");
	const baseSource = new FixtureTaskSource([task]);
	const source = {
		claimNext: baseSource.claimNext.bind(baseSource),
		retryPreSubmit: baseSource.retryPreSubmit.bind(baseSource),
		async recordSubmitIntent() {
			throw new Error("durable intent unavailable");
		},
		async confirmPromptSubmitted() {},
	};
	const factory = new DoubaoFixtureSessionFactory([task]);
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "intent-failure-run");
	const summary = await runBatch({
		taskSource: source,
		sessionFactory: factory,
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
	});

	assert.equal(summary.needsHuman, 1);
	assert.equal(factory.calls.filter(({ operation }) => operation === "submit").length, 0);
});

test("an unknown central retry result marks the run incomplete but continues with later tasks", async () => {
	const tasks = [
		fixtureTask("retry-coordination", "pre_submit_transient_then_success"),
		fixtureTask("after-retry-coordination", "success"),
	];
	const baseSource = new FixtureTaskSource(tasks);
	let markNeedsHumanCalls = 0;
	const source = {
		claimNext: baseSource.claimNext.bind(baseSource),
		async retryPreSubmit() {
			throw new Error("reclaim API unavailable after failure response");
		},
		async recordSubmitIntent() {},
		async confirmPromptSubmitted() {},
		async markNeedsHuman() {
			markNeedsHumanCalls += 1;
		},
	};
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "retry-coordination-run");
	const factory = new DoubaoFixtureSessionFactory(tasks);
	const summary = await runBatch({
		taskSource: source,
		sessionFactory: factory,
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
	});

	assert.equal(summary.status, "incomplete");
	assert.equal(summary.queuedRemaining, "unknown");
	assert.equal(summary.total, 2);
	assert.equal(summary.succeeded, 1);
	assert.equal(summary.needsHuman, 1);
	assert.equal(
		summary.results[0]?.status === "needs_human" ? summary.results[0].code : "",
		"retry_coordination_failed",
	);
	assert.equal(markNeedsHumanCalls, 1);
	assert.equal(
		factory.calls.filter(({ taskId, operation }) => taskId === tasks[0]?.id && operation === "submit").length,
		0,
	);
	assert.equal(
		factory.calls.filter(({ taskId, operation }) => taskId === tasks[1]?.id && operation === "submit").length,
		1,
	);
});

test("needs-human tasks preserve handoff metadata and do not interrupt the batch", async () => {
	const tasks = [fixtureTask("captcha", "captcha"), fixtureTask("after-captcha", "success")];
	const { summary, journal } = await execute(tasks);

	assert.equal(summary.total, 2);
	assert.equal(summary.needsHuman, 1);
	assert.equal(summary.succeeded, 1);
	const failure = summary.results.find(({ taskId }) => taskId === "captcha");
	assert.equal(failure?.status, "needs_human");
	assert.ok(failure?.status === "needs_human" && failure.handoff?.fixture);
	const handoff = JSON.parse(
		await readFile(path.join(journal.stateDirectory, "handoffs", "captcha-e54154cc0a4e97e9.json"), "utf8"),
	) as { taskId: string; code: string; profileDirectory: string };
	assert.equal(handoff.taskId, "captcha");
	assert.equal(handoff.code, "captcha");
	assert.match(handoff.profileDirectory, /^fixture-profile:/);
});

test("a failed needs-human persistence marks the run incomplete without claiming central handoff", async () => {
	const tasks = [fixtureTask("unpersisted-captcha", "captcha"), fixtureTask("after-unpersisted-captcha", "success")];
	const baseSource = new FixtureTaskSource(tasks);
	const source = {
		claimNext: baseSource.claimNext.bind(baseSource),
		retryPreSubmit: baseSource.retryPreSubmit.bind(baseSource),
		recordSubmitIntent: baseSource.recordSubmitIntent.bind(baseSource),
		confirmPromptSubmitted: baseSource.confirmPromptSubmitted.bind(baseSource),
		async markNeedsHuman() {
			throw new Error("failure API unavailable");
		},
	};
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "unpersisted-needs-human-run");
	const factory = new DoubaoFixtureSessionFactory(tasks);
	const summary = await runBatch({
		taskSource: source,
		sessionFactory: factory,
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
	});

	assert.equal(summary.status, "incomplete");
	assert.equal(summary.queuedRemaining, "unknown");
	assert.equal(summary.total, 2);
	assert.equal(summary.succeeded, 1);
	assert.equal(summary.needsHuman, 0);
	assert.deepEqual(
		summary.results.map(({ status }) => status),
		["persistence_failed", "succeeded"],
	);
	const failed = summary.results[0];
	assert.equal(failed?.status === "persistence_failed" ? failed.code : "", "needs_human_persist_failed");
});

test("specific-batch queue states distinguish settled, drained needs-human, and unfinished waiting", async () => {
	for (const [queueState, expectedStatus] of [
		["settled", "complete"],
		["drained", "needs_human"],
		["waiting", "incomplete"],
	] as const) {
		let claims = 0;
		const directory = await temporaryDirectory();
		const journal = await RunJournal.create(directory, `empty-${queueState}`);
		const summary = await runBatch({
			taskSource: {
				async claimNext() {
					claims += 1;
					return null;
				},
				queueState: () => queueState,
				async recordSubmitIntent() {},
				async confirmPromptSubmitted() {},
			},
			sessionFactory: new DoubaoFixtureSessionFactory([]),
			journal,
			sink: new LocalObservationSink(journal.runDirectory),
			batchId: "specific-batch",
			emptyClaimGracePolls: 2,
			emptyClaimPollMs: 0,
		});
		assert.equal(summary.status, expectedStatus);
		assert.equal(claims, queueState === "waiting" ? 2 : 1);
	}
});

test("an unscoped drained queue is normal poll idle rather than an incomplete run", async () => {
	let claims = 0;
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "global-idle");
	const summary = await runBatch({
		taskSource: {
			async claimNext() {
				claims += 1;
				return null;
			},
			queueState: () => "drained",
			async recordSubmitIntent() {},
			async confirmPromptSubmitted() {},
		},
		sessionFactory: new DoubaoFixtureSessionFactory([]),
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
		emptyClaimGracePolls: 2,
		emptyClaimPollMs: 0,
	});
	assert.equal(summary.status, "idle");
	assert.equal(summary.total, 0);
	assert.equal(claims, 1);
});

test("remote-style success deletes uploaded evidence and stores only a redacted local summary", async () => {
	const task = {
		...fixtureTask("remote-retention", "success"),
		promptText: "confidential customer prompt",
		fixtureAnswer: "confidential customer answer",
	};
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "remote-retention-run");
	const summary = await runBatch({
		taskSource: new FixtureTaskSource([task]),
		sessionFactory: new DoubaoFixtureSessionFactory([task]),
		journal,
		sink: { retainLocalArtifacts: false, async submit() {} },
	});
	assert.equal(summary.succeeded, 1);
	const success = summary.results[0];
	assert.equal(success?.status, "succeeded");
	if (success?.status !== "succeeded") throw new Error("Expected a successful fixture result");
	for (const artifact of success.observation.evidence) assert.equal(await exists(artifact.path), false);
	const storedSummary = await readFile(journal.summaryPath, "utf8");
	assert.doesNotMatch(storedSummary, /confidential customer prompt|confidential customer answer|doubao\.com|evidence/);
	const journalText = await readFile(journal.eventsPath, "utf8");
	assert.doesNotMatch(journalText, new RegExp(directory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("state directories and sensitive files are private on POSIX", { skip: process.platform === "win32" }, async () => {
	const { journal } = await execute([fixtureTask("permissions", "success")]);
	const observationPath = path.join(journal.runDirectory, "observations", "permissions.json");
	const screenshotPath = path.join(journal.runDirectory, "evidence", "permissions", "attempt-1", "page.png");

	assert.equal((await stat(journal.runDirectory)).mode & 0o777, 0o700);
	assert.equal((await stat(journal.eventsPath)).mode & 0o777, 0o600);
	assert.equal((await stat(journal.summaryPath)).mode & 0o777, 0o600);
	assert.equal((await stat(observationPath)).mode & 0o777, 0o600);
	assert.equal((await stat(screenshotPath)).mode & 0o777, 0o600);
});

async function execute(tasks: FixtureTask[]) {
	const directory = await temporaryDirectory();
	const journal = await RunJournal.create(directory, "test-run");
	const factory = new DoubaoFixtureSessionFactory(tasks);
	const summary = await runBatch({
		taskSource: new FixtureTaskSource(tasks),
		sessionFactory: factory,
		journal,
		sink: new LocalObservationSink(journal.runDirectory),
	});
	const events = (await readFile(journal.eventsPath, "utf8"))
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as { type: string; attempt?: number; data?: Record<string, unknown> });
	return { summary, factory, journal, events };
}

function fixtureTask(id: string, scenario: FixtureScenario): FixtureTask {
	return {
		id,
		batchId: "fixture-batch",
		brandId: "stepfun",
		promptText: `fixture prompt ${id}`,
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sampleIndex: 1,
		sessionRequirement: "anonymous_clean",
		searchRequirement: "forbidden",
		evaluationRole: "observation",
		automationAttemptCount: 1,
		leaseGeneration: 1,
		scenario,
	};
}

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), "yonaris-browser-runner-"));
	temporaryDirectories.push(directory);
	return directory;
}

async function exists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}
