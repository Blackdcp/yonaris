import assert from "node:assert/strict";
import test from "node:test";
import { decideReviewedConsumerCohortImport } from "./reviewed-consumer-cohort-import-policy";

const expected = Array.from({ length: 18 }, (_, index) => ({
	sourceKey: `reviewed-consumer-cohort:fixed:slot-${index + 1}`,
	attemptId: `attempt-${index + 1}`,
	runId: `run-${index + 1}`,
}));

test("plans one atomic insert only when the cohort is entirely absent", () => {
	assert.deepEqual(decideReviewedConsumerCohortImport(expected, [], []), { action: "insert" });
});

test("returns unchanged only for the exact one-to-one terminal cohort", () => {
	const attempts = expected.map((item) => ({ id: item.attemptId, sourceKey: item.sourceKey, status: "succeeded" }));
	const runs = expected.map((item) => ({ id: item.runId, observationAttemptId: item.attemptId }));
	assert.deepEqual(decideReviewedConsumerCohortImport(expected, attempts, runs), { action: "unchanged" });
});

test("rejects partial, extra, nonterminal and broken one-to-one state", () => {
	const attempts = expected.map((item) => ({ id: item.attemptId, sourceKey: item.sourceKey, status: "succeeded" }));
	const runs = expected.map((item) => ({ id: item.runId, observationAttemptId: item.attemptId }));
	const firstAttempt = attempts[0];
	const secondAttempt = attempts[1];
	const firstRun = runs[0];
	if (!firstAttempt || !secondAttempt || !firstRun) throw new Error("invalid test fixture");
	assert.throws(
		() => decideReviewedConsumerCohortImport(expected, attempts.slice(0, 17), runs.slice(0, 17)),
		/conflict/,
	);
	assert.throws(
		() =>
			decideReviewedConsumerCohortImport(
				expected,
				[...attempts, { id: "extra-attempt", sourceKey: "reviewed-consumer-cohort:fixed:extra", status: "succeeded" }],
				runs,
			),
		/conflict/,
	);
	assert.throws(
		() =>
			decideReviewedConsumerCohortImport(expected, [{ ...firstAttempt, status: "failed" }, ...attempts.slice(1)], runs),
		/conflict/,
	);
	assert.throws(
		() =>
			decideReviewedConsumerCohortImport(expected, attempts, [
				{ ...firstRun, observationAttemptId: secondAttempt.id },
				...runs.slice(1),
			]),
		/conflict/,
	);
});
