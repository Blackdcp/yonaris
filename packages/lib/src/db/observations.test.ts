import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	existing: undefined as Record<string, unknown> | undefined,
	updatedValues: undefined as Record<string, unknown> | undefined,
}));

vi.mock("./db", () => ({
	db: {
		insert: () => ({
			values: () => ({
				onConflictDoNothing: () => ({ returning: async () => [] }),
			}),
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
	},
}));

import { claimImportedObservationAttempt, ObservationSourceConflictError } from "./observations";

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
		sampleIndex: input.sampleIndex,
		captureMetadata: { sampleFingerprint: "old-fingerprint" },
	};
}

describe("imported observation retries", () => {
	beforeEach(() => {
		mocks.updatedValues = undefined;
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
