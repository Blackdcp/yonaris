import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import {
	assertPortalBrowserRunnerMutationAllowed,
	canCancelBrowserRunnerAfterStart,
	deriveBrowserRunnerBatchStatus,
} from "../browser-runner-policy";
import {
	buildDeliveryManifestHash,
	buildDeliveryManifestSnapshot,
	buildDeliveryTaskSlotKey,
	type DeliveryCoverage,
	type DeliveryEvaluationRole,
	type DeliveryManifestTaskSnapshot,
	type DeliveryProtocol,
	type DeliverySearchRequirement,
	type DeliverySessionRequirement,
	normalizeDeliveryProtocol,
	normalizeDeliveryTaskPlan,
	summarizeDeliveryCoverage,
} from "../delivery-manifest";
import { db } from "./db";
import {
	brands,
	competitors,
	type DeliveryBatch,
	type DeliveryTask,
	deliveryBatches,
	deliveryTasks,
	measurementScopes,
	observationAttempts,
	prompts,
} from "./schema";

type TransactionCallback = Parameters<typeof db.transaction>[0];
export type DeliveryTransaction = Parameters<TransactionCallback>[0];
type DeliveryExecutor = Pick<DeliveryTransaction, "select" | "update">;

export class DeliveryBatchConflictError extends Error {
	constructor(public readonly idempotencyKey: string) {
		super(`Delivery batch idempotency key ${idempotencyKey} is already assigned to another manifest`);
		this.name = "DeliveryBatchConflictError";
	}
}

export class DeliveryBatchStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DeliveryBatchStateError";
	}
}

export class DeliveryTaskLeaseError extends Error {
	constructor(public readonly taskId: string) {
		super(`Delivery task ${taskId} lease is missing, expired, or owned by another claimant`);
		this.name = "DeliveryTaskLeaseError";
	}
}

export type DeliveryTaskView = Omit<DeliveryTask, "leaseTokenHash">;

export interface DeliveryTaskPlanInput {
	promptId: string;
	expectedPromptText?: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	sampleIndex: number;
	sessionRequirement: DeliverySessionRequirement;
	searchRequirement: DeliverySearchRequirement;
	evaluationRole?: DeliveryEvaluationRole;
}

export interface DeliveryClaimProof {
	taskId: string;
	claimedBy: string;
	leaseToken: string;
	leaseGeneration: number;
}

export interface ClaimedDeliveryTask {
	task: DeliveryTaskView;
	leaseToken: string;
	leaseGeneration: number;
	leaseExpiresAt: Date;
}

export interface ActiveDeliveryClaimContext {
	task: DeliveryTaskView;
	batch: Pick<DeliveryBatch, "id" | "brandId" | "scopeId" | "status" | "protocol">;
	verifiedAt: Date;
	measurementWindowEndsAt: Date;
}

export async function createDraftDeliveryBatch(input: {
	brandId: string;
	scopeId: string;
	idempotencyKey: string;
	name: string;
	protocol: DeliveryProtocol;
	createdBy?: string;
	executionMode?: "manual" | "browser_runner";
}): Promise<DeliveryBatch> {
	const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey", 300);
	const name = requiredText(input.name, "name", 300);
	const protocol = normalizeDeliveryProtocol(input.protocol);
	const executionMode = input.executionMode ?? "manual";

	const [inserted] = await db
		.insert(deliveryBatches)
		.values({
			brandId: input.brandId,
			scopeId: input.scopeId,
			idempotencyKey,
			name,
			protocol,
			createdBy: optionalText(input.createdBy, "createdBy", 300),
			executionMode,
			automationStatus: executionMode === "browser_runner" ? "not_started" : null,
		})
		.onConflictDoNothing({ target: [deliveryBatches.brandId, deliveryBatches.idempotencyKey] })
		.returning();
	if (inserted) return inserted;

	const existing = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.brandId, input.brandId), eq(deliveryBatches.idempotencyKey, idempotencyKey)),
	});
	if (!existing) throw new Error(`Failed to resolve delivery batch ${idempotencyKey}`);
	if (
		existing.scopeId !== input.scopeId ||
		existing.name !== name ||
		existing.executionMode !== executionMode ||
		JSON.stringify(existing.protocol) !== JSON.stringify(protocol)
	) {
		throw new DeliveryBatchConflictError(idempotencyKey);
	}
	return existing;
}

