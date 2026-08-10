import { beforeEach, describe, expect, it, vi } from "vitest";

type LedgerState = {
	attemptStatus: "running" | "succeeded";
	attemptCaptureMetadata: Record<string, unknown>;
	promptRuns: Array<Record<string, unknown>>;
	citations: Array<Record<string, unknown>>;
	taskStatus: "claimed" | "completed";
	artifactStatus: "staged" | "attached";
};

const harness = vi.hoisted(() => {
	const initialState = (): LedgerState => ({
		attemptStatus: "running",
		attemptCaptureMetadata: { cleanSession: true },
		promptRuns: [],
		citations: [],
		taskStatus: "claimed",
		artifactStatus: "staged",
	});
	return {
		current: initialState(),
		initialState,
		failurePoint: null as "resolve" | "attach" | null,
		transactionExecutors: [] as unknown[],
	};
});

const evidenceReference = {
	artifactId: "10000000-0000-4000-8000-000000000010",
	type: "screenshot" as const,
	uri: "https://portal.yonaris.com/api/admin/sampling/evidence/10000000-0000-4000-8000-000000000010",
	sha256: "a".repeat(64),
	mediaType: "image/png",
	byteSize: 9,
};

const transactionExecutor = {
	update: () => ({
		set: (values: Record<string, unknown>) => {
			if (values.status === "succeeded") harness.current.attemptStatus = "succeeded";
			if (values.captureMetadata !== undefined) {
				harness.current.attemptCaptureMetadata = {
					...harness.current.attemptCaptureMetadata,
					evidenceRefs: [evidenceReference],
				};
			}
			return {
				where: () => ({
					returning: async () => [{ id: "attempt-1" }],
				}),
			};
		},
	}),
	insert: () => ({
		values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => {
			if (Array.isArray(values)) {
				harness.current.citations.push(...structuredClone(values));
				return Promise.resolve();
			}
			return {
				returning: async () => {
					const promptRun = { id: "run-1", ...structuredClone(values) };
					harness.current.promptRuns.push(promptRun);
					return [{ id: "run-1", createdAt: values.createdAt }];
				},
			};
		},
	}),
};

vi.mock("./db", () => ({
	db: {
		transaction: async (callback: (executor: typeof transactionExecutor) => Promise<unknown>) => {
			const snapshot = structuredClone(harness.current);
			harness.transactionExecutors.push(transactionExecutor);
			try {
				return await callback(transactionExecutor);
			} catch (error) {
				harness.current = snapshot;
				throw error;
			}
		},
	},
}));

vi.mock("./evidence-artifacts", () => ({
	EvidenceArtifactValidationError: class EvidenceArtifactValidationError extends Error {},
	resolveEvidenceArtifactsForSubmission: vi.fn(async (executor: unknown) => {
		expect(executor).toBe(transactionExecutor);
		if (harness.failurePoint === "resolve") throw new Error("injected evidence resolve failure");
		return [evidenceReference];
	}),
	attachEvidenceArtifactsInTransaction: vi.fn(async (executor: unknown) => {
		expect(executor).toBe(transactionExecutor);
		harness.current.artifactStatus = "attached";
		if (harness.failurePoint === "attach") throw new Error("injected evidence attach failure");
		return { artifacts: [], evidenceRefs: [evidenceReference] };
	}),
}));

vi.mock("./delivery-batches", () => ({
	completeDeliveryTaskInTransaction: vi.fn(async (executor: unknown) => {
		expect(executor).toBe(transactionExecutor);
		harness.current.taskStatus = "completed";
	}),
	failDeliveryTaskInTransaction: vi.fn(),
}));

import { persistSuccessfulObservation } from "./observations";

const startedAt = new Date("2026-08-11T11:59:00.000Z");
const observedAt = new Date("2026-08-11T12:00:00.000Z");
const persistenceInput = {
	attemptId: "attempt-1",
	startedAt,
	observedAt,
	promptId: "10000000-0000-4000-8000-000000000001",
	brand: { id: "brand-1" },
	scope: { id: "10000000-0000-4000-8000-000000000002" },
	target: {
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "manual_import.generic",
	},
	config: { model: "doubao", provider: "manual-import", webSearch: true },
	recordedVersion: "consumer-web-2026-08-11",
	answerText: "Yonaris is mentioned in the answer.",
	rawOutput: { captureMode: "manual_import" },
	webQueries: [],
	brandMentioned: true,
	competitorsMentioned: [],
	extractedCitations: [
		{
			url: "https://example.com/source",
			domain: "example.com",
			title: "Source",
			citationIndex: 0,
		},
	],
	deliveryClaim: {
		taskId: "10000000-0000-4000-8000-000000000003",
		claimedBy: "operator-1",
		leaseToken: "lease-token",
		leaseGeneration: 4,
	},
	evidenceArtifacts: {
		artifactIds: [evidenceReference.artifactId],
		uriForArtifact: () => evidenceReference.uri,
	},
};

describe("successful observation transaction", () => {
	beforeEach(() => {
		harness.current = harness.initialState();
		harness.failurePoint = null;
		harness.transactionExecutors.length = 0;
	});

	it.each(["resolve", "attach"] as const)(
		"rolls back the complete ledger when evidence %s fails and permits the same task to retry",
		async (failurePoint) => {
			harness.failurePoint = failurePoint;

			await expect(persistSuccessfulObservation(persistenceInput as never)).rejects.toThrow(
				`injected evidence ${failurePoint} failure`,
			);
			expect(harness.current).toEqual(harness.initialState());

			harness.failurePoint = null;
			await expect(persistSuccessfulObservation(persistenceInput as never)).resolves.toMatchObject({
				id: "run-1",
				evidenceRefs: [evidenceReference],
			});
			expect(harness.current).toMatchObject({
				attemptStatus: "succeeded",
				taskStatus: "completed",
				artifactStatus: "attached",
			});
			expect(harness.current.promptRuns).toHaveLength(1);
			expect(harness.current.citations).toHaveLength(1);
			expect(harness.current.promptRuns[0]?.rawOutput).toMatchObject({
				evidenceRefs: [evidenceReference],
			});
			expect(harness.transactionExecutors).toEqual([transactionExecutor, transactionExecutor]);
		},
	);
});
