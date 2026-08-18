import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareResponseSnapshotBundle } from "@workspace/lib/response-snapshots/contract";
import {
	BACKFILL_RESPONSE_SNAPSHOT_WRITE_SET,
	buildResponseSnapshotBackfillDraft,
	buildResponseSnapshotBackfillPlan,
	classifyResponseSnapshotBackfillActions,
	executeResponseSnapshotBackfillActions,
	parseResponseSnapshotBackfillCli,
	parseResponseSnapshotBackfillRequest,
	responseSnapshotBackfillFingerprint,
	summarizeResponseSnapshotBackfillDryRun,
} from "./backfill-response-snapshots-policy";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_RUN_ID = "44444444-4444-4444-8444-444444444444";
const THIRD_RUN_ID = "55555555-5555-4555-8555-555555555555";
const FOURTH_RUN_ID = "66666666-6666-4666-8666-666666666666";
const SOURCE_SHA = "a".repeat(40);

describe("response snapshot backfill policy", () => {
	it("defaults to dry-run and requires an immutable source SHA", () => {
		assert.deepEqual(parseResponseSnapshotBackfillCli(["--request-file", "request.json", "--source-sha", SOURCE_SHA]), {
			requestFile: "request.json",
			sourceSha: SOURCE_SHA,
			apply: false,
		});
		assert.throws(() => parseResponseSnapshotBackfillCli(["--request-file", "request.json"]), /source SHA/i);
	});

	it("accepts only exact brand, UTC window, channels and run identities", () => {
		const request = parseResponseSnapshotBackfillRequest(validRequest());
		assert.equal(request.brandId, "stepfun");
		assert.deepEqual(request.channelsExact, ["doubao"]);
		assert.deepEqual(request.runIds, [RUN_ID]);
		assert.throws(
			() => parseResponseSnapshotBackfillRequest({ ...validRequest(), runIds: [RUN_ID, RUN_ID] }),
			/unique/i,
		);
		assert.throws(
			() =>
				parseResponseSnapshotBackfillRequest({ ...validRequest(), toObservedAtExclusive: "2026-08-14T00:00:00.000Z" }),
			/window/i,
		);
	});

	it("fails closed unless the exact successful run cohort and citations match", () => {
		const row = validRun();
		const fingerprint = responseSnapshotBackfillFingerprint([row], []);
		const approved = parseResponseSnapshotBackfillRequest({
			...validRequest(),
			expectedRunFingerprint: fingerprint,
		});
		const plan = buildPlan(approved, [row], []);
		assert.equal(plan.expectedRunCount, 1);
		assert.equal(plan.runs[0]?.contentSource, "reconstructed_from_historical_run");
		assert.throws(() => buildPlan(approved, [{ ...row, attemptStatus: "failed" }], []), /succeeded/i);
		assert.throws(
			() =>
				buildPlan(
					approved,
					[row],
					[{ promptRunId: RUN_ID, promptId: "wrong", brandId: "stepfun", model: "doubao", citationIndex: 0 }],
				),
			/citation identity/i,
		);
	});

	it("permits writes only to snapshot reservation/outbox tables", () => {
		assert.deepEqual(BACKFILL_RESPONSE_SNAPSHOT_WRITE_SET, ["response_snapshots", "response_snapshot_outbox"]);
	});

	it("does not expose the unavailable query sentinel in a reconstructed backfill snapshot", () => {
		const run = validPpioRun({ webQueries: ["unavailable"], webSearchEnabled: true });
		const plan = buildPlan(approvedPpioRequest([run]), [run], []);
		const [plannedRun] = plan.runs;
		assert.ok(plannedRun);

		const draft = buildResponseSnapshotBackfillDraft(plannedRun);

		assert.deepEqual(draft.webQueries, []);
		assert.equal(draft.queryAvailability, "unavailable");
	});

	it("safely bounds persisted citation titles when reconstructing a historical snapshot", () => {
		const run = validPpioRun();
		const citations = [
			{
				promptRunId: run.runId,
				promptId: run.promptId,
				brandId: run.brandId,
				model: run.model,
				citationIndex: 0,
				url: "https://example.com/source",
				title: "x".repeat(1_194),
				domain: "example.com",
			},
		];
		const request = parseResponseSnapshotBackfillRequest({
			...validPpioRequest(),
			expectedRunFingerprint: responseSnapshotBackfillFingerprint([run], citations),
		});
		const plan = buildPlan(request, [run], citations);
		const plannedRun = plan.runs[0];
		assert.ok(plannedRun);

		const draft = buildResponseSnapshotBackfillDraft(plannedRun);

		assert.equal(draft.citations[0]?.title?.length, 1_000);
		assert.doesNotThrow(() => prepareResponseSnapshotBundle(draft));
	});

	it("accepts PPIO only with an explicit snapshot contract failure source", () => {
		const request = parseResponseSnapshotBackfillRequest(validPpioRequest());
		assert.equal(request.brandId, "ppio");
		assert.equal(request.sourceFailureCode, "snapshot_contract_invalid");
		assert.throws(() => {
			const { sourceFailureCode: _, ...missingFailureCode } = validPpioRequest();
			return parseResponseSnapshotBackfillRequest(missingFailureCode);
		}, /failure code|reviewed fields/i);
		assert.throws(
			() =>
				parseResponseSnapshotBackfillRequest({
					...validPpioRequest(),
					sourceFailureCode: "snapshot_prepare_failed",
				}),
			/snapshot_contract_invalid/i,
		);
		assert.throws(
			() => parseResponseSnapshotBackfillRequest({ ...validPpioRequest(), brandId: "another-brand" }),
			/restricted|brand/i,
		);
	});

	it("rebuilds only the exact reviewed PPIO failures from persisted run data", () => {
		const firstRun = validPpioRun();
		const secondRun = validPpioRun({ runId: SECOND_RUN_ID });
		const request = approvedPpioRequest([firstRun, secondRun]);
		const plan = buildPlan(request, [firstRun, secondRun], []);

		const actions = classifyResponseSnapshotBackfillActions(request, plan.runs, [
			currentSnapshot(firstRun, "failed", "snapshot_contract_invalid"),
			currentSnapshot(secondRun, "failed", "snapshot_contract_invalid"),
		]);

		assert.deepEqual(
			actions.map(({ run, action }) => ({ runId: run.runId, answerText: run.answerText, action })),
			[
				{ runId: RUN_ID, answerText: "PPIO provides cloud infrastructure.", action: "rebuild" },
				{ runId: SECOND_RUN_ID, answerText: "PPIO provides cloud infrastructure.", action: "rebuild" },
			],
		);
	});

	it("reports four current PPIO failures as rebuilds without claiming creates", () => {
		const runs = [
			validPpioRun(),
			validPpioRun({ runId: SECOND_RUN_ID }),
			validPpioRun({ runId: THIRD_RUN_ID }),
			validPpioRun({ runId: FOURTH_RUN_ID }),
		];
		const request = approvedPpioRequest(runs);
		const plan = buildPlan(request, runs, []);
		const snapshots = runs.map((run) => currentSnapshot(run, "failed", "snapshot_contract_invalid"));
		const actions = classifyResponseSnapshotBackfillActions(request, plan.runs, snapshots);

		assert.deepEqual(summarizeResponseSnapshotBackfillDryRun(actions, snapshots), {
			existing: 4,
			wouldCreate: 0,
			wouldRebuild: 4,
		});
	});

	it("preserves StepFun missing-snapshot wouldCreate semantics", () => {
		const run = validRun();
		const request = parseResponseSnapshotBackfillRequest({
			...validRequest(),
			expectedRunFingerprint: responseSnapshotBackfillFingerprint([run], []),
		});
		const plan = buildPlan(request, [run], []);
		const actions = classifyResponseSnapshotBackfillActions(request, plan.runs, []);

		assert.deepEqual(summarizeResponseSnapshotBackfillDryRun(actions, []), {
			existing: 0,
			wouldCreate: 1,
			wouldRebuild: 0,
		});
	});

	it("ignores other same-window runs but rejects an unreviewed PPIO contract failure", () => {
		const firstRun = validPpioRun();
		const secondRun = validPpioRun({ runId: SECOND_RUN_ID });
		const request = approvedPpioRequest([firstRun, secondRun]);
		const requestedFailuresAndUnrelatedReadyRun: Parameters<typeof buildResponseSnapshotBackfillPlan>[3] = [
			{
				runId: RUN_ID,
				currentSnapshotStatus: "failed",
				currentSnapshotFailureCode: "snapshot_contract_invalid",
			},
			{
				runId: SECOND_RUN_ID,
				currentSnapshotStatus: "failed",
				currentSnapshotFailureCode: "snapshot_contract_invalid",
			},
			{ runId: THIRD_RUN_ID, currentSnapshotStatus: "ready", currentSnapshotFailureCode: null },
		];

		assert.doesNotThrow(() =>
			buildResponseSnapshotBackfillPlan(request, [firstRun, secondRun], [], requestedFailuresAndUnrelatedReadyRun),
		);
		assert.throws(
			() =>
				buildResponseSnapshotBackfillPlan(
					request,
					[firstRun, secondRun],
					[],
					requestedFailuresAndUnrelatedReadyRun.slice(0, 1),
				),
			/missing|cohort/i,
		);
		assert.throws(
			() =>
				buildResponseSnapshotBackfillPlan(
					request,
					[firstRun, secondRun],
					[],
					[
						...requestedFailuresAndUnrelatedReadyRun.slice(0, 2),
						{
							runId: THIRD_RUN_ID,
							currentSnapshotStatus: "failed",
							currentSnapshotFailureCode: "snapshot_contract_invalid",
						},
					],
				),
			/unreviewed|cohort/i,
		);
	});

	it("treats already-ready PPIO snapshots as an idempotent no-op", () => {
		const run = validPpioRun();
		const request = approvedPpioRequest([run]);
		const plan = buildResponseSnapshotBackfillPlan(
			request,
			[run],
			[],
			[{ runId: run.runId, currentSnapshotStatus: "ready", currentSnapshotFailureCode: null }],
		);

		assert.deepEqual(
			classifyResponseSnapshotBackfillActions(request, plan.runs, [currentSnapshot(run, "ready", null)]).map(
				({ action }) => action,
			),
			["already_ready"],
		);
	});

	it("rebuilds from persisted plans without invoking a provider", async () => {
		const run = validPpioRun();
		const request = approvedPpioRequest([run]);
		const plan = buildPlan(request, [run], []);
		const actions = classifyResponseSnapshotBackfillActions(request, plan.runs, [
			currentSnapshot(run, "failed", "snapshot_contract_invalid"),
		]);
		let providerCalls = 0;
		const persistedAnswers: string[] = [];
		const dependencies = {
			rebuild: async (persistedRun: (typeof plan.runs)[number]) => {
				persistedAnswers.push(persistedRun.answerText);
				return { status: "ready" as const, queued: true };
			},
			triggerProvider: async () => {
				providerCalls += 1;
			},
		};

		const receipt = await executeResponseSnapshotBackfillActions(actions, dependencies);

		assert.deepEqual(persistedAnswers, ["PPIO provides cloud infrastructure."]);
		assert.equal(providerCalls, 0);
		assert.deepEqual(receipt, { created: 1, alreadyReady: 0, pending: 0, failed: 0 });
	});

	it("does not write an already-ready PPIO snapshot", async () => {
		const run = validPpioRun();
		const request = approvedPpioRequest([run]);
		const plan = buildPlan(request, [run], []);
		const actions = classifyResponseSnapshotBackfillActions(request, plan.runs, [currentSnapshot(run, "ready", null)]);
		let writes = 0;

		const receipt = await executeResponseSnapshotBackfillActions(actions, {
			rebuild: async () => {
				writes += 1;
				return { status: "ready", queued: true };
			},
		});

		assert.equal(writes, 0);
		assert.deepEqual(receipt, { created: 0, alreadyReady: 1, pending: 0, failed: 0 });
	});

	it("rejects PPIO snapshots outside the exact reviewed failure cohort", () => {
		const run = validPpioRun();
		const request = approvedPpioRequest([run]);
		const plan = buildPlan(request, [run], []);

		for (const currentRows of [
			[],
			[currentSnapshot({ ...run, runId: SECOND_RUN_ID }, "failed", "snapshot_contract_invalid")],
			[currentSnapshot(run, "failed", "snapshot_prepare_failed")],
			[currentSnapshot(run, "pending", null)],
			[currentSnapshot(run, "expired", null)],
			[currentSnapshot({ ...run, brandId: "another-brand" }, "failed", "snapshot_contract_invalid")],
		]) {
			assert.throws(
				() => classifyResponseSnapshotBackfillActions(request, plan.runs, currentRows),
				/PPIO|identity|status|failure/i,
			);
		}
	});

	it("preserves StepFun ready, pending, failed, and absent snapshot behavior", () => {
		const run = validRun();
		const request = parseResponseSnapshotBackfillRequest({
			...validRequest(),
			expectedRunFingerprint: responseSnapshotBackfillFingerprint([run], []),
		});
		const plan = buildPlan(request, [run], []);
		const actionFor = (currentRows: ReturnType<typeof currentSnapshot>[]) =>
			classifyResponseSnapshotBackfillActions(request, plan.runs, currentRows)[0]?.action;

		assert.equal(actionFor([currentSnapshot(run, "ready", null)]), "already_ready");
		assert.equal(actionFor([currentSnapshot(run, "pending", null)]), "pending");
		assert.equal(actionFor([currentSnapshot(run, "failed", "snapshot_contract_invalid")]), "rebuild");
		assert.equal(actionFor([]), "rebuild");
	});
});