export async function addDeliveryTasks(input: {
	brandId: string;
	batchId: string;
	tasks: readonly DeliveryTaskPlanInput[];
}): Promise<DeliveryTaskView[]> {
	if (input.tasks.length === 0) return [];

	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch) throw new Error(`Delivery batch ${input.batchId} was not found`);
		if (batch.status !== "draft") {
			throw new DeliveryBatchStateError(`Delivery batch ${input.batchId} is ${batch.status}; its manifest is frozen`);
		}

		const promptIds = [...new Set(input.tasks.map(({ promptId }) => promptId))];
		const promptRows = await tx
			.select({ id: prompts.id, value: prompts.value, enabled: prompts.enabled })
			.from(prompts)
			.where(
				and(eq(prompts.brandId, batch.brandId), eq(prompts.scopeId, batch.scopeId), inArray(prompts.id, promptIds)),
			);
		const promptById = new Map(promptRows.map((prompt) => [prompt.id, prompt]));
		const plans = input.tasks.map((task) => {
			const prompt = promptById.get(task.promptId);
			if (!prompt) throw new Error(`Prompt ${task.promptId} does not belong to delivery batch scope`);
			if (!prompt.enabled) throw new Error(`Prompt ${task.promptId} is disabled`);
			if (task.expectedPromptText !== undefined && task.expectedPromptText !== prompt.value) {
				throw new Error(`Prompt ${task.promptId} changed before it could be added to the delivery manifest`);
			}
			const plan = normalizeDeliveryTaskPlan({
				brandId: batch.brandId,
				scopeId: batch.scopeId,
				promptId: prompt.id,
				promptText: prompt.value,
				surfaceTargetKey: task.surfaceTargetKey,
				captureRouteKey: task.captureRouteKey,
				sampleIndex: task.sampleIndex,
				sessionRequirement: task.sessionRequirement,
				searchRequirement: task.searchRequirement,
				evaluationRole: task.evaluationRole,
			});
			return { ...plan, slotKey: buildDeliveryTaskSlotKey(plan) };
		});
		if (new Set(plans.map(({ slotKey }) => slotKey)).size !== plans.length) {
			throw new Error("Delivery task list contains duplicate manifest slots");
		}

		const existingTasks = await tx.select().from(deliveryTasks).where(eq(deliveryTasks.batchId, batch.id));
		const existingBySlot = new Map(existingTasks.map((task) => [task.slotKey, task]));
		if (existingTasks.length > 0) {
			if (existingTasks.length !== plans.length || plans.some(({ slotKey }) => !existingBySlot.has(slotKey))) {
				throw new DeliveryBatchConflictError(batch.idempotencyKey);
			}
			return plans.map(({ slotKey }) => redactDeliveryTask(requiredMapValue(existingBySlot, slotKey)));
		}

		const inserted = await tx
			.insert(deliveryTasks)
			.values(
				plans.map((plan) => ({
					batchId: batch.id,
					...plan,
					automationStatus: batch.executionMode === "browser_runner" ? ("queued" as const) : null,
				})),
			)
			.returning();
		const insertedBySlot = new Map(inserted.map((task) => [task.slotKey, task]));
		return plans.map(({ slotKey }) => redactDeliveryTask(requiredMapValue(insertedBySlot, slotKey)));
	});
}

