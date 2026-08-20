import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionCaptureRoute,
	type BrowserExtensionSurface,
	browserExtensionCaptureRoute,
} from "../browser-extension-contract";
import {
	BROWSER_RUNNER_MAX_PRE_SUBMIT_ATTEMPTS,
	type BrowserRunnerExactTaskReconciliation,
	browserRunnerResumeDenial,
	canCancelBrowserRunnerAfterStart,
	decideBrowserRunnerFailure,
	deriveBrowserRunnerBatchStatus,
	expiredBrowserRunnerClaimNeedsHuman,
	isBrowserRunnerCnScope,
	isSafePreSubmitBrokerTransportRecoveryCandidate,
	isSafePreSubmitDedicatedProfileBusyRecoveryCandidate,
	reconcileBrowserRunnerExactTask,
} from "../browser-runner-policy";
import type { DeliveryProtocol } from "../delivery-manifest";
import { normalizeDeliveryProtocol } from "../delivery-manifest";
import { db } from "./db";
import { settleDeliveryBatch } from "./delivery-batches";
import { type DeliveryTask, deliveryBatches, deliveryTasks, measurementScopes } from "./schema";

export type BrowserRunnerQueue = "available" | "needs_human";

export function browserRunnerNeedsHumanFinalizationPath(
	status: DeliveryTask["status"],
): readonly Extract<DeliveryTask["status"], "claimed" | "failed">[] {
	if (status === "available") return ["claimed", "failed"];
	if (status === "claimed") return ["failed"];
	throw new BrowserRunnerStateError(`Task status ${status} cannot be finalized from needs-human`);
}

export interface BrowserRunnerClaim {
	task: Omit<DeliveryTask, "leaseTokenHash">;
	leaseToken: string;
	leaseGeneration: number;
	leaseExpiresAt: Date;
}

export type BrowserRunnerResumedClaim = BrowserRunnerClaim & {
	recoveryStage: "pre_submit" | "post_submit";
};

export type BrowserRunnerTaskReconciliation = {
	state: BrowserRunnerExactTaskReconciliation;
	task: Omit<DeliveryTask, "leaseTokenHash">;
};

export type BrowserRunnerClaimTarget =
	| { surfaceTargetKey: "doubao.consumer_web"; captureRouteKey: "browser_runner.doubao" }
	| {
			surfaceTargetKey: BrowserExtensionSurface;
			captureRouteKey: BrowserExtensionCaptureRoute;
	  };

export function resolveBrowserRunnerClaimTargets(input: {
	principalKind: "legacy_host" | "browser_extension";
	requestedSurfaceTargetKeys?: readonly string[];
	supportedSurfaces?: readonly BrowserExtensionSurface[];
}): BrowserRunnerClaimTarget[] {
	const requested = input.requestedSurfaceTargetKeys ? new Set(input.requestedSurfaceTargetKeys) : null;
	if (input.principalKind === "legacy_host") {
		return !requested || requested.has("doubao.consumer_web")
			? [{ surfaceTargetKey: "doubao.consumer_web", captureRouteKey: "browser_runner.doubao" }]
			: [];
	}
	const supported = new Set(input.supportedSurfaces ?? []);
	return BROWSER_EXTENSION_SURFACES.filter(
		(surface) => supported.has(surface) && (!requested || requested.has(surface)),
	).map((surface) => ({ surfaceTargetKey: surface, captureRouteKey: browserExtensionCaptureRoute(surface) }));
}

export class BrowserRunnerStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrowserRunnerStateError";
	}
}

export async function startBrowserRunnerBatch(input: { brandId: string; batchId: string }) {
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch) throw new BrowserRunnerStateError("Delivery batch was not found");
		if (batch.executionMode !== "browser_runner") {
			throw new BrowserRunnerStateError("Only browser-runner batches can start automation");
		}
		if (batch.status !== "frozen") throw new BrowserRunnerStateError("The delivery batch is not ready to start");
		if (batch.automationStatus !== "not_started") {
			throw new BrowserRunnerStateError(`Browser automation is ${batch.automationStatus ?? "not configured"}`);
		}
		const [scope] = await tx
			.select({
				market: measurementScopes.market,
				locale: measurementScopes.locale,
				timezone: measurementScopes.timezone,
			})
			.from(measurementScopes)
			.where(and(eq(measurementScopes.id, batch.scopeId), eq(measurementScopes.brandId, batch.brandId)))
			.limit(1);
		if (!scope || !isBrowserRunnerCnScope(scope)) {
			throw new BrowserRunnerStateError("Browser automation requires a CN/zh-CN/Asia/Shanghai measurement scope");
		}
		const now = new Date();
		const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
		const startsAt = new Date(protocol.measurementWindow.startsAt);
		const endsAt = new Date(protocol.measurementWindow.endsAt);
		if (now < startsAt) throw new BrowserRunnerStateError("The frozen measurement window has not started");
		if (now >= endsAt) throw new BrowserRunnerStateError("The frozen measurement window has ended");
		const [started] = await tx
			.update(deliveryBatches)
			.set({
				status: "in_progress",
				automationStatus: "running",
				automationStartedAt: now,
				startedAt: batch.startedAt ?? now,
			})
			.where(
				and(
					eq(deliveryBatches.id, batch.id),
					eq(deliveryBatches.status, "frozen"),
					eq(deliveryBatches.automationStatus, "not_started"),
				),
			)
			.returning();
		if (!started) throw new BrowserRunnerStateError("Browser automation was started concurrently");
		await tx
			.update(deliveryTasks)
			.set({ automationStatus: "queued" })
			.where(
				and(
					eq(deliveryTasks.batchId, batch.id),
					eq(deliveryTasks.status, "available"),
					isNull(deliveryTasks.automationStatus),
				),
			);
		return started;
	});
}

