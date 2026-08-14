import {
	type BrowserRunnerClaim,
	claimBrowserRunnerTask,
	markBrowserRunnerSubmitConfirmed,
	markBrowserRunnerSubmitIntent,
	recordBrowserRunnerFailure,
	resumeBrowserRunnerTask,
} from "@workspace/lib/db/browser-runner";
import { db } from "@workspace/lib/db/db";
import {
	completeDeliveryTaskSuccess,
	getDeliveryBatch,
	getDeliveryTask,
	heartbeatDeliveryTask,
} from "@workspace/lib/db/delivery-batches";
import { listEvidenceArtifactsForClaim } from "@workspace/lib/db/evidence-artifacts";
import {
	claimImportedObservationAttempt,
	markObservationFailed,
	persistSuccessfulObservation,
} from "@workspace/lib/db/observations";
import {
	brands,
	deliveryBatches,
	deliveryTasks,
	measurementScopes,
	observationAttempts,
	promptRuns,
} from "@workspace/lib/db/schema";
import type { DeliveryManifestSnapshot } from "@workspace/lib/delivery-manifest";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { BrowserRunnerHttpError, type BrowserRunnerPrincipal } from "./browser-runner-auth";
import {
	archiveBrowserRunnerResponseSnapshotBestEffort,
	assertBrowserRunnerSnapshotClaimCapacity,
	BrowserRunnerSnapshotCapacityError,
	buildBrowserRunnerResponseSnapshotDraft,
} from "./browser-runner-snapshot-policy";
import {
	browserAnswerHtmlSchema,
	prepareSamplingObservation,
	samplingObservationBaseSchema,
} from "./sampling-observation";

export const browserRunnerClaimSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
		batchId: z.guid().optional(),
		surfaceTargetKeys: z.array(z.literal("doubao.consumer_web")).min(1).max(1).optional(),
	})
	.strict();

export const browserRunnerLeaseSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
		leaseToken: z.string().min(32).max(500),
		leaseGeneration: z.number().int().positive(),
	})
	.strict();

export const browserRunnerSessionLeaseSchema = browserRunnerLeaseSchema.extend({
	runnerSessionId: z.string().trim().min(1).max(300),
});

export const browserRunnerResumeSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
	})
	.strict();

export const browserRunnerFailureSchema = browserRunnerLeaseSchema.extend({
	stage: z.enum(["pre_submit", "post_submit"]),
	code: z.string().trim().min(1).max(100),
	reason: z.string().trim().min(1).max(1_000),
});

export const browserRunnerObservationSchema = browserRunnerLeaseSchema.extend({
	runnerSessionId: z.string().trim().min(1).max(300),
	adapterVersion: z.string().trim().min(1).max(100),
	browserVersion: z.string().trim().min(1).max(200),
	observation: samplingObservationBaseSchema.extend({ answerHtml: browserAnswerHtmlSchema }),
});

export function assertBrowserRunnerEvidenceSelection(
	artifacts: readonly { id: string; kind: "screenshot" | "page_snapshot" }[],
	evidenceArtifactIds: readonly string[],
): void {
	const submittedArtifactIds = new Set(evidenceArtifactIds);
	const submittedArtifacts = artifacts.filter(({ id }) => submittedArtifactIds.has(id));
	if (
		evidenceArtifactIds.length !== 2 ||
		submittedArtifactIds.size !== 2 ||
		submittedArtifacts.length !== 2 ||
		submittedArtifacts.filter(({ kind }) => kind === "screenshot").length !== 1 ||
		submittedArtifacts.filter(({ kind }) => kind === "page_snapshot").length !== 1
	) {
		throw new Error("Browser Runner completion requires exactly one staged screenshot and one staged page snapshot");
	}
}

const RUNNER_LEASE_MS = 15 * 60 * 1_000;

export async function claimRunnerTask(
	input: z.infer<typeof browserRunnerClaimSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertCapacity?: typeof assertBrowserRunnerSnapshotClaimCapacity;
		claim?: typeof claimBrowserRunnerTask;
	} = {},
) {
	try {
		await (dependencies.assertCapacity ?? assertBrowserRunnerSnapshotClaimCapacity)({
			enabled: process.env.RESPONSE_SNAPSHOT_ENABLED === "true",
			storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT,
		});
	} catch (error) {
		if (error instanceof BrowserRunnerSnapshotCapacityError) {
			throw new BrowserRunnerHttpError(503, "Response snapshot storage is unavailable; Browser Runner queue is paused");
		}
		throw error;
	}
	const claim = await (dependencies.claim ?? claimBrowserRunnerTask)({
		...input,
		runnerId: principal.id,
		leaseDurationMs: RUNNER_LEASE_MS,
	});
	if (!claim) return null;
	return buildRunnerClaimResponse(claim, principal, false);
}