export async function freezeDeliveryBatch(input: {
	brandId: string;
	batchId: string;
	frozenBy?: string;
}): Promise<DeliveryBatch> {
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch) throw new Error(`Delivery batch ${input.batchId} was not found`);
		if (batch.status === "cancelled") throw new DeliveryBatchStateError(`Delivery batch ${input.batchId} is cancelled`);
		if (batch.status !== "draft") return batch;

		const tasks = await tx
			.select()
			.from(deliveryTasks)
			.where(eq(deliveryTasks.batchId, batch.id))
			.orderBy(asc(deliveryTasks.slotKey));
		if (tasks.length === 0) throw new DeliveryBatchStateError("A delivery batch cannot be frozen without tasks");
		if (tasks.some(({ status }) => status !== "planned")) {
			throw new DeliveryBatchStateError("A draft delivery batch contains a non-planned task");
		}

		const [[brand], [scope], competitorRows] = await Promise.all([
			tx.select().from(brands).where(eq(brands.id, batch.brandId)).limit(1),
			tx
				.select()
				.from(measurementScopes)
				.where(and(eq(measurementScopes.id, batch.scopeId), eq(measurementScopes.brandId, batch.brandId)))
				.limit(1),
			tx.select().from(competitors).where(eq(competitors.brandId, batch.brandId)),
		]);
		if (!brand || !scope) throw new Error(`Delivery batch ${batch.id} context no longer exists`);

		const manifestTasks: DeliveryManifestTaskSnapshot[] = tasks.map((task) => ({
			id: task.id,
			brandId: task.brandId,
			scopeId: task.scopeId,
			promptId: task.promptId,
			promptText: task.promptText,
			surfaceTargetKey: task.surfaceTargetKey,
			captureRouteKey: task.captureRouteKey,
			sampleIndex: task.sampleIndex,
			sessionRequirement: task.sessionRequirement,
			searchRequirement: task.searchRequirement,
			evaluationRole: task.evaluationRole,
			slotKey: task.slotKey,
		}));
		const manifestSnapshot = buildDeliveryManifestSnapshot(
			{
				batch: {
					id: batch.id,
					brandId: batch.brandId,
					scopeId: batch.scopeId,
					idempotencyKey: batch.idempotencyKey,
					name: batch.name,
				},
				scope: {
					id: scope.id,
					key: scope.key,
					name: scope.name,
					market: scope.market,
					locale: scope.locale,
					timezone: scope.timezone,
				},
				brand: {
					id: brand.id,
					name: brand.name,
					website: brand.website,
					additionalDomains: brand.additionalDomains,
					aliases: brand.aliases,
				},
				competitors: competitorRows.map((competitor) => ({
					id: competitor.id,
					name: competitor.name,
					domains: competitor.domains,
					aliases: competitor.aliases,
				})),
				protocol: normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol),
			},
			manifestTasks,
		);
		const frozenAt = new Date();
		const [frozen] = await tx
			.update(deliveryBatches)
			.set({
				status: "frozen",
				plannedTaskCount: tasks.length,
				manifestSnapshot,
				manifestHash: buildDeliveryManifestHash(manifestSnapshot),
				frozenBy: optionalText(input.frozenBy, "frozenBy", 300),
				frozenAt,
			})
			.where(and(eq(deliveryBatches.id, batch.id), eq(deliveryBatches.status, "draft")))
			.returning();
		if (!frozen) throw new DeliveryBatchStateError(`Delivery batch ${batch.id} was concurrently frozen`);

		await tx
			.update(deliveryTasks)
			.set({ status: "available", availableAt: frozenAt })
			.where(and(eq(deliveryTasks.batchId, batch.id), eq(deliveryTasks.status, "planned")));
		return frozen;
	});
}

export async function listDeliveryBatches(input: {
	brandId: string;
	scopeId?: string;
	limit?: number;
}): Promise<DeliveryBatch[]> {
	const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
	return db
		.select()
		.from(deliveryBatches)
		.where(
			input.scopeId
				? and(eq(deliveryBatches.brandId, input.brandId), eq(deliveryBatches.scopeId, input.scopeId))
				: eq(deliveryBatches.brandId, input.brandId),
		)
		.orderBy(asc(deliveryBatches.createdAt))
		.limit(limit);
}

export async function getDeliveryBatch(input: { brandId: string; batchId: string }): Promise<{
	batch: DeliveryBatch;
	tasks: DeliveryTaskView[];
} | null> {
	const batch = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)),
	});
	if (!batch) return null;
	const tasks = await db
		.select()
		.from(deliveryTasks)
		.where(eq(deliveryTasks.batchId, batch.id))
		.orderBy(asc(deliveryTasks.createdAt));
	return { batch, tasks: tasks.map(redactDeliveryTask) };
}

export async function getDeliveryTask(input: { brandId: string; taskId: string }): Promise<DeliveryTaskView | null> {
	const task = await db.query.deliveryTasks.findFirst({
		where: and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.brandId, input.brandId)),
	});
	return task ? redactDeliveryTask(task) : null;
}

export async function getDeliveryBatchCoverage(input: {
	brandId: string;
	batchId: string;
}): Promise<DeliveryCoverage | null> {
	const batch = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)),
		columns: { id: true },
	});
	if (!batch) return null;
	const tasks = await db
		.select({ status: deliveryTasks.status, evaluationRole: deliveryTasks.evaluationRole })
		.from(deliveryTasks)
		.where(eq(deliveryTasks.batchId, batch.id));
	return summarizeDeliveryCoverage(tasks);
}

