import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLocalDemoAtomicPostcondition, buildLocalDemoAtomicRepairPlan } from "./local-demo-atomic-import-policy";

const expected = Array.from({ length: 18 }, (_, index) => ({
	sourceKey: `source-${index + 1}`,
	sampleFingerprint: `fingerprint-${index + 1}`,
}));

const attempts = expected.map((item, index) => ({
	id: `attempt-${index + 1}`,
	sourceKey: item.sourceKey,
	status: "succeeded",
	captureMetadata:
		index === 0
			? { structuredDetailRevision: 1, sampleFingerprint: item.sampleFingerprint }
			: { structuredDetailRevision: 0 },
}));

const runs = attempts.map((attempt, index) => ({
	id: `run-${index + 1}`,
	observationAttemptId: attempt.id,
}));
const firstAttempt = attempts[0];
const firstRun = runs[0];
assert.ok(firstAttempt);
assert.ok(firstRun);

describe("atomic local demo repair policy", () => {
	it("maps the exact 18 existing attempts and runs before any repair", () => {
		const plan = buildLocalDemoAtomicRepairPlan({ expected, attempts, runs });

		assert.equal(plan.length, 18);
		assert.deepEqual(plan[0], {
			sourceKey: "source-1",
			attemptId: "attempt-1",
			promptRunId: "run-1",
			structuredDetailCurrent: true,
		});
		assert.equal(plan[1]?.structuredDetailCurrent, false);
	});

	it("fails closed when an existing attempt is missing or extra", () => {
		assert.throws(
			() => buildLocalDemoAtomicRepairPlan({ expected, attempts: attempts.slice(0, 17), runs: runs.slice(0, 17) }),
			/exactly 18 existing local demo attempts/i,
		);
		assert.throws(
			() =>
				buildLocalDemoAtomicRepairPlan({
					expected,
					attempts: [...attempts, { ...firstAttempt, id: "attempt-extra", sourceKey: "source-extra" }],
					runs,
				}),
			/exactly 18 existing local demo attempts/i,
		);
	});

	it("fails closed when attempts or runs are duplicated, mismatched, or not succeeded", () => {
		assert.throws(
			() =>
				buildLocalDemoAtomicRepairPlan({
					expected,
					attempts: [{ ...firstAttempt, status: "failed" }, ...attempts.slice(1)],
					runs,
				}),
			/existing local demo attempt is not succeeded/i,
		);
		assert.throws(
			() =>
				buildLocalDemoAtomicRepairPlan({
					expected,
					attempts,
					runs: [{ ...firstRun, observationAttemptId: "attempt-2" }, ...runs.slice(1)],
				}),
			/exactly one existing prompt run per attempt/i,
		);
	});

	it("rejects a diagnostic or default-scope mismatch before commit", () => {
		const expectedDiagnostic = {
			totalRuns: 18,
			brandMentionedRuns: 12,
			distinctPrompts: 3,
			webSearchObservedRuns: 18,
			queryBearingRuns: 18,
			totalQueries: 48,
			citationBearingRuns: 18,
			totalCitations: 271,
		};
		assert.doesNotThrow(() =>
			assertLocalDemoAtomicPostcondition({
				actualDiagnostic: expectedDiagnostic,
				expectedDiagnostic,
				actualDefaultScopeIds: ["scope-cn"],
				expectedDefaultScopeId: "scope-cn",
			}),
		);
		assert.throws(
			() =>
				assertLocalDemoAtomicPostcondition({
					actualDiagnostic: { ...expectedDiagnostic, totalCitations: 270 },
					expectedDiagnostic,
					actualDefaultScopeIds: ["scope-cn"],
					expectedDefaultScopeId: "scope-cn",
				}),
			/atomic postcondition mismatch/i,
		);
		assert.throws(
			() =>
				assertLocalDemoAtomicPostcondition({
					actualDiagnostic: expectedDiagnostic,
					expectedDiagnostic,
					actualDefaultScopeIds: ["scope-old", "scope-cn"],
					expectedDefaultScopeId: "scope-cn",
				}),
			/atomic default scope postcondition mismatch/i,
		);
	});
});
