import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { canClaimOverseasRunCall, summarizeOverseasRunCallStates } from "./overseas-runs";
import { overseasRunCallStatusEnum, overseasRunCalls, overseasRunCohortStatusEnum, overseasRunCohorts } from "./schema";

describe("overseas Run now persistence contract", () => {
	it("defines the reviewed cohort and paid-call lifecycles", () => {
		expect(overseasRunCohortStatusEnum.enumValues).toEqual(["dispatch_pending", "running", "completed"]);
		expect(overseasRunCallStatusEnum.enumValues).toEqual(["queued", "running", "succeeded", "failed"]);
	});

	it("enforces cohort idempotency and one slot per prompt, surface, and sample", () => {
		const cohort = getTableConfig(overseasRunCohorts);
		const call = getTableConfig(overseasRunCalls);
		expect(cohort.indexes.map((index) => index.config.name)).toContain("overseas_run_cohorts_brand_idempotency_uidx");
		expect(call.indexes.map((index) => index.config.name)).toContain("overseas_run_calls_cohort_slot_uidx");
		expect(call.columns.map(({ name }) => name)).toEqual(
			expect.arrayContaining(["paid_intent_at", "provider_submission_id", "observation_attempt_id", "prompt_run_id"]),
		);
		expect(call.checks.map(({ name }) => name)).toContain("overseas_run_calls_supported_provider");
		expect(call.checks.map(({ name }) => name)).not.toContain("overseas_run_calls_brightdata_only");
	});

	it("derives progress only from persisted call states", () => {
		expect(
			summarizeOverseasRunCallStates([
				...Array.from({ length: 250 }, () => "queued" as const),
				...Array.from({ length: 10 }, () => "running" as const),
				...Array.from({ length: 35 }, () => "succeeded" as const),
				...Array.from({ length: 5 }, () => "failed" as const),
			]),
		).toEqual({ planned: 300, queued: 250, running: 10, succeeded: 35, failed: 5 });
	});

	it("never reclaims a call after paid intent exists", () => {
		expect(canClaimOverseasRunCall({ status: "queued", paidIntentAt: null })).toBe(true);
		expect(canClaimOverseasRunCall({ status: "queued", paidIntentAt: new Date() })).toBe(false);
		expect(canClaimOverseasRunCall({ status: "running", paidIntentAt: null })).toBe(false);
	});
});
