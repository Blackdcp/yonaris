import { db } from "@workspace/lib/db/db";
import {
	type Brand,
	citations,
	type MeasurementScope,
	observationAttempts,
	promptRuns,
} from "@workspace/lib/db/schema";
import { buildObservationSourceKey, type ObservationTargetDescriptor } from "@workspace/lib/observation-targets";
import type { ModelConfig } from "@workspace/lib/providers";
import type { Citation } from "@workspace/lib/text-extraction";
import { and, eq, ne, sql } from "drizzle-orm";

export interface ClaimedObservationAttempt {
	id: string;
	startedAt: Date;
	shouldExecute: boolean;
}

export async function claimObservationAttempt(input: {
	sourceJobId: string;
	promptId: string;
	promptText: string;
	brandId: string;
	scope: MeasurementScope;
	target: ObservationTargetDescriptor;
	config: ModelConfig;
	sampleIndex: number;
}): Promise<ClaimedObservationAttempt> {
	const sourceKey = buildObservationSourceKey({
		sourceJobId: input.sourceJobId,
		config: input.config,
		sampleIndex: input.sampleIndex,
	});
	const startedAt = new Date();
	const captureMetadata = {
		captureMode: input.target.captureMode,
		requestedMarket: input.scope.market,
		requestedLocale: input.scope.locale,
		timezone: input.scope.timezone,
		fixedMarket: input.target.fixedMarket,
		fixedLocale: input.target.fixedLocale,
	};

	const [inserted] = await db
		.insert(observationAttempts)
		.values({
			sourceKey,
			sourceJobId: input.sourceJobId,
			promptId: input.promptId,
			promptText: input.promptText,
			brandId: input.brandId,
			scopeId: input.scope.id,
			surfaceTargetKey: input.target.surfaceTargetKey,
			captureRouteKey: input.target.captureRouteKey,
			model: input.config.model,
			provider: input.config.provider,
			requestedVersion: input.config.version,
			webSearchEnabled: input.config.webSearch,
			sampleIndex: input.sampleIndex,
			status: "running",
			startedAt,
			captureMetadata,
		})
		.onConflictDoNothing({ target: [observationAttempts.brandId, observationAttempts.sourceKey] })
		.returning({ id: observationAttempts.id, startedAt: observationAttempts.startedAt });

	if (inserted) return { ...inserted, shouldExecute: true };

	const existing = await db.query.observationAttempts.findFirst({
		where: and(eq(observationAttempts.brandId, input.brandId), eq(observationAttempts.sourceKey, sourceKey)),
		columns: { id: true, status: true, startedAt: true },
	});
	if (!existing) throw new Error(`Failed to resolve observation attempt ${sourceKey}`);
	if (existing.status === "succeeded" || existing.status === "cancelled") {
		return { id: existing.id, startedAt: existing.startedAt, shouldExecute: false };
	}

	const [claimed] = await db
		.update(observationAttempts)
		.set({
			status: "running",
			executionCount: sql<number>`${observationAttempts.executionCount} + 1`,
			startedAt,
			completedAt: null,
			latencyMs: null,
			errorClass: null,
			errorCode: null,
			errorMessage: null,
			failureStage: null,
			captureMetadata,
		})
		.where(
			and(
				eq(observationAttempts.id, existing.id),
				ne(observationAttempts.status, "succeeded"),
				ne(observationAttempts.status, "cancelled"),
			),
		)
		.returning({ id: observationAttempts.id, startedAt: observationAttempts.startedAt });

	if (!claimed) return { id: existing.id, startedAt: existing.startedAt, shouldExecute: false };
	return { ...claimed, shouldExecute: true };
}

function sanitizeErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/(api[-_ ]?key|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
		.slice(0, 1_000);
}

function errorCode(error: unknown): string | null {
	if (!error || typeof error !== "object" || !("code" in error)) return null;
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" || typeof code === "number" ? String(code).slice(0, 100) : null;
}

export async function markObservationFailed(input: {
	attemptId: string;
	startedAt: Date;
	error: unknown;
	stage: "configuration" | "provider" | "persistence";
}): Promise<void> {
	const completedAt = new Date();
	await db
		.update(observationAttempts)
		.set({
			status: "failed",
			completedAt,
			latencyMs: Math.max(0, completedAt.getTime() - input.startedAt.getTime()),
			errorClass: input.error instanceof Error ? input.error.name : "UnknownError",
			errorCode: errorCode(input.error),
			errorMessage: sanitizeErrorMessage(input.error),
			failureStage: input.stage,
		})
		.where(and(eq(observationAttempts.id, input.attemptId), ne(observationAttempts.status, "succeeded")));
}

export async function persistSuccessfulObservation(input: {
	attemptId: string;
	startedAt: Date;
	observedAt: Date;
	promptId: string;
	brand: Brand;
	scope: MeasurementScope;
	target: ObservationTargetDescriptor;
	config: ModelConfig;
	recordedVersion: string;
	answerText: string;
	rawOutput: unknown;
	webQueries: string[];
	brandMentioned: boolean;
	competitorsMentioned: string[];
	extractedCitations: Citation[];
}): Promise<{ id: string; createdAt: Date }> {
	return db.transaction(async (tx) => {
		const [promptRun] = await tx
			.insert(promptRuns)
			.values({
				promptId: input.promptId,
				brandId: input.brand.id,
				observationAttemptId: input.attemptId,
				scopeId: input.scope.id,
				surfaceTargetKey: input.target.surfaceTargetKey,
				captureRouteKey: input.target.captureRouteKey,
				model: input.config.model,
				provider: input.config.provider,
				version: input.recordedVersion,
				webSearchEnabled: input.config.webSearch,
				rawOutput: input.rawOutput,
				answerText: input.answerText,
				webQueries: input.webQueries,
				brandMentioned: input.brandMentioned,
				competitorsMentioned: input.competitorsMentioned,
				observedAt: input.observedAt,
			})
			.returning({ id: promptRuns.id, createdAt: promptRuns.createdAt });
		if (!promptRun) throw new Error(`Failed to persist successful observation ${input.attemptId}`);

		if (input.extractedCitations.length > 0) {
			await tx.insert(citations).values(
				input.extractedCitations.map((citation) => ({
					promptRunId: promptRun.id,
					promptId: input.promptId,
					brandId: input.brand.id,
					model: input.config.model,
					url: citation.url,
					domain: citation.domain,
					title: citation.title || null,
					citationIndex: citation.citationIndex,
					createdAt: promptRun.createdAt,
				})),
			);
		}

		const [completed] = await tx
			.update(observationAttempts)
			.set({
				status: "succeeded",
				completedAt: input.observedAt,
				latencyMs: Math.max(0, input.observedAt.getTime() - input.startedAt.getTime()),
				errorClass: null,
				errorCode: null,
				errorMessage: null,
				failureStage: null,
			})
			.where(and(eq(observationAttempts.id, input.attemptId), ne(observationAttempts.status, "succeeded")))
			.returning({ id: observationAttempts.id });
		if (!completed) throw new Error(`Observation attempt ${input.attemptId} was already completed`);

		return promptRun;
	});
}
