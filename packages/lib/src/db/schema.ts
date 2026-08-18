import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	customType,
	foreignKey,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { BrowserExtensionReadiness } from "../browser-extension-contract";
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
export const deliveryBatchStatusEnum = pgEnum("delivery_batch_status", [
	"draft",
	"frozen",
	"in_progress",
	"completed",
	"cancelled",
]);
export const deliveryTaskStatusEnum = pgEnum("delivery_task_status", [
	"planned",
	"available",
	"claimed",
	"succeeded",
	"failed",
	"cancelled",
]);
export const deliverySessionRequirementEnum = pgEnum("delivery_session_requirement", [
	"none",
	"anonymous_clean",
	"new_account_clean",
	"dedicated_sampling_profile",
]);
export const deliverySearchRequirementEnum = pgEnum("delivery_search_requirement", [
	"not_applicable",
	"required",
	"forbidden",
	"platform_default",
]);
export const deliveryEvaluationRoleEnum = pgEnum("delivery_evaluation_role", ["scored", "observation"]);
export const deliveryExecutionModeEnum = pgEnum("delivery_execution_mode", ["manual", "browser_runner"]);
export const browserRunnerBatchStatusEnum = pgEnum("browser_runner_batch_status", [
	"not_started",
	"running",
	"needs_human",
	"settled",
]);
export const browserRunnerTaskStatusEnum = pgEnum("browser_runner_task_status", [
	"queued",
	"running",
	"needs_human",
	"completed",
]);
export const evidenceArtifactStatusEnum = pgEnum("evidence_artifact_status", ["staged", "attached"]);
export const evidenceArtifactKindEnum = pgEnum("evidence_artifact_kind", ["screenshot", "page_snapshot"]);
export const responseSnapshotStatusEnum = pgEnum("response_snapshot_status", ["pending", "ready", "failed", "expired"]);
export const responseSnapshotStorageBackendEnum = pgEnum("response_snapshot_storage_backend", ["filesystem", "kodo"]);
export const responseSnapshotContentSourceEnum = pgEnum("response_snapshot_content_source", [
	"native_answer_html",
	"browser_answer_html",
	"rendered_from_structured_response",
	"reconstructed_from_historical_run",
]);
export const responseSnapshotCaptureMethodEnum = pgEnum("response_snapshot_capture_method", [
	"brightdata_dataset",
	"brightdata_serp",
	"consumer_web_browser",
	"historical_reconstruction",
]);
export const responseSnapshotAccessActionEnum = pgEnum("response_snapshot_access_action", [
	"view_html",
	"download_html",
	"download_json",
	"download_manifest",
	"export",
]);
export const overseasRunCohortStatusEnum = pgEnum("overseas_run_cohort_status", [
	"dispatch_pending",
	"running",
	"completed",
]);
export const overseasRunCallStatusEnum = pgEnum("overseas_run_call_status", [
	"queued",
	"running",
	"succeeded",
	"failed",
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea";
	},
});

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
		organizationIdIdx: uniqueIndex("brands_organization_id_uidx").on(table.organizationId),
	}),
).enableRLS();

export const browserRunnerDevices = pgTable(
	"browser_runner_devices",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		displayName: text("display_name").notNull(),
		tokenHash: text("token_hash").notNull(),
		extensionVersion: text("extension_version").notNull(),
		browserFamily: text("browser_family").notNull(),
		browserVersion: text("browser_version").notNull(),
		platform: text("platform").notNull(),
		supportedSurfaces: text("supported_surfaces").array().notNull().default([]),
		readiness: json("readiness").$type<BrowserExtensionReadiness>().notNull().default({}),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdBy: text("created_by").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		tokenHashIdx: uniqueIndex("browser_runner_devices_token_hash_uidx").on(table.tokenHash),
		lastSeenIdx: index("browser_runner_devices_last_seen_idx").on(table.lastSeenAt),
		validDisplayName: check(
			"browser_runner_devices_valid_display_name",
			sql`char_length(${table.displayName}) BETWEEN 1 AND 100`,
		),
		validTokenHash: check("browser_runner_devices_valid_token_hash", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
		validBrowserFamily: check("browser_runner_devices_valid_browser_family", sql`${table.browserFamily} = 'chrome'`),
		validPlatform: check("browser_runner_devices_valid_platform", sql`${table.platform} IN ('windows', 'macos')`),
		validSurfaceCount: check(
			"browser_runner_devices_valid_surface_count",
			sql`cardinality(${table.supportedSurfaces}) BETWEEN 1 AND 2`,
		),
		validSurfaces: check(
			"browser_runner_devices_valid_surfaces",
			sql`${table.supportedSurfaces} <@ ARRAY['doubao.consumer_web', 'deepseek.consumer_web']::text[]`,
		),
	}),
).enableRLS();