function buildPlan(
	request: Parameters<typeof buildResponseSnapshotBackfillPlan>[0],
	runs: Parameters<typeof buildResponseSnapshotBackfillPlan>[1],
	citations: Parameters<typeof buildResponseSnapshotBackfillPlan>[2],
) {
	return buildResponseSnapshotBackfillPlan(
		request,
		runs,
		citations,
		runs.map((run) => ({
			runId: run.runId,
			currentSnapshotStatus: request.brandId === "ppio" ? ("failed" as const) : null,
			currentSnapshotFailureCode: request.brandId === "ppio" ? "snapshot_contract_invalid" : null,
		})),
	);
}

function validRequest() {
	return {
		schemaVersion: 1,
		operation: "backfill-response-snapshots",
		requestId: "stepfun-snapshot-backfill-20260815",
		brandId: "stepfun",
		fromObservedAt: "2026-08-14T00:00:00.000Z",
		toObservedAtExclusive: "2026-08-16T00:00:00.000Z",
		channelsExact: ["doubao"],
		runIds: [RUN_ID],
		expectedRunCount: 1,
		expectedRunFingerprint: "0".repeat(64),
		sourceCommitSha: SOURCE_SHA,
	};
}

function validRun() {
	return {
		runId: RUN_ID,
		brandId: "stepfun",
		promptId: "22222222-2222-4222-8222-222222222222",
		scopeId: "33333333-3333-4333-8333-333333333333",
		promptBrandId: "stepfun",
		promptScopeId: "33333333-3333-4333-8333-333333333333",
		promptText: "StepFun 是什么公司？",
		answerText: "StepFun 是一家人工智能公司。",
		model: "doubao",
		provider: "local-pc-reviewed",
		version: "consumer-web",
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "reviewed_consumer.deepseek",
		webSearchEnabled: true,
		webQueries: [] as string[],
		brandMentioned: true,
		competitorsMentioned: [],
		observedAt: new Date("2026-08-15T01:00:00.000Z"),
		attemptStatus: "succeeded",
		scopeMarket: "CN",
		scopeLocale: "zh-CN",
		scopeTimezone: "Asia/Shanghai",
	};
}

