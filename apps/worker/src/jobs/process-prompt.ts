import * as Sentry from "@sentry/node";
import { getDefaultDelayHours, getRunsPerPrompt } from "@workspace/lib/constants";
import { db } from "@workspace/lib/db/db";
import { resolvePromptMeasurementScope } from "@workspace/lib/db/measurement-scopes";
import {
	claimObservationAttempt,
	markObservationFailed,
	persistSuccessfulObservation,
} from "@workspace/lib/db/observations";
import { type Brand, brands, type Competitor, competitors, prompts } from "@workspace/lib/db/schema";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import { assertObservationRouteSupportsScope, resolveObservationTarget } from "@workspace/lib/observation-targets";
import {
	formatScrapeTarget,
	getProvider,
	type ModelConfig,
	type Provider,
	parseScrapeTargets,
	selectTargetsForBrand,
} from "@workspace/lib/providers";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import boss from "../boss";
import { trackWorkerEvent } from "../telemetry";
import {
	archivePromptResponseSnapshotBestEffort,
	assertPromptSnapshotCaptureConfiguration,
	buildPromptResponseSnapshotDraft,
	resolvePromptSnapshotCapturePolicy,
} from "./process-prompt-snapshot-policy";
import { assertResponseSnapshotCapacity } from "./response-snapshot-maintenance-policy";

export interface ProcessPromptData {
	promptId: string;
	cadenceHours?: number; // Hours until next run (for self-rescheduling)
}

interface PromptContext {
	prompt: typeof prompts.$inferSelect;
	brand: Brand;
	competitors: Competitor[];
}

/**
 * Schedule the next run for a prompt after the specified cadence.
 */
async function scheduleNextRun(promptId: string, cadenceHours: number): Promise<void> {
	const startAfterSeconds = cadenceHours * 60 * 60;

	try {
		await boss.send(
			"process-prompt",
			{ promptId, cadenceHours },
			{
				singletonKey: `prompt-${promptId}`,
				singletonSeconds: startAfterSeconds, // Prevent duplicates for the cadence period
				startAfter: startAfterSeconds,
				retryLimit: 3,
				retryDelay: 60,
				retryBackoff: true,
				expireInSeconds: 60 * 15,
			},
		);
		console.log(`Scheduled next run for prompt ${promptId} in ${cadenceHours}h`);
	} catch (error) {
		console.error(`Failed to schedule next run for prompt ${promptId}:`, error);
		// Don't throw - we don't want to fail the job just because rescheduling failed
	}
}

/**
 * Get the cadence hours for a prompt based on its brand's delay override.
 */
async function getCadenceHours(promptId: string): Promise<number> {
	const defaultDelayHours = getDefaultDelayHours();
	const prompt = await db.query.prompts.findFirst({
		where: eq(prompts.id, promptId),
	});

	if (!prompt) return defaultDelayHours;

	const brand = await db.query.brands.findFirst({
		where: eq(brands.id, prompt.brandId),
	});

	if (!brand) return defaultDelayHours;

	return brand.delayOverrideHours ?? defaultDelayHours;
}

async function getPromptContext(promptId: string): Promise<PromptContext | null> {
	const prompt = await db.query.prompts.findFirst({
		where: eq(prompts.id, promptId),
	});

	if (!prompt) {
		console.error(`Prompt not found: ${promptId}`);
		return null;
	}

	const brand = await db.query.brands.findFirst({
		where: eq(brands.id, prompt.brandId),
	});

	if (!brand) {
		console.error(`Brand not found: ${prompt.brandId}`);
		return null;
	}

	const brandCompetitors = await db.query.competitors.findMany({
		where: eq(competitors.brandId, prompt.brandId),
	});

	return {
		prompt,
		brand,
		competitors: brandCompetitors,
	};
}