export async function claimBrowserRunnerTask(input: {
	brandId: string;
	batchId?: string;
	runnerId: string;
	leaseDurationMs?: number;
	captureTargets?: readonly BrowserRunnerClaimTarget[];
}): Promise<BrowserRunnerClaim | null> {
	const runnerId = requiredText(input.runnerId, "runnerId", 200);
	const leaseDurationMs = validLeaseDuration(input.leaseDurationMs);
	const captureTargets = input.captureTargets ?? [
		{ surfaceTargetKey: "doubao.consumer_web", captureRouteKey: "browser_runner.doubao" } as const,
	];
	if (captureTargets.length === 0) return null;
	await reconcileExpiredBrowserRunnerBatches({ brandId: input.brandId });
	return db.transaction(async (tx) => {
		const conditions = [
			eq(deliveryBatches.brandId, input.brandId),
			eq(deliveryBatches.executionMode, "browser_runner"),
			eq(deliveryBatches.automationStatus, "running"),
			inArray(deliveryBatches.status, ["frozen", "in_progress"]),
		];
		if (input.batchId) conditions.push(eq(deliveryBatches.id, input.batchId));
		const batches = await tx
			.select({ id: deliveryBatches.id, protocol: deliveryBatches.protocol, status: deliveryBatches.status })
			.from(deliveryBatches)
			.where(and(...conditions))
			.orderBy(asc(deliveryBatches.createdAt));
		const now = new Date();
		for (const batch of batches) {
			const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
			const startsAt = new Date(protocol.measurementWindow.startsAt);
			const endsAt = new Date(protocol.measurementWindow.endsAt);
			if (now < startsAt || now >= endsAt) continue;
			for (;;) {
				const availability = or(
					and(eq(deliveryTasks.status, "available"), eq(deliveryTasks.automationStatus, "queued")),
					and(
						eq(deliveryTasks.status, "claimed"),
						eq(deliveryTasks.automationStatus, "running"),
						lt(deliveryTasks.leaseExpiresAt, now),
					),
				);
				if (!availability) throw new Error("Failed to build browser-runner availability condition");
				const targetCondition = or(
					...captureTargets.map((target) =>
						and(
							eq(deliveryTasks.surfaceTargetKey, target.surfaceTargetKey),
							eq(deliveryTasks.captureRouteKey, target.captureRouteKey),
						),
					),
				);
				if (!targetCondition) return null;
				const taskConditions = [eq(deliveryTasks.batchId, batch.id), targetCondition, availability];
				const [candidate] = await tx
					.select()
					.from(deliveryTasks)
					.where(and(...taskConditions))
					.orderBy(asc(deliveryTasks.createdAt), asc(deliveryTasks.id))
					.limit(1)
					.for("update", { skipLocked: true });
				if (!candidate) break;
				if (
					expiredBrowserRunnerClaimNeedsHuman({
						deliveryStatus: candidate.status,
						automationStatus: candidate.automationStatus,
					})
				) {
					const submitUnknown = candidate.submitIntentAt !== null;
					await markTaskNeedsHuman(tx, candidate, {
						code: submitUnknown ? "submit_outcome_unknown" : "runner_lease_expired",
						reason: submitUnknown
							? "The previous runner recorded submit intent; automatic replay is forbidden"
							: "The previous runner lease expired; automatic replay requires explicit human disposition",
					});
					await refreshBrowserRunnerBatchState(tx, batch.id);
					continue;
				}
				if (candidate.automationAttemptCount >= BROWSER_RUNNER_MAX_PRE_SUBMIT_ATTEMPTS) {
					await markTaskNeedsHuman(tx, candidate, {
						code: "pre_submit_attempts_exhausted",
						reason: "The automatic pre-submit retry budget was exhausted",
					});
					await refreshBrowserRunnerBatchState(tx, batch.id);
					continue;
				}
				const leaseToken = randomBytes(32).toString("base64url");
				const leaseGeneration = candidate.leaseGeneration + 1;
				const leaseExpiresAt = new Date(Math.min(now.getTime() + leaseDurationMs, endsAt.getTime()));
				const [claimed] = await tx
					.update(deliveryTasks)
					.set({
						status: "claimed",
						automationStatus: "running",
						automationAttemptCount: candidate.automationAttemptCount + 1,
						claimedBy: `browser-runner:${runnerId}`,
						leaseTokenHash: hashToken(leaseToken),
						leaseGeneration,
						leaseExpiresAt,
						claimCount: candidate.claimCount + 1,
						claimedAt: now,
					})
					.where(
						and(
							eq(deliveryTasks.id, candidate.id),
							eq(deliveryTasks.status, candidate.status),
							eq(deliveryTasks.leaseGeneration, candidate.leaseGeneration),
						),
					)
					.returning();
				if (!claimed) continue;
				if (batch.status === "frozen") {
					await tx
						.update(deliveryBatches)
						.set({ status: "in_progress" })
						.where(and(eq(deliveryBatches.id, batch.id), eq(deliveryBatches.status, "frozen")));
				}
				return {
					task: redact(claimed),
					leaseToken,
					leaseGeneration,
					leaseExpiresAt,
				};
			}
		}
		return null;
	});
}

