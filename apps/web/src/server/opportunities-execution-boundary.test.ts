import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Predicate =
	| { op: "eq"; column: string; value: unknown }
	| { op: "isNull"; column: string }
	| { op: "and"; predicates: Predicate[] };

const mocks = vi.hoisted(() => ({
	requireAuthSession: vi.fn(),
	requireBrandAccess: vi.fn(),
	runStructuredCompletionPrompt: vi.fn(),
	resolveMeasurementScopeForBrand: vi.fn(),
	resolveFilteredPrompts: vi.fn(),
	getBrandMentionRateByModel: vi.fn(),
	getPerPromptCitationPages: vi.fn(),
	getPerPromptDailyCitationStats: vi.fn(),
	getPerPromptDailyCompetitorMentions: vi.fn(),
	getPerPromptRunStats: vi.fn(),
	getTimezoneLookbackRange: vi.fn(),
	resolveTimezone: vi.fn(),
	extractDomain: vi.fn(),
	categorizeDomain: vi.fn(),
	isBrandedPrompt: vi.fn(),
	computeVolatility: vi.fn(),
	stabilityScore: vi.fn(),
	selectResults: [] as unknown[][],
	queryLog: [] as { table: string; predicate: Predicate }[],
	insertValues: [] as Record<string, unknown>[],
	insert: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		validator: (schema: { parse(value: unknown): unknown }) => ({
			handler:
				(handler: (args: { data: unknown }) => unknown) =>
				async (args: { data: unknown }) =>
					handler({ ...args, data: schema.parse(args.data) }),
		}),
	}),
}));

