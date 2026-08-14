import { isLocalDemoStructuredDetailCurrent } from "./local-demo-import-policy";

export type LocalDemoAtomicDiagnostic = {
	totalRuns: number;
	brandMentionedRuns: number;
	distinctPrompts: number;
	webSearchObservedRuns: number;
	queryBearingRuns: number;
	totalQueries: number;
	citationBearingRuns: number;
	totalCitations: number;
};

type ExpectedObservation = {
	sourceKey: string;
	sampleFingerprint: string;
};

type ExistingAttempt = {
	id: string;
	sourceKey: string;
	status: string;
	captureMetadata: unknown;
};

type ExistingPromptRun = {
	id: string;
	observationAttemptId: string | null;
};

export type LocalDemoAtomicRepairPlanItem = {
	sourceKey: string;
	attemptId: string;
	promptRunId: string;
	structuredDetailCurrent: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildLocalDemoAtomicRepairPlan(input: {
	expected: readonly ExpectedObservation[];
	attempts: readonly ExistingAttempt[];
	runs: readonly ExistingPromptRun[];
}): LocalDemoAtomicRepairPlanItem[] {
	if (input.expected.length !== 18 || new Set(input.expected.map((item) => item.sourceKey)).size !== 18) {
		throw new Error("Atomic repair must describe exactly 18 unique local demo observations");
	}
	if (input.attempts.length !== 18) {
		throw new Error("Atomic repair requires exactly 18 existing local demo attempts");
	}
	const attemptsBySourceKey = new Map(input.attempts.map((attempt) => [attempt.sourceKey, attempt]));
	if (attemptsBySourceKey.size !== 18 || new Set(input.attempts.map((attempt) => attempt.id)).size !== 18) {
		throw new Error("Atomic repair requires exactly 18 existing local demo attempts");
	}
	for (const attempt of input.attempts) {
		if (attempt.status !== "succeeded") {
			throw new Error("Existing local demo attempt is not succeeded");
		}
	}
	if (input.expected.some((item) => !attemptsBySourceKey.has(item.sourceKey))) {
		throw new Error("Atomic repair requires exactly 18 existing local demo attempts");
	}

	if (input.runs.length !== 18 || new Set(input.runs.map((run) => run.id)).size !== 18) {
		throw new Error("Atomic repair requires exactly one existing prompt run per attempt");
	}
	const allowedAttemptIds = new Set(input.attempts.map((attempt) => attempt.id));
	const runsByAttemptId = new Map<string, ExistingPromptRun>();
	for (const run of input.runs) {
		if (
			run.observationAttemptId === null ||
			!allowedAttemptIds.has(run.observationAttemptId) ||
			runsByAttemptId.has(run.observationAttemptId)
		) {
			throw new Error("Atomic repair requires exactly one existing prompt run per attempt");
		}
		runsByAttemptId.set(run.observationAttemptId, run);
	}
	if (runsByAttemptId.size !== 18) {
		throw new Error("Atomic repair requires exactly one existing prompt run per attempt");
	}

	return input.expected.map((item) => {
		const attempt = attemptsBySourceKey.get(item.sourceKey);
		if (!attempt) throw new Error("Atomic repair requires exactly 18 existing local demo attempts");
		const run = runsByAttemptId.get(attempt.id);
		if (!run) throw new Error("Atomic repair requires exactly one existing prompt run per attempt");
		return {
			sourceKey: item.sourceKey,
			attemptId: attempt.id,
			promptRunId: run.id,
			structuredDetailCurrent:
				isRecord(attempt.captureMetadata) &&
				isLocalDemoStructuredDetailCurrent(attempt.captureMetadata, item.sampleFingerprint),
		};
	});
}

export function assertLocalDemoAtomicPostcondition(input: {
	actualDiagnostic: LocalDemoAtomicDiagnostic;
	expectedDiagnostic: LocalDemoAtomicDiagnostic;
	actualDefaultScopeIds: readonly string[];
	expectedDefaultScopeId: string;
}): void {
	for (const [key, expected] of Object.entries(input.expectedDiagnostic)) {
		if (input.actualDiagnostic[key as keyof LocalDemoAtomicDiagnostic] !== expected) {
			throw new Error("Local demo atomic postcondition mismatch");
		}
	}
	if (input.actualDefaultScopeIds.length !== 1 || input.actualDefaultScopeIds[0] !== input.expectedDefaultScopeId) {
		throw new Error("Local demo atomic default scope postcondition mismatch");
	}
}