export async function resumeBrowserRunnerTask(input: {
	brandId: string;
	taskId: string;
	runnerId: string;
	leaseDurationMs?: number;
}): Promise<BrowserRunnerResumedClaim> {
	const runnerId = requiredText(input.runnerId, "runnerId", 200);
	const claimant = `browser-runner:${runnerId}`;
	const leaseDurationMs = validLeaseDuration(input.leaseDurationMs);
	return db.transaction(async (tx) => {
		const [identity] = await tx
			.select({ batchId: deliveryTasks.batchId })
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.brandId, input.brandId)))
			.limit(1);
		if (!identity) throw new BrowserRunnerStateError("Browser Runner task was not found");
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, identity.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (
			batch?.executionMode !== "browser_runner" ||
			!inProgressDeliveryBatch(batch.status) ||
			(batch.automationStatus !== "needs_human" && batch.automationStatus !== "running")
		) {
			throw new BrowserRunnerStateError("Browser Runner batch is not resumable");
		}
		const [task] = await tx
			.select()
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.batchId, batch.id)))
			.limit(1)
			.for("update");
		if (!task) throw new BrowserRunnerStateError("Browser Runner task was not found");
		const denial = browserRunnerResumeDenial({
			deliveryStatus: task.status,
			automationStatus: task.automationStatus,
			submitIntentAt: task.submitIntentAt,
			originalClaimedBy: task.claimedBy,
			requestingClaimant: claimant,
		});
		if (denial) throw new BrowserRunnerStateError(`Browser Runner task cannot resume: ${denial}`);
		const recoveryStage = task.submitIntentAt === null ? "pre_submit" : "post_submit";
		const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
		const now = new Date();
		const startsAt = new Date(protocol.measurementWindow.startsAt);
		const endsAt = new Date(protocol.measurementWindow.endsAt);
		if (now < startsAt || now >= endsAt) {
			throw new BrowserRunnerStateError("Browser Runner task is outside its frozen measurement window");
		}
		const leaseToken = randomBytes(32).toString("base64url");
		const leaseGeneration = task.leaseGeneration + 1;
		const leaseExpiresAt = new Date(Math.min(now.getTime() + leaseDurationMs, endsAt.getTime()));
		const [resumed] = await tx
			.update(deliveryTasks)
			.set({
				status: "claimed",
				automationStatus: "running",
				leaseTokenHash: hashToken(leaseToken),
				leaseGeneration,
				leaseExpiresAt,
				claimCount: task.claimCount + 1,
				claimedAt: now,
				...(recoveryStage === "pre_submit" ? { needsHumanCode: null, needsHumanReason: null } : {}),
			})
			.where(
				and(
					eq(deliveryTasks.id, task.id),
					eq(deliveryTasks.status, "available"),
					eq(deliveryTasks.automationStatus, "needs_human"),
					eq(deliveryTasks.claimedBy, claimant),
					eq(deliveryTasks.leaseGeneration, task.leaseGeneration),
					recoveryStage === "pre_submit"
						? isNull(deliveryTasks.submitIntentAt)
						: isNotNull(deliveryTasks.submitIntentAt),
				),
			)
			.returning();
		if (!resumed) throw new BrowserRunnerStateError("Browser Runner task changed before it could resume");
		await tx
			.update(deliveryBatches)
			.set({ automationStatus: "running" })
			.where(and(eq(deliveryBatches.id, batch.id), eq(deliveryBatches.executionMode, "browser_runner")));
		return { task: redact(resumed), leaseToken, leaseGeneration, leaseExpiresAt, recoveryStage };
	});
}

export async function reconcileBrowserRunnerTask(input: {
	brandId: string;
	taskId: string;
	runnerId: string;
}): Promise<BrowserRunnerTaskReconciliation> {
	const claimant = `browser-runner:${requiredText(input.runnerId, "runnerId", 200)}`;
	return db.transaction(async (tx) => {
		const [identity] = await tx
			.select({ batchId: deliveryTasks.batchId })
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.brandId, input.brandId)))
			.limit(1);
		if (!identity) throw new BrowserRunnerStateError("Browser Runner task was not found");
		const [batch] = await tx
			.select({ id: deliveryBatches.id, executionMode: deliveryBatches.executionMode })
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, identity.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (batch?.executionMode !== "browser_runner") {
			throw new BrowserRunnerStateError("Browser Runner task was not found");
		}
		const [task] = await tx
			.select()
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.batchId, batch.id)))
			.limit(1)
			.for("update");
		if (!task) throw new BrowserRunnerStateError("Browser Runner task was not found");
		const now = new Date();
		const state = reconcileBrowserRunnerExactTask({
			deliveryStatus: task.status,
			automationStatus: task.automationStatus,
			submitIntentAt: task.submitIntentAt,
			originalClaimedBy: task.claimedBy,
			requestingClaimant: claimant,
			leaseExpiresAt: task.leaseExpiresAt,
			now,
		});
		if (
			(state === "resumable_pre" || state === "resumable_post") &&
			task.status === "claimed" &&
			task.automationStatus === "running"
		) {
			await markTaskNeedsHuman(tx, task, {
				code: state === "resumable_post" ? "submit_outcome_unknown" : "runner_lease_expired",
				reason:
					state === "resumable_post"
						? "The previous runner recorded submit intent; automatic replay is forbidden"
						: "The previous runner lease expired; automatic replay requires explicit human disposition",
			});
			await refreshBrowserRunnerBatchState(tx, task.batchId);
			const [reconciled] = await tx.select().from(deliveryTasks).where(eq(deliveryTasks.id, task.id)).limit(1);
			if (!reconciled) throw new BrowserRunnerStateError("Browser Runner task changed during reconciliation");
			return { state, task: redact(reconciled) };
		}
		return { state, task: redact(task) };
	});
}