export async function runModelIteration({
	sourceJobId,
	promptId,
	promptValue,
	brand,
	scope,
	competitorsList,
	config,
	providerImpl,
	runIndex,
	beforeProviderRun,
}: {
	sourceJobId: string;
	promptId: string;
	promptValue: string;
	brand: Brand;
	scope: Awaited<ReturnType<typeof resolvePromptMeasurementScope>>;
	competitorsList: Competitor[];
	config: ModelConfig;
	providerImpl: Provider;
	runIndex: number;
	beforeProviderRun?: () => Promise<void>;
}): Promise<{ observationAttemptId: string; promptRunId: string; providerSubmissionId?: string } | null> {
	const logPrefix = `[${config.model}_${runIndex}]`;
	const target = resolveObservationTarget(config);
	const snapshotCaptureEnabled = process.env.RESPONSE_SNAPSHOT_ENABLED === "true";
	assertPromptSnapshotCaptureConfiguration({
		enabled: snapshotCaptureEnabled,
		provider: config.provider,
		storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT,
	});
	const capacity = await assertResponseSnapshotCapacity({
		enabled: snapshotCaptureEnabled && config.provider === "brightdata",
		storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT,
	});
	if (capacity?.state === "warn") {
		console.warn(`[response-snapshots] capacity warning (${capacity.usedPercent.toFixed(1)}% used)`);
	}
	const attempt = await claimObservationAttempt({
		sourceJobId,
		promptId,
		promptText: promptValue,
		brandId: brand.id,
		scope,
		target,
		config,
		sampleIndex: runIndex,
	});
	if (attempt.state === "completed") {
		console.log(`${logPrefix} Observation already completed; skipping duplicate execution`);
		return attempt.promptRunId ? { observationAttemptId: attempt.id, promptRunId: attempt.promptRunId } : null;
	}
	if (attempt.state === "in_progress") {
		throw new Error(`${logPrefix} Observation is already in progress`);
	}

	let failureStage: "configuration" | "provider" | "persistence" = "configuration";
	try {
		assertObservationRouteSupportsScope(target, scope);
		await beforeProviderRun?.();
		failureStage = "provider";
		const result = await providerImpl.run(config.model, promptValue, {
			webSearch: config.webSearch,
			version: config.version,
		});
		const observedAt = new Date();
		failureStage = "persistence";

		// `webQueries` is stored exactly as the provider reported it — engines do
		// sometimes genuinely search the prompt verbatim, and that's real data. The
		// fan-out page excludes verbatim repeats at read time as a display rule;
		// providers whose query field is fabricated (DataForSEO) write the
		// `unavailable` sentinel in their own extractor instead.
		const { rawOutput, textContent, webQueries, citations: extractedCitations, modelVersion } = result;
		console.log(`${logPrefix} AI call completed, textContent length: ${textContent?.length ?? "null"}`);
		const snapshotCapture = resolvePromptSnapshotCapturePolicy({
			enabled: snapshotCaptureEnabled,
			storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT,
			snapshotSource: result.snapshotSource,
		});

		const safeTextContent = typeof textContent === "string" ? textContent : "";

		const { brandMentioned, competitorsMentioned } = analyzeMentions(safeTextContent, brand, competitorsList);

		const recordedVersion = modelVersion ?? config.version ?? config.provider;

		const { id: promptRunId, snapshotReservation } = await persistSuccessfulObservation({
			attemptId: attempt.id,
			startedAt: attempt.startedAt,
			observedAt,
			promptId,
			brand,
			scope,
			target,
			config,
			recordedVersion,
			answerText: safeTextContent,
			rawOutput,
			webQueries,
			brandMentioned,
			competitorsMentioned,
			extractedCitations,
			reserveResponseSnapshot: snapshotCapture !== null,
		});
		console.log(`${logPrefix} Saved prompt run ${promptRunId}`);

		const snapshotSource = result.snapshotSource;
		if (snapshotCapture && snapshotReservation && snapshotSource) {
			const snapshotResult = await archivePromptResponseSnapshotBestEffort({
				reservation: snapshotReservation,
				storageRoot: snapshotCapture.storageRoot,
				draft: () =>
					buildPromptResponseSnapshotDraft({
						promptRunId,
						brandId: brand.id,
						scopeId: scope.id,
						promptId,
						promptText: promptValue,
						answerText: safeTextContent,
						citations: extractedCitations,
						webQueries,
						webSearchEnabled: config.webSearch,
						brandMentioned,
						competitorsMentioned,
						channel: target.surfaceTargetKey,
						modelVersion: recordedVersion,
						market: scope.market,
						locale: scope.locale,
						timezone: scope.timezone,
						observedAt,
						snapshotSource,
					}),
			});
			if (snapshotResult.status !== "ready" && snapshotResult.status !== "already_ready") {
				console.warn(
					`${logPrefix} Response snapshot ${snapshotResult.snapshotId} queued for recovery (${snapshotResult.status})`,
				);
			}
		}
		return {
			observationAttemptId: attempt.id,
			promptRunId,
			...(result.providerSubmissionId ? { providerSubmissionId: result.providerSubmissionId } : {}),
		};
	} catch (error) {
		try {
			await markObservationFailed({
				attemptId: attempt.id,
				startedAt: attempt.startedAt,
				error,
				stage: failureStage,
			});
		} catch (attemptError) {
			Sentry.withScope((scope) => {
				scope.setTag("queue", "process-prompt");
				scope.setTag("failure_stage", "attempt-persistence");
				scope.setContext("run", { promptId, brandId: brand.id, runIndex, attemptId: attempt.id });
				Sentry.captureException(attemptError);
			});
		}
		// A single run's failure doesn't fail the job (only an all-runs failure
		// does), so report it here to keep per-provider failure rates visible.
		Sentry.withScope((scope) => {
			scope.setTag("queue", "process-prompt");
			scope.setTag("provider", config.provider);
			scope.setTag("model", config.model);
			scope.setTag("surface_target", target.surfaceTargetKey);
			scope.setTag("capture_route", target.captureRouteKey);
			scope.setTag("failure_stage", failureStage);
			scope.setContext("run", { promptId, brandId: brand.id, runIndex, attemptId: attempt.id });
			Sentry.captureException(error);
		});
		throw error;
	}
}