export async function getRunnerQueueState(
	input: z.infer<typeof browserRunnerClaimSchema>,
): Promise<"settled" | "drained" | "waiting"> {
	if (!input.batchId) {
		const [pending] = await db
			.select({ id: deliveryTasks.id })
			.from(deliveryBatches)
			.innerJoin(deliveryTasks, eq(deliveryTasks.batchId, deliveryBatches.id))
			.where(
				and(
					eq(deliveryBatches.brandId, input.brandId),
					eq(deliveryBatches.executionMode, "browser_runner"),
					eq(deliveryBatches.status, "in_progress"),
					eq(deliveryBatches.automationStatus, "running"),
					isNotNull(deliveryBatches.automationStartedAt),
					inArray(deliveryTasks.status, ["available", "claimed"]),
					inArray(deliveryTasks.automationStatus, ["queued", "running"]),
				),
			)
			.limit(1);
		if (pending) return "waiting";
		const [needsHuman] = await db
			.select({ id: deliveryTasks.id })
			.from(deliveryBatches)
			.innerJoin(deliveryTasks, eq(deliveryTasks.batchId, deliveryBatches.id))
			.where(
				and(
					eq(deliveryBatches.brandId, input.brandId),
					eq(deliveryBatches.executionMode, "browser_runner"),
					eq(deliveryBatches.status, "in_progress"),
					eq(deliveryBatches.automationStatus, "needs_human"),
					eq(deliveryTasks.automationStatus, "needs_human"),
				),
			)
			.limit(1);
		return browserRunnerGlobalQueueState(false, Boolean(needsHuman));
	}
	const result = await getDeliveryBatch({ brandId: input.brandId, batchId: input.batchId });
	if (result?.batch.executionMode !== "browser_runner") return "waiting";
	if (
		result.batch.automationStatus === "settled" ||
		result.batch.status === "completed" ||
		result.batch.status === "cancelled"
	) {
		return "settled";
	}
	return result.batch.automationStatus === "needs_human" ? "drained" : "waiting";
}

export function browserRunnerGlobalQueueState(
	hasStartedQueuedOrRunningTask: boolean,
	hasNeedsHumanTask = false,
): "waiting" | "drained" | "settled" {
	if (hasStartedQueuedOrRunningTask) return "waiting";
	return hasNeedsHumanTask ? "drained" : "settled";
}

export async function resumeRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerResumeSchema>,
	principal: BrowserRunnerPrincipal,
) {
	const claim = await resumeBrowserRunnerTask({
		brandId: input.brandId,
		taskId,
		runnerId: principal.id,
		leaseDurationMs: RUNNER_LEASE_MS,
	});
	return buildRunnerClaimResponse(claim, principal, true);
}

async function buildRunnerClaimResponse(
	claim: BrowserRunnerClaim,
	principal: BrowserRunnerPrincipal,
	postSubmitAssist: boolean,
) {
	const batch = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.id, claim.task.batchId), eq(deliveryBatches.brandId, claim.task.brandId)),
	});
	if (!batch?.manifestSnapshot) throw new Error("Browser Runner task has no frozen manifest");
	const manifest = batch.manifestSnapshot as DeliveryManifestSnapshot;
	if (
		manifest.scope.market !== principal.market ||
		manifest.scope.locale !== principal.locale ||
		manifest.scope.timezone !== principal.timezone
	) {
		await recordBrowserRunnerFailure({
			brandId: claim.task.brandId,
			taskId: claim.task.id,
			runnerId: principal.id,
			leaseToken: claim.leaseToken,
			leaseGeneration: claim.leaseGeneration,
			stage: "pre_submit",
			code: "runner_localization_mismatch",
			reason: "Frozen measurement scope does not match the server-bound CN runner registration",
		});
		throw new Error("Browser Runner registration does not match the frozen measurement scope");
	}
	return {
		task: {
			id: claim.task.id,
			batchId: claim.task.batchId,
			brandId: claim.task.brandId,
			scopeId: claim.task.scopeId,
			promptId: claim.task.promptId,
			promptText: claim.task.promptText,
			surfaceTargetKey: claim.task.surfaceTargetKey,
			captureRouteKey: claim.task.captureRouteKey,
			sampleIndex: claim.task.sampleIndex,
			sessionRequirement: claim.task.sessionRequirement,
			searchRequirement: claim.task.searchRequirement,
			evaluationRole: claim.task.evaluationRole,
			timezone: manifest.scope.timezone,
			market: manifest.scope.market,
			locale: manifest.scope.locale,
			launchUrl: "https://www.doubao.com/chat/",
			minimumEvidenceArtifacts: manifest.protocol.evidence.minimumArtifacts,
			automationAttemptCount: claim.task.automationAttemptCount,
		},
		leaseToken: claim.leaseToken,
		leaseGeneration: claim.leaseGeneration,
		leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
		postSubmitAssist,
		submitConfirmed: claim.task.submitConfirmedAt !== null,
		runnerSessionId: claim.task.runnerSessionId,
	};
}