export async function recordBrowserRunnerFailure(input: {
	brandId: string;
	taskId: string;
	runnerId: string;
	leaseToken: string;
	leaseGeneration: number;
	stage: "pre_submit" | "post_submit";
	code: string;
	reason: string;
}) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [task] = await tx.select().from(deliveryTasks).where(activeRunnerLease(input, now)).limit(1).for("update");
		if (!task || task.brandId !== input.brandId) throw new BrowserRunnerStateError("Runner task lease is invalid");
		const shouldRetry =
			decideBrowserRunnerFailure({
				stage: input.stage,
				code: input.code,
				automationAttemptCount: task.automationAttemptCount,
				submitIntentAt: task.submitIntentAt,
				submitConfirmedAt: task.submitConfirmedAt,
			}) === "retry";
		const error = describeError(input.code, input.reason);
		const [updated] = await tx
			.update(deliveryTasks)
			.set(
				shouldRetry
					? {
							status: "available",
							automationStatus: "queued",
							leaseTokenHash: null,
							leaseExpiresAt: null,
							availableAt: now,
							...error,
						}
					: {
							status: "available",
							automationStatus: "needs_human",
							leaseTokenHash: null,
							leaseExpiresAt: null,
							availableAt: now,
							needsHumanCode: error.lastErrorCode,
							needsHumanReason: error.lastErrorMessage,
							...error,
						},
			)
			.where(activeRunnerLease(input, now))
			.returning();
		if (!updated) throw new BrowserRunnerStateError("Runner task lease was lost");
		await refreshBrowserRunnerBatchState(tx, task.batchId);
		return { task: redact(updated), retryScheduled: shouldRetry };
	});
}

export async function markBrowserRunnerSubmitConfirmed(input: {
	taskId: string;
	runnerId: string;
	leaseToken: string;
	leaseGeneration: number;
	runnerSessionId: string;
}) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const runnerSessionId = requiredText(input.runnerSessionId, "runnerSessionId", 300);
		const [task] = await tx
			.select({
				runnerSessionId: deliveryTasks.runnerSessionId,
				submitIntentAt: deliveryTasks.submitIntentAt,
				submitConfirmedAt: deliveryTasks.submitConfirmedAt,
			})
			.from(deliveryTasks)
			.where(activeRunnerLease(input, now))
			.limit(1)
			.for("update");
		if (!task?.submitIntentAt) throw new BrowserRunnerStateError("Runner task has no durable submit intent");
		if (task.runnerSessionId !== runnerSessionId) {
			throw new BrowserRunnerStateError("Runner session does not match the durable submit intent");
		}
		if (task.submitConfirmedAt) return task;
		const [updated] = await tx
			.update(deliveryTasks)
			.set({ submitConfirmedAt: now })
			.where(and(activeRunnerLease(input, now), isNull(deliveryTasks.submitConfirmedAt)))
			.returning({ submitIntentAt: deliveryTasks.submitIntentAt, submitConfirmedAt: deliveryTasks.submitConfirmedAt });
		if (!updated?.submitConfirmedAt) throw new BrowserRunnerStateError("Runner task lease was lost");
		return updated;
	});
}

export async function markBrowserRunnerSubmitIntent(input: {
	taskId: string;
	runnerId: string;
	leaseToken: string;
	leaseGeneration: number;
	runnerSessionId: string;
}) {
	return db.transaction(async (tx) => {
		const now = new Date();
		const runnerSessionId = requiredText(input.runnerSessionId, "runnerSessionId", 300);
		const [task] = await tx
			.select({
				runnerSessionId: deliveryTasks.runnerSessionId,
				submitIntentAt: deliveryTasks.submitIntentAt,
				needsHumanCode: deliveryTasks.needsHumanCode,
			})
			.from(deliveryTasks)
			.where(activeRunnerLease(input, now))
			.limit(1)
			.for("update");
		if (!task) throw new BrowserRunnerStateError("Runner task lease is invalid");
		if (task.needsHumanCode !== null) {
			throw new BrowserRunnerStateError("A resumed post-submit task cannot record another submit intent");
		}
		if (task.submitIntentAt) {
			if (task.runnerSessionId !== runnerSessionId) {
				throw new BrowserRunnerStateError("Runner session does not match the durable submit intent");
			}
			return task;
		}
		const [updated] = await tx
			.update(deliveryTasks)
			.set({ runnerSessionId, submitIntentAt: now })
			.where(activeRunnerLease(input, now))
			.returning({ runnerSessionId: deliveryTasks.runnerSessionId, submitIntentAt: deliveryTasks.submitIntentAt });
		if (!updated?.submitIntentAt) throw new BrowserRunnerStateError("Runner task lease was lost");
		return updated;
	});
}

export async function markBrowserRunnerTaskCompleted(input: { taskId: string; batchId: string }): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.update(deliveryTasks)
			.set({ automationStatus: "completed", needsHumanCode: null, needsHumanReason: null })
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.status, "succeeded")));
		await refreshBrowserRunnerBatchState(tx, input.batchId);
	});
}

export async function getBrowserRunnerProgress(batchId: string) {
	const rows = await db
		.select({
			status: deliveryTasks.status,
			automationStatus: deliveryTasks.automationStatus,
			submitIntentAt: deliveryTasks.submitIntentAt,
		})
		.from(deliveryTasks)
		.where(eq(deliveryTasks.batchId, batchId));
	return summarizeProgress(rows);
}

