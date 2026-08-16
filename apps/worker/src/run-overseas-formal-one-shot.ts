import { db } from "@workspace/lib/db/db";
import {
	brands,
	citations,
	competitors,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
	responseSnapshots,
} from "@workspace/lib/db/schema";
import { buildObservationSourceKey, resolveObservationTarget } from "@workspace/lib/observation-targets";
import { getProvider, parseScrapeTargets, selectTargetsForBrand } from "@workspace/lib/providers";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { runModelIteration } from "./jobs/process-prompt";
import { assertResponseSnapshotCapacity } from "./jobs/response-snapshot-maintenance-policy";
import {
	assertOverseasFormalDestination,
	buildOverseasFormalCallPlan,
	type OverseasFormalPromptIdentity,
} from "./overseas-formal-run-policy";
import {
	EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST,
	OVERSEAS_FORMAL_RUN_REQUEST_ID,
	type OverseasFormalRunRequest,
	OverseasFormalRunRequestError,
	readOverseasFormalRunRequestFile,
} from "./overseas-formal-run-request";

type CliMode = "dry-run" | "apply" | "status-only";
type FailureStage = "request" | "prerequisites" | "destination" | "execution" | "diagnostic";

let failureStage: FailureStage = "request";

function parseCli(argv: string[]): { requestFile: string; mode: CliMode } {
	let requestFile: string | undefined;
	let mode: CliMode = "dry-run";
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--apply" || argument === "--status-only") {
			if (mode !== "dry-run") throw new OverseasFormalRunRequestError("duplicate_mode", "Choose one CLI mode");
			mode = argument === "--apply" ? "apply" : "status-only";
			continue;
		}
		if (argument !== "--request-file" || requestFile !== undefined || !argv[index + 1]) {
			throw new OverseasFormalRunRequestError("invalid_cli", "A single --request-file is required");
		}
		requestFile = argv[++index];
	}
	if (!requestFile) throw new OverseasFormalRunRequestError("invalid_cli", "A single --request-file is required");
	return { requestFile, mode };
}

function exactlyOne<T>(rows: T[], entity: string): T {
	if (rows.length !== 1) throw new Error(`${entity} did not resolve exactly once`);
	return rows[0] as T;
}

async function resolvePrerequisites(request: OverseasFormalRunRequest) {
	const brand = exactlyOne(
		await db
			.select()
			.from(brands)
			.where(and(eq(brands.name, request.brand.nameExact), eq(brands.enabled, true)))
			.limit(2),
		"StepFun brand",
	);
	const sourceScope = exactlyOne(
		await db
			.select()
			.from(measurementScopes)
			.where(
				and(
					eq(measurementScopes.brandId, brand.id),
					eq(measurementScopes.key, request.sourceScope.keyExact),
					eq(measurementScopes.enabled, true),
				),
			)
			.limit(2),
		"StepFun source scope",
	);
	const sourcePrompts = await db
		.select({ id: prompts.id, value: prompts.value, tags: prompts.tags, systemTags: prompts.systemTags })
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, sourceScope.id), eq(prompts.enabled, true)))
		.orderBy(asc(prompts.createdAt), asc(prompts.id));
	const configured = selectTargetsForBrand(parseScrapeTargets(process.env.SCRAPE_TARGETS), brand.enabledModels).filter(
		(config) => config.model === request.target.model && config.provider === request.target.provider,
	);
	const config = exactlyOne(configured, "StepFun ChatGPT Bright Data target");
	const target = resolveObservationTarget(config);
	const sourcePlan = buildOverseasFormalCallPlan(request, sourcePrompts, {
		model: config.model,
		provider: config.provider,
		webSearch: config.webSearch,
		surfaceTargetKey: target.surfaceTargetKey,
		captureRouteKey: target.captureRouteKey,
	});
	if (!getProvider(config.provider).isConfigured()) throw new Error("Bright Data provider is not configured");
	if (process.env.RESPONSE_SNAPSHOT_ENABLED !== "true" || !process.env.RESPONSE_SNAPSHOT_ROOT?.trim()) {
		throw new Error("Response snapshot storage is not enabled");
	}
	await assertResponseSnapshotCapacity({ enabled: true, storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT });
	return { brand, sourceScope, sourcePrompts, sourcePlan, config, target };
}

async function readDestination(brandId: string, request: OverseasFormalRunRequest) {
	const rows = await db
		.select()
		.from(measurementScopes)
		.where(and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, request.destinationScope.keyExact)))
		.limit(2);
	if (rows.length === 0) return null;
	const scope = exactlyOne(rows, "Overseas destination scope");
	const promptRows = await db
		.select({ id: prompts.id, value: prompts.value, tags: prompts.tags, systemTags: prompts.systemTags })
		.from(prompts)
		.where(and(eq(prompts.brandId, brandId), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)))
		.orderBy(asc(prompts.createdAt), asc(prompts.id));
	assertOverseasFormalDestination(request, { ...scope, prompts: promptRows });
	return { scope, prompts: promptRows };
}