export async function heartbeatRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerLeaseSchema>,
	runnerId: string,
) {
	await assertRunnerTask(taskId, input.brandId, runnerId);
	return heartbeatDeliveryTask({
		taskId,
		claimedBy: runnerClaimant(runnerId),
		leaseToken: input.leaseToken,
		leaseGeneration: input.leaseGeneration,
		leaseDurationMs: RUNNER_LEASE_MS,
	});
}

export async function recordRunnerSubmitIntent(
	taskId: string,
	input: z.infer<typeof browserRunnerSessionLeaseSchema>,
	runnerId: string,
) {
	await assertRunnerTask(taskId, input.brandId, runnerId);
	return markBrowserRunnerSubmitIntent({ taskId, ...input, runnerId });
}

export async function recordRunnerSubmitConfirmed(
	taskId: string,
	input: z.infer<typeof browserRunnerSessionLeaseSchema>,
	runnerId: string,
) {
	await assertRunnerTask(taskId, input.brandId, runnerId);
	return markBrowserRunnerSubmitConfirmed({ taskId, ...input, runnerId });
}

export async function failRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerFailureSchema>,
	runnerId: string,
) {
	await assertRunnerTask(taskId, input.brandId, runnerId);
	return recordBrowserRunnerFailure({ taskId, ...input, runnerId });
}