export async function requeueBrowserRunnerSafePreSubmitTransportFailures(input: {
	brandId: string;
	batchId: string;
	expectedTaskCount: number;
}): Promise<{ requeuedCount: number }> {
	if (!Number.isSafeInteger(input.expectedTaskCount) || input.expectedTaskCount < 1 || input.expectedTaskCount > 100) {
		throw new BrowserRunnerStateError("Expected Browser Runner task count is invalid");
	}
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (
			batch?.executionMode !== "browser_runner" ||
			batch.status !== "in_progress" ||
			batch.automationStatus !== "needs_human" ||
			batch.automationStartedAt === null ||
			batch.plannedTaskCount !== input.expectedTaskCount
		) {
			throw new BrowserRunnerStateError("Browser Runner batch is not eligible for safe transport recovery");
		}
		const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
		const now = new Date();
		if (now < new Date(protocol.measurementWindow.startsAt) || now >= new Date(protocol.measurementWindow.endsAt)) {
			throw new BrowserRunnerStateError("Browser Runner safe transport recovery is outside the frozen window");
		}
		const tasks = await tx
			.select()
			.from(deliveryTasks)
			.where(eq(deliveryTasks.batchId, batch.id))
			.orderBy(asc(deliveryTasks.createdAt), asc(deliveryTasks.id))
			.for("update");
		if (
			tasks.length !== input.expectedTaskCount ||
			!tasks.every((task) =>
				isSafePreSubmitBrokerTransportRecoveryCandidate({
					deliveryStatus: task.status,
					automationStatus: task.automationStatus,
					automationAttemptCount: task.automationAttemptCount,
					claimCount: task.claimCount,
					submitIntentAt: task.submitIntentAt,
					submitConfirmedAt: task.submitConfirmedAt,
					observationAttemptId: task.observationAttemptId,
					needsHumanCode: task.needsHumanCode,
					lastErrorCode: task.lastErrorCode,
				}),
			)
		) {
			throw new BrowserRunnerStateError("Browser Runner task cohort is not safe to requeue");
		}
		const requeued = await tx
			.update(deliveryTasks)
			.set({
				status: "available",
				automationStatus: "queued",
				automationAttemptCount: 0,
				claimedBy: null,
				claimedAt: null,
				leaseTokenHash: null,
				leaseExpiresAt: null,
				runnerSessionId: null,
				needsHumanCode: null,
				needsHumanReason: null,
				lastErrorClass: "BrowserRunnerOperatorRecovery",
				lastErrorCode: "broker_transport_pre_submit_requeued_v1",
				lastErrorMessage: "The untouched pre-submit cohort was explicitly requeued after broker transport repair",
				availableAt: now,
			})
			.where(
				inArray(
					deliveryTasks.id,
					tasks.map(({ id }) => id),
				),
			)
			.returning({ id: deliveryTasks.id });
		if (requeued.length !== input.expectedTaskCount) {
			throw new BrowserRunnerStateError("Browser Runner safe transport recovery changed concurrently");
		}
		const [updatedBatch] = await tx
			.update(deliveryBatches)
			.set({ automationStatus: "running", automationSettledAt: null })
			.where(
				and(
					eq(deliveryBatches.id, batch.id),
					eq(deliveryBatches.status, "in_progress"),
					eq(deliveryBatches.automationStatus, "needs_human"),
				),
			)
			.returning({ id: deliveryBatches.id });
		if (!updatedBatch) throw new BrowserRunnerStateError("Browser Runner batch recovery changed concurrently");
		return { requeuedCount: requeued.length };
	});
}