export async function claimNextDeliveryTask(input: {
	brandId: string;
	batchId?: string;
	claimedBy: string;
	leaseDurationMs?: number;
	surfaceTargetKeys?: readonly string[];
	evaluationRoles?: readonly DeliveryEvaluationRole[];
	queue?: "available" | "needs_human";
}): Promise<ClaimedDeliveryTask | null> {
	const claimedBy = requiredText(input.claimedBy, "claimedBy", 300);
	const leaseDurationMs = validLeaseDuration(input.leaseDurationMs);
	if (input.surfaceTargetKeys?.length === 0 || input.evaluationRoles?.length === 0) return null;

	return db.transaction(async (tx) => {
		const batchConditions = [
			eq(deliveryBatches.brandId, input.brandId),
			inArray(deliveryBatches.status, ["frozen", "in_progress"]),
		];
		if ((input.queue ?? "available") === "needs_human") {
			batchConditions.push(eq(deliveryBatches.executionMode, "browser_runner"));
			batchConditions.push(eq(deliveryBatches.automationStatus, "needs_human"));
		}
		if (input.batchId) batchConditions.push(eq(deliveryBatches.id, input.batchId));
		const batches = await tx
			.select({
				id: deliveryBatches.id,
				status: deliveryBatches.status,
				startedAt: deliveryBatches.startedAt,
				protocol: deliveryBatches.protocol,
				executionMode: deliveryBatches.executionMode,
				automationStatus: deliveryBatches.automationStatus,
			})
			.from(deliveryBatches)
			.where(and(...batchConditions))
			.orderBy(asc(deliveryBatches.createdAt));
		if (batches.length === 0) return null;

		const now = new Date();
		const eligibleBatches: Array<{ batch: (typeof batches)[number]; windowEndsAt: Date }> = [];
		for (const batch of batches) {
			const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
			const windowStartsAt = new Date(protocol.measurementWindow.startsAt);
			const windowEndsAt = new Date(protocol.measurementWindow.endsAt);
			if (now < windowStartsAt) {
				if (input.batchId) {
					throw new DeliveryBatchStateError(`Delivery batch ${batch.id} measurement window has not started`);
				}
				continue;
			}
			if (now >= windowEndsAt) {
				if (input.batchId) {
					throw new DeliveryBatchStateError(`Delivery batch ${batch.id} measurement window has ended`);
				}
				continue;
			}
			eligibleBatches.push({ batch, windowEndsAt });
		}

		for (const { batch, windowEndsAt } of eligibleBatches) {
			const queue = input.queue ?? "available";
			const availabilityCondition =
				queue === "needs_human"
					? or(
							and(
								eq(deliveryTasks.status, "available"),
								eq(deliveryTasks.automationStatus, "needs_human"),
								isNull(deliveryTasks.submitIntentAt),
							),
							and(
								eq(deliveryTasks.status, "claimed"),
								eq(deliveryTasks.automationStatus, "running"),
								isNotNull(deliveryTasks.needsHumanCode),
								isNull(deliveryTasks.submitIntentAt),
								lt(deliveryTasks.leaseExpiresAt, now),
							),
						)
					: or(
							and(eq(deliveryTasks.status, "available"), isNull(deliveryTasks.automationStatus)),
							and(
								eq(deliveryTasks.status, "claimed"),
								isNull(deliveryTasks.automationStatus),
								lt(deliveryTasks.leaseExpiresAt, now),
							),
						);
			if (!availabilityCondition) throw new Error("Failed to build delivery task availability condition");
			const taskConditions = [eq(deliveryTasks.batchId, batch.id), availabilityCondition];
			if (input.surfaceTargetKeys)
				taskConditions.push(inArray(deliveryTasks.surfaceTargetKey, input.surfaceTargetKeys));
			if (input.evaluationRoles) taskConditions.push(inArray(deliveryTasks.evaluationRole, input.evaluationRoles));

			const [candidate] = await tx
				.select()
				.from(deliveryTasks)
				.where(and(...taskConditions))
				.orderBy(asc(deliveryTasks.createdAt), asc(deliveryTasks.id))
				.limit(1)
				.for("update", { skipLocked: true });
			if (!candidate) continue;

			const leaseToken = randomBytes(32).toString("base64url");
			const leaseExpiresAt = boundedLeaseExpiry(now, leaseDurationMs, windowEndsAt);
			const leaseGeneration = candidate.leaseGeneration + 1;
			const [claimed] = await tx
				.update(deliveryTasks)
				.set({
					status: "claimed",
					claimedBy,
					leaseTokenHash: hashLeaseToken(leaseToken),
					leaseGeneration,
					leaseExpiresAt,
					claimCount: candidate.claimCount + 1,
					claimedAt: now,
					...(queue === "needs_human" ? { automationStatus: "running" as const } : {}),
				})
				.where(
					and(
						eq(deliveryTasks.id, candidate.id),
						eq(deliveryTasks.status, candidate.status),
						eq(deliveryTasks.leaseGeneration, candidate.leaseGeneration),
						candidate.status === "claimed" ? lt(deliveryTasks.leaseExpiresAt, now) : undefined,
					),
				)
				.returning();
			if (!claimed) continue;

			if (batch.status === "frozen") {
				await tx
					.update(deliveryBatches)
					.set({ status: "in_progress", startedAt: batch.startedAt ?? now })
					.where(and(eq(deliveryBatches.id, batch.id), eq(deliveryBatches.status, "frozen")));
			}
			return {
				task: redactDeliveryTask(claimed),
				leaseToken,
				leaseGeneration,
				leaseExpiresAt,
			};
		}
		return null;
	});
}