/**
 * Process a prompt - runs AI models and saves results.
 * This is a pg-boss job handler, called when a scheduled job fires.
 * After successful completion, schedules the next run.
 */
export async function processPromptJob(jobs: Job<ProcessPromptData>[]): Promise<void> {
	const scrapeConfigs = parseScrapeTargets(process.env.SCRAPE_TARGETS);

	// pg-boss v12 passes an array of jobs - process each one
	for (const job of jobs) {
		const { promptId, cadenceHours: providedCadence } = job.data;
		console.log(`Processing prompt ${promptId}`);

		// Get cadence hours - use provided value or look it up
		const cadenceHours = providedCadence ?? (await getCadenceHours(promptId));

		// Get prompt context
		const context = await getPromptContext(promptId);
		if (!context) {
			console.log(`Prompt ${promptId} not found, skipping (no reschedule)`);
			continue; // Job completes successfully - prompt was deleted, don't reschedule
		}

		const { prompt, brand, competitors: competitorsList } = context;

		// Check if prompt and brand are enabled
		if (!prompt.enabled || !brand.enabled) {
			console.log(`Prompt ${promptId} or brand ${brand.id} is disabled, skipping but rescheduling`);
			// Still reschedule - the prompt might be enabled later
			await scheduleNextRun(promptId, cadenceHours);
			continue;
		}

		const scope = await resolvePromptMeasurementScope(prompt);

		const brandConfigs = selectTargetsForBrand(scrapeConfigs, brand.enabledModels);
		const selectedConfigs =
			scope.automaticTargetKeys === null
				? brandConfigs
				: brandConfigs.filter((config) => scope.automaticTargetKeys?.includes(formatScrapeTarget(config)));
		if (scope.automaticTargetKeys && scope.automaticTargetKeys.length > 0) {
			const selectedTargetKeys = new Set(selectedConfigs.map((config) => formatScrapeTarget(config)));
			const missingTargetKeys = scope.automaticTargetKeys.filter((targetKey) => !selectedTargetKeys.has(targetKey));
			if (missingTargetKeys.length > 0) {
				throw new Error(
					`Scope ${scope.key} automatic targets are unavailable in the deployment or disabled for the brand: ${missingTargetKeys.join(", ")}`,
				);
			}
		}
		if (selectedConfigs.length === 0) {
			console.log(`Prompt ${promptId} for brand ${brand.id} has no targets (brand.enabledModels=[])`);
			if (scope.automaticTargetKeys?.length === 0) {
				console.log(`Scope ${scope.key} is manual-only; prompt ${promptId} will not be rescheduled`);
				continue;
			}
			if (scope.automaticTargetKeys && scope.automaticTargetKeys.length > 0) {
				throw new Error(
					`Scope ${scope.key} has automatic targets configured, but none match the deployment and brand target configuration`,
				);
			}
		}

		console.log(`Processing prompt "${prompt.value}" for brand "${brand.name}"`);

		// Run all model iterations in parallel
		const runPromises: Promise<void>[] = [];
		const runsPerPrompt = getRunsPerPrompt();

		for (const config of selectedConfigs) {
			const providerImpl = getProvider(config.provider);
			for (let i = 0; i < runsPerPrompt; i++) {
				runPromises.push(
					runModelIteration({
						sourceJobId: String(job.id),
						promptId,
						promptValue: prompt.value,
						brand,
						scope,
						competitorsList,
						config,
						providerImpl,
						runIndex: i + 1,
					}).then(() => undefined),
				);
			}
		}

		const results = await Promise.allSettled(runPromises);
		const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

		if (failures.length > 0) {
			const errorMessages = failures
				.map((f, i) => `Run ${i + 1}: ${f.reason instanceof Error ? f.reason.message : String(f.reason)}`)
				.join("; ");

			// Log failures but don't throw if some succeeded
			console.error(`Prompt ${promptId} had ${failures.length}/${runPromises.length} failed runs: ${errorMessages}`);

			// If ALL runs failed, throw to trigger retry
			if (failures.length === runPromises.length) {
				throw new Error(`All runs failed for prompt ${promptId}: ${errorMessages}`);
			}
		}

		const successCount = runPromises.length - failures.length;
		console.log(`Completed prompt ${promptId}: ${successCount}/${runPromises.length} successful runs`);

		trackWorkerEvent("prompt_processed", {
			brand_id: brand.id,
			scope_id: scope.id,
			surface_targets: [...new Set(selectedConfigs.map((config) => resolveObservationTarget(config).surfaceTargetKey))],
			capture_routes: [...new Set(selectedConfigs.map((config) => resolveObservationTarget(config).captureRouteKey))],
			models: [...new Set(selectedConfigs.map((c) => c.model))],
			providers: [...new Set(selectedConfigs.map((c) => c.provider))],
			total_runs: runPromises.length,
			successful_runs: successCount,
			failed_runs: failures.length,
		});

		// Schedule the next run
		await scheduleNextRun(promptId, cadenceHours);
	}
}
