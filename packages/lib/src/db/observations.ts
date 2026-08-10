import type { ModelConfig } from "@workspace/config/scrape-targets";
import { and, eq, sql } from "drizzle-orm";
import type { ObservationTargetDescriptor } from "../observation-targets";
import { buildObservationSourceKey } from "../observation-targets";
import type { Citation } from "../text-extraction";
import { db } from "./db";
import {
	completeDeliveryTaskInTransaction,
	type DeliveryClaimProof,
	failDeliveryTaskInTransaction,
} from "./delivery-batches";
import {
	attachEvidenceArtifactsInTransaction,
	type EvidenceArtifactReference,
	EvidenceArtifactValidationError,
	resolveEvidenceArtifactsForSubmission,
} from "./evidence-artifacts";
import { type Brand, citations, type MeasurementScope, observationAttempts, promptRuns } from "./schema";

export class ObservationSourceConflictError extends Error {
	constructor(public readonly sourceKey: string) {
		super(`Observation source key ${sourceKey} is already assigned to a different sample`);
		this.name = "ObservationSourceConflictError";
	}
}

export interface ClaimedObservationAttempt {
	id: string;
	startedAt: Date;
	state: "execute" | "in_progress" | "completed";
	promptRunId?: string;
}

const RUNNING_ATTEMPT_LEASE_MS = 14 * 60 * 1_000;

interface ClaimObservationInput {
	sourceKey: string;
	sourceJobId?: string;
	promptId: string;
	promptText: string;
	brandId: string;
	scope: MeasurementScope;
	target: ObservationTargetDescriptor;
	config: ModelConfig;
	sampleIndex: number;
	captureMetadata?: Record<string, unknown>;
	sampleFingerprint?: string;
}