export async function completeRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerObservationSchema>,
	runnerId: string,
) {
	const snapshotCaptureEnabled = process.env.RESPONSE_SNAPSHOT_ENABLED === "true";
	const task = await assertRunnerTask(taskId, input.brandId, runnerId);
	if (task.status === "succeeded" && task.observationAttemptId) {
		const existingRun = await db.query.promptRuns.findFirst({
			where: eq(promptRuns.observationAttemptId, task.observationAttemptId),
			columns: { id: true },
		});
		return { duplicate: true, attemptId: task.observationAttemptId, promptRunId: existingRun?.id ?? null };
	}
	await heartbeatRunnerTask(taskId, input, runnerId);
	if (!task.submitIntentAt || !task.submitConfirmedAt) {
		throw new Error("Browser Runner completion requires durable submit intent and confirmation");
	}
	if (task.runnerSessionId !== input.runnerSessionId) {
		throw new Error("Browser Runner completion session does not match the durable submit intent");
	}
	const [batchResult, brand, scope] = await Promise.all([
		getDeliveryBatch({ brandId: input.brandId, batchId: task.batchId }),
		db.query.brands.findFirst({ where: eq(brands.id, input.brandId) }),
		db.query.measurementScopes.findFirst({
			where: and(eq(measurementScopes.id, task.scopeId), eq(measurementScopes.brandId, task.brandId)),
		}),
	]);
	if (!batchResult?.batch.manifestSnapshot || !brand || !scope) {
		throw new Error("Browser Runner task context no longer exists");
	}
	const manifest = batchResult.batch.manifestSnapshot as DeliveryManifestSnapshot;
	const observation = input.observation;
	const prepared = prepareSamplingObservation({
		task,
		manifest,
		observation,
		captureActor: {
			kind: "browser_runner",
			id: runnerId,
			adapterVersion: input.adapterVersion,
			browserVersion: input.browserVersion,
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
		},
		leaseGeneration: input.leaseGeneration,
	});
	const deliveryClaim = {
		taskId,
		claimedBy: runnerClaimant(runnerId),
		leaseToken: input.leaseToken,
		leaseGeneration: input.leaseGeneration,
	};
	const stagedArtifacts = await listEvidenceArtifactsForClaim({ brandId: task.brandId, claim: deliveryClaim });
	assertBrowserRunnerEvidenceSelection(stagedArtifacts, observation.evidenceArtifactIds);
	const attempt = await claimImportedObservationAttempt({
		sourceKey: `delivery-task:${task.id}`,
		promptId: task.promptId,
		promptText: task.promptText,
		brandId: task.brandId,
		scope,
		target: prepared.target,
		config: prepared.config,
		webSearchObserved: prepared.webSearchObserved,
		sampleIndex: task.sampleIndex,
		captureMetadata: prepared.captureMetadata,
		sampleFingerprint: prepared.sampleFingerprint,
	});
	if (attempt.state === "in_progress") throw new Error("Browser Runner completion is already in progress");
	if (attempt.state === "completed") {
		if (task.status !== "succeeded") {
			await completeDeliveryTaskSuccess({ ...deliveryClaim, observationAttemptId: attempt.id });
		}
		const promptRunId =
			attempt.promptRunId ??
			(
				await db.query.promptRuns.findFirst({
					where: eq(promptRuns.observationAttemptId, attempt.id),
					columns: { id: true },
				})
			)?.id;
		return { duplicate: true, attemptId: attempt.id, promptRunId: promptRunId ?? null };
	}
	let promptRun: Awaited<ReturnType<typeof persistSuccessfulObservation>>;
	try {
		promptRun = await persistSuccessfulObservation({
			attemptId: attempt.id,
			startedAt: attempt.startedAt,
			observedAt: prepared.observedAt,
			promptId: task.promptId,
			brand,
			scope,
			target: prepared.target,
			config: prepared.config,
			webSearchObserved: prepared.webSearchObserved,
			recordedVersion: observation.modelVersion ?? "consumer-surface-unspecified",
			answerText: observation.answerText,
			rawOutput: prepared.rawOutput,
			webQueries: observation.webQueries,
			brandMentioned: prepared.mentionResult.brandMentioned,
			competitorsMentioned: prepared.mentionResult.competitorsMentioned,
			extractedCitations: prepared.citations,
			deliveryClaim,
			evidenceArtifacts: {
				artifactIds: observation.evidenceArtifactIds,
				uriForArtifact: (artifactId) => runnerEvidenceUrl(task.brandId, artifactId),
			},
			reserveResponseSnapshot: snapshotCaptureEnabled,
		});
	} catch (error) {
		const current = await db.query.observationAttempts.findFirst({
			where: eq(observationAttempts.id, attempt.id),
			columns: { status: true },
		});
		if (current?.status === "running") {
			await markObservationFailed({ attemptId: attempt.id, startedAt: attempt.startedAt, error, stage: "import" });
		}
		await recordBrowserRunnerFailure({
			brandId: task.brandId,
			taskId,
			runnerId,
			leaseToken: input.leaseToken,
			leaseGeneration: input.leaseGeneration,
			stage: "post_submit",
			code: "observation_persistence_failed",
			reason: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	if (snapshotCaptureEnabled && promptRun.snapshotReservation) {
		const recordedVersion = observation.modelVersion ?? "consumer-surface-unspecified";
		const snapshot = await archiveBrowserRunnerResponseSnapshotBestEffort({
			reservation: promptRun.snapshotReservation,
			storageRoot: process.env.RESPONSE_SNAPSHOT_ROOT ?? "",
			draft: () =>
				buildBrowserRunnerResponseSnapshotDraft({
					promptRunId: promptRun.id,
					brandId: brand.id,
					scopeId: scope.id,
					promptId: task.promptId,
					promptText: task.promptText,
					answerText: observation.answerText,
					answerHtml: observation.answerHtml,
					citations: prepared.citations.map((citation) => ({
						url: citation.url,
						title: citation.title ?? null,
						domain: citation.domain,
						citationIndex: citation.citationIndex,
					})),
					webQueries: observation.webQueries,
					webSearchEnabled: prepared.config.webSearch,
					brandMentioned: prepared.mentionResult.brandMentioned,
					competitorsMentioned: prepared.mentionResult.competitorsMentioned,
					channel: prepared.target.surfaceTargetKey,
					modelVersion: recordedVersion,
					market: scope.market,
					locale: scope.locale,
					timezone: scope.timezone,
					observedAt: prepared.observedAt,
				}),
		});
		return {
			duplicate: false,
			attemptId: attempt.id,
			promptRunId: promptRun.id,
			snapshot: { id: snapshot.snapshotId, status: snapshot.status },
		};
	}

	return { duplicate: false, attemptId: attempt.id, promptRunId: promptRun.id, snapshot: null };
}

export async function assertRunnerTask(taskId: string, brandId: string, runnerId: string) {
	const task = await getDeliveryTask({ brandId, taskId });
	if (!task) throw new Error("Browser Runner task was not found");
	if (
		task.captureRouteKey !== "browser_runner.doubao" ||
		task.surfaceTargetKey !== "doubao.consumer_web" ||
		task.claimedBy !== runnerClaimant(runnerId)
	) {
		throw new Error("Task is not claimed by this Doubao Browser Runner");
	}
	return task;
}

export function runnerClaimant(runnerId: string) {
	return `browser-runner:${runnerId.trim()}`;
}

function runnerEvidenceUrl(brandId: string, artifactId: string) {
	const appUrl = process.env.APP_URL;
	if (!appUrl) throw new Error("APP_URL is required for Browser Runner evidence");
	return new URL(
		`/api/admin/sampling/evidence/${encodeURIComponent(artifactId)}?brandId=${encodeURIComponent(brandId)}`,
		appUrl,
	).toString();
}
