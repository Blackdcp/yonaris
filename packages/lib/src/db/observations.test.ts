import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	existing: undefined as Record<string, unknown> | undefined,
	updatedValues: undefined as Record<string, unknown> | undefined,
	insertedAttemptValues: undefined as Record<string, unknown> | undefined,
	insertedPromptRunValues: undefined as Record<string, unknown> | undefined,
}));

vi.mock("./db", () => ({
	db: {
		insert: () => ({
			values: (values: Record<string, unknown>) => {
				mocks.insertedAttemptValues = values;
				return {
					onConflictDoNothing: () => ({ returning: async () => [] }),
				};
			},
		}),
		query: {
			observationAttempts: { findFirst: async () => mocks.existing },
			promptRuns: { findFirst: async () => undefined },
		},
		update: () => ({
			set: (values: Record<string, unknown>) => {
				mocks.updatedValues = values;
				return {
					where: () => ({
						returning: async () => [{ id: "attempt-1", startedAt: values.startedAt }],
					}),
				};
			},
		}),
		transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
			callback({
				update: () => ({
					set: () => ({ where: () => ({ returning: async () => [{ id: "attempt-1" }] }) }),
				}),
				insert: () => ({
					values: (values: Record<string, unknown>) => {
						mocks.insertedPromptRunValues = values;
						return { returning: async () => [{ id: "run-1", createdAt: new Date() }] };
					},
				}),
			}),
	},
}));

import {
	claimImportedObservationAttempt,
	ObservationSourceConflictError,
	persistSuccessfulObservation,
} from "./observations";

const input = {
	sourceKey: "delivery-task:task-1",
	promptId: "10000000-0000-4000-8000-000000000001",
	promptText: "Which brand is visible?",
	brandId: "brand-1",
	scope: {
		id: "10000000-0000-4000-8000-000000000002",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
	},
	target: {
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "manual_import.generic",
		captureMode: "manual_import" as const,
		surfaceKind: "consumer_web" as const,
	},
	config: { model: "doubao", provider: "manual-import", webSearch: true },
	sampleIndex: 1,
	captureMetadata: { pageUrl: "https://www.doubao.com/chat/1" },
	sampleFingerprint: "new-fingerprint",
	webSearchObserved: null,
};

function existingAttempt(status: "running" | "failed", startedAt: Date) {
	return {
		id: "attempt-1",
		status,
		startedAt,
		promptId: input.promptId,
		scopeId: input.scope.id,
		surfaceTargetKey: input.target.surfaceTargetKey,
		captureRouteKey: input.target.captureRouteKey,
		promptText: input.promptText,
		model: input.config.model,
		provider: input.config.provider,
		requestedVersion: null,
		webSearchEnabled: input.config.webSearch,
		webSearchObserved: input.webSearchObserved,
		sampleIndex: input.sampleIndex,
		captureMetadata: { sampleFingerprint: "old-fingerprint" },
	};
}

describe("imported observation retries", () => {
	beforeEach(() => {
		mocks.updatedValues = undefined;
		mocks.insertedAttemptValues = undefined;
		mocks.insertedPromptRunValues = undefined;
	});

	it("persists an unknown search observation as null on the attempt", async () => {
		mocks.existing = existingAttempt("failed", new Date());

		await claimImportedObservationAttempt(input as never);

		expect(mocks.insertedAttemptValues?.webSearchObserved).toBeNull();
	});

	it("does not infer observed search from the compatibility enabled flag", async () => {
		const unknownInput = { ...input, webSearchObserved: undefined };
		mocks.existing = {
			...existingAttempt("failed", new Date()),
			webSearchObserved: null,
		};

		await claimImportedObservationAttempt(unknownInput as never);

		expect(mocks.insertedAttemptValues?.webSearchObserved).toBeNull();
	});

	it("refreshes observed search when a failed completion is retried", async () => {
		mocks.existing = {
			...existingAttempt("failed", new Date()),
			webSearchObserved: null,
		};

		await claimImportedObservationAttempt({ ...input, webSearchObserved: true } as never);

		expect(mocks.updatedValues?.webSearchObserved).toBe(true);
	});

	it("allows a failed attempt to be retried with fresh evidence", async () => {
		mocks.existing = existingAttempt("failed", new Date());

		await expect(claimImportedObservationAttempt(input as never)).resolves.toMatchObject({ state: "execute" });
		expect(mocks.updatedValues?.captureMetadata).toMatchObject({ sampleFingerprint: "new-fingerprint" });
	});

	it("allows an expired running attempt to be reclaimed with fresh evidence", async () => {
		mocks.existing = existingAttempt("running", new Date(Date.now() - 15 * 60 * 1_000));

		await expect(claimImportedObservationAttempt(input as never)).resolves.toMatchObject({ state: "execute" });
		expect(mocks.updatedValues?.captureMetadata).toMatchObject({ sampleFingerprint: "new-fingerprint" });
	});

	it("rejects different evidence while the original attempt lease is active", async () => {
		mocks.existing = existingAttempt("running", new Date());

		await expect(claimImportedObservationAttempt(input as never)).rejects.toBeInstanceOf(
			ObservationSourceConflictError,
		);
		expect(mocks.updatedValues).toBeUndefined();
	});
});

describe("successful observation persistence", () => {
	it("preserves unknown search evidence on the prompt run", async () => {
		await persistSuccessfulObservation({
			attemptId: "attempt-1",
			startedAt: new Date(),
			observedAt: new Date(),
			promptId: input.promptId,
			brand: { id: input.brandId },
			scope: input.scope,
			target: input.target,
			config: input.config,
			recordedVersion: "doubao-live",
			answerText: "answer",
			rawOutput: {},
			webQueries: [],
			webSearchObserved: null,
			brandMentioned: false,
			competitorsMentioned: [],
			extractedCitations: [],
		} as never);

		expect(mocks.insertedPromptRunValues?.webSearchObserved).toBeNull();
	});

	it("keeps pre-migration attempts retryable when observed search was not recorded", async () => {
		const legacyInput = {
			...input,
			config: { ...input.config, webSearch: false },
			webSearchObserved: undefined,
		};
		mocks.existing = {
			...existingAttempt("failed", new Date()),
			webSearchEnabled: false,
			webSearchObserved: null,
		};

		await expect(claimImportedObservationAttempt(legacyInput as never)).resolves.toMatchObject({ state: "execute" });
	});
});