async function claimObservationAttemptBySource(input: ClaimObservationInput): Promise<ClaimedObservationAttempt> {
	const startedAt = new Date();
	const fixedLocalization = Boolean(input.target.fixedMarket && input.target.fixedLocale);
	const localizationEvidence = fixedLocalization
		? "fixed_route"
		: input.target.captureMode === "manual_import" || input.target.captureMode === "assisted_browser"
			? "capture_reported"
			: "prompt_context_only";
	const captureMetadata = {
		captureMode: input.target.captureMode,
		scopeContextMarket: input.scope.market,
		scopeContextLocale: input.scope.locale,
		timezone: input.scope.timezone,
		fixedMarket: input.target.fixedMarket,
		fixedLocale: input.target.fixedLocale,
		executionMarketVerified: fixedLocalization,
		localizationEvidence,
		...input.captureMetadata,
		...(input.sampleFingerprint ? { sampleFingerprint: input.sampleFingerprint } : {}),
	};

	const [inserted] = await db
		.insert(observationAttempts)
		.values({
			sourceKey: input.sourceKey,
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

	if (inserted) return { ...inserted, state: "execute" };

	const existing = await db.query.observationAttempts.findFirst({
		where: and(eq(observationAttempts.brandId, input.brandId), eq(observationAttempts.sourceKey, input.sourceKey)),
		columns: {
			id: true,
			status: true,
			startedAt: true,
			promptId: true,
			scopeId: true,
			surfaceTargetKey: true,
			captureRouteKey: true,
			promptText: true,
			model: true,
			provider: true,
			requestedVersion: true,
			webSearchEnabled: true,
			sampleIndex: true,
			captureMetadata: true,
		},
	});
	if (!existing) throw new Error(`Failed to resolve observation attempt ${input.sourceKey}`);
	const identityChanged =
		existing.promptId !== input.promptId ||
		existing.scopeId !== input.scope.id ||
		existing.surfaceTargetKey !== input.target.surfaceTargetKey ||
		existing.captureRouteKey !== input.target.captureRouteKey ||
		existing.promptText !== input.promptText ||
		existing.model !== input.config.model ||
		existing.provider !== input.config.provider ||
		(existing.requestedVersion ?? undefined) !== input.config.version ||
		existing.webSearchEnabled !== input.config.webSearch ||
		existing.sampleIndex !== input.sampleIndex;
	const fingerprintChanged =
		input.sampleFingerprint !== undefined &&
		(existing.captureMetadata as { sampleFingerprint?: unknown }).sampleFingerprint !== input.sampleFingerprint;
	const runningLeaseActive =
		existing.status === "running" && Date.now() - existing.startedAt.getTime() < RUNNING_ATTEMPT_LEASE_MS;
	if (
		identityChanged ||
		(fingerprintChanged && (existing.status === "succeeded" || existing.status === "cancelled" || runningLeaseActive))
	) {
		throw new ObservationSourceConflictError(input.sourceKey);
	}

	if (existing.status === "succeeded" || existing.status === "cancelled") {
		const existingRun = await db.query.promptRuns.findFirst({
			where: eq(promptRuns.observationAttemptId, existing.id),
			columns: { id: true },
		});
		return {
			id: existing.id,
			startedAt: existing.startedAt,
			state: "completed",
			promptRunId: existingRun?.id,
		};
	}
	if (runningLeaseActive) {
		return { id: existing.id, startedAt: existing.startedAt, state: "in_progress" };
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
				eq(observationAttempts.status, existing.status),
				eq(observationAttempts.startedAt, existing.startedAt),
			),
		)
		.returning({ id: observationAttempts.id, startedAt: observationAttempts.startedAt });

	if (!claimed) return { id: existing.id, startedAt: existing.startedAt, state: "in_progress" };
	return { ...claimed, state: "execute" };
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
	return claimObservationAttemptBySource({
		...input,
		sourceKey: buildObservationSourceKey({
			sourceJobId: input.sourceJobId,
			config: input.config,
			sampleIndex: input.sampleIndex,
		}),
	});
}

export async function claimImportedObservationAttempt(input: {
	sourceKey: string;
	promptId: string;
	promptText: string;
	brandId: string;
	scope: MeasurementScope;
	target: ObservationTargetDescriptor;
	config: ModelConfig;
	sampleIndex: number;
	captureMetadata: Record<string, unknown>;
	sampleFingerprint: string;
}): Promise<ClaimedObservationAttempt> {
	return claimObservationAttemptBySource(input);
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
	stage: "configuration" | "provider" | "persistence" | "import";
	deliveryClaim?: DeliveryClaimProof;
}): Promise<void> {
	const completedAt = new Date();
	const markFailed = async (executor: Pick<typeof db, "update">) => {
		return executor
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
			.where(
				and(
					eq(observationAttempts.id, input.attemptId),
					eq(observationAttempts.status, "running"),
					eq(observationAttempts.startedAt, input.startedAt),
				),
			)
			.returning({ id: observationAttempts.id });
	};

	if (!input.deliveryClaim) {
		await markFailed(db);
		return;
	}
	const deliveryClaim = input.deliveryClaim;

	await db.transaction(async (tx) => {
		const [failedAttempt] = await markFailed(tx);
		if (!failedAttempt) throw new Error(`Observation attempt ${input.attemptId} lease was lost`);
		await failDeliveryTaskInTransaction(tx, {
			...deliveryClaim,
			observationAttemptId: input.attemptId,
			error: input.error,
		});
	});
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
	deliveryClaim?: DeliveryClaimProof;
	evidenceArtifacts?: {
		artifactIds: readonly string[];
		uriForArtifact: (artifactId: string) => string;
	};
}): Promise<{ id: string; createdAt: Date; evidenceRefs: EvidenceArtifactReference[] }> {
	return db.transaction(async (tx) => {
		const completedAt = new Date();
		const [completed] = await tx
			.update(observationAttempts)
			.set({
				status: "succeeded",
				completedAt,
				latencyMs: Math.max(0, completedAt.getTime() - input.startedAt.getTime()),
				errorClass: null,
				errorCode: null,
				errorMessage: null,
				failureStage: null,
			})
			.where(
				and(
					eq(observationAttempts.id, input.attemptId),
					eq(observationAttempts.status, "running"),
					eq(observationAttempts.startedAt, input.startedAt),
				),
			)
			.returning({ id: observationAttempts.id });
		if (!completed) throw new Error(`Observation attempt ${input.attemptId} lease was lost`);

		if (input.evidenceArtifacts && !input.deliveryClaim) {
			throw new EvidenceArtifactValidationError("Managed evidence artifacts require a delivery claim");
		}
		const evidenceRefs =
			input.evidenceArtifacts && input.deliveryClaim
				? await resolveEvidenceArtifactsForSubmission(tx, {
						brandId: input.brand.id,
						claim: input.deliveryClaim,
						artifactIds: input.evidenceArtifacts.artifactIds,
						uriForArtifact: input.evidenceArtifacts.uriForArtifact,
					})
				: [];
		if (evidenceRefs.length > 0) {
			await tx
				.update(observationAttempts)
				.set({
					captureMetadata: sql`(${observationAttempts.captureMetadata}::jsonb || ${JSON.stringify({ evidenceRefs })}::jsonb)::json`,
				})
				.where(eq(observationAttempts.id, input.attemptId));
		}

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
				rawOutput: mergeEvidenceRefs(input.rawOutput, evidenceRefs),
				answerText: input.answerText,
				webQueries: input.webQueries,
				brandMentioned: input.brandMentioned,
				competitorsMentioned: input.competitorsMentioned,
				observedAt: input.observedAt,
				createdAt: input.observedAt,
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
					createdAt: input.observedAt,
				})),
			);
		}

		if (input.deliveryClaim) {
			if (input.evidenceArtifacts) {
				await attachEvidenceArtifactsInTransaction(tx, {
					brandId: input.brand.id,
					claim: input.deliveryClaim,
					artifactIds: input.evidenceArtifacts.artifactIds,
					observationAttemptId: input.attemptId,
					uriForArtifact: input.evidenceArtifacts.uriForArtifact,
				});
			}
			await completeDeliveryTaskInTransaction(tx, {
				...input.deliveryClaim,
				observationAttemptId: input.attemptId,
			});
		}

		return { ...promptRun, evidenceRefs };
	});
}

function mergeEvidenceRefs(rawOutput: unknown, evidenceRefs: EvidenceArtifactReference[]): unknown {
	if (evidenceRefs.length === 0) return rawOutput;
	if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
		throw new EvidenceArtifactValidationError("Managed evidence requires an object-shaped raw output");
	}
	return { ...rawOutput, evidenceRefs };
}