export async function requeueBrowserRunnerDedicatedProfileBusyTasks(input: {
	brandId: string;
	batchId: string;
	expectedTaskCount: number;
	expectedRequeueCount: number;
}): Promise<{ requeuedCount: number }> {
	if (
		!Number.isSafeInteger(input.expectedTaskCount) ||
		input.expectedTaskCount < 2 ||
		input.expectedTaskCount > 100 ||
		input.expectedRequeueCount !== input.expectedTaskCount - 1
	) {
		throw new BrowserRunnerStateError("Expected Browser Runner dedicated-profile recovery count is invalid");
	}
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (
			batch?.executionMode !== "browser_runner" ||
			batch.status !== "in_progress" ||
			batch.automationStatus !== "needs_human" ||
			batch.automationStartedAt === null ||
			batch.plannedTaskCount !== input.expectedTaskCount
		) {
			throw new BrowserRunnerStateError("Browser Runner batch is not eligible for dedicated-profile recovery");
		}
		const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
		const now = new Date();
		if (now < new Date(protocol.measurementWindow.startsAt) || now >= new Date(protocol.measurementWindow.endsAt)) {
			throw new BrowserRunnerStateError("Browser Runner dedicated-profile recovery is outside the frozen window");
		}
		const tasks = await tx
			.select()
			.from(deliveryTasks)
			.where(eq(deliveryTasks.batchId, batch.id))
			.orderBy(asc(deliveryTasks.createdAt), asc(deliveryTasks.id))
			.for("update");
		const succeeded = tasks.filter(
			(task) =>
				task.status === "succeeded" &&
				task.automationStatus === "completed" &&
				task.submitIntentAt !== null &&
				task.submitConfirmedAt !== null &&
				task.observationAttemptId !== null,
		);
		const candidates = tasks.filter((task) =>
			isSafePreSubmitDedicatedProfileBusyRecoveryCandidate({
				deliveryStatus: task.status,
				automationStatus: task.automationStatus,
				automationAttemptCount: task.automationAttemptCount,
				claimCount: task.claimCount,
				submitIntentAt: task.submitIntentAt,
				submitConfirmedAt: task.submitConfirmedAt,
				observationAttemptId: task.observationAttemptId,
				needsHumanCode: task.needsHumanCode,
				lastErrorCode: task.lastErrorCode,
			}),
		);
		if (
			tasks.length !== input.expectedTaskCount ||
			succeeded.length !== 1 ||
			candidates.length !== input.expectedRequeueCount
		) {
			throw new BrowserRunnerStateError("Browser Runner dedicated-profile cohort is not safe to requeue");
		}
		const requeued = await tx
			.update(deliveryTasks)
			.set({
				status: "available",
				automationStatus: "queued",
				automationAttemptCount: 0,
				claimedBy: null,
				claimedAt: null,
				leaseTokenHash: null,
				leaseExpiresAt: null,
				runnerSessionId: null,
				needsHumanCode: null,
				needsHumanReason: null,
				lastErrorClass: "BrowserRunnerOperatorRecovery",
				lastErrorCode: "dedicated_profile_busy_requeued_v1",
				lastErrorMessage: "The untouched tasks were explicitly requeued after the retained profile was released",
				availableAt: now,
			})
			.where(
				inArray(
					deliveryTasks.id,
					candidates.map(({ id }) => id),
				),
			)
			.returning({ id: deliveryTasks.id });
		if (requeued.length !== input.expectedRequeueCount) {
			throw new BrowserRunnerStateError("Browser Runner dedicated-profile recovery changed concurrently");
		}
		const [updatedBatch] = await tx
			.update(deliveryBatches)
			.set({ automationStatus: "running", automationSettledAt: null })
			.where(
				and(
					eq(deliveryBatches.id, batch.id),
					eq(deliveryBatches.status, "in_progress"),
					eq(deliveryBatches.automationStatus, "needs_human"),
				),
			)
			.returning({ id: deliveryBatches.id });
		if (!updatedBatch) throw new BrowserRunnerStateError("Browser Runner batch recovery changed concurrently");
		return { requeuedCount: requeued.length };
	});
}

export async function canCancelBrowserRunnerBatch(input: { brandId: string; batchId: string }): Promise<boolean> {
	const batch = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)),
		columns: { executionMode: true, automationStartedAt: true },
	});
	if (!batch) throw new BrowserRunnerStateError("Delivery batch was not found");
	if (batch.executionMode !== "browser_runner" || batch.automationStartedAt === null) return true;
	const tasks = await db.select().from(deliveryTasks).where(eq(deliveryTasks.batchId, input.batchId));
	return canCancelBrowserRunnerAfterStart(tasks);
}

export async function confirmBrowserRunnerTerminalFailure(input: {
	brandId: string;
	taskId: string;
	confirmedBy: string;
	reason: string;
}) {
	const confirmedBy = sanitizeDiagnostic(requiredText(input.confirmedBy, "confirmedBy", 300));
	const reason = sanitizeDiagnostic(requiredText(input.reason, "reason", 1_000));
	return db.transaction(async (tx) => {
		const [identity] = await tx
			.select({ batchId: deliveryTasks.batchId })
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.brandId, input.brandId)))
			.limit(1);
		if (!identity) throw new BrowserRunnerStateError("Browser Runner task was not found");
		const [batch] = await tx
			.select({
				id: deliveryBatches.id,
				executionMode: deliveryBatches.executionMode,
				automationStatus: deliveryBatches.automationStatus,
			})
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, identity.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch || batch.executionMode !== "browser_runner" || batch.automationStatus !== "needs_human") {
			throw new BrowserRunnerStateError("Task is not part of a Browser Runner batch");
		}
		const now = new Date();
		const [task] = await tx
			.select({ needsHumanCode: deliveryTasks.needsHumanCode, needsHumanReason: deliveryTasks.needsHumanReason })
			.from(deliveryTasks)
			.where(
				and(
					eq(deliveryTasks.id, input.taskId),
					eq(deliveryTasks.status, "available"),
					eq(deliveryTasks.automationStatus, "needs_human"),
					isNotNull(deliveryTasks.needsHumanCode),
				),
			)
			.limit(1)
			.for("update");
		if (!task?.needsHumanCode || !task.needsHumanReason) {
			throw new BrowserRunnerStateError("Task is not awaiting terminal human disposition");
		}
		const terminalMessage = terminalFailureMessage(task.needsHumanReason, reason, confirmedBy);
		const [failed] = await tx
			.update(deliveryTasks)
			.set({
				status: "failed",
				automationStatus: "completed",
				leaseTokenHash: null,
				leaseExpiresAt: null,
				failedAt: now,
				lastErrorClass: "BrowserRunnerTerminalFailure",
				lastErrorCode: task.needsHumanCode,
				lastErrorMessage: terminalMessage,
				needsHumanCode: null,
				needsHumanReason: null,
			})
			.where(
				and(
					eq(deliveryTasks.id, input.taskId),
					eq(deliveryTasks.status, "available"),
					eq(deliveryTasks.automationStatus, "needs_human"),
					isNotNull(deliveryTasks.needsHumanCode),
				),
			)
			.returning();
		if (!failed) throw new BrowserRunnerStateError("Task is not awaiting terminal human disposition");
		await settleDeliveryBatch(tx, failed.batchId, now);
		return redact(failed);
	});
}

