import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	requireBrandAccess: vi.fn(),
	requireBrandWriteAccess: vi.fn(),
	resolveMeasurementScopeForBrand: vi.fn(),
	lockedBrand: vi.fn(),
	existingPromptRows: vi.fn(),
	transaction: vi.fn(),
	findSavedPrompts: vi.fn(),
	insertValues: vi.fn(),
	createMultiplePromptJobSchedulers: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator: () => ({
			handler: (handler: (args: { data: unknown }) => unknown) => handler,
		}),
	}),
}));

vi.mock("@workspace/lib/db/db", () => ({
	db: {
		transaction: mocks.transaction,
	},
}));

vi.mock("@workspace/lib/db/measurement-scopes", () => ({
	ensureLegacyMeasurementScope: vi.fn(),
	resolveMeasurementScopeForBrand: mocks.resolveMeasurementScopeForBrand,
}));

vi.mock("@workspace/lib/db/schema", () => ({
	brands: { id: "brands.id" },
	competitors: {},
	promptRuns: {},
	prompts: { id: "prompts.id", brandId: "prompts.brandId", scopeId: "prompts.scopeId" },
	SYSTEM_TAGS: { BRANDED: "branded", UNBRANDED: "unbranded" },
}));

vi.mock("@workspace/lib/tag-utils", () => ({
	computeSystemTags: () => [],
	getEffectiveBrandedStatus: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	and: (...conditions: unknown[]) => conditions,
	count: vi.fn(),
	desc: vi.fn(),
	eq: (...values: unknown[]) => values,
	sql: vi.fn(),
}));

vi.mock("@/lib/auth/helpers", () => ({
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
	requireBrandAccess: mocks.requireBrandAccess,
	requireBrandWriteAccess: mocks.requireBrandWriteAccess,
}));

vi.mock("@/lib/job-scheduler", () => ({
	createMultiplePromptJobSchedulers: mocks.createMultiplePromptJobSchedulers,
}));

vi.mock("@/lib/domain-categories", () => ({
	CITATION_PAGE_TYPES: [],
	emptyCategoryCounts: vi.fn(),
	emptyPageTypeCounts: vi.fn(),
	extractDomain: vi.fn(),
	isGoogleSurfaceUrl: vi.fn(),
	normalizeUrl: vi.fn(),
	resolvePageType: vi.fn(),
}));
vi.mock("@/lib/domain-categories.server", () => ({ classifyUrl: vi.fn() }));
vi.mock("@/lib/google-module", () => ({ buildGoogleModule: vi.fn() }));
vi.mock("@/lib/postgres-read", () => ({
	getPromptCitationUrlStats: vi.fn(),
	getPromptCompetitorDailyStats: vi.fn(),
	getPromptDailyStats: vi.fn(),
	getPromptsFirstEvaluatedAt: vi.fn(),
	getPromptsSummary: vi.fn(),
	getPromptWebQueriesForMapping: vi.fn(),
	getPromptWebQueryCounts: vi.fn(),
}));
vi.mock("@/lib/chart-utils", () => ({ generateDateRange: vi.fn() }));
vi.mock("@/lib/timezone-utils", () => ({ getTimezoneLookbackRange: vi.fn(), shiftDateStr: vi.fn() }));
vi.mock("./customer-data-dto", () => ({ toCustomerPromptRunDto: vi.fn() }));

import { updatePromptsFn } from "./prompts";

const input = {
	brandId: "stepfun",
	scopeId: "11111111-1111-4111-8111-111111111111",
	prompts: [{ value: "国内有哪些主流大模型公司？", enabled: true, tags: [] }],
};

describe("prompt execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.lockedBrand.mockResolvedValue([
			{
				id: "stepfun",
				name: "StepFun",
				website: "https://stepfun.com",
			},
		]);
		mocks.existingPromptRows.mockResolvedValue([]);
		mocks.findSavedPrompts.mockResolvedValue([{ id: "prompt-new" }]);
		mocks.transaction.mockImplementation((callback) => {
			let selectCall = 0;
			return callback({
				select: () => ({
					from: () => ({
						where: () => {
							selectCall += 1;
							return selectCall === 1 ? { limit: () => ({ for: mocks.lockedBrand }) } : mocks.existingPromptRows();
						},
					}),
				}),
				insert: () => ({ values: mocks.insertValues }),
				update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
				query: { prompts: { findMany: mocks.findSavedPrompts } },
			});
		});
		mocks.createMultiplePromptJobSchedulers.mockResolvedValue(undefined);
		mocks.insertValues.mockResolvedValue(undefined);
	});

	it("lets a tenant writer configure a manual-only scope without scheduling provider work", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: input.scopeId,
			automaticTargetKeys: [],
		});

		await expect(updatePromptsFn({ data: input })).resolves.toEqual([{ id: "prompt-new" }]);
		expect(mocks.requireBrandWriteAccess).toHaveBeenCalledWith("customer-1", "stepfun");
		expect(mocks.createMultiplePromptJobSchedulers).not.toHaveBeenCalled();
	});

	it("rejects a tenant writer before mutating an automatic or legacy scope", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: input.scopeId,
			automaticTargetKeys: null,
		});

		await expect(updatePromptsFn({ data: input })).rejects.toThrow("managed by the platform");
		expect(mocks.transaction).not.toHaveBeenCalled();
		expect(mocks.createMultiplePromptJobSchedulers).not.toHaveBeenCalled();
	});

	it("rejects repeated incremental inserts after a manual scope reaches its total cap", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: input.scopeId,
			automaticTargetKeys: [],
		});
		mocks.existingPromptRows.mockResolvedValue(
			Array.from({ length: 100 }, (_, index) => ({ id: `prompt-${index}`, value: `Prompt ${index}` })),
		);

		await expect(updatePromptsFn({ data: input })).rejects.toThrow("at most 100 prompts");
		expect(mocks.insertValues).not.toHaveBeenCalled();
		expect(mocks.createMultiplePromptJobSchedulers).not.toHaveBeenCalled();
	});

	it("preserves automatic scheduling for a global platform admin", async () => {
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "platform-1", role: "admin" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: input.scopeId,
			automaticTargetKeys: ["chatgpt.consumer_web"],
		});

		await expect(updatePromptsFn({ data: input })).resolves.toEqual([{ id: "prompt-new" }]);
		expect(mocks.requireBrandWriteAccess).not.toHaveBeenCalled();
		expect(mocks.createMultiplePromptJobSchedulers).toHaveBeenCalledWith(["prompt-new"]);
	});
});
