import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	BACKFILL_RESPONSE_SNAPSHOT_WRITE_SET,
	buildResponseSnapshotBackfillPlan,
	parseResponseSnapshotBackfillCli,
	parseResponseSnapshotBackfillRequest,
	responseSnapshotBackfillFingerprint,
} from "./backfill-response-snapshots-policy";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
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
		const plan = buildResponseSnapshotBackfillPlan(approved, [row], []);
		assert.equal(plan.expectedRunCount, 1);
		assert.equal(plan.runs[0]?.contentSource, "reconstructed_from_historical_run");
		assert.throws(
			() => buildResponseSnapshotBackfillPlan(approved, [{ ...row, attemptStatus: "failed" }], []),
			/succeeded/i,
		);
		assert.throws(
			() =>
				buildResponseSnapshotBackfillPlan(
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
});

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
		webQueries: [],
		brandMentioned: true,
		competitorsMentioned: [],
		observedAt: new Date("2026-08-15T01:00:00.000Z"),
		attemptStatus: "succeeded",
		scopeMarket: "CN",
		scopeLocale: "zh-CN",
		scopeTimezone: "Asia/Shanghai",
	};
}
