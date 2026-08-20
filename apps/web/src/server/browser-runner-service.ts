import {
	assertExtensionEvidenceProtocol,
	type BrowserExtensionSurface,
	browserExtensionCaptureRoute,
	isBrowserExtensionCaptureRoute,
	isCurrentBrowserExtensionAdapterVersionBindingSatisfied,
	STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS,
} from "@workspace/lib/browser-extension-contract";
import {
	type BrowserExtensionTaskOperation,
	browserExtensionTaskOperationDenial,
} from "@workspace/lib/browser-runner-policy";
import {
	type BrowserRunnerClaim,
	type BrowserRunnerTaskReconciliation,
	claimBrowserRunnerTask,
	markBrowserRunnerSubmitConfirmed,
	markBrowserRunnerSubmitIntent,
	reconcileBrowserRunnerTask,
	recordBrowserRunnerFailure,
	resolveBrowserRunnerClaimTargets,
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
	buildBrowserRunnerResponseSnapshotDraftV2,
} from "./browser-runner-snapshot-policy";
import {
	browserRunnerLegacyObservationSchema,
	browserRunnerStructuredObservationSchema,
	prepareSamplingObservation,
} from "./sampling-observation";

export const browserRunnerClaimSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
		batchId: z.guid().optional(),
		adapterVersion: z.string().trim().min(1).max(100).optional(),
		surfaceTargetKeys: z
			.array(z.enum(["doubao.consumer_web", "deepseek.consumer_web"]))
			.min(1)
			.max(2)
			.refine((surfaces) => new Set(surfaces).size === surfaces.length, "Surface targets must be unique")
			.optional(),
	})
	.strict();

export const browserRunnerLeaseSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
		leaseToken: z.string().min(32).max(500),
		leaseGeneration: z.number().int().positive(),
		adapterVersion: z.string().trim().min(1).max(100).optional(),
	})
	.strict();

export const browserRunnerSessionLeaseSchema = browserRunnerLeaseSchema.extend({
	runnerSessionId: z.string().trim().min(1).max(300),
});

export const browserRunnerResumeSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
		stage: z.enum(["pre_submit", "post_submit"]).optional(),
		adapterVersion: z.string().trim().min(1).max(100).optional(),
	})
	.strict();

export const browserRunnerReconcileSchema = z
	.object({
		brandId: z.string().trim().min(1).max(300),
	})
	.strict();

export const browserRunnerFailureSchema = browserRunnerLeaseSchema.extend({
	stage: z.enum(["pre_submit", "post_submit"]),
	code: z.string().trim().min(1).max(100),
	reason: z.string().trim().min(1).max(1_000),
});

export const browserRunnerObservationSchema = browserRunnerLeaseSchema
	.extend({
		runnerSessionId: z.string().trim().min(1).max(300),
		adapterVersion: z.string().trim().min(1).max(100),
		browserVersion: z.string().trim().min(1).max(200),
		observation: z.union([browserRunnerLegacyObservationSchema, browserRunnerStructuredObservationSchema]),
	})
	.superRefine((input, context) => {
		const requiresStructuredObservation = Object.values(STRUCTURED_BROWSER_EXTENSION_ADAPTER_VERSIONS).includes(
			input.adapterVersion,
		);
		const isStructuredObservation =
			"schemaVersion" in input.observation && input.observation.schemaVersion === "browser-runner-observation.v2";
		if (requiresStructuredObservation !== isStructuredObservation) {
			context.addIssue({
				code: "custom",
				path: ["observation"],
				message: "Observation protocol does not match the exact adapter version",
			});
		}
	});

type BrowserRunnerEvidenceArtifact = {
	id: string;
	kind: "screenshot" | "page_snapshot";
	mediaType?: string;
	byteSize?: number;
	sha256?: string;
};

type BrowserRunnerVisualEvidence = {
	artifactId: string;
	mediaType: "image/jpeg";
	sha256: string;
	bytes: number;
};

function assertVisualEvidence(value: BrowserRunnerVisualEvidence | null): BrowserRunnerVisualEvidence {
	if (!value) throw new Error("Structured browser extension completion is missing its staged JPEG evidence");
	return value;
}

function assertLegacyAnswerHtml(observation: z.infer<typeof browserRunnerObservationSchema>["observation"]): string {
	if (!("answerHtml" in observation)) {
		throw new Error("Legacy browser extension completion is missing answer-container HTML");
	}
	return observation.answerHtml;
}

