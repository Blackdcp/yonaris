import assert from "node:assert/strict";
import test from "node:test";
import {
	decideReviewedConsumerCohortImport,
	reviewedConsumerCitationIdentityMatches,
	reviewedConsumerCohortIdentityMatches,
} from "./reviewed-consumer-cohort-import-policy";

const expected = Array.from({ length: 18 }, (_, index) => ({
	sourceKey: `reviewed-consumer-cohort:fixed:slot-${index + 1}`,
	attemptId: `attempt-${index + 1}`,
	runId: `run-${index + 1}`,
}));

test("plans one atomic insert only when the cohort is entirely absent", () => {
	assert.deepEqual(decideReviewedConsumerCohortImport(expected, [], []), { action: "insert" });
});

test("requires stored citations to retain their DeepSeek channel identity", () => {
	const expected = {
		promptId: "prompt-1",
		brandId: "stepfun",
		model: "deepseek",
		url: "https://example.com/article",
		domain: "example.com",
		title: "Example",
		citationIndex: 0,
		createdAt: new Date("2026-08-14T00:00:00.000Z"),
	};
	assert.equal(reviewedConsumerCitationIdentityMatches(expected, expected), true);
	for (const field of [
		"promptId",
		"brandId",
		"model",
		"url",
		"domain",
		"title",
		"citationIndex",
		"createdAt",
	] as const) {
		const wrongValue = field === "citationIndex" ? 1 : field === "createdAt" ? new Date(0) : "wrong";
		assert.equal(
			reviewedConsumerCitationIdentityMatches({ ...expected, [field]: wrongValue }, expected),
			false,
			`citation ${field} drift must fail closed`,
		);
	}
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

test("requires every persisted channel identity field to match the reviewed DeepSeek cohort", () => {
	const expectedIdentity = {
		promptId: "prompt-1",
		brandId: "stepfun",
		scopeId: "scope-cn",
		surfaceTargetKey: "deepseek.consumer_web",
		captureRouteKey: "assisted_browser.generic",
		model: "deepseek",
		provider: "local-pc-reviewed",
		version: "deepseek-web-20260814",
		webSearchEnabled: true,
		webSearchObserved: true,
	};
	const attempt = { ...expectedIdentity, requestedVersion: expectedIdentity.version };
	const run = { ...expectedIdentity };
	assert.equal(reviewedConsumerCohortIdentityMatches(attempt, run, expectedIdentity), true);
	for (const field of [
		"promptId",
		"brandId",
		"scopeId",
		"surfaceTargetKey",
		"captureRouteKey",
		"model",
		"provider",
		"requestedVersion",
		"webSearchEnabled",
		"webSearchObserved",
	] as const) {
		assert.equal(
			reviewedConsumerCohortIdentityMatches(
				{ ...attempt, [field]: field === "webSearchEnabled" ? false : "wrong" },
				run,
				expectedIdentity,
			),
			false,
			`attempt ${field} drift must fail closed`,
		);
	}
	for (const field of [
		"promptId",
		"brandId",
		"scopeId",
		"surfaceTargetKey",
		"captureRouteKey",
		"model",
		"provider",
		"version",
		"webSearchEnabled",
		"webSearchObserved",
	] as const) {
		assert.equal(
			reviewedConsumerCohortIdentityMatches(
				attempt,
				{ ...run, [field]: field === "webSearchEnabled" ? false : "wrong" },
				expectedIdentity,
			),
			false,
			`run ${field} drift must fail closed`,
		);
	}
});