export const browserRunnerDeviceBrands = pgTable(
	"browser_runner_device_brands",
	{
		deviceId: uuid("device_id")
			.references(() => browserRunnerDevices.id, { onDelete: "cascade" })
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		assignedBy: text("assigned_by").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.deviceId, table.brandId], name: "browser_runner_device_brands_pk" }),
		brandIdx: index("browser_runner_device_brands_brand_idx").on(table.brandId),
	}),
).enableRLS();

export const browserRunnerPairings = pgTable(
	"browser_runner_pairings",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		codeHash: text("code_hash").notNull(),
		displayName: text("display_name").notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		createdBy: text("created_by").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		deviceId: uuid("device_id").references(() => browserRunnerDevices.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		codeHashIdx: uniqueIndex("browser_runner_pairings_code_hash_uidx").on(table.codeHash),
		brandCreatedIdx: index("browser_runner_pairings_brand_created_idx").on(table.brandId, table.createdAt),
		validDisplayName: check(
			"browser_runner_pairings_valid_display_name",
			sql`char_length(${table.displayName}) BETWEEN 1 AND 100`,
		),
		validCodeHash: check("browser_runner_pairings_valid_code_hash", sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`),
		validExpiry: check(
			"browser_runner_pairings_valid_expiry",
			sql`${table.expiresAt} > ${table.createdAt} AND ${table.expiresAt} <= ${table.createdAt} + interval '15 minutes'`,
		),
		consumptionConsistent: check(
			"browser_runner_pairings_consumption_consistent",
			sql`(${table.consumedAt} IS NULL AND ${table.deviceId} IS NULL) OR (${table.consumedAt} IS NOT NULL AND ${table.deviceId} IS NOT NULL)`,
		),
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
		samplingEvaluationRole: deliveryEvaluationRoleEnum("sampling_evaluation_role"),
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
		brandScopeIdIdx: uniqueIndex("prompts_brand_scope_id_uidx").on(table.brandId, table.scopeId, table.id),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "prompts_brand_scope_fk",
		}),
	}),
).enableRLS();

export const deliveryBatches = pgTable(
	"delivery_batches",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		name: text("name").notNull(),
		status: deliveryBatchStatusEnum().notNull().default("draft"),
		executionMode: deliveryExecutionModeEnum("execution_mode").notNull().default("manual"),
		automationStatus: browserRunnerBatchStatusEnum("automation_status"),
		automationStartedAt: timestamp("automation_started_at", { withTimezone: true }),
		automationSettledAt: timestamp("automation_settled_at", { withTimezone: true }),
		plannedTaskCount: integer("planned_task_count").notNull().default(0),
		protocol: json("protocol").notNull().default({}),
		manifestSnapshot: json("manifest_snapshot"),
		manifestHash: text("manifest_hash"),
		createdBy: text("created_by"),
		frozenBy: text("frozen_by"),
		cancelledBy: text("cancelled_by"),
		frozenAt: timestamp("frozen_at", { withTimezone: true }),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		brandIdempotencyIdx: uniqueIndex("delivery_batches_brand_idempotency_uidx").on(table.brandId, table.idempotencyKey),
		identityIdx: uniqueIndex("delivery_batches_identity_uidx").on(table.brandId, table.scopeId, table.id),
		brandScopeStatusCreatedIdx: index("delivery_batches_scope_status_created_idx").on(
			table.brandId,
			table.scopeId,
			table.status,
			table.createdAt,
		),
		executionStateConsistent: check(
			"delivery_batches_execution_state_consistent",
			sql`(${table.executionMode} = 'manual' AND ${table.automationStatus} IS NULL AND ${table.automationStartedAt} IS NULL AND ${table.automationSettledAt} IS NULL) OR (${table.executionMode} = 'browser_runner' AND ${table.automationStatus} IS NOT NULL)`,
		),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "delivery_batches_brand_scope_fk",
		}),
		nonnegativePlannedTaskCount: check(
			"delivery_batches_nonnegative_planned_task_count",
			sql`${table.plannedTaskCount} >= 0`,
		),
		frozenManifestPresent: check(
			"delivery_batches_frozen_manifest_present",
			sql`${table.status} IN ('draft', 'cancelled') OR (${table.plannedTaskCount} > 0 AND ${table.manifestSnapshot} IS NOT NULL AND ${table.manifestHash} IS NOT NULL AND ${table.frozenAt} IS NOT NULL)`,
		),
	}),
).enableRLS();

export const overseasRunCohorts = pgTable(
	"overseas_run_cohorts",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		manifest: json("manifest").notNull(),
		manifestFingerprint: text("manifest_fingerprint").notNull(),
		status: overseasRunCohortStatusEnum("status").notNull().default("dispatch_pending"),
		plannedCallCount: integer("planned_call_count").notNull(),
		createdBy: text("created_by").notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		brandIdempotencyIdx: uniqueIndex("overseas_run_cohorts_brand_idempotency_uidx").on(
			table.brandId,
			table.idempotencyKey,
		),
		brandScopeCreatedIdx: index("overseas_run_cohorts_brand_scope_created_idx").on(
			table.brandId,
			table.scopeId,
			table.createdAt,
		),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "overseas_run_cohorts_brand_scope_fk",
		}),
		validManifestFingerprint: check(
			"overseas_run_cohorts_valid_manifest_fingerprint",
			sql`${table.manifestFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		positivePlannedCallCount: check(
			"overseas_run_cohorts_positive_planned_call_count",
			sql`${table.plannedCallCount} > 0 AND ${table.plannedCallCount} <= 10000`,
		),
		lifecycleConsistent: check(
			"overseas_run_cohorts_lifecycle_consistent",
			sql`(${table.status} = 'dispatch_pending' AND ${table.startedAt} IS NULL AND ${table.completedAt} IS NULL) OR (${table.status} = 'running' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NULL) OR (${table.status} = 'completed' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NOT NULL)`,
		),
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
		webSearchObserved: boolean("web_search_observed"),
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

export const deliveryTasks = pgTable(
	"delivery_tasks",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		batchId: uuid("batch_id").notNull(),
		brandId: text("brand_id").notNull(),
		scopeId: uuid("scope_id").notNull(),
		promptId: uuid("prompt_id").notNull(),
		promptText: text("prompt_text").notNull(),
		surfaceTargetKey: text("surface_target_key").notNull(),
		captureRouteKey: text("capture_route_key").notNull(),
		sampleIndex: smallint("sample_index").notNull(),
		sessionRequirement: deliverySessionRequirementEnum("session_requirement").notNull(),
		searchRequirement: deliverySearchRequirementEnum("search_requirement").notNull(),
		evaluationRole: deliveryEvaluationRoleEnum("evaluation_role").notNull().default("scored"),
		slotKey: text("slot_key").notNull(),
		status: deliveryTaskStatusEnum().notNull().default("planned"),
		automationStatus: browserRunnerTaskStatusEnum("automation_status"),
		automationAttemptCount: smallint("automation_attempt_count").notNull().default(0),
		runnerSessionId: text("runner_session_id"),
		submitIntentAt: timestamp("submit_intent_at", { withTimezone: true }),
		submitConfirmedAt: timestamp("submit_confirmed_at", { withTimezone: true }),
		needsHumanCode: text("needs_human_code"),
		needsHumanReason: text("needs_human_reason"),
		observationAttemptId: uuid("observation_attempt_id").references(() => observationAttempts.id),
		claimedBy: text("claimed_by"),
		leaseTokenHash: text("lease_token_hash"),
		leaseGeneration: integer("lease_generation").notNull().default(0),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		claimCount: smallint("claim_count").notNull().default(0),
		lastErrorClass: text("last_error_class"),
		lastErrorCode: text("last_error_code"),
		lastErrorMessage: text("last_error_message"),
		availableAt: timestamp("available_at", { withTimezone: true }),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
		succeededAt: timestamp("succeeded_at", { withTimezone: true }),
		failedAt: timestamp("failed_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		batchSlotIdx: uniqueIndex("delivery_tasks_batch_slot_uidx").on(table.batchId, table.slotKey),
		batchManifestSlotIdx: uniqueIndex("delivery_tasks_batch_manifest_slot_uidx").on(
			table.batchId,
			table.promptId,
			table.surfaceTargetKey,
			table.captureRouteKey,
			table.sampleIndex,
			table.sessionRequirement,
			table.searchRequirement,
			table.evaluationRole,
		),
		observationAttemptIdx: uniqueIndex("delivery_tasks_observation_attempt_id_uidx").on(table.observationAttemptId),
		batchStatusLeaseIdx: index("delivery_tasks_batch_status_lease_idx").on(
			table.batchId,
			table.status,
			table.leaseExpiresAt,
			table.createdAt,
		),
		brandScopeTargetStatusIdx: index("delivery_tasks_scope_target_status_idx").on(
			table.brandId,
			table.scopeId,
			table.surfaceTargetKey,
			table.status,
		),
		evidenceIdentityIdx: uniqueIndex("delivery_tasks_evidence_identity_uidx").on(
			table.brandId,
			table.scopeId,
			table.batchId,
			table.id,
		),
		batchIdentityFk: foreignKey({
			columns: [table.brandId, table.scopeId, table.batchId],
			foreignColumns: [deliveryBatches.brandId, deliveryBatches.scopeId, deliveryBatches.id],
			name: "delivery_tasks_batch_identity_fk",
		}),
		promptIdentityFk: foreignKey({
			columns: [table.brandId, table.scopeId, table.promptId],
			foreignColumns: [prompts.brandId, prompts.scopeId, prompts.id],
			name: "delivery_tasks_prompt_identity_fk",
		}),
		positiveSampleIndex: check("delivery_tasks_positive_sample_index", sql`${table.sampleIndex} > 0`),
		nonnegativeClaimCount: check("delivery_tasks_nonnegative_claim_count", sql`${table.claimCount} >= 0`),
		nonnegativeAutomationAttemptCount: check(
			"delivery_tasks_nonnegative_automation_attempt_count",
			sql`${table.automationAttemptCount} >= 0`,
		),
		automationStateConsistent: check(
			"delivery_tasks_automation_state_consistent",
			sql`(${table.automationStatus} IS NULL AND ${table.automationAttemptCount} = 0 AND ${table.runnerSessionId} IS NULL AND ${table.submitIntentAt} IS NULL AND ${table.submitConfirmedAt} IS NULL AND ${table.needsHumanCode} IS NULL AND ${table.needsHumanReason} IS NULL) OR (${table.automationStatus} = 'queued' AND ${table.status} IN ('planned', 'available') AND ${table.leaseTokenHash} IS NULL AND ${table.leaseExpiresAt} IS NULL AND ${table.runnerSessionId} IS NULL AND ${table.submitIntentAt} IS NULL AND ${table.submitConfirmedAt} IS NULL AND ${table.needsHumanCode} IS NULL AND ${table.needsHumanReason} IS NULL) OR (${table.automationStatus} = 'running' AND ${table.status} = 'claimed' AND ${table.leaseTokenHash} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL) OR (${table.automationStatus} = 'needs_human' AND ${table.status} = 'available' AND ${table.leaseTokenHash} IS NULL AND ${table.leaseExpiresAt} IS NULL AND ${table.needsHumanCode} IS NOT NULL AND ${table.needsHumanReason} IS NOT NULL) OR (${table.automationStatus} = 'completed' AND ${table.status} IN ('succeeded', 'failed', 'cancelled'))`,
		),
		runnerSessionStateConsistent: check(
			"delivery_tasks_runner_session_state_consistent",
			sql`(${table.runnerSessionId} IS NULL AND ${table.submitIntentAt} IS NULL AND ${table.submitConfirmedAt} IS NULL) OR (${table.runnerSessionId} IS NOT NULL AND char_length(${table.runnerSessionId}) BETWEEN 1 AND 300 AND ${table.submitIntentAt} IS NOT NULL)`,
		),
		nonnegativeLeaseGeneration: check(
			"delivery_tasks_nonnegative_lease_generation",
			sql`${table.leaseGeneration} >= 0`,
		),
		leaseStateConsistent: check(
			"delivery_tasks_lease_state_consistent",
			sql`(${table.status} = 'claimed' AND ${table.claimedBy} IS NOT NULL AND ${table.leaseTokenHash} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL AND ${table.claimedAt} IS NOT NULL) OR (${table.status} <> 'claimed' AND ${table.leaseTokenHash} IS NULL AND ${table.leaseExpiresAt} IS NULL)`,
		),
		terminalStateConsistent: check(
			"delivery_tasks_terminal_state_consistent",
			sql`(${table.status} = 'succeeded' AND ${table.observationAttemptId} IS NOT NULL AND ${table.succeededAt} IS NOT NULL AND ${table.failedAt} IS NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'failed' AND ${table.succeededAt} IS NULL AND ${table.failedAt} IS NOT NULL AND ${table.cancelledAt} IS NULL) OR (${table.status} = 'cancelled' AND ${table.succeededAt} IS NULL AND ${table.failedAt} IS NULL AND ${table.cancelledAt} IS NOT NULL) OR (${table.status} IN ('planned', 'available', 'claimed') AND ${table.succeededAt} IS NULL AND ${table.failedAt} IS NULL AND ${table.cancelledAt} IS NULL)`,
		),
	}),
).enableRLS();

export const evidenceArtifacts = pgTable(
	"evidence_artifacts",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		taskId: uuid("task_id")
			.references(() => deliveryTasks.id)
			.notNull(),
		batchId: uuid("batch_id").notNull(),
		brandId: text("brand_id").notNull(),
		scopeId: uuid("scope_id").notNull(),
		leaseGeneration: integer("lease_generation").notNull(),
		uploadedBy: text("uploaded_by").notNull(),
		kind: evidenceArtifactKindEnum().notNull(),
		mediaType: text("media_type").notNull(),
		originalFilename: text("original_filename"),
		byteSize: integer("byte_size").notNull(),
		sha256: text("sha256").notNull(),
		storageBackend: text("storage_backend").notNull().default("postgres"),
		storageKey: text("storage_key").notNull(),
		content: bytea("content").notNull(),
		status: evidenceArtifactStatusEnum().notNull().default("staged"),
		observationAttemptId: uuid("observation_attempt_id").references(() => observationAttempts.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		attachedAt: timestamp("attached_at", { withTimezone: true }),
	},
	(table) => ({
		taskGenerationShaIdx: uniqueIndex("evidence_artifacts_task_generation_sha_uidx").on(
			table.taskId,
			table.leaseGeneration,
			table.sha256,
		),
		taskStatusCreatedIdx: index("evidence_artifacts_task_status_created_idx").on(
			table.taskId,
			table.status,
			table.createdAt,
		),
		statusCreatedIdx: index("evidence_artifacts_status_created_idx").on(table.status, table.createdAt),
		attemptIdx: index("evidence_artifacts_attempt_id_idx").on(table.observationAttemptId),
		taskIdentityFk: foreignKey({
			columns: [table.brandId, table.scopeId, table.batchId, table.taskId],
			foreignColumns: [deliveryTasks.brandId, deliveryTasks.scopeId, deliveryTasks.batchId, deliveryTasks.id],
			name: "evidence_artifacts_task_identity_fk",
		}),
		positiveLeaseGeneration: check("evidence_artifacts_positive_lease_generation", sql`${table.leaseGeneration} > 0`),
		validByteSize: check(
			"evidence_artifacts_valid_byte_size",
			sql`${table.byteSize} > 0 AND ${table.byteSize} <= 8388608 AND octet_length(${table.content}) = ${table.byteSize}`,
		),
		validSha256: check("evidence_artifacts_valid_sha256", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
		postgresStorage: check(
			"evidence_artifacts_postgres_storage",
			sql`${table.storageBackend} = 'postgres' AND ${table.storageKey} = 'evidence/' || ${table.id}::text`,
		),
		validMediaType: check(
			"evidence_artifacts_valid_media_type",
			sql`(${table.kind} = 'screenshot' AND ${table.mediaType} IN ('image/png', 'image/jpeg', 'image/webp')) OR (${table.kind} = 'page_snapshot' AND ${table.mediaType} IN ('application/pdf', 'text/html'))`,
		),
		stateConsistent: check(
			"evidence_artifacts_state_consistent",
			sql`(${table.status} = 'staged' AND ${table.observationAttemptId} IS NULL AND ${table.attachedAt} IS NULL) OR (${table.status} = 'attached' AND ${table.observationAttemptId} IS NOT NULL AND ${table.attachedAt} IS NOT NULL)`,
		),
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
		webSearchObserved: boolean("web_search_observed"),
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

export const overseasRunCalls = pgTable(
	"overseas_run_calls",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		cohortId: uuid("cohort_id")
			.references(() => overseasRunCohorts.id, { onDelete: "cascade" })
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id").notNull(),
		promptId: uuid("prompt_id")
			.references(() => prompts.id)
			.notNull(),
		promptText: text("prompt_text").notNull(),
		channelKey: text("channel_key").notNull(),
		model: text("model").notNull(),
		provider: text("provider").notNull(),
		requestedVersion: text("requested_version"),
		webSearchEnabled: boolean("web_search_enabled").notNull(),
		surfaceTargetKey: text("surface_target_key").notNull(),
		captureRouteKey: text("capture_route_key").notNull(),
		sampleIndex: smallint("sample_index").notNull(),
		status: overseasRunCallStatusEnum("status").notNull().default("queued"),
		jobDispatchedAt: timestamp("job_dispatched_at", { withTimezone: true }),
		paidIntentAt: timestamp("paid_intent_at", { withTimezone: true }),
		providerSubmissionId: text("provider_submission_id"),
		observationAttemptId: uuid("observation_attempt_id").references(() => observationAttempts.id),
		promptRunId: uuid("prompt_run_id").references(() => promptRuns.id),
		failureClass: text("failure_class"),
		failureCode: text("failure_code"),
		failureMessage: text("failure_message"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => ({
		cohortSlotIdx: uniqueIndex("overseas_run_calls_cohort_slot_uidx").on(
			table.cohortId,
			table.promptId,
			table.surfaceTargetKey,
			table.sampleIndex,
		),
		cohortStatusCreatedIdx: index("overseas_run_calls_cohort_status_created_idx").on(
			table.cohortId,
			table.status,
			table.createdAt,
		),
		attemptIdx: uniqueIndex("overseas_run_calls_observation_attempt_uidx").on(table.observationAttemptId),
		runIdx: uniqueIndex("overseas_run_calls_prompt_run_uidx").on(table.promptRunId),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "overseas_run_calls_brand_scope_fk",
		}),
		promptIdentityFk: foreignKey({
			columns: [table.brandId, table.scopeId, table.promptId],
			foreignColumns: [prompts.brandId, prompts.scopeId, prompts.id],
			name: "overseas_run_calls_prompt_identity_fk",
		}),
		validSampleIndex: check("overseas_run_calls_valid_sample_index", sql`${table.sampleIndex} BETWEEN 1 AND 5`),
		brightDataOnly: check("overseas_run_calls_brightdata_only", sql`${table.provider} = 'brightdata'`),
		lifecycleConsistent: check(
			"overseas_run_calls_lifecycle_consistent",
			sql`(${table.status} = 'queued' AND ${table.startedAt} IS NULL AND ${table.completedAt} IS NULL AND ${table.paidIntentAt} IS NULL AND ${table.observationAttemptId} IS NULL AND ${table.promptRunId} IS NULL) OR (${table.status} = 'running' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NULL AND ${table.promptRunId} IS NULL) OR (${table.status} = 'succeeded' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NOT NULL AND ${table.paidIntentAt} IS NOT NULL AND ${table.observationAttemptId} IS NOT NULL AND ${table.promptRunId} IS NOT NULL AND ${table.failureClass} IS NULL AND ${table.failureCode} IS NULL AND ${table.failureMessage} IS NULL) OR (${table.status} = 'failed' AND ${table.startedAt} IS NOT NULL AND ${table.completedAt} IS NOT NULL AND ${table.failureClass} IS NOT NULL AND ${table.failureCode} IS NOT NULL AND ${table.failureMessage} IS NOT NULL AND ${table.promptRunId} IS NULL)`,
		),
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

export const responseSnapshots = pgTable(
	"response_snapshots",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		promptRunId: uuid("prompt_run_id")
			.references(() => promptRuns.id)
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		scopeId: uuid("scope_id"),
		promptId: uuid("prompt_id")
			.references(() => prompts.id)
			.notNull(),
		revision: smallint("revision").notNull().default(1),
		isCurrent: boolean("is_current").notNull().default(true),
		status: responseSnapshotStatusEnum().notNull().default("pending"),
		storageBackend: responseSnapshotStorageBackendEnum("storage_backend"),
		storageKey: text("storage_key"),
		contentSource: responseSnapshotContentSourceEnum("content_source"),
		captureMethod: responseSnapshotCaptureMethodEnum("capture_method"),
		schemaVersion: text("schema_version"),
		templateVersion: text("template_version"),
		htmlSha256: text("html_sha256"),
		jsonSha256: text("json_sha256"),
		manifestSha256: text("manifest_sha256"),
		sourcePayloadSha256: text("source_payload_sha256"),
		htmlBytes: integer("html_bytes"),
		jsonBytes: integer("json_bytes"),
		manifestBytes: integer("manifest_bytes"),
		htmlGzipBytes: integer("html_gzip_bytes"),
		jsonGzipBytes: integer("json_gzip_bytes"),
		failureCode: text("failure_code"),
		observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		readyAt: timestamp("ready_at", { withTimezone: true }),
		failedAt: timestamp("failed_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => ({
		promptRunRevisionIdx: uniqueIndex("response_snapshots_prompt_run_revision_uidx").on(
			table.promptRunId,
			table.revision,
		),
		promptRunCurrentIdx: uniqueIndex("response_snapshots_prompt_run_current_uidx")
			.on(table.promptRunId)
			.where(sql`${table.isCurrent}`),
		brandCreatedIdx: index("response_snapshots_brand_created_idx").on(table.brandId, table.createdAt),
		statusExpiresIdx: index("response_snapshots_status_expires_idx").on(table.status, table.expiresAt),
		positiveRevision: check("response_snapshots_positive_revision", sql`${table.revision} > 0`),
		validRetention: check("response_snapshots_valid_retention", sql`${table.expiresAt} > ${table.observedAt}`),
		storagePairConsistent: check(
			"response_snapshots_storage_pair_consistent",
			sql`(${table.storageBackend} IS NULL AND ${table.storageKey} IS NULL) OR (${table.storageBackend} IS NOT NULL AND ${table.storageKey} IS NOT NULL AND char_length(${table.storageKey}) BETWEEN 1 AND 1000 AND ${table.storageKey} !~ '(^/|(^|/)[.][.](/|$))')`,
		),
		artifactMetadataConsistent: check(
			"response_snapshots_artifact_metadata_consistent",
			sql`(${table.contentSource} IS NULL AND ${table.captureMethod} IS NULL AND ${table.schemaVersion} IS NULL AND ${table.templateVersion} IS NULL AND ${table.htmlSha256} IS NULL AND ${table.jsonSha256} IS NULL AND ${table.manifestSha256} IS NULL AND ${table.htmlBytes} IS NULL AND ${table.jsonBytes} IS NULL AND ${table.manifestBytes} IS NULL AND ${table.htmlGzipBytes} IS NULL AND ${table.jsonGzipBytes} IS NULL) OR (${table.contentSource} IS NOT NULL AND ${table.captureMethod} IS NOT NULL AND char_length(${table.schemaVersion}) BETWEEN 1 AND 100 AND char_length(${table.templateVersion}) BETWEEN 1 AND 100 AND ${table.htmlSha256} ~ '^[0-9a-f]{64}$' AND ${table.jsonSha256} ~ '^[0-9a-f]{64}$' AND ${table.manifestSha256} ~ '^[0-9a-f]{64}$' AND (${table.sourcePayloadSha256} IS NULL OR ${table.sourcePayloadSha256} ~ '^[0-9a-f]{64}$') AND ${table.htmlBytes} > 0 AND ${table.jsonBytes} > 0 AND ${table.manifestBytes} > 0 AND ${table.htmlGzipBytes} > 0 AND ${table.jsonGzipBytes} > 0)`,
		),
		stateConsistent: check(
			"response_snapshots_state_consistent",
			sql`(${table.status} = 'pending' AND ${table.readyAt} IS NULL AND ${table.failedAt} IS NULL AND ${table.failureCode} IS NULL AND ${table.storageBackend} IS NULL AND ${table.storageKey} IS NULL) OR (${table.status} = 'ready' AND ${table.readyAt} IS NOT NULL AND ${table.failedAt} IS NULL AND ${table.failureCode} IS NULL AND ${table.storageBackend} IS NOT NULL AND ${table.storageKey} IS NOT NULL AND ${table.contentSource} IS NOT NULL) OR (${table.status} = 'failed' AND ${table.readyAt} IS NULL AND ${table.failedAt} IS NOT NULL AND char_length(${table.failureCode}) BETWEEN 1 AND 100 AND ${table.storageBackend} IS NULL AND ${table.storageKey} IS NULL) OR (${table.status} = 'expired' AND ${table.readyAt} IS NOT NULL AND ${table.failedAt} IS NULL AND ${table.failureCode} IS NULL AND ${table.contentSource} IS NOT NULL)`,
		),
		scopeBrandFk: foreignKey({
			columns: [table.brandId, table.scopeId],
			foreignColumns: [measurementScopes.brandId, measurementScopes.id],
			name: "response_snapshots_brand_scope_fk",
		}),
	}),
).enableRLS();

export const responseSnapshotOutbox = pgTable(
	"response_snapshot_outbox",
	{
		snapshotId: uuid("snapshot_id")
			.primaryKey()
			.references(() => responseSnapshots.id, { onDelete: "cascade" })
			.notNull(),
		htmlGzip: bytea("html_gzip").notNull(),
		jsonGzip: bytea("json_gzip").notNull(),
		manifestJson: bytea("manifest_json").notNull(),
		attemptCount: integer("attempt_count").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
		lastErrorCode: text("last_error_code"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => ({
		nextAttemptIdx: index("response_snapshot_outbox_next_attempt_idx").on(table.nextAttemptAt),
		boundedPayload: check(
			"response_snapshot_outbox_bounded_payload",
			sql`octet_length(${table.htmlGzip}) > 0 AND octet_length(${table.jsonGzip}) > 0 AND octet_length(${table.manifestJson}) > 0 AND octet_length(${table.htmlGzip}) + octet_length(${table.jsonGzip}) + octet_length(${table.manifestJson}) <= 8388608`,
		),
		validExpiry: check("response_snapshot_outbox_valid_expiry", sql`${table.expiresAt} > ${table.createdAt}`),
		nonnegativeAttempts: check("response_snapshot_outbox_nonnegative_attempts", sql`${table.attemptCount} >= 0`),
	}),
).enableRLS();

export const responseSnapshotAccessEvents = pgTable(
	"response_snapshot_access_events",
	{
		id: uuid("id").defaultRandom().primaryKey().notNull(),
		snapshotId: uuid("snapshot_id")
			.references(() => responseSnapshots.id)
			.notNull(),
		brandId: text("brand_id")
			.references(() => brands.id)
			.notNull(),
		actorUserId: text("actor_user_id").notNull(),
		action: responseSnapshotAccessActionEnum().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		brandCreatedIdx: index("response_snapshot_access_events_brand_created_idx").on(table.brandId, table.createdAt),
		snapshotCreatedIdx: index("response_snapshot_access_events_snapshot_created_idx").on(
			table.snapshotId,
			table.createdAt,
		),
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
		scopeId: uuid("scope_id"),
		/** The full enriched opportunities report the page renders (OpportunitiesReport JSON). */
		report: json("report").notNull(),
		/** Model/provider that generated it, when known. */
		model: text("model"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		brandScopeCreatedIdx: index("brand_opportunities_brand_scope_created_at_idx").on(
			table.brandId,
			table.scopeId,
			table.createdAt,
		),
		scopeFk: foreignKey({
			columns: [table.scopeId],
			foreignColumns: [measurementScopes.id],
			name: "brand_opportunities_scope_fk",
		}),
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

export type OverseasRunCohort = typeof overseasRunCohorts.$inferSelect;
export type NewOverseasRunCohort = typeof overseasRunCohorts.$inferInsert;
export type OverseasRunCall = typeof overseasRunCalls.$inferSelect;
export type NewOverseasRunCall = typeof overseasRunCalls.$inferInsert;

export type ObservationAttempt = typeof observationAttempts.$inferSelect;
export type NewObservationAttempt = typeof observationAttempts.$inferInsert;

export type DeliveryBatch = typeof deliveryBatches.$inferSelect;
export type NewDeliveryBatch = typeof deliveryBatches.$inferInsert;

export type DeliveryTask = typeof deliveryTasks.$inferSelect;
export type NewDeliveryTask = typeof deliveryTasks.$inferInsert;

export type BrowserRunnerDevice = typeof browserRunnerDevices.$inferSelect;
export type NewBrowserRunnerDevice = typeof browserRunnerDevices.$inferInsert;
export type BrowserRunnerDeviceBrand = typeof browserRunnerDeviceBrands.$inferSelect;
export type BrowserRunnerPairing = typeof browserRunnerPairings.$inferSelect;

export type EvidenceArtifact = typeof evidenceArtifacts.$inferSelect;
export type NewEvidenceArtifact = typeof evidenceArtifacts.$inferInsert;

export type ResponseSnapshot = typeof responseSnapshots.$inferSelect;
export type NewResponseSnapshot = typeof responseSnapshots.$inferInsert;

export type ResponseSnapshotOutbox = typeof responseSnapshotOutbox.$inferSelect;
export type NewResponseSnapshotOutbox = typeof responseSnapshotOutbox.$inferInsert;

export type ResponseSnapshotAccessEvent = typeof responseSnapshotAccessEvents.$inferSelect;
export type NewResponseSnapshotAccessEvent = typeof responseSnapshotAccessEvents.$inferInsert;

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
