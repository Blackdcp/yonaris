export type ReviewedImportExpected = { sourceKey: string };
export type ReviewedImportAttempt = { id: string; sourceKey: string; status: string };
export type ReviewedImportRun = { id: string; observationAttemptId: string | null };

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