export function assertBrowserRunnerEvidenceSelection(
	captureRouteKey: string,
	artifacts: readonly BrowserRunnerEvidenceArtifact[],
	evidenceArtifactIds: readonly string[],
	adapterVersion?: string,
): BrowserRunnerVisualEvidence | null {
	const submittedArtifactIds = new Set(evidenceArtifactIds);
	const submittedArtifacts = artifacts.filter(({ id }) => submittedArtifactIds.has(id));
	if (isBrowserExtensionCaptureRoute(captureRouteKey)) {
		if (evidenceArtifactIds.length !== 1 || submittedArtifactIds.size !== 1 || submittedArtifacts.length !== 1) {
			throw new Error("Browser extension completion requires exactly one staged page snapshot");
		}
		assertExtensionEvidenceProtocol({
			captureRouteKey,
			adapterVersion,
			minimumArtifacts: evidenceArtifactIds.length,
			kinds: submittedArtifacts.map(({ kind }) => kind),
			mediaTypes: submittedArtifacts.map(({ mediaType }) => mediaType ?? ""),
			byteSizes: submittedArtifacts.map(({ byteSize }) => byteSize ?? 0),
		});
		if (submittedArtifacts[0]?.kind !== "screenshot") return null;
		const screenshot = submittedArtifacts[0];
		if (
			screenshot.mediaType !== "image/jpeg" ||
			screenshot.byteSize === undefined ||
			screenshot.sha256 === undefined ||
			!/^[0-9a-f]{64}$/u.test(screenshot.sha256)
		) {
			throw new Error("Structured browser extension completion requires valid staged JPEG metadata");
		}
		return {
			artifactId: screenshot.id,
			mediaType: screenshot.mediaType,
			sha256: screenshot.sha256,
			bytes: screenshot.byteSize,
		};
	}
	if (
		captureRouteKey !== "browser_runner.doubao" ||
		evidenceArtifactIds.length !== 2 ||
		submittedArtifactIds.size !== 2 ||
		submittedArtifacts.length !== 2 ||
		submittedArtifacts.filter(({ kind }) => kind === "screenshot").length !== 1 ||
		submittedArtifacts.filter(({ kind }) => kind === "page_snapshot").length !== 1
	) {
		throw new Error("Browser Runner completion requires exactly one staged screenshot and one staged page snapshot");
	}
	return null;
}

const RUNNER_LEASE_MS = 15 * 60 * 1_000;

export async function claimRunnerTask(
	input: z.infer<typeof browserRunnerClaimSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertCapacity?: typeof assertBrowserRunnerSnapshotClaimCapacity;
		claim?: typeof claimBrowserRunnerTask;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	assertPrincipalBrand(principal, input.brandId);
	const isAdapterVersionBindingSatisfied =
		dependencies.isAdapterVersionBindingSatisfied ?? isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	if (principal.kind === "browser_extension" && input.adapterVersion !== undefined) {
		const requestedSurfaces = input.surfaceTargetKeys ?? principal.readySurfaces;
		const [requestedSurface] = requestedSurfaces;
		if (
			requestedSurfaces.length !== 1 ||
			!requestedSurface ||
			!isAdapterVersionBindingSatisfied(requestedSurface, input.adapterVersion)
		) {
			throw new BrowserRunnerHttpError(409, "The running Browser Runner adapter is not approved for this claim");
		}
	}
	const captureTargets = resolveBrowserRunnerClaimTargets({
		principalKind: principal.kind,
		requestedSurfaceTargetKeys: input.surfaceTargetKeys,
		supportedSurfaces: principal.kind === "browser_extension" ? principal.readySurfaces : undefined,
	});
	if (
		principal.kind === "browser_extension" &&
		input.adapterVersion === undefined &&
		captureTargets.some((target) => !isAdapterVersionBindingSatisfied(target.surfaceTargetKey, input.adapterVersion))
	) {
		throw new BrowserRunnerHttpError(409, "The running Browser Runner adapter is not approved for this claim");
	}
	if (captureTargets.length === 0) {
		if (principal.kind === "browser_extension") {
			const requested = input.surfaceTargetKeys ?? principal.supportedSurfaces;
			const hasSupportedRequest = requested.some((surface) =>
				principal.supportedSurfaces.includes(surface as BrowserExtensionSurface),
			);
			const hasReadyRequest = requested.some((surface) =>
				principal.readySurfaces.includes(surface as BrowserExtensionSurface),
			);
			if (hasSupportedRequest && !hasReadyRequest) {
				throw new BrowserRunnerHttpError(
					409,
					"No requested Browser Runner surface is ready on this device; reload or update the extension and complete the surface health check",
				);
			}
		}
		return null;
	}
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
		brandId: input.brandId,
		batchId: input.batchId,
		runnerId: principal.id,
		leaseDurationMs: RUNNER_LEASE_MS,
		captureTargets,
	});
	if (!claim) return null;
	return buildRunnerClaimResponse(claim, principal, false);
}