function validPpioRequest() {
	return {
		...validRequest(),
		requestId: "ppio-snapshot-contract-backfill-20260818",
		brandId: "ppio",
		channelsExact: ["google-ai-mode"],
		sourceFailureCode: "snapshot_contract_invalid",
	};
}

function validPpioRun(overrides: Partial<ReturnType<typeof validRun>> = {}) {
	return {
		...validRun(),
		brandId: "ppio",
		promptBrandId: "ppio",
		promptText: "Which infrastructure providers support AI workloads?",
		answerText: "PPIO provides cloud infrastructure.",
		model: "google-ai-mode",
		provider: "brightdata",
		version: "google-ai-mode",
		surfaceTargetKey: "google-ai-mode.consumer_web",
		captureRouteKey: "brightdata.google-ai-mode",
		scopeMarket: "US",
		scopeLocale: "en-US",
		scopeTimezone: "UTC",
		...overrides,
	};
}

function approvedPpioRequest(runs: ReturnType<typeof validPpioRun>[]) {
	return parseResponseSnapshotBackfillRequest({
		...validPpioRequest(),
		runIds: runs.map((run) => run.runId).sort(),
		expectedRunCount: runs.length,
		expectedRunFingerprint: responseSnapshotBackfillFingerprint(runs, []),
	});
}

function currentSnapshot(
	run: ReturnType<typeof validPpioRun>,
	status: "pending" | "ready" | "failed" | "expired",
	failureCode: string | null,
) {
	return {
		promptRunId: run.runId,
		brandId: run.brandId,
		promptId: run.promptId,
		scopeId: run.scopeId,
		status,
		failureCode,
	};
}
