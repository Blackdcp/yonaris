import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	requireBrandAccess: vi.fn(),
	runStructuredCompletionPrompt: vi.fn(),
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

vi.mock("@workspace/lib/db/schema", () => ({
	brandOpportunities: { brandId: "brandOpportunities.brandId", createdAt: "brandOpportunities.createdAt" },
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
	desc: vi.fn(),
	eq: vi.fn(),
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

import { generateOpportunitiesFn, getOpportunitiesFn } from "./opportunities";

describe("opportunities execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectResults.splice(0);
	});

	it("keeps customer GET requests read-only even when no report exists", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.selectResults.push([{ id: "scope-1", timezone: "Asia/Shanghai", enabled: true }], []);

		await expect(getOpportunitiesFn({ data: { brandId: "stepfun" } })).resolves.toEqual({
			report: null,
			reason: "insufficient-data",
			generatedFor: null,
			lastEvaluatedAt: null,
		});
		expect(mocks.requireBrandAccess).toHaveBeenCalledWith("customer-1", "stepfun");
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("rejects customer generation before reading or writing execution data", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });

		await expect(generateOpportunitiesFn({ data: { brandId: "stepfun" } })).rejects.toThrow("Platform administrator");
		expect(mocks.selectResults).toHaveLength(0);
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});
});