export async function finalizeBrowserRunnerNeedsHuman(input: {
	brandId: string;
	batchId: string;
	confirmedBy: string;
	reason: string;
}) {
	const confirmedBy = sanitizeDiagnostic(requiredText(input.confirmedBy, "confirmedBy", 300));
	const reason = sanitizeDiagnostic(requiredText(input.reason, "reason", 1_000));
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch || batch.executionMode !== "browser_runner") {
			throw new BrowserRunnerStateError("Browser Runner batch was not found");
		}
		const now = new Date();
		const unresolved = await tx
			.select()
			.from(deliveryTasks)
			.where(and(eq(deliveryTasks.batchId, batch.id), inArray(deliveryTasks.status, ["available", "claimed"])))
			.for("update");
		if (unresolved.length === 0) throw new BrowserRunnerStateError("No unresolved needs-human tasks remain");
		if (
			unresolved.some(
				(task) =>
					task.needsHumanCode === null ||
					(task.automationStatus !== "needs_human" && task.automationStatus !== "running") ||
					(task.status === "claimed" && task.leaseExpiresAt !== null && task.leaseExpiresAt > now),
			)
		) {
			throw new BrowserRunnerStateError("Only unleased needs-human tasks can be finalized as terminal failures");
		}
		const availableCount = unresolved.filter(
			(task) => browserRunnerNeedsHumanFinalizationPath(task.status)[0] === "claimed",
		).length;
		if (availableCount > 0) {
			const internalLeaseTokenHash = randomBytes(32).toString("hex");
			const privatelyClaimed = await tx
				.update(deliveryTasks)
				.set({
					status: "claimed",
					automationStatus: "running",
					leaseTokenHash: internalLeaseTokenHash,
					leaseGeneration: sql`${deliveryTasks.leaseGeneration} + 1`,
					leaseExpiresAt: now,
				})
				.where(
					and(
						eq(deliveryTasks.batchId, batch.id),
						eq(deliveryTasks.status, "available"),
						eq(deliveryTasks.automationStatus, "needs_human"),
						isNotNull(deliveryTasks.needsHumanCode),
					),
				)
				.returning({ id: deliveryTasks.id });
			if (privatelyClaimed.length !== availableCount) {
				throw new BrowserRunnerStateError("Needs-human tasks changed during terminal failure finalization");
			}
		}
		const finalized = await tx
			.update(deliveryTasks)
			.set({
				status: "failed",
				automationStatus: "completed",
				leaseTokenHash: null,
				leaseExpiresAt: null,
				failedAt: now,
				lastErrorClass: "BrowserRunnerTerminalFailure",
				lastErrorCode: deliveryTasks.needsHumanCode,
				lastErrorMessage: sql`left(coalesce(${deliveryTasks.needsHumanReason}, '') || ' | terminal disposition: ' || ${reason} || ' (confirmed by ' || ${confirmedBy} || ')', 2000)`,
				needsHumanCode: null,
				needsHumanReason: null,
			})
			.where(
				and(
					eq(deliveryTasks.batchId, batch.id),
					eq(deliveryTasks.status, "claimed"),
					isNotNull(deliveryTasks.needsHumanCode),
					lte(deliveryTasks.leaseExpiresAt, now),
				),
			)
			.returning({ id: deliveryTasks.id });
		if (finalized.length !== unresolved.length) {
			throw new BrowserRunnerStateError("Needs-human tasks changed during terminal failure finalization");
		}
		await settleDeliveryBatch(tx, batch.id, now);
		return { finalizedCount: finalized.length, resultStatus: "incomplete" as const };
	});
}

export async function reconcileExpiredBrowserRunnerBatches(input: { brandId: string }): Promise<number> {
	const candidates = await db
		.select({ id: deliveryBatches.id })
		.from(deliveryBatches)
		.where(
			and(
				eq(deliveryBatches.brandId, input.brandId),
				eq(deliveryBatches.executionMode, "browser_runner"),
				isNotNull(deliveryBatches.automationStartedAt),
				inArray(deliveryBatches.status, ["frozen", "in_progress"]),
			),
		);
	let reconciled = 0;
	for (const candidate of candidates) {
		reconciled += await db.transaction(async (tx) => {
			const [batch] = await tx
				.select()
				.from(deliveryBatches)
				.where(and(eq(deliveryBatches.id, candidate.id), eq(deliveryBatches.brandId, input.brandId)))
				.limit(1)
				.for("update");
			if (!batch || batch.executionMode !== "browser_runner" || batch.automationStartedAt === null) return 0;
			const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
			const now = new Date();
			if (now < new Date(protocol.measurementWindow.endsAt)) return 0;
			const unresolved = await tx
				.select()
				.from(deliveryTasks)
				.where(
					and(
						eq(deliveryTasks.batchId, batch.id),
						inArray(deliveryTasks.status, ["available", "claimed"]),
						inArray(deliveryTasks.automationStatus, ["queued", "running"]),
					),
				)
				.for("update");
			let changed = 0;
			for (const task of unresolved) {
				if (task.status === "claimed" && task.leaseExpiresAt !== null && task.leaseExpiresAt > now) continue;
				const submitUnknown = task.submitIntentAt !== null;
				const code = submitUnknown ? "submit_outcome_unknown" : "window_expired_unexecuted";
				const reason = submitUnknown
					? "The frozen window ended after durable submit intent; automatic replay is forbidden"
					: "The frozen measurement window ended before this slot could be completed";
				const [updated] = await tx
					.update(deliveryTasks)
					.set({
						status: "available",
						automationStatus: "needs_human",
						leaseTokenHash: null,
						leaseExpiresAt: null,
						availableAt: now,
						needsHumanCode: code,
						needsHumanReason: reason,
						lastErrorClass: "BrowserRunnerWindowExpired",
						lastErrorCode: code,
						lastErrorMessage: reason,
					})
					.where(
						and(
							eq(deliveryTasks.id, task.id),
							eq(deliveryTasks.status, task.status),
							eq(deliveryTasks.automationStatus, task.automationStatus as "queued" | "running"),
							eq(deliveryTasks.leaseGeneration, task.leaseGeneration),
						),
					)
					.returning({ id: deliveryTasks.id });
				if (updated) changed += 1;
			}
			await refreshBrowserRunnerBatchState(tx, batch.id);
			return changed;
		});
	}
	return reconciled;
}