vi.mock("@workspace/lib/db/db", () => ({
	db: {
		select: () => ({
			from: (table: { __table: string }) => ({
				where: (predicate: Predicate) => {
					mocks.queryLog.push({ table: table.__table, predicate });
					const result = Promise.resolve(mocks.selectResults.shift() ?? []);
					return Object.assign(result, {
						limit: () => result,
						orderBy: () => ({ limit: () => result }),
					});
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
		__table: "brandOpportunities",
		brandId: "brandOpportunities.brandId",
		scopeId: "brandOpportunities.scopeId",
		outputLanguage: "brandOpportunities.outputLanguage",
		createdAt: "brandOpportunities.createdAt",
	},
	brands: {
		__table: "brands",
		id: "brands.id",
		name: "brands.name",
		website: "brands.website",
		additionalDomains: "brands.additionalDomains",
	},
	competitors: {
		__table: "competitors",
		brandId: "competitors.brandId",
		name: "competitors.name",
		domains: "competitors.domains",
	},
	measurementScopes: {
		__table: "measurementScopes",
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
	and: (...predicates: Predicate[]): Predicate => ({ op: "and", predicates }),
	desc: (column: string) => ({ op: "desc", column }),
	eq: (column: string, value: unknown): Predicate => ({ op: "eq", column, value }),
	isNull: (column: string): Predicate => ({ op: "isNull", column }),
}));

vi.mock("@/lib/auth/helpers", () => ({
	isAdmin: (session: { user: { role?: string } }) => session.user.role === "admin",
	requireAuthSession: mocks.requireAuthSession,
	requireBrandAccess: mocks.requireBrandAccess,
}));

vi.mock("@/lib/domain-categories", () => ({ extractDomain: mocks.extractDomain }));
vi.mock("@/lib/domain-categories.server", () => ({ categorizeDomain: mocks.categorizeDomain }));
vi.mock("@/lib/postgres-read", () => ({
	getBrandMentionRateByModel: mocks.getBrandMentionRateByModel,
	getPerPromptCitationPages: mocks.getPerPromptCitationPages,
	getPerPromptDailyCitationStats: mocks.getPerPromptDailyCitationStats,
	getPerPromptDailyCompetitorMentions: mocks.getPerPromptDailyCompetitorMentions,
	getPerPromptRunStats: mocks.getPerPromptRunStats,
}));
vi.mock("@/lib/prompt-tags", () => ({ isBrandedPrompt: mocks.isBrandedPrompt }));
vi.mock("@/lib/timezone-utils", () => ({
	getTimezoneLookbackRange: mocks.getTimezoneLookbackRange,
	resolveTimezone: mocks.resolveTimezone,
}));
vi.mock("@/lib/visibility-stats", () => ({
	computeVolatility: mocks.computeVolatility,
	stabilityScore: mocks.stabilityScore,
}));
vi.mock("@/server/prompt-resolution", () => ({ resolveFilteredPrompts: mocks.resolveFilteredPrompts }));

import { canReadOpportunityReportInScope, generateOpportunitiesFn, getOpportunitiesFn } from "./opportunities";

const SCOPE_CHINA = "00000000-0000-4000-8000-000000000001";
const SCOPE_GLOBAL = "00000000-0000-4000-8000-000000000002";
const RAW_PROMPT = "  Which AI IDE works in 中国?  ";
const EN_GUIDANCE = "Write every model-authored field in English.";
const ZH_GUIDANCE =
	"所有由模型撰写的标题、摘要、理由、行动建议与注意事项均使用专业、自然的简体中文。原样保留相关 Prompt、品牌名、竞品名、URL 与引用证据。";

function storedRow(outputLanguage: "en" | "zh-CN", overrides: Record<string, unknown> = {}) {
	return {
		scopeId: SCOPE_CHINA,
		outputLanguage,
		report: { summary: [`${outputLanguage} summary`], opportunities: [], risks: [] },
		createdAt: new Date("2026-08-20T00:00:00.000Z"),
		...overrides,
	};
}

function successfulModelReport(relatedPrompts: string[] = [RAW_PROMPT]) {
	return {
		object: {
			summary: ["Focused plan"],
			opportunities: [
				{
					category: "creation",
					title: "Publish a comparison",
					why: "The tracked evidence shows a gap.",
					relatedPrompts,
				},
			],
			risks: ["Keep the evidence current."],
		},
		modelVersion: "test-model",
	};
}

function configureSufficientDigest() {
	mocks.resolveFilteredPrompts.mockResolvedValue([{ id: "prompt-1", value: RAW_PROMPT, tags: [] }]);
	mocks.getPerPromptRunStats.mockResolvedValue([{ prompt_id: "prompt-1", runs: 1, brand_mention_rate: 0 }]);
	mocks.getPerPromptDailyCompetitorMentions.mockResolvedValue([]);
	mocks.getPerPromptDailyCitationStats.mockResolvedValue([]);
	mocks.getPerPromptCitationPages.mockResolvedValue([]);
	mocks.getBrandMentionRateByModel.mockResolvedValue([]);
	mocks.selectResults.push([{ name: "原样品牌", website: "https://brand.example", additionalDomains: [] }], []);
}

function setArtifactZhCnFlag(value: string | undefined) {
	const env = process.env as Record<string, string | undefined>;
	if (value === undefined) delete env.ARTIFACT_ZH_CN_ENABLED;
	else env.ARTIFACT_ZH_CN_ENABLED = value;
}

function opportunityQueries() {
	return mocks.queryLog.filter((query) => query.table === "brandOpportunities");
}

function expectScopedLanguagePredicate(queryIndex: number, outputLanguage: "en" | "zh-CN") {
	expect(opportunityQueries()[queryIndex]?.predicate).toEqual({
		op: "and",
		predicates: [
			{ op: "eq", column: "brandOpportunities.brandId", value: "ppio" },
			{ op: "eq", column: "brandOpportunities.scopeId", value: SCOPE_CHINA },
			{ op: "eq", column: "brandOpportunities.outputLanguage", value: outputLanguage },
		],
	});
}

describe("opportunities execution boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setArtifactZhCnFlag(undefined);
		mocks.selectResults.splice(0);
		mocks.queryLog.splice(0);
		mocks.insertValues.splice(0);
		mocks.requireAuthSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: SCOPE_CHINA,
			enabled: true,
			timezone: "UTC",
			samplingEvaluationRole: "scored",
		});
		mocks.resolveFilteredPrompts.mockResolvedValue([]);
		mocks.getPerPromptRunStats.mockResolvedValue([]);
		mocks.getPerPromptDailyCompetitorMentions.mockResolvedValue([]);
		mocks.getPerPromptDailyCitationStats.mockResolvedValue([]);
		mocks.getPerPromptCitationPages.mockResolvedValue([]);
		mocks.getBrandMentionRateByModel.mockResolvedValue([]);
		mocks.getTimezoneLookbackRange.mockReturnValue({ fromDateStr: "2026-07-01", toDateStr: "2026-08-01" });
		mocks.resolveTimezone.mockReturnValue("UTC");
		mocks.extractDomain.mockImplementation((value: string) => value);
		mocks.categorizeDomain.mockReturnValue("other");
		mocks.isBrandedPrompt.mockReturnValue(false);
		mocks.computeVolatility.mockReturnValue({ weightedVolatility: 0.5 });
		mocks.stabilityScore.mockReturnValue(50);
		mocks.runStructuredCompletionPrompt.mockResolvedValue(successfulModelReport());
		mocks.insert.mockImplementation(() => ({
			values: (values: Record<string, unknown>) => {
				mocks.insertValues.push(values);
				return {
					returning: () => Promise.resolve([{ createdAt: new Date("2026-08-27T00:00:00.000Z") }]),
				};
			},
		}));
	});

	afterEach(() => {
		setArtifactZhCnFlag(undefined);
		vi.restoreAllMocks();
	});

	it("normalizes an omitted legacy GET language to English", async () => {
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], []);

		await expect(getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA } })).resolves.toEqual({
			report: null,
			reason: "not_generated",
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "en",
		});
		expectScopedLanguagePredicate(0, "en");
		expect(mocks.requireBrandAccess).toHaveBeenCalledWith("admin-1", "ppio");
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("normalizes an omitted legacy POST language to English", async () => {
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], []);

		await expect(generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA } })).resolves.toEqual({
			report: null,
			reason: "insufficient-data",
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "en",
		});
		expectScopedLanguagePredicate(0, "en");
	});

	it.each(["zh", "CN", "zh-SG"])("rejects unsupported GET language %s before auth or database access", async (value) => {
		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: value as "en" } }),
		).rejects.toThrow();
		expect(mocks.requireAuthSession).not.toHaveBeenCalled();
		expect(mocks.queryLog).toHaveLength(0);
	});

	it.each(["zh", "CN", "zh-SG"])("rejects unsupported POST language %s before auth or database access", async (value) => {
		await expect(
			generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: value as "en" } }),
		).rejects.toThrow();
		expect(mocks.requireAuthSession).not.toHaveBeenCalled();
		expect(mocks.queryLog).toHaveLength(0);
	});

	it("does not return a Chinese row to an English GET even if a database double returns it", async () => {
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], [storedRow("zh-CN")]);

		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "en" } }),
		).resolves.toMatchObject({ report: null, reason: "not_generated", outputLanguage: "en" });
		expectScopedLanguagePredicate(0, "en");
	});

	it("reads an existing Chinese row while the Chinese write gate is disabled", async () => {
		const row = storedRow("zh-CN");
		mocks.selectResults.push([{ id: SCOPE_CHINA }], [row]);

		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" } }),
		).resolves.toMatchObject({ report: row.report, reason: null, outputLanguage: "zh-CN" });
		expectScopedLanguagePredicate(0, "zh-CN");
	});

	it("never queries a legacy null-scope row for Chinese", async () => {
		mocks.selectResults.push([{ id: SCOPE_CHINA }], []);

		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" } }),
		).resolves.toMatchObject({ reason: "not_generated", outputLanguage: "zh-CN" });
		expect(opportunityQueries()).toHaveLength(1);
		expectScopedLanguagePredicate(0, "zh-CN");
	});

	it("queries an English-only predicate before returning a legacy null-scope row", async () => {
		const row = storedRow("en", { scopeId: null });
		mocks.selectResults.push([{ id: SCOPE_CHINA }], [], [row]);

		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "en" } }),
		).resolves.toMatchObject({ report: row.report, reason: null, outputLanguage: "en" });
		expectScopedLanguagePredicate(0, "en");
		expect(opportunityQueries()[1]?.predicate).toEqual({
			op: "and",
			predicates: [
				{ op: "eq", column: "brandOpportunities.brandId", value: "ppio" },
				{ op: "isNull", column: "brandOpportunities.scopeId" },
				{ op: "eq", column: "brandOpportunities.outputLanguage", value: "en" },
			],
		});
	});

	it("does not expose a legacy row when a disabled historical Program still exists", async () => {
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], []);

		await expect(
			getOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "en" } }),
		).resolves.toMatchObject({ report: null, reason: "not_generated", outputLanguage: "en" });
		expect(opportunityQueries()).toHaveLength(1);
	});

	it.each(["en", "zh-CN"] as const)(
		"rejects unauthorized %s generation before scope, database, digest, or LLM work",
		async (outputLanguage) => {
			mocks.requireAuthSession.mockResolvedValue({ user: { id: "customer-1", role: "user" } });

			await expect(
				generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage } }),
			).rejects.toThrow("Platform administrator");
			expect(mocks.resolveMeasurementScopeForBrand).not.toHaveBeenCalled();
			expect(mocks.queryLog).toHaveLength(0);
			expect(mocks.resolveFilteredPrompts).not.toHaveBeenCalled();
			expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
			expect(mocks.insert).not.toHaveBeenCalled();
		},
	);

	it("rejects generation for a scope that does not belong to the brand", async () => {
		mocks.resolveMeasurementScopeForBrand.mockRejectedValue(new Error("Measurement scope does not belong to brand"));

		await expect(
			generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_GLOBAL, outputLanguage: "en" } }),
		).rejects.toThrow("does not belong to brand");
		expect(mocks.queryLog).toHaveLength(0);
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it("rejects an observation Program before any paid completion", async () => {
		mocks.resolveMeasurementScopeForBrand.mockResolvedValue({
			id: SCOPE_CHINA,
			enabled: true,
			timezone: "UTC",
			samplingEvaluationRole: "observation",
		});

		await expect(
			generateOpportunitiesFn({ data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "en" } }),
		).rejects.toThrow("scored Program");
		expect(mocks.queryLog).toHaveLength(0);
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it.each([undefined, "false", "TRUE", "invalid"])(
		"fails Chinese writes closed for flag %s before scope or paid side effects",
		async (flag) => {
			setArtifactZhCnFlag(flag);

			await expect(
				generateOpportunitiesFn({
					data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" },
				}),
			).resolves.toEqual({
				report: null,
				reason: "temporarily-unavailable",
				generatedFor: null,
				lastEvaluatedAt: null,
				outputLanguage: "zh-CN",
			});
			expect(mocks.requireAuthSession).toHaveBeenCalledTimes(1);
			expect(mocks.resolveMeasurementScopeForBrand).not.toHaveBeenCalled();
			expect(mocks.queryLog).toHaveLength(0);
			expect(mocks.resolveFilteredPrompts).not.toHaveBeenCalled();
			expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
			expect(mocks.insert).not.toHaveBeenCalled();
		},
	);

	it("does not treat a recent English row as a fresh or insufficient-data fallback for Chinese", async () => {
		setArtifactZhCnFlag("true");
		const almostSixDaysOld = new Date(Date.now() - 5.9 * 86_400_000);
		mocks.selectResults.push(
			[{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }],
			[storedRow("en", { createdAt: almostSixDaysOld })],
		);

		await expect(
			generateOpportunitiesFn({
				data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" },
			}),
		).resolves.toEqual({
			report: null,
			reason: "insufficient-data",
			generatedFor: null,
			lastEvaluatedAt: null,
			outputLanguage: "zh-CN",
		});
		expectScopedLanguagePredicate(0, "zh-CN");
		expect(mocks.runStructuredCompletionPrompt).not.toHaveBeenCalled();
	});

	it("serves only a fresh same-language generation cache entry", async () => {
		setArtifactZhCnFlag("true");
		const row = storedRow("zh-CN", { createdAt: new Date() });
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], [row]);

		await expect(
			generateOpportunitiesFn({
				data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" },
			}),
		).resolves.toMatchObject({ report: row.report, reason: null, outputLanguage: "zh-CN" });
		expectScopedLanguagePredicate(0, "zh-CN");
		expect(mocks.resolveFilteredPrompts).not.toHaveBeenCalled();
	});

	it("uses only a stale same-language row for the insufficient-data fallback", async () => {
		setArtifactZhCnFlag("true");
		const row = storedRow("zh-CN", { createdAt: new Date("2026-01-01T00:00:00.000Z") });
		mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], [row]);

		await expect(
			generateOpportunitiesFn({
				data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" },
			}),
		).resolves.toMatchObject({ report: row.report, reason: null, outputLanguage: "zh-CN" });
		expectScopedLanguagePredicate(0, "zh-CN");
	});

	it("does not use a stale English row when Chinese model generation fails", async () => {
		setArtifactZhCnFlag("true");
		mocks.selectResults.push(
			[{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }],
			[storedRow("en", { createdAt: new Date("2026-01-01T00:00:00.000Z") })],
		);
		configureSufficientDigest();
		mocks.runStructuredCompletionPrompt.mockRejectedValue(new Error("provider unavailable"));
		vi.spyOn(console, "warn").mockImplementation(() => undefined);

		await expect(
			generateOpportunitiesFn({
				data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage: "zh-CN" },
			}),
		).rejects.toThrow("Failed to generate a valid opportunities report");
		expectScopedLanguagePredicate(0, "zh-CN");
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	it.each([
		["en", EN_GUIDANCE, ZH_GUIDANCE],
		["zh-CN", ZH_GUIDANCE, EN_GUIDANCE],
	] as const)(
		"adds exactly one %s guidance block and persists the selected language",
		async (outputLanguage, guidance, otherGuidance) => {
			if (outputLanguage === "zh-CN") setArtifactZhCnFlag("true");
			mocks.selectResults.push([{ id: SCOPE_CHINA }, { id: SCOPE_GLOBAL }], []);
			configureSufficientDigest();
			mocks.runStructuredCompletionPrompt.mockResolvedValue(
				successfulModelReport(["which ai ide works in 中国?", "invented prompt"]),
			);

			const result = await generateOpportunitiesFn({
				data: { brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage },
			});

			const prompt = mocks.runStructuredCompletionPrompt.mock.calls[0]?.[0] as string;
			expect(prompt.split(guidance)).toHaveLength(2);
			expect(prompt).not.toContain(otherGuidance);
			expect(result).toMatchObject({ outputLanguage, generatedFor: { brandName: "原样品牌" } });
			expect(result.report?.opportunities[0]?.relatedPrompts).toEqual([
				{ text: RAW_PROMPT, promptId: "prompt-1" },
			]);
			expect(mocks.insertValues).toEqual([
				expect.objectContaining({ brandId: "ppio", scopeId: SCOPE_CHINA, outputLanguage }),
			]);
			const insertedReport = mocks.insertValues[0]?.report as
				| { opportunities: { relatedPrompts: unknown[] }[] }
				| undefined;
			expect(insertedReport?.opportunities[0]?.relatedPrompts).toEqual([
				{ text: RAW_PROMPT, promptId: "prompt-1" },
			]);
			expectScopedLanguagePredicate(0, outputLanguage);
		},
	);

	it("never exposes a report from another measurement scope or language", () => {
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: SCOPE_GLOBAL,
				reportOutputLanguage: "en",
				requestedScopeId: SCOPE_CHINA,
				requestedOutputLanguage: "en",
				totalScopeCount: 2,
				soleScopeId: null,
			}),
		).toBe(false);
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: SCOPE_CHINA,
				reportOutputLanguage: "zh-CN",
				requestedScopeId: SCOPE_CHINA,
				requestedOutputLanguage: "en",
				totalScopeCount: 1,
				soleScopeId: SCOPE_CHINA,
			}),
		).toBe(false);
	});

	it("allows a legacy unscoped English report only for the sole requested Program", () => {
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: null,
				reportOutputLanguage: "en",
				requestedScopeId: SCOPE_CHINA,
				requestedOutputLanguage: "en",
				totalScopeCount: 1,
				soleScopeId: SCOPE_CHINA,
			}),
		).toBe(true);
		expect(
			canReadOpportunityReportInScope({
				reportScopeId: null,
				reportOutputLanguage: "en",
				requestedScopeId: SCOPE_CHINA,
				requestedOutputLanguage: "zh-CN",
				totalScopeCount: 1,
				soleScopeId: SCOPE_CHINA,
			}),
		).toBe(false);
	});
});