export async function getRunnerQueueState(
	input: z.infer<typeof browserRunnerClaimSchema>,
	principal?: BrowserRunnerPrincipal,
): Promise<"settled" | "drained" | "waiting"> {
	if (principal) assertPrincipalBrand(principal, input.brandId);
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
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		resume?: typeof resumeBrowserRunnerTask;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	await authorizeRunnerTaskOperation(
		taskId,
		input.brandId,
		principal,
		{
			kind: "resume",
			adapterVersion: input.adapterVersion,
		},
		{
			assertTask: dependencies.assertTask,
			isAdapterVersionBindingSatisfied: dependencies.isAdapterVersionBindingSatisfied,
		},
	);
	const claim = await (dependencies.resume ?? resumeBrowserRunnerTask)({
		brandId: input.brandId,
		taskId,
		runnerId: principal.id,
		leaseDurationMs: RUNNER_LEASE_MS,
	});
	return buildRunnerClaimResponse(claim, principal, claim.recoveryStage === "post_submit");
}

export async function reconcileRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerReconcileSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertTask?: (taskId: string, brandId: string, principal: BrowserRunnerPrincipal) => Promise<unknown>;
		reconcile?: (input: Parameters<typeof reconcileBrowserRunnerTask>[0]) => Promise<{
			state: BrowserRunnerTaskReconciliation["state"];
			task: Pick<
				BrowserRunnerTaskReconciliation["task"],
				"id" | "batchId" | "brandId" | "surfaceTargetKey" | "promptText" | "runnerSessionId" | "claimedBy"
			>;
		}>;
	} = {},
) {
	await (dependencies.assertTask ?? assertRunnerReconciliationTask)(taskId, input.brandId, principal);
	const result = await (dependencies.reconcile ?? reconcileBrowserRunnerTask)({
		brandId: input.brandId,
		taskId,
		runnerId: principal.id,
	});
	if (result.task.claimedBy !== runnerClaimant(principal.id)) {
		throw new Error("Task is not claimed by this Browser Runner device");
	}
	return {
		state: result.state,
		task: {
			taskId: result.task.id,
			batchId: result.task.batchId,
			brandId: result.task.brandId,
			surfaceTargetKey: result.task.surfaceTargetKey,
			promptText: result.task.promptText,
		},
		runnerSessionId: result.task.runnerSessionId,
	};
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
			launchUrl: browserRunnerLaunchUrl(claim.task.surfaceTargetKey),
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
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		write?: typeof heartbeatDeliveryTask;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	await authorizeRunnerTaskOperation(
		taskId,
		input.brandId,
		principal,
		{ kind: "heartbeat", adapterVersion: input.adapterVersion },
		{
			assertTask: dependencies.assertTask,
			isAdapterVersionBindingSatisfied: dependencies.isAdapterVersionBindingSatisfied,
		},
	);
	return (dependencies.write ?? heartbeatDeliveryTask)({
		taskId,
		claimedBy: runnerClaimant(principal.id),
		leaseToken: input.leaseToken,
		leaseGeneration: input.leaseGeneration,
		leaseDurationMs: RUNNER_LEASE_MS,
	});
}

export async function recordRunnerSubmitIntent(
	taskId: string,
	input: z.infer<typeof browserRunnerSessionLeaseSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		write?: typeof markBrowserRunnerSubmitIntent;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	await authorizeRunnerTaskOperation(
		taskId,
		input.brandId,
		principal,
		{ kind: "submit_intent", adapterVersion: input.adapterVersion },
		{
			assertTask: dependencies.assertTask,
			isAdapterVersionBindingSatisfied: dependencies.isAdapterVersionBindingSatisfied,
		},
	);
	const { adapterVersion: _adapterVersion, ...leaseInput } = input;
	return (dependencies.write ?? markBrowserRunnerSubmitIntent)({ taskId, ...leaseInput, runnerId: principal.id });
}

