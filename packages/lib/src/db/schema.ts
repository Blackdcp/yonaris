import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
// `organization` is referenced by the brands FK below; the re-export makes it
// (and the rest of the auth schema) visible to `import * as schema` consumers.
import { organization } from "./schema-auth";

// Better-auth tables & relations — re-exported so `import * as schema` sees everything.
// Source file is auto-generated; run `pnpm run generate:auth-schema` to refresh.
export * from "./schema-auth";

// ============================================================================
// Application tables
// ============================================================================

export const reportStatusEnum = pgEnum("report_status", ["pending", "processing", "completed", "failed"]);
export const observationStatusEnum = pgEnum("observation_status", [
	"pending",
	"running",
	"succeeded",
	"failed",
	"cancelled",
]);

export const brands = pgTable(
	"brands",
	{
		id: text("id").primaryKey().notNull(),
		name: text("name").notNull(),
		website: text("website").notNull(),
		additionalDomains: text("additional_domains").array().notNull().default([]),
		aliases: text("aliases").array().notNull().default([]),
		enabled: boolean("enabled").default(true).notNull(),
		onboarded: boolean("onboarded").default(false).notNull(),
		delayOverrideHours: integer("delay_override_hours"),
		enabledModels: text("enabled_models").array(),
		// Hard tenancy scope. Every brand belongs to exactly one better-auth
		// organization; org membership (the `member` table) is the access-control
		// mechanism — see apps/web/src/lib/auth/helpers.ts. Historically `brand.id`
		// equalled `organization.id`; the 0010 backfill makes that mapping explicit
		// so cloud entitlements/metering/enforcement can join on it.
		organizationId: text("organization_id")
			.references(() => organization.id)
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		organizationIdIdx: index("brands_organization_id_idx").on(table.organizationId),
	}),
).enableRLS();

export const measurementScopes = pgTable(
	"measurement_scopes",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		key: text("key").notNull(),
		name: text("name").notNull(),
		market: text("market").notNull(),
		locale: text("locale").notNull(),
		timezone: text("timezone").notNull().default("UTC"),
		automaticTargetKeys: text("automatic_target_keys").array(),
		enabled: boolean("enabled").notNull().default(true),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		brandKeyIdx: uniqueIndex("measurement_scopes_brand_key_uidx").on(table.brandId, table.key),
		brandIdIdx: uniqueIndex("measurement_scopes_brand_id_uidx").on(table.brandId, table.id),
		defaultScopeIdx: uniqueIndex("measurement_scopes_one_default_per_brand_uidx")
			.on(table.brandId)
			.where(sql`${table.isDefault} = true`),
		brandEnabledIdx: index("measurement_scopes_brand_enabled_idx").on(table.brandId, table.enabled),
	}),
).enableRLS();

export const prompts = pgTable(
	"prompts",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id"),
		value: text("value").notNull(),
		enabled: boolean("enabled").default(true).notNull(),
		tags: text("tags").array().notNull().default([]),
		systemTags: text("system_tags").array().notNull().default([]),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		brandIdIdx: index("prompts_brand_id_idx").on(table.brandId),
		brandIdEnabledIdx: index("prompts_brand_id_enabled_idx").on(table.brandId, table.enabled),
		brandScopeEnabledIdx: index("prompts_brand_scope_enabled_idx").on(table.brandId, table.scopeId, table.enabled),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "prompts_brand_scope_fk",
		}),
	}),
).enableRLS();

export const competitors = pgTable("competitors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	brandId: text("brand_id")
		.references(() => brands.id)
		.notNull(),
	name: text("name").notNull(),
	domains: text("domains").array().notNull().default([]),
	aliases: text("aliases").array().notNull().default([]),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
}).enableRLS();

export const observationAttempts = pgTable(
	"observation_attempts",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		sourceKey: text("source_key").notNull(),
		sourceJobId: text("source_job_id"),
		promptId: uuid("prompt_id")
			.references(() => prompts.id)
			.notNull(),
		promptText: text("prompt_text").notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id").notNull(),
		surfaceTargetKey: text("surface_target_key").notNull(),
		captureRouteKey: text("capture_route_key").notNull(),
		model: text("model").notNull(),
		provider: text("provider").notNull(),
		requestedVersion: text("requested_version"),
		webSearchEnabled: boolean("web_search_enabled").notNull(),
		sampleIndex: smallint("sample_index").notNull(),
		executionCount: smallint("execution_count").notNull().default(1),
		status: observationStatusEnum().notNull().default("pending"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		latencyMs: integer("latency_ms"),
		errorClass: text("error_class"),
		errorCode: text("error_code"),
		errorMessage: text("error_message"),
		failureStage: text("failure_stage"),
		captureMetadata: json("capture_metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		sourceKeyIdx: uniqueIndex("observation_attempts_brand_source_key_uidx").on(table.brandId, table.sourceKey),
		promptCreatedIdx: index("observation_attempts_prompt_created_idx").on(table.promptId, table.createdAt),
		brandScopeTargetStatusCreatedIdx: index("observation_attempts_scope_target_status_created_idx").on(
			table.brandId,
			table.scopeId,
			table.surfaceTargetKey,
			table.status,
			table.createdAt,
		),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "observation_attempts_brand_scope_fk",
		}),
		positiveSampleIndex: check("observation_attempts_positive_sample_index", sql`${table.sampleIndex} > 0`),
	}),
).enableRLS();