export async function heartbeatDeliveryTask(
	claim: DeliveryClaimProof & { leaseDurationMs?: number },
): Promise<{ leaseGeneration: number; leaseExpiresAt: Date }> {
	const leaseDurationMs = validLeaseDuration(claim.leaseDurationMs);
	return db.transaction(async (tx) => {
		const checkedAt = new Date();
		const [lockedTask] = await tx
			.select({ batchId: deliveryTasks.batchId, leaseExpiresAt: deliveryTasks.leaseExpiresAt })
			.from(deliveryTasks)
			.where(activeLeaseCondition(claim, checkedAt))
			.limit(1)
			.for("update");
		const now = new Date();
		if (!lockedTask || requiredDate(lockedTask.leaseExpiresAt) <= now) {
			throw new DeliveryTaskLeaseError(claim.taskId);
		}

		const [batch] = await tx
			.select({ protocol: deliveryBatches.protocol })
			.from(deliveryBatches)
			.where(eq(deliveryBatches.id, lockedTask.batchId))
			.limit(1);
		if (!batch) throw new DeliveryTaskLeaseError(claim.taskId);
		const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
		const windowEndsAt = new Date(protocol.measurementWindow.endsAt);
		if (now >= windowEndsAt) throw new DeliveryTaskLeaseError(claim.taskId);

		const leaseExpiresAt = boundedLeaseExpiry(now, leaseDurationMs, windowEndsAt);
		const [updated] = await tx
			.update(deliveryTasks)
			.set({ leaseExpiresAt })
			.where(activeLeaseCondition(claim, now))
			.returning({ leaseGeneration: deliveryTasks.leaseGeneration, leaseExpiresAt: deliveryTasks.leaseExpiresAt });
		if (!updated) throw new DeliveryTaskLeaseError(claim.taskId);
		return { leaseGeneration: updated.leaseGeneration, leaseExpiresAt: requiredDate(updated.leaseExpiresAt) };
	});
}

export async function assertActiveDeliveryClaim(claim: DeliveryClaimProof): Promise<ActiveDeliveryClaimContext> {
	return db.transaction((tx) => assertActiveDeliveryClaimInTransaction(tx, claim));
}

export async function assertActiveDeliveryClaimInTransaction(
	executor: Pick<DeliveryTransaction, "select">,
	claim: DeliveryClaimProof,
): Promise<ActiveDeliveryClaimContext> {
	const [taskIdentity] = await executor
		.select({ batchId: deliveryTasks.batchId })
		.from(deliveryTasks)
		.where(eq(deliveryTasks.id, claim.taskId))
		.limit(1);
	if (!taskIdentity) throw new DeliveryTaskLeaseError(claim.taskId);

	const [batch] = await executor
		.select({
			id: deliveryBatches.id,
			brandId: deliveryBatches.brandId,
			scopeId: deliveryBatches.scopeId,
			status: deliveryBatches.status,
			protocol: deliveryBatches.protocol,
		})
		.from(deliveryBatches)
		.where(eq(deliveryBatches.id, taskIdentity.batchId))
		.limit(1)
		.for("update");
	if (!batch || (batch.status !== "frozen" && batch.status !== "in_progress")) {
		throw new DeliveryTaskLeaseError(claim.taskId);
	}

	const checkedAt = new Date();
	const [task] = await executor
		.select()
		.from(deliveryTasks)
		.where(activeLeaseCondition(claim, checkedAt))
		.limit(1)
		.for("update");
	const verifiedAt = new Date();
	if (!task?.leaseExpiresAt || task.leaseExpiresAt <= verifiedAt) {
		throw new DeliveryTaskLeaseError(claim.taskId);
	}

	const protocol = normalizeDeliveryProtocol(batch.protocol as DeliveryProtocol);
	const measurementWindowStartsAt = new Date(protocol.measurementWindow.startsAt);
	const measurementWindowEndsAt = new Date(protocol.measurementWindow.endsAt);
	if (verifiedAt < measurementWindowStartsAt || verifiedAt >= measurementWindowEndsAt) {
		throw new DeliveryTaskLeaseError(claim.taskId);
	}

	return {
		task: redactDeliveryTask(task),
		batch,
		verifiedAt,
		measurementWindowEndsAt,
	};
}