export async function recordRunnerSubmitConfirmed(
	taskId: string,
	input: z.infer<typeof browserRunnerSessionLeaseSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		write?: typeof markBrowserRunnerSubmitConfirmed;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	await authorizeRunnerTaskOperation(
		taskId,
		input.brandId,
		principal,
		{ kind: "submit_confirmed", adapterVersion: input.adapterVersion },
		{
			assertTask: dependencies.assertTask,
			isAdapterVersionBindingSatisfied: dependencies.isAdapterVersionBindingSatisfied,
		},
	);
	const { adapterVersion: _adapterVersion, ...leaseInput } = input;
	return (dependencies.write ?? markBrowserRunnerSubmitConfirmed)({ taskId, ...leaseInput, runnerId: principal.id });
}

export async function failRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerFailureSchema>,
	principal: BrowserRunnerPrincipal,
) {
	await assertRunnerTask(taskId, input.brandId, principal);
	return recordBrowserRunnerFailure({ taskId, ...input, runnerId: principal.id });
}

export async function completeRunnerTask(
	taskId: string,
	input: z.infer<typeof browserRunnerObservationSchema>,
	principal: BrowserRunnerPrincipal,
	dependencies: {
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	const snapshotCaptureEnabled = process.env.RESPONSE_SNAPSHOT_ENABLED === "true";
	const task = await authorizeRunnerTaskOperation(
		taskId,
		input.brandId,
		principal,
		{
			kind: "complete",
			adapterVersion: input.adapterVersion,
		},
		dependencies,
	);
	if (task.status === "succeeded" && task.observationAttemptId) {
		const existingRun = await db.query.promptRuns.findFirst({
			where: eq(promptRuns.observationAttemptId, task.observationAttemptId),
			columns: { id: true },
		});
		return { duplicate: true, attemptId: task.observationAttemptId, promptRunId: existingRun?.id ?? null };
	}
	await heartbeatRunnerTask(taskId, input, principal, dependencies);
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
			id: principal.id,
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
		claimedBy: runnerClaimant(principal.id),
		leaseToken: input.leaseToken,
		leaseGeneration: input.leaseGeneration,
	};
	const stagedArtifacts = await listEvidenceArtifactsForClaim({ brandId: task.brandId, claim: deliveryClaim });
	const visualEvidence = assertBrowserRunnerEvidenceSelection(
		task.captureRouteKey,
		stagedArtifacts,
		observation.evidenceArtifactIds,
		input.adapterVersion,
	);
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
			runnerId: principal.id,
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
				"schemaVersion" in observation && observation.schemaVersion === "browser-runner-observation.v2"
					? buildBrowserRunnerResponseSnapshotDraftV2({
							promptRunId: promptRun.id,
							brandId: brand.id,
							scopeId: scope.id,
							promptId: task.promptId,
							promptText: task.promptText,
							answerText: observation.answerText,
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
							adapterVersion: input.adapterVersion,
							visualEvidence: assertVisualEvidence(visualEvidence),
							captureDiagnostics: observation.captureDiagnostics,
						})
					: buildBrowserRunnerResponseSnapshotDraft({
							promptRunId: promptRun.id,
							brandId: brand.id,
							scopeId: scope.id,
							promptId: task.promptId,
							promptText: task.promptText,
							answerText: observation.answerText,
							answerHtml: assertLegacyAnswerHtml(observation),
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

export async function authorizeRunnerTaskOperation(
	taskId: string,
	brandId: string,
	principal: BrowserRunnerPrincipal,
	operation: BrowserExtensionTaskOperation,
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	const task = await (dependencies.assertTask ?? assertRunnerTask)(taskId, brandId, principal);
	if (principal.kind !== "browser_extension") return task;
	const denial = browserExtensionTaskOperationDenial(
		{
			surfaceTargetKey: task.surfaceTargetKey,
			readySurfaces: principal.readySurfaces,
			operation,
		},
		{
			isAdapterVersionBindingSatisfied: dependencies.isAdapterVersionBindingSatisfied,
		},
	);
	if (denial === "surface_not_ready") {
		throw new BrowserRunnerHttpError(
			409,
			"The task surface is not ready with a server-approved adapter on this Browser Runner device",
		);
	}
	if (denial === "adapter_version_not_approved") {
		throw new BrowserRunnerHttpError(
			409,
			"The operation adapter version is not the current server-approved version for this task surface",
		);
	}
	return task;
}

export async function authorizeRunnerEvidenceUpload(
	taskId: string,
	brandId: string,
	input: { runnerSessionId?: string; adapterVersion?: string },
	principal: BrowserRunnerPrincipal,
	dependencies: {
		assertTask?: typeof assertRunnerTask;
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
) {
	const task = await authorizeRunnerTaskOperation(
		taskId,
		brandId,
		principal,
		{ kind: "evidence", adapterVersion: input.adapterVersion },
		dependencies,
	);
	if (principal.kind !== "browser_extension") return task;
	// The currently deployed Doubao v7 uploader predates these headers. The
	// operation policy above admits this exact omission only while v7 remains
	// approved; once v8 is approved, an omitted adapter version is rejected
	// before this compatibility branch can run.
	if (input.runnerSessionId === undefined && input.adapterVersion === undefined) return task;
	if (
		!input.runnerSessionId ||
		!task.submitIntentAt ||
		!task.submitConfirmedAt ||
		task.runnerSessionId !== input.runnerSessionId
	) {
		throw new BrowserRunnerHttpError(409, "Evidence upload must match the confirmed Browser Runner session");
	}
	return task;
}

export async function assertRunnerTask(taskId: string, brandId: string, principal: BrowserRunnerPrincipal) {
	assertPrincipalBrand(principal, brandId);
	const task = await getDeliveryTask({ brandId, taskId });
	if (!task) throw new Error("Browser Runner task was not found");
	const routeAllowed =
		principal.kind === "legacy_host"
			? task.surfaceTargetKey === "doubao.consumer_web" && task.captureRouteKey === "browser_runner.doubao"
			: principal.supportedSurfaces.includes(task.surfaceTargetKey as BrowserExtensionSurface) &&
				isExtensionTargetPair(task.surfaceTargetKey, task.captureRouteKey);
	if (!routeAllowed || task.claimedBy !== runnerClaimant(principal.id)) {
		throw new Error("Task is not claimed by this Browser Runner device");
	}
	return task;
}

async function assertRunnerReconciliationTask(taskId: string, brandId: string, principal: BrowserRunnerPrincipal) {
	assertPrincipalBrand(principal, brandId);
	const task = await getDeliveryTask({ brandId, taskId });
	if (!task) throw new Error("Browser Runner task was not found");
	const routeAllowed =
		principal.kind === "legacy_host"
			? task.surfaceTargetKey === "doubao.consumer_web" && task.captureRouteKey === "browser_runner.doubao"
			: principal.supportedSurfaces.includes(task.surfaceTargetKey as BrowserExtensionSurface) &&
				isExtensionTargetPair(task.surfaceTargetKey, task.captureRouteKey);
	if (!routeAllowed || task.claimedBy !== runnerClaimant(principal.id)) {
		throw new Error("Task is not claimed by this Browser Runner device");
	}
	return task;
}

function assertPrincipalBrand(principal: BrowserRunnerPrincipal, brandId: string): void {
	if (principal.kind === "browser_extension" && !principal.allowedBrandIds.includes(brandId)) {
		throw new BrowserRunnerHttpError(403, "Browser Runner device is not assigned to this brand");
	}
}

function isExtensionTargetPair(surfaceTargetKey: string, captureRouteKey: string): boolean {
	return (
		(surfaceTargetKey === "doubao.consumer_web" || surfaceTargetKey === "deepseek.consumer_web") &&
		captureRouteKey === browserExtensionCaptureRoute(surfaceTargetKey)
	);
}

export function browserRunnerLaunchUrl(surfaceTargetKey: string): string {
	if (surfaceTargetKey === "doubao.consumer_web") return "https://www.doubao.com/chat/";
	if (surfaceTargetKey === "deepseek.consumer_web") return "https://chat.deepseek.com/";
	throw new Error("Browser Runner task has an unsupported launch surface");
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