export const promptRuns = pgTable(
	"prompt_runs",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		promptId: uuid("prompt_id")
			.references(() => prompts.id)
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		observationAttemptId: uuid("observation_attempt_id").references(() => observationAttempts.id),
		scopeId: uuid("scope_id"),
		surfaceTargetKey: text("surface_target_key"),
		captureRouteKey: text("capture_route_key"),
		model: text("model").notNull(),
		provider: text("provider"),
		version: text("version").notNull(),
		webSearchEnabled: boolean("web_search_enabled").notNull(),
		rawOutput: json("raw_output").notNull(),
		answerText: text("answer_text"),
		webQueries: text("web_queries").array().notNull().default([]),
		brandMentioned: boolean("brand_mentioned").notNull(),
		competitorsMentioned: text("competitors_mentioned").array().notNull().default([]),
		observedAt: timestamp("observed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		promptIdCreatedAtIdx: index("prompt_runs_prompt_id_created_at_idx").on(table.promptId, table.createdAt),
		createdAtIdx: index("prompt_runs_created_at_idx").on(table.createdAt),
		webSearchCreatedAtIdx: index("prompt_runs_web_search_created_at_idx").on(table.webSearchEnabled, table.createdAt),
		webSearchModelCreatedAtIdx: index("prompt_runs_web_search_model_created_at_idx").on(
			table.webSearchEnabled,
			table.model,
			table.createdAt,
		),
		providerIdx: index("prompt_runs_provider_idx").on(table.provider),
		observationAttemptIdx: uniqueIndex("prompt_runs_observation_attempt_id_uidx").on(table.observationAttemptId),
		modelCreatedAtIdx: index("prompt_runs_model_created_at_idx").on(table.model, table.createdAt),
		scopeTargetCreatedAtIdx: index("prompt_runs_scope_target_created_at_idx").on(
			table.brandId,
			table.scopeId,
			table.surfaceTargetKey,
			table.createdAt,
		),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "prompt_runs_brand_scope_fk",
		}),
	}),
).enableRLS();

export const citations = pgTable(
	"citations",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		promptRunId: uuid("prompt_run_id")
			.references(() => promptRuns.id)
			.notNull(),
		promptId: uuid("prompt_id")
			.references(() => prompts.id)
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		model: text("model").notNull(),
		url: text("url").notNull(),
		domain: text("domain").notNull(),
		title: text("title"),
		citationIndex: smallint("citation_index").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
	},
	(table) => ({
		brandAnalyticsIdx: index("idx_citations_brand_analytics").on(
			table.brandId,
			table.createdAt,
			table.url,
			table.domain,
			table.title,
			table.promptId,
			table.model,
		),
		promptCreatedIdx: index("citations_prompt_id_created_at_idx").on(table.promptId, table.createdAt),
		domainIdx: index("citations_domain_idx").on(table.domain),
	}),
).enableRLS();

export const reports = pgTable(
	"reports",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandName: text("brand_name").notNull(),
		brandWebsite: text("brand_website").notNull(),
		status: reportStatusEnum().notNull().default("pending"),
		progress: integer("progress").notNull().default(0),
		rawOutput: json("raw_output"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		createdAtIdx: index("reports_created_at_idx").on(table.createdAt),
	}),
).enableRLS();

// One row per generated Opportunities report, per brand — append-only history
// (every generation is kept, not overwritten). The page reads the latest row and
// regenerates only when it's stale; see apps/web/src/server/opportunities.ts.
export const brandOpportunities = pgTable(
	"brand_opportunities",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		/** The full enriched opportunities report the page renders (OpportunitiesReport JSON). */
		report: json("report").notNull(),
		/** Model/provider that generated it, when known. */
		model: text("model"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		brandCreatedIdx: index("brand_opportunities_brand_id_created_at_idx").on(table.brandId, table.createdAt),
	}),
).enableRLS();

export type BrandOpportunity = typeof brandOpportunities.$inferSelect;
export type NewBrandOpportunity = typeof brandOpportunities.$inferInsert;

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

export type MeasurementScope = typeof measurementScopes.$inferSelect;
export type NewMeasurementScope = typeof measurementScopes.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;

export type PromptRun = typeof promptRuns.$inferSelect;
export type NewPromptRun = typeof promptRuns.$inferInsert;

export type ObservationAttempt = typeof observationAttempts.$inferSelect;
export type NewObservationAttempt = typeof observationAttempts.$inferInsert;

export type BrandWithPrompts = Brand & {
	prompts: Prompt[];
	competitors: Competitor[];
};

export type CitationRecord = typeof citations.$inferSelect;
export type NewCitationRecord = typeof citations.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export const SYSTEM_TAGS = {
	BRANDED: "branded",
	UNBRANDED: "unbranded",
} as const;

export type SystemTag = (typeof SYSTEM_TAGS)[keyof typeof SYSTEM_TAGS];

// Encrypted overrides for credential environment variables, keyed by the env-var
// name they stand in for. Separate table, strictest access.
export const secrets = pgTable("secrets", {
	name: text("name").primaryKey().notNull(),
	encryptedValue: text("encrypted_value").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
}).enableRLS();
