import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	requireBrandAccess: vi.fn(),
	runStructuredCompletionPrompt: vi.fn(),
	resolveMeasurementScopeForBrand: vi.fn(),
	selectResults: [] as unknown[][],
	insert: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator: () => ({ handler: (handler: (args: { data: unknown }) => unknown) => handler }),
	}),
}));

vi.mock("@workspace/lib/db/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => {
					const finish = () => Promise.resolve(mocks.selectResults.shift() ?? []);
					return { limit: finish, orderBy: () => ({ limit: finish }) };
				},
			}),
		}),
		insert: mocks.insert,
	},
}));

vi.mock("@workspace/lib/db/measurement-scopes", () => ({
	resolveMeasurementScopeForBrand: mocks.resolveMeasurementScopeForBrand,
}));

vi.mock("@workspace/lib/db/schema", () => ({
	brandOpportunities: {
		brandId: "brandOpportunities.brandId",
		scopeId: "brandOpportunities.scopeId",
		createdAt: "brandOpportunities.createdAt",
	},
	brands: {},
	competitors: {},
	measurementScopes: {
		id: "measurementScopes.id",
		brandId: "measurementScopes.brandId",
		timezone: "measurementScopes.timezone",
		enabled: "measurementScopes.enabled",
	},
}));

vi.mock("@workspace/lib/onboarding", () => ({
	runStructuredCompletionPrompt: mocks.runStructuredCompletionPrompt,
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn(),
	desc: vi.fn(),
	eq: vi.fn(),
	isNull: vi.fn(),
}));

vi.mock("@/lib/auth/helpers", () => ({
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
	requireBrandAccess: mocks.requireBrandAccess,
}));

vi.mock("@/lib/domain-categories", () => ({ extractDomain: vi.fn() }));
vi.mock("@/lib/domain-categories.server", () => ({ categorizeDomain: vi.fn() }));
vi.mock("@/lib/postgres-read", () => ({
	getBrandMentionRateByModel: vi.fn(),
	getPerPromptCitationPages: vi.fn(),
	getPerPromptDailyCitationStats: vi.fn(),
	getPerPromptDailyCompetitorMentions: vi.fn(),
	getPerPromptRunStats: vi.fn(),
}));
vi.mock("@/lib/prompt-tags", () => ({ isBrandedPrompt: vi.fn() }));
vi.mock("@/lib/timezone-utils", () => ({ getTimezoneLookbackRange: vi.fn(), resolveTimezone: vi.fn() }));
vi.mock("@/lib/visibility-stats", () => ({
	computeVolatility: vi.fn(),
	stabilityScore: vi.fn(),
}));
vi.mock("@/server/prompt-resolution", () => ({ resolveFilteredPrompts: vi.fn() }));

import { canReadOpportunityReportInScope, generateOpportunitiesFn, getOpportunitiesFn } from "./opportunities";

describe("opportunities execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectResults.splice(0);
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: "scope-china",
			enabled: true,
			samplingEvaluationRole: "scored",
		});
	});

	it("keeps customer GET requests read-only even when no report exists", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.selectResults.push([{ id: "scope-1", timezone: "Asia/Shanghai", enabled: true }], []);

		await expect(getOpportunitiesFn({ data: { brandId: "stepfun", scopeId: "scope-china" } })).resolves.toEqual({
			report: null,
			reason: "not_generated",
			generatedFor: null,
			lastEvaluatedAt: null,
		});
		expect(mocks.requireBrandAccess).toHaveBeenCalledWith("customer-1", "stepfun");
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("does not return a stored report from a different requested scope", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.selectResults.push(
			[{ id: "scope-china", timezone: "Asia/Shanghai", enabled: true }],
			[
				{
					scopeId: "scope-global",
					report: { summary: ["global only"], opportunities: [], risks: [] },
					createdAt: new Date("2026-08-18T00:00:00.000Z"),
				},
			],
		);

		await expect(getOpportunitiesFn({ data: { brandId: "ppio", scopeId: "scope-china" } })).resolves.toEqual({
			report: null,
			reason: "not_generated",
			generatedFor: null,
			lastEvaluatedAt: null,
		});
	});

	it("does not expose a legacy report when a disabled historical Program still exists", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.selectResults.push(
			[
				{ id: "scope-china", enabled: true },
				{ id: "scope-legacy", enabled: false },
			],
			[],
			[
				{
					scopeId: null,
					report: { summary: ["legacy"], opportunities: [], risks: [] },
					createdAt: new Date("2026-08-18T00:00:00.000Z"),
				},
			],
		);

		await expect(getOpportunitiesFn({ data: { brandId: "ppio", scopeId: "scope-china" } })).resolves.toEqual({
			report: null,
			reason: "not_generated",
			generatedFor: null,
			lastEvaluatedAt: null,
		});
	});

	it("rejects customer generation before reading or writing execution data", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });

		await expect(
			generateOpportunitiesFn({ data: { brandId: "stepfun", scopeId: "00000000-0000-4000-8000-000000000001" } }),
		).rejects.toThrow("Platform administrator");
		expect(mocks.selectResults).toHaveLength(0);
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("rejects generation for a scope that does not belong to the brand", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
		mocks.resolveMeasurementScopeForBrand.mockRejectedValue(new Error("Measurement scope does not belong to brand"));

		await expect(generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: "scope-global" } })).rejects.toThrow(
			"does not belong to brand",
		);
	});

	it("rejects generation for an observation scope before any paid completion", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: "scope-diagnostic",
			enabled: true,
			timezone: "UTC",
			samplingEvaluationRole: "observation",
		});

		await expect(
			generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: "00000000-0000-4000-8000-000000000002" } }),
		).rejects.toThrow("scored Program");
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("never exposes a report from another measurement scope", () => {
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: "scope-global",
				requestedScopeId: "scope-china",
				totalScopeCount: 2,
				soleScopeId: null,
			}),
		).toBe(false);
	});

	it("allows a legacy unscoped report only when the requested Program is the brand's sole scope", () => {
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: null,
				requestedScopeId: "scope-china",
				totalScopeCount: 1,
				soleScopeId: "scope-china",
			}),
		).toBe(true);
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: null,
				requestedScopeId: "scope-china",
				totalScopeCount: 2,
				soleScopeId: "scope-china",
			}),
		).toBe(false);
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: null,
				requestedScopeId: "scope-china",
				totalScopeCount: 1,
				soleScopeId: "scope-global",
			}),
		).toBe(false);
	});
});