async function ensureDestination(
	request: OverseasFormalRunRequest,
	brandId: string,
	sourcePrompts: OverseasFormalPromptIdentity[],
) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${request.requestId}, 0))`);
		const existingRows = await tx
			.select()
			.from(measurementScopes)
			.where(and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, request.destinationScope.keyExact)))
			.limit(2)
			.for("update");
		let scope = existingRows.length === 0 ? null : exactlyOne(existingRows, "Overseas destination scope");
		if (!scope) {
			const [scopeCount] = await tx
				.select({ value: count(measurementScopes.id) })
				.from(measurementScopes)
				.where(eq(measurementScopes.brandId, brandId));
			if ((scopeCount?.value ?? 0) >= 20) throw new Error("StepFun has reached the measurement scope limit");
			const createdScopes = await tx
				.insert(measurementScopes)
				.values({
					brandId,
					key: request.destinationScope.keyExact,
					name: request.destinationScope.nameExact,
					market: request.destinationScope.marketExact,
					locale: request.destinationScope.localeExact,
					timezone: request.destinationScope.timezoneExact,
					automaticTargetKeys: [],
					samplingEvaluationRole: request.destinationScope.evaluationRoleExact,
					enabled: true,
					isDefault: false,
				})
				.returning();
			const createdScope = exactlyOne(createdScopes, "Created overseas destination scope");
			scope = createdScope;
			await tx.insert(prompts).values(
				sourcePrompts.map((prompt) => ({
					brandId,
					scopeId: createdScope.id,
					value: prompt.value,
					enabled: true,
					tags: prompt.tags,
					systemTags: prompt.systemTags,
				})),
			);
		}
		const promptRows = await tx
			.select({ id: prompts.id, value: prompts.value, tags: prompts.tags, systemTags: prompts.systemTags })
			.from(prompts)
			.where(and(eq(prompts.brandId, brandId), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)))
			.orderBy(asc(prompts.createdAt), asc(prompts.id));
		assertOverseasFormalDestination(request, { ...scope, prompts: promptRows });
		return { scope, prompts: promptRows };
	});
}

async function diagnostic(
	brandId: string,
	scopeId: string,
	sourceKeys: string[],
): Promise<{
	completedCalls: number;
	failedCalls: number;
	runningCalls: number;
	promptRunCount: number;
	citationCount: number;
	readySnapshots: number;
	pendingSnapshots: number;
	failedSnapshots: number;
}> {
	const attempts = await db
		.select({ id: observationAttempts.id, status: observationAttempts.status })
		.from(observationAttempts)
		.where(and(eq(observationAttempts.brandId, brandId), inArray(observationAttempts.sourceKey, sourceKeys)));
	const completedAttempts = attempts.filter(({ status }) => status === "succeeded");
	const attemptIds = completedAttempts.map(({ id }) => id);
	const runs = attemptIds.length
		? await db
				.select({ id: promptRuns.id })
				.from(promptRuns)
				.where(
					and(
						eq(promptRuns.brandId, brandId),
						eq(promptRuns.scopeId, scopeId),
						inArray(promptRuns.observationAttemptId, attemptIds),
					),
				)
		: [];
	const runIds = runs.map(({ id }) => id);
	const [citationRow] = runIds.length
		? await db
				.select({ value: count(citations.id) })
				.from(citations)
				.where(inArray(citations.promptRunId, runIds))
		: [{ value: 0 }];
	const snapshots = runIds.length
		? await db
				.select({ status: responseSnapshots.status })
				.from(responseSnapshots)
				.where(and(inArray(responseSnapshots.promptRunId, runIds), eq(responseSnapshots.isCurrent, true)))
		: [];
	return {
		completedCalls: completedAttempts.length,
		failedCalls: attempts.filter(({ status }) => status === "failed").length,
		runningCalls: attempts.filter(({ status }) => status === "running" || status === "pending").length,
		promptRunCount: runs.length,
		citationCount: citationRow?.value ?? 0,
		readySnapshots: snapshots.filter(({ status }) => status === "ready").length,
		pendingSnapshots: snapshots.filter(({ status }) => status === "pending").length,
		failedSnapshots: snapshots.filter(({ status }) => status === "failed" || status === "expired").length,
	};
}

async function main(): Promise<void> {
	const cli = parseCli(process.argv.slice(2));
	failureStage = "request";
	const request = await readOverseasFormalRunRequestFile(cli.requestFile);
	failureStage = "prerequisites";
	const prerequisites = await resolvePrerequisites(request);
	failureStage = "destination";
	const existing = await readDestination(prerequisites.brand.id, request);
	const sourceKeys = prerequisites.sourcePlan.calls.map((call) =>
		buildObservationSourceKey({
			sourceJobId: call.sourceJobId,
			config: prerequisites.config,
			sampleIndex: call.sampleIndex,
		}),
	);
	if (cli.mode !== "apply") {
		const state = existing ? await diagnostic(prerequisites.brand.id, existing.scope.id, sourceKeys) : null;
		process.stdout.write(
			`${JSON.stringify({
				ok: true,
				operation: "overseas_formal_one_shot",
				requestId: request.requestId,
				action: existing
					? "existing_read_only"
					: cli.mode === "status-only"
						? "absent_read_only"
						: "would_create_and_run",
				scopeKey: request.destinationScope.keyExact,
				channel: request.target.surfaceTargetKey,
				plannedCalls: prerequisites.sourcePlan.calls.length,
				dailyAutomationEnabled: false,
				...(state
					? {
							completedCalls: state.completedCalls,
							failedCalls: state.failedCalls,
							runningCalls: state.runningCalls,
							promptRunCount: state.promptRunCount,
							readySnapshots: state.readySnapshots,
							pendingSnapshots: state.pendingSnapshots,
							failedSnapshots: state.failedSnapshots,
						}
					: {}),
			})}\n`,
		);
		return;
	}

	const destination =
		existing ?? (await ensureDestination(request, prerequisites.brand.id, prerequisites.sourcePrompts));
	const plan = buildOverseasFormalCallPlan(request, destination.prompts, {
		model: prerequisites.config.model,
		provider: prerequisites.config.provider,
		webSearch: prerequisites.config.webSearch,
		surfaceTargetKey: prerequisites.target.surfaceTargetKey,
		captureRouteKey: prerequisites.target.captureRouteKey,
	});
	const provider = getProvider(prerequisites.config.provider);
	const competitorsList = await db.query.competitors.findMany({
		where: eq(competitors.brandId, prerequisites.brand.id),
	});
	const failures: unknown[] = [];
	failureStage = "execution";
	for (const call of plan.calls) {
		try {
			await runModelIteration({
				sourceJobId: call.sourceJobId,
				promptId: call.prompt.id,
				promptValue: call.prompt.value,
				brand: prerequisites.brand,
				scope: destination.scope,
				competitorsList,
				config: prerequisites.config,
				providerImpl: provider,
				runIndex: call.sampleIndex,
			});
		} catch (error) {
			failures.push(error);
		}
	}
	failureStage = "diagnostic";
	const state = await diagnostic(prerequisites.brand.id, destination.scope.id, sourceKeys);
	if (
		failures.length > 0 ||
		state.completedCalls !== 3 ||
		state.promptRunCount !== 3 ||
		state.readySnapshots !== 3 ||
		state.pendingSnapshots !== 0
	) {
		process.stderr.write(
			`${JSON.stringify({
				ok: false,
				operation: "overseas_formal_one_shot",
				requestId: request.requestId,
				action: "incomplete",
				scopeKey: request.destinationScope.keyExact,
				channel: request.target.surfaceTargetKey,
				plannedCalls: 3,
				completedCalls: state.completedCalls,
				failedCalls: state.failedCalls,
				runningCalls: state.runningCalls,
				promptRunCount: state.promptRunCount,
				readySnapshots: state.readySnapshots,
				pendingSnapshots: state.pendingSnapshots,
				failedSnapshots: state.failedSnapshots,
				executionFailures: failures.length,
				dailyAutomationEnabled: false,
				code: "overseas_formal_one_shot_incomplete",
			})}\n`,
		);
		process.exitCode = 1;
		return;
	}
	process.stdout.write(
		`${JSON.stringify({
			ok: true,
			operation: "overseas_formal_one_shot",
			requestId: request.requestId,
			action: "completed",
			scopeKey: request.destinationScope.keyExact,
			channel: request.target.surfaceTargetKey,
			plannedCalls: 3,
			completedCalls: state.completedCalls,
			promptRunCount: state.promptRunCount,
			citationCount: state.citationCount,
			readySnapshots: state.readySnapshots,
			pendingSnapshots: state.pendingSnapshots,
			dailyAutomationEnabled: false,
		})}\n`,
	);
}

main().catch((error: unknown) => {
	const known = error instanceof OverseasFormalRunRequestError;
	process.stderr.write(
		`${JSON.stringify({
			ok: false,
			operation: "overseas_formal_one_shot",
			requestId: OVERSEAS_FORMAL_RUN_REQUEST_ID,
			action: "failed",
			failureStage,
			scopeKey: EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST.destinationScope.keyExact,
			channel: EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST.target.surfaceTargetKey,
			plannedCalls: 3,
			dailyAutomationEnabled: false,
			code: known ? error.code : "overseas_formal_one_shot_failed",
		})}\n`,
	);
	process.exitCode = 1;
});
