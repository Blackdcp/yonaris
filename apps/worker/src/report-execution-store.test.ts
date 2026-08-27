import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { db } from "@workspace/lib/db/db";
import { reports } from "@workspace/lib/db/schema";
import {
	activeReportClaimPredicate,
	claimableReportPredicate,
	claimedReportCompletionUpdate,
	claimedReportFailureUpdate,
	claimedReportProgressUpdate,
	createReportExecutionClaim,
	pendingReportFailureUpdate,
	pendingReportPredicate,
	type ReportExecutionClaim,
	reportClaimUpdate,
} from "./report-execution-store";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";
const CLAIM_TOKEN = new Date("2026-08-27T10:11:12.345Z");

const claim: ReportExecutionClaim = {
	reportId: REPORT_ID,
	outputLanguage: "zh-CN",
	token: CLAIM_TOKEN,
};

function selectWith(predicate: ReturnType<typeof pendingReportPredicate>) {
	return db.select({ id: reports.id }).from(reports).where(predicate).toSQL();
}

describe("report execution SQL predicates", () => {
	it("creates a token newer than the persisted row when the host clock has not advanced", () => {
		const created = createReportExecutionClaim(
			REPORT_ID,
			"en",
			new Date("2026-08-27T10:11:12.000Z"),
			new Date("2026-08-27T10:11:12.345Z"),
		);

		assert.equal(created.token.toISOString(), "2026-08-27T10:11:12.346Z");
	});

	it("limits deterministic rejection to the pending report row", () => {
		const query = selectWith(pendingReportPredicate(REPORT_ID));

		assert.match(query.sql, /"reports"\."id" = \$1/);
		assert.match(query.sql, /"reports"\."status" = \$2/);
		assert.deepEqual(query.params, [REPORT_ID, "pending"]);
	});

	it("claims only a language-exact pending or failed report", () => {
		const query = selectWith(claimableReportPredicate(claim));

		assert.match(query.sql, /"reports"\."id" = \$1/);
		assert.match(query.sql, /"reports"\."output_language" = \$2/);
		assert.match(query.sql, /"reports"\."status" in \(\$3, \$4\)/i);
		assert.deepEqual(query.params, [REPORT_ID, "zh-CN", "pending", "failed"]);
	});

	it("emits the complete conditional-failure update for a rejected pending job", () => {
		const failedAt = new Date("2026-08-27T10:12:00.000Z");
		const query = pendingReportFailureUpdate(REPORT_ID, failedAt).toSQL();

		assert.match(query.sql, /set "status" = \$1, "updated_at" = \$2/);
		assert.match(query.sql, /"reports"\."id" = \$3/);
		assert.match(query.sql, /"reports"\."status" = \$4/);
		assert.match(query.sql, /returning "id"/);
		assert.deepEqual(query.params, ["failed", "2026-08-27T10:12:00.000Z", REPORT_ID, "pending"]);
	});

	it("emits the complete atomic claim update with its exact epoch token", () => {
		const query = reportClaimUpdate(claim).toSQL();

		assert.match(query.sql, /set "status" = \$1, "updated_at" = \$2/);
		assert.match(query.sql, /"reports"\."id" = \$3/);
		assert.match(query.sql, /"reports"\."output_language" = \$4/);
		assert.match(query.sql, /"reports"\."status" in \(\$5, \$6\)/i);
		assert.match(query.sql, /returning "id"/);
		assert.deepEqual(query.params, ["processing", "2026-08-27T10:11:12.345Z", REPORT_ID, "zh-CN", "pending", "failed"]);
	});

	it("matches a live claim by id, language, processing status, and exact token", () => {
		const query = selectWith(activeReportClaimPredicate(claim));

		assert.match(query.sql, /"reports"\."id" = \$1/);
		assert.match(query.sql, /"reports"\."output_language" = \$2/);
		assert.match(query.sql, /"reports"\."status" = \$3/);
		assert.match(query.sql, /"reports"\."updated_at" = \$4/);
		assert.deepEqual(query.params, [REPORT_ID, "zh-CN", "processing", "2026-08-27T10:11:12.345Z"]);
	});

	it("preserves the exact claim token while updating progress despite the schema on-update hook", () => {
		const query = claimedReportProgressUpdate(claim, 42.4).toSQL();

		assert.match(query.sql, /set "progress" = \$1, "updated_at" = \$2/);
		assert.match(query.sql, /"reports"\."updated_at" = \$6/);
		assert.deepEqual(query.params, [
			42,
			"2026-08-27T10:11:12.345Z",
			REPORT_ID,
			"zh-CN",
			"processing",
			"2026-08-27T10:11:12.345Z",
		]);
	});

	it("atomically completes at progress 100 under the exact active claim", () => {
		const completedAt = new Date("2026-08-27T10:12:00.000Z");
		const query = claimedReportCompletionUpdate(claim, { raw: "evidence" }, completedAt).toSQL();

		assert.match(query.sql, /set "status" = \$1, "progress" = \$2/);
		assert.match(query.sql, /"reports"\."updated_at" = \$9/);
		assert.equal(query.params[0], "completed");
		assert.equal(query.params[1], 100);
		assert.deepEqual(query.params.slice(-4), [REPORT_ID, "zh-CN", "processing", "2026-08-27T10:11:12.345Z"]);
	});

	it("emits the complete active-claim failure update", () => {
		const failedAt = new Date("2026-08-27T10:12:00.000Z");
		const query = claimedReportFailureUpdate(claim, failedAt).toSQL();

		assert.match(query.sql, /set "status" = \$1, "updated_at" = \$2/);
		assert.match(query.sql, /"reports"\."updated_at" = \$6/);
		assert.match(query.sql, /returning "id"/);
		assert.deepEqual(query.params, [
			"failed",
			"2026-08-27T10:12:00.000Z",
			REPORT_ID,
			"zh-CN",
			"processing",
			"2026-08-27T10:11:12.345Z",
		]);
	});
});