export async function releaseDeliveryTask(claim: DeliveryClaimProof & { error?: unknown }): Promise<DeliveryTaskView> {
	return db.transaction(async (tx) => {
		const now = new Date();
		const [lockedTask] = await tx
			.select({
				captureRouteKey: deliveryTasks.captureRouteKey,
				submitIntentAt: deliveryTasks.submitIntentAt,
			})
			.from(deliveryTasks)
			.where(activeLeaseCondition(claim, now))
			.limit(1)
			.for("update");
		if (!lockedTask) throw new DeliveryTaskLeaseError(claim.taskId);
		assertPortalBrowserRunnerMutationAllowed(lockedTask, "release");
		const error = claim.error === undefined ? {} : describeError(claim.error);
		const [released] = await tx
			.update(deliveryTasks)
			.set({
				status: "available",
				automationStatus: sql`CASE WHEN ${deliveryTasks.automationStatus} IS NULL THEN NULL ELSE 'needs_human'::browser_runner_task_status END`,
				leaseTokenHash: null,
				leaseExpiresAt: null,
				availableAt: now,
				...error,
			})
			.where(activeLeaseCondition(claim, now))
			.returning();
		if (!released) throw new DeliveryTaskLeaseError(claim.taskId);
		return redactDeliveryTask(released);
	});
}

export async function completeDeliveryTaskSuccess(
	claim: DeliveryClaimProof & { observationAttemptId: string },
): Promise<DeliveryTaskView> {
	return db.transaction((tx) => completeDeliveryTaskInTransaction(tx, claim));
}

export async function failDeliveryTask(
	claim: DeliveryClaimProof & { observationAttemptId?: string; error: unknown },
): Promise<DeliveryTaskView> {
	return db.transaction((tx) => failDeliveryTaskInTransaction(tx, claim));
}

export async function completeDeliveryTaskInTransaction(
	executor: DeliveryExecutor,
	claim: DeliveryClaimProof & { observationAttemptId: string },
): Promise<DeliveryTaskView> {
	await lockDeliveryTaskBatch(executor, claim.taskId);
	const now = new Date();
	await assertAttemptMatchesTask(executor, claim.taskId, claim.observationAttemptId, "succeeded");
	const [completed] = await executor
		.update(deliveryTasks)
		.set({
			status: "succeeded",
			automationStatus: sql`CASE WHEN ${deliveryTasks.automationStatus} IS NULL THEN NULL ELSE 'completed'::browser_runner_task_status END`,
			observationAttemptId: claim.observationAttemptId,
			leaseTokenHash: null,
			leaseExpiresAt: null,
			succeededAt: now,
			lastErrorClass: null,
			lastErrorCode: null,
			lastErrorMessage: null,
			needsHumanCode: null,
			needsHumanReason: null,
		})
		.where(activeLeaseCondition(claim, now))
		.returning();
	if (!completed) throw new DeliveryTaskLeaseError(claim.taskId);
	await settleDeliveryBatch(executor, completed.batchId, now);
	return redactDeliveryTask(completed);
}

export async function failDeliveryTaskInTransaction(
	executor: DeliveryExecutor,
	claim: DeliveryClaimProof & { observationAttemptId?: string; error: unknown },
): Promise<DeliveryTaskView> {
	await lockDeliveryTaskBatch(executor, claim.taskId);
	const now = new Date();
	const [originalTask] = await executor
		.select({
			needsHumanCode: deliveryTasks.needsHumanCode,
			needsHumanReason: deliveryTasks.needsHumanReason,
		})
		.from(deliveryTasks)
		.where(eq(deliveryTasks.id, claim.taskId))
		.limit(1)
		.for("update");
	if (!originalTask) throw new DeliveryTaskLeaseError(claim.taskId);
	if (claim.observationAttemptId) {
		await assertAttemptMatchesTask(executor, claim.taskId, claim.observationAttemptId, "failed");
	}
	const reportedError = describeError(claim.error);
	const terminalFailure =
		originalTask.needsHumanCode && originalTask.needsHumanReason
			? {
					lastErrorClass: "BrowserRunnerTerminalFailure",
					lastErrorCode: originalTask.needsHumanCode,
					lastErrorMessage:
						`${sanitizeDiagnostic(originalTask.needsHumanReason)} | terminal disposition: ${sanitizeDiagnostic(reportedError.lastErrorMessage ?? "Terminal failure confirmed")} (confirmed by ${sanitizeDiagnostic(claim.claimedBy)})`.slice(
							0,
							2_000,
						),
				}
			: reportedError;
	const [failed] = await executor
		.update(deliveryTasks)
		.set({
			status: "failed",
			automationStatus: sql`CASE WHEN ${deliveryTasks.automationStatus} IS NULL THEN NULL ELSE 'completed'::browser_runner_task_status END`,
			observationAttemptId: claim.observationAttemptId,
			leaseTokenHash: null,
			leaseExpiresAt: null,
			failedAt: now,
			...terminalFailure,
			needsHumanCode: null,
			needsHumanReason: null,
		})
		.where(activeLeaseCondition(claim, now))
		.returning();
	if (!failed) throw new DeliveryTaskLeaseError(claim.taskId);
	await settleDeliveryBatch(executor, failed.batchId, now);
	return redactDeliveryTask(failed);
}