function summarizeProgress(
	rows: Array<{ status: string; automationStatus: string | null; submitIntentAt: Date | null }>,
) {
	const needsHumanRows = rows.filter(({ automationStatus }) => automationStatus === "needs_human");
	return {
		total: rows.length,
		completed: rows.filter(({ automationStatus }) => automationStatus === "completed").length,
		running: rows.filter(({ status, automationStatus }) => status === "claimed" && automationStatus === "running")
			.length,
		needsHuman: needsHumanRows.length,
		needsHumanPreSubmit: needsHumanRows.filter(({ submitIntentAt }) => submitIntentAt === null).length,
		needsHumanPostSubmit: needsHumanRows.filter(({ submitIntentAt }) => submitIntentAt !== null).length,
	};
}

function inProgressDeliveryBatch(status: string) {
	return status === "frozen" || status === "in_progress";
}

async function refreshBrowserRunnerBatchState(executor: Pick<typeof db, "select" | "update">, batchId: string) {
	const rows = await executor
		.select({
			status: deliveryTasks.status,
			automationStatus: deliveryTasks.automationStatus,
			submitIntentAt: deliveryTasks.submitIntentAt,
		})
		.from(deliveryTasks)
		.where(eq(deliveryTasks.batchId, batchId));
	const automationStatus = deriveBrowserRunnerBatchStatus(rows.map(({ automationStatus }) => automationStatus));
	await executor
		.update(deliveryBatches)
		.set({ automationStatus, ...(automationStatus === "settled" ? { automationSettledAt: new Date() } : {}) })
		.where(and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.executionMode, "browser_runner")));
}

async function markTaskNeedsHuman(
	executor: Pick<typeof db, "update">,
	task: DeliveryTask,
	input: { code: string; reason: string },
) {
	await executor
		.update(deliveryTasks)
		.set({
			status: "available",
			automationStatus: "needs_human",
			leaseTokenHash: null,
			leaseExpiresAt: null,
			needsHumanCode: input.code,
			needsHumanReason: input.reason,
			lastErrorClass: "BrowserRunnerNeedsHuman",
			lastErrorCode: input.code,
			lastErrorMessage: input.reason,
			availableAt: new Date(),
		})
		.where(eq(deliveryTasks.id, task.id));
}

function activeRunnerLease(
	claim: { taskId: string; runnerId: string; leaseToken: string; leaseGeneration: number },
	now: Date,
) {
	return and(
		eq(deliveryTasks.id, claim.taskId),
		eq(deliveryTasks.status, "claimed"),
		eq(deliveryTasks.automationStatus, "running"),
		eq(deliveryTasks.claimedBy, `browser-runner:${requiredText(claim.runnerId, "runnerId", 200)}`),
		eq(deliveryTasks.leaseTokenHash, hashToken(claim.leaseToken)),
		eq(deliveryTasks.leaseGeneration, claim.leaseGeneration),
		gt(deliveryTasks.leaseExpiresAt, now),
	);
}

function hashToken(token: string) {
	return createHash("sha256")
		.update(requiredText(token, "leaseToken", 500))
		.digest("hex");
}

function validLeaseDuration(value = 15 * 60 * 1_000) {
	if (!Number.isSafeInteger(value) || value < 10_000 || value > 60 * 60 * 1_000) {
		throw new Error("leaseDurationMs must be between 10000 and 3600000");
	}
	return value;
}

function requiredText(value: string, field: string, maxLength: number) {
	const normalized = value.trim();
	if (!normalized || normalized.length > maxLength) throw new Error(`${field} is invalid`);
	return normalized;
}

function describeError(code: string, reason: string) {
	return {
		lastErrorClass: "BrowserRunnerError",
		lastErrorCode: requiredText(code, "code", 100),
		lastErrorMessage: requiredText(reason, "reason", 1_000)
			.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
			.replace(/(api[-_ ]?key|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]"),
	};
}

function terminalFailureMessage(originalReason: string, humanReason: string, confirmedBy: string) {
	return `${sanitizeDiagnostic(originalReason)} | terminal disposition: ${sanitizeDiagnostic(humanReason)} (confirmed by ${sanitizeDiagnostic(confirmedBy)})`.slice(
		0,
		2_000,
	);
}

function sanitizeDiagnostic(value: string) {
	return value
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/(api[-_ ]?key|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}

function redact(task: DeliveryTask): Omit<DeliveryTask, "leaseTokenHash"> {
	const { leaseTokenHash, ...view } = task;
	void leaseTokenHash;
	return view;
}
