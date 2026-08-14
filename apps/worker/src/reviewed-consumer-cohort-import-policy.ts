export type ReviewedImportExpected = { sourceKey: string };
export type ReviewedImportAttempt = { id: string; sourceKey: string; status: string };
export type ReviewedImportRun = { id: string; observationAttemptId: string | null };

type ReviewedCohortIdentity = {
	promptId: string;
	brandId: string;
	scopeId: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	model: string;
	provider: string;
	version: string;
	webSearchEnabled: boolean;
	webSearchObserved: boolean | null;
};

type StoredReviewedCohortIdentity = {
	promptId: string;
	brandId: string;
	scopeId: string | null;
	surfaceTargetKey: string | null;
	captureRouteKey: string | null;
	model: string;
	provider: string | null;
	version: string | null;
	webSearchEnabled: boolean;
	webSearchObserved: boolean | null;
};

type ReviewedCitationIdentity = {
	promptId: string;
	brandId: string;
	model: string;
	url: string;
	domain: string;
	title: string;
	citationIndex: number;
	createdAt: Date;
};

export function reviewedConsumerCitationIdentityMatches(
	actual: Omit<ReviewedCitationIdentity, "title"> & { title: string | null },
	expected: ReviewedCitationIdentity,
): boolean {
	return (
		actual.promptId === expected.promptId &&
		actual.brandId === expected.brandId &&
		actual.model === expected.model &&
		actual.url === expected.url &&
		actual.domain === expected.domain &&
		actual.title === expected.title &&
		actual.citationIndex === expected.citationIndex &&
		actual.createdAt.getTime() === expected.createdAt.getTime()
	);
}

export function reviewedConsumerCohortIdentityMatches(
	attempt: Omit<StoredReviewedCohortIdentity, "version"> & { requestedVersion: string | null },
	run: StoredReviewedCohortIdentity,
	expected: ReviewedCohortIdentity,
): boolean {
	return (
		attempt.promptId === expected.promptId &&
		attempt.brandId === expected.brandId &&
		attempt.scopeId === expected.scopeId &&
		attempt.surfaceTargetKey === expected.surfaceTargetKey &&
		attempt.captureRouteKey === expected.captureRouteKey &&
		attempt.model === expected.model &&
		attempt.provider === expected.provider &&
		attempt.requestedVersion === expected.version &&
		attempt.webSearchEnabled === expected.webSearchEnabled &&
		attempt.webSearchObserved === expected.webSearchObserved &&
		run.promptId === expected.promptId &&
		run.brandId === expected.brandId &&
		run.scopeId === expected.scopeId &&
		run.surfaceTargetKey === expected.surfaceTargetKey &&
		run.captureRouteKey === expected.captureRouteKey &&
		run.model === expected.model &&
		run.provider === expected.provider &&
		run.version === expected.version &&
		run.webSearchEnabled === expected.webSearchEnabled &&
		run.webSearchObserved === expected.webSearchObserved
	);
}

export function decideReviewedConsumerCohortImport(
	expected: readonly ReviewedImportExpected[],
	attempts: readonly ReviewedImportAttempt[],
	runs: readonly ReviewedImportRun[],
): { action: "insert" | "unchanged" } {
	if (expected.length !== 18 || new Set(expected.map((item) => item.sourceKey)).size !== 18) {
		throw new Error("reviewed_consumer_cohort_conflict");
	}
	if (attempts.length === 0 && runs.length === 0) return { action: "insert" };
	if (attempts.length !== 18 || runs.length !== 18) throw new Error("reviewed_consumer_cohort_conflict");

	const expectedKeys = new Set(expected.map((item) => item.sourceKey));
	const attemptIds = new Set<string>();
	for (const attempt of attempts) {
		if (attempt.status !== "succeeded" || !expectedKeys.has(attempt.sourceKey) || attemptIds.has(attempt.id)) {
			throw new Error("reviewed_consumer_cohort_conflict");
		}
		attemptIds.add(attempt.id);
	}
	const linkedAttempts = new Set<string>();
	for (const run of runs) {
		if (
			!run.observationAttemptId ||
			!attemptIds.has(run.observationAttemptId) ||
			linkedAttempts.has(run.observationAttemptId)
		) {
			throw new Error("reviewed_consumer_cohort_conflict");
		}
		linkedAttempts.add(run.observationAttemptId);
	}
	if (linkedAttempts.size !== 18) throw new Error("reviewed_consumer_cohort_conflict");
	return { action: "unchanged" };
}