export async function cancelDeliveryBatch(input: {
	brandId: string;
	batchId: string;
	cancelledBy?: string;
}): Promise<DeliveryBatch> {
	return db.transaction(async (tx) => {
		const [batch] = await tx
			.select()
			.from(deliveryBatches)
			.where(and(eq(deliveryBatches.id, input.batchId), eq(deliveryBatches.brandId, input.brandId)))
			.limit(1)
			.for("update");
		if (!batch) throw new Error(`Delivery batch ${input.batchId} was not found`);
		if (batch.status === "cancelled") return batch;
		if (batch.status === "completed") {
			throw new DeliveryBatchStateError(`Completed delivery batch ${batch.id} cannot be cancelled`);
		}
		if (batch.executionMode === "browser_runner" && batch.automationStartedAt !== null) {
			const tasks = await tx.select().from(deliveryTasks).where(eq(deliveryTasks.batchId, batch.id)).for("update");
			if (!canCancelBrowserRunnerAfterStart(tasks)) {
				throw new DeliveryBatchStateError(
					`Browser-runner batch ${batch.id} cannot be cancelled after any frozen slot was attempted`,
				);
			}
		}

		const cancelledAt = new Date();
		await tx
			.update(deliveryTasks)
			.set({
				status: "cancelled",
				automationStatus: sql`CASE WHEN ${deliveryTasks.automationStatus} IS NULL THEN NULL ELSE 'completed'::browser_runner_task_status END`,
				leaseTokenHash: null,
				leaseExpiresAt: null,
				cancelledAt,
			})
			.where(
				and(eq(deliveryTasks.batchId, batch.id), inArray(deliveryTasks.status, ["planned", "available", "claimed"])),
			);
		const [cancelled] = await tx
			.update(deliveryBatches)
			.set({
				status: "cancelled",
				automationStatus: batch.executionMode === "browser_runner" ? "settled" : batch.automationStatus,
				automationSettledAt: batch.executionMode === "browser_runner" ? cancelledAt : batch.automationSettledAt,
				cancelledAt,
				cancelledBy: optionalText(input.cancelledBy, "cancelledBy", 300),
			})
			.where(eq(deliveryBatches.id, batch.id))
			.returning();
		if (!cancelled) throw new Error(`Failed to cancel delivery batch ${batch.id}`);
		return cancelled;
	});
}

function activeLeaseCondition(claim: DeliveryClaimProof, now: Date) {
	if (!Number.isSafeInteger(claim.leaseGeneration) || claim.leaseGeneration <= 0) {
		throw new Error("leaseGeneration must be a positive integer");
	}
	return and(
		eq(deliveryTasks.id, claim.taskId),
		eq(deliveryTasks.status, "claimed"),
		eq(deliveryTasks.claimedBy, requiredText(claim.claimedBy, "claimedBy", 300)),
		eq(deliveryTasks.leaseTokenHash, hashLeaseToken(claim.leaseToken)),
		eq(deliveryTasks.leaseGeneration, claim.leaseGeneration),
		gt(deliveryTasks.leaseExpiresAt, now),
	);
}

async function lockDeliveryTaskBatch(executor: DeliveryExecutor, taskId: string): Promise<void> {
	const [task] = await executor
		.select({ batchId: deliveryTasks.batchId })
		.from(deliveryTasks)
		.where(eq(deliveryTasks.id, taskId))
		.limit(1);
	if (!task) throw new Error(`Delivery task ${taskId} was not found`);
	const [batch] = await executor
		.select({ id: deliveryBatches.id, executionMode: deliveryBatches.executionMode })
		.from(deliveryBatches)
		.where(eq(deliveryBatches.id, task.batchId))
		.limit(1)
		.for("update");
	if (!batch) throw new Error(`Delivery batch ${task.batchId} was not found`);
}

async function assertAttemptMatchesTask(
	executor: DeliveryExecutor,
	taskId: string,
	attemptId: string,
	expectedStatus: "succeeded" | "failed",
): Promise<void> {
	const [row] = await executor
		.select({ task: deliveryTasks, attempt: observationAttempts })
		.from(deliveryTasks)
		.innerJoin(observationAttempts, eq(observationAttempts.id, attemptId))
		.where(eq(deliveryTasks.id, taskId))
		.limit(1);
	if (
		!row ||
		row.attempt.status !== expectedStatus ||
		row.attempt.brandId !== row.task.brandId ||
		row.attempt.scopeId !== row.task.scopeId ||
		row.attempt.promptId !== row.task.promptId ||
		row.attempt.promptText !== row.task.promptText ||
		row.attempt.surfaceTargetKey !== row.task.surfaceTargetKey ||
		row.attempt.captureRouteKey !== row.task.captureRouteKey ||
		row.attempt.sampleIndex !== row.task.sampleIndex
	) {
		throw new Error(`Observation attempt ${attemptId} does not match delivery task ${taskId}`);
	}
}

export async function settleDeliveryBatch(
	executor: DeliveryExecutor,
	batchId: string,
	completedAt: Date,
): Promise<void> {
	// Serialize the two possible "last task" transactions. Under READ COMMITTED,
	// the waiter takes a fresh snapshot after the earlier holder commits.
	const [batch] = await executor
		.select({ id: deliveryBatches.id, executionMode: deliveryBatches.executionMode })
		.from(deliveryBatches)
		.where(eq(deliveryBatches.id, batchId))
		.limit(1)
		.for("update");
	if (!batch) throw new Error(`Delivery batch ${batchId} was not found while settling`);
	const unresolved = await executor
		.select({ id: deliveryTasks.id })
		.from(deliveryTasks)
		.where(and(eq(deliveryTasks.batchId, batchId), inArray(deliveryTasks.status, ["planned", "available", "claimed"])))
		.limit(1);
	if (unresolved.length > 0) {
		if (batch.executionMode === "browser_runner") {
			const states = await executor
				.select({ automationStatus: deliveryTasks.automationStatus })
				.from(deliveryTasks)
				.where(eq(deliveryTasks.batchId, batchId));
			await executor
				.update(deliveryBatches)
				.set({
					automationStatus: deriveBrowserRunnerBatchStatus(states.map(({ automationStatus }) => automationStatus)),
				})
				.where(eq(deliveryBatches.id, batchId));
		}
		return;
	}
	await executor
		.update(deliveryBatches)
		.set({
			status: "completed",
			completedAt,
			automationStatus: sql`CASE WHEN ${deliveryBatches.executionMode} = 'browser_runner' THEN 'settled'::browser_runner_batch_status ELSE ${deliveryBatches.automationStatus} END`,
			automationSettledAt: sql`CASE WHEN ${deliveryBatches.executionMode} = 'browser_runner' THEN ${completedAt} ELSE ${deliveryBatches.automationSettledAt} END`,
		})
		.where(and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.status, "in_progress")));
}

function redactDeliveryTask(task: DeliveryTask): DeliveryTaskView {
	const { leaseTokenHash, ...view } = task;
	void leaseTokenHash;
	return view;
}

function hashLeaseToken(token: string): string {
	if (!token) throw new Error("leaseToken must not be empty");
	if (token.length > 500) throw new Error("leaseToken must not exceed 500 characters");
	return createHash("sha256").update(token).digest("hex");
}

function validLeaseDuration(value = 15 * 60 * 1_000): number {
	if (!Number.isSafeInteger(value) || value < 10_000 || value > 60 * 60 * 1_000) {
		throw new Error("leaseDurationMs must be an integer between 10000 and 3600000");
	}
	return value;
}

function boundedLeaseExpiry(now: Date, leaseDurationMs: number, windowEndsAt: Date): Date {
	return new Date(Math.min(now.getTime() + leaseDurationMs, windowEndsAt.getTime()));
}

function requiredText(value: string, field: string, maxLength: number): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${field} must not be empty`);
	if (normalized.length > maxLength) throw new Error(`${field} must not exceed ${maxLength} characters`);
	return normalized;
}

function optionalText(value: string | undefined, field: string, maxLength: number): string | undefined {
	return value === undefined ? undefined : requiredText(value, field, maxLength);
}

function requiredDate(value: Date | null): Date {
	if (!value) throw new Error("Delivery lease expiry was not returned");
	return value;
}

function requiredMapValue<K, V>(map: Map<K, V>, key: K): V {
	const value = map.get(key);
	if (!value) throw new Error("Failed to resolve a delivery task after insertion");
	return value;
}

function describeError(error: unknown): Pick<DeliveryTask, "lastErrorClass" | "lastErrorCode" | "lastErrorMessage"> {
	const errorClass = error instanceof Error ? error.name : "UnknownError";
	const rawMessage = error instanceof Error ? error.message : String(error);
	const message = rawMessage
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/(api[-_ ]?key|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
		.slice(0, 1_000);
	const code =
		error && typeof error === "object" && "code" in error
			? String((error as { code?: unknown }).code ?? "").slice(0, 100) || null
			: null;
	return { lastErrorClass: errorClass, lastErrorCode: code, lastErrorMessage: message };
}

function sanitizeDiagnostic(value: string): string {
	return value
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/(api[-_ ]?key|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}
