import { createServerFn } from "@tanstack/react-start";
import { db } from "@workspace/lib/db/db";
import {
	addDeliveryTasks,
	cancelDeliveryBatch,
	claimNextDeliveryTask,
	completeDeliveryTaskSuccess,
	createDraftDeliveryBatch,
	failDeliveryTask,
	freezeDeliveryBatch,
	getDeliveryBatch,
	getDeliveryTask,
	heartbeatDeliveryTask,
	releaseDeliveryTask,
	type DeliveryTaskPlanInput,
	type DeliveryTaskView,
} from "@workspace/lib/db/delivery-batches";
import {
	claimImportedObservationAttempt,
	markObservationFailed,
	persistSuccessfulObservation,
} from "@workspace/lib/db/observations";
import type { DeliveryManifestSnapshot, DeliveryProtocol } from "@workspace/lib/delivery-manifest";
import { DEFAULT_DELIVERY_EVIDENCE_POLICY, summarizeDeliveryCoverage } from "@workspace/lib/delivery-manifest";
import {
	brands,
	deliveryBatches,
	deliveryTasks,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
} from "@workspace/lib/db/schema";
import {
	MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS,
	MANUAL_OBSERVATION_SURFACE_TARGET_KEYS,
	resolveManualObservationTarget,
} from "@workspace/lib/manual-observation-targets";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { prepareSamplingObservation, samplingObservationInputSchema } from "./sampling-observation";

const SAMPLING_TARGET_PRESENTATION = {
	"doubao.consumer_web": { label: "豆包", launchUrl: "https://www.doubao.com/chat/" },
	"deepseek.consumer_web": { label: "DeepSeek", launchUrl: "https://chat.deepseek.com/" },
	"kimi.consumer_web": { label: "Kimi", launchUrl: "https://www.kimi.com/" },
	"yuanbao.consumer_web": { label: "腾讯元宝", launchUrl: "https://yuanbao.tencent.com/" },
	"qwen.consumer_web": { label: "通义千问", launchUrl: "https://www.qianwen.com/" },
	"wenxin.consumer_web": { label: "文心一言", launchUrl: "https://yiyan.baidu.com/" },
	"chatgpt.consumer_web": { label: "ChatGPT", launchUrl: "https://chatgpt.com/" },
	"perplexity.consumer_web": { label: "Perplexity", launchUrl: "https://www.perplexity.ai/" },
	"gemini.consumer_web": { label: "Gemini", launchUrl: "https://gemini.google.com/" },
	"copilot.consumer_web": { label: "Microsoft Copilot", launchUrl: "https://copilot.microsoft.com/" },
	"claude.consumer_web": { label: "Claude", launchUrl: "https://claude.ai/" },
	"grok.consumer_web": { label: "Grok", launchUrl: "https://grok.com/" },
	"google_search.ai_overview": { label: "Google AI Overviews", launchUrl: "https://www.google.com/" },
	"google_search.ai_mode": { label: "Google AI Mode", launchUrl: "https://www.google.com/aimode" },
} satisfies Record<(typeof MANUAL_OBSERVATION_SURFACE_TARGET_KEYS)[number], { label: string; launchUrl: string }>;

export const SAMPLING_TARGETS = MANUAL_OBSERVATION_SURFACE_TARGET_KEYS.map((surfaceTargetKey) => {
	const captureRouteKey = "assisted_browser.generic" as const;
	const descriptor = resolveManualObservationTarget({ surfaceTargetKey, captureRouteKey });
	const presentation = SAMPLING_TARGET_PRESENTATION[surfaceTargetKey];
	return {
		surfaceTargetKey,
		captureRouteKey,
		model: descriptor.model,
		label: presentation.label,
		launchUrl: presentation.launchUrl,
		surfaceKind: descriptor.surfaceKind,
		defaultSessionRequirement: "anonymous_clean" as const,
		defaultSearchRequirement:
			descriptor.surfaceKind === "search_surface" ? ("required" as const) : ("forbidden" as const),
	};
});

const brandIdSchema = z.string().trim().min(1, "brandId is required");
const guidSchema = z.guid();
const batchStatusSchema = z.enum(["draft", "frozen", "in_progress", "completed", "cancelled"]);

const evidenceProtocolSchema = z.object({
	minimumArtifacts: z.number().int().min(1).max(20),
	requireSha256: z.boolean(),
	requirePageUrl: z.boolean(),
	allowedUriSchemes: z
		.array(z.enum(["http", "https"]))
		.min(1)
		.max(2),
});

const deliveryProtocolSchema = z.object({
	measurementWindow: z.object({
		startsAt: z.string().datetime({ offset: true }),
		endsAt: z.string().datetime({ offset: true }),
	}),
	evidence: evidenceProtocolSchema.default(DEFAULT_DELIVERY_EVIDENCE_POLICY),
	notes: z.string().trim().min(1).max(2_000).optional(),
});

const createSamplingBatchInputSchema = z.object({
	brandId: brandIdSchema,
	scopeId: guidSchema,
	idempotencyKey: z.string().trim().min(1).max(200),
	name: z.string().trim().min(1).max(120),
	promptIds: z.array(guidSchema).min(1).max(500),
	targets: z
		.array(
			z.object({
				surfaceTargetKey: z.enum(MANUAL_OBSERVATION_SURFACE_TARGET_KEYS),
				captureRouteKey: z.enum(MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS).default("assisted_browser.generic"),
				samplesPerPrompt: z.number().int().min(1).max(20),
				evaluationRole: z.enum(["scored", "observation"]),
				sessionRequirement: z.enum(["anonymous_clean", "new_account_clean"]),
				searchRequirement: z.enum(["not_applicable", "required", "forbidden"]),
			}),
		)
		.min(1)
		.max(50),
	protocol: deliveryProtocolSchema,
});

const listSamplingBatchesInputSchema = z.object({
	brandId: brandIdSchema,
	scopeId: guidSchema.optional(),
	status: batchStatusSchema.optional(),
	limit: z.number().int().min(1).max(100).default(20),
	offset: z.number().int().min(0).default(0),
});

const samplingTaskSelectorSchema = z.object({ brandId: brandIdSchema, taskId: guidSchema });
const samplingTaskLeaseSchema = samplingTaskSelectorSchema.extend({
	leaseToken: z.string().min(32).max(500),
	leaseGeneration: z.number().int().positive(),
});

const SAMPLING_LEASE_MS = 15 * 60 * 1_000;
const MAX_SAMPLING_TASKS_PER_BATCH = 10_000;

async function requireSamplingAdmin() {
	const session = await requireAuthSession();
	if (!isAdmin(session)) throw new Error("Forbidden: Admin access required");
	return session;
}

async function requireSamplingAdminBrand(brandId: string) {
	const session = await requireSamplingAdmin();
	// This first delivery workbench is intentionally deployment-admin-only and
	// therefore cross-organization. Loading the brand here prevents any task or
	// batch operation from relying on the historical brandId === organizationId convention.
	const brand = await db.query.brands.findFirst({ where: eq(brands.id, brandId) });
	if (!brand) throw new Error(`Brand "${brandId}" not found`);
	return { session, brand };
}

function getSamplingTargetPresentation(surfaceTargetKey: string) {
	const target = SAMPLING_TARGETS.find((candidate) => candidate.surfaceTargetKey === surfaceTargetKey);
	if (!target) throw new Error(`Sampling target "${surfaceTargetKey}" is not registered`);
	return target;
}

function buildSamplingBatchSummary(
	batch: typeof deliveryBatches.$inferSelect,
	coverage: ReturnType<typeof summarizeDeliveryCoverage>,
) {
	return {
		id: batch.id,
		brandId: batch.brandId,
		scopeId: batch.scopeId,
		idempotencyKey: batch.idempotencyKey,
		name: batch.name,
		status: batch.status,
		plannedTaskCount: batch.plannedTaskCount,
		manifestHash: batch.manifestHash,
		frozenAt: batch.frozenAt,
		startedAt: batch.startedAt,
		completedAt: batch.completedAt,
		cancelledAt: batch.cancelledAt,
		createdAt: batch.createdAt,
		updatedAt: batch.updatedAt,
		coverage,
	};
}

function deliveryTaskIdentity(task: {
	promptId: string;
	promptText?: string;
	expectedPromptText?: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	sampleIndex: number;
	sessionRequirement: string;
	searchRequirement: string;
	evaluationRole?: string;
}): string {
	return JSON.stringify([
		task.promptId,
		task.promptText ?? task.expectedPromptText,
		task.surfaceTargetKey,
		task.captureRouteKey,
		task.sampleIndex,
		task.sessionRequirement,
		task.searchRequirement,
		task.evaluationRole ?? "scored",
	]);
}

export interface SamplingTaskDetail {
	id: string;
	batchId: string;
	batchName: string;
	brandId: string;
	brandName: string;
	scopeId: string;
	scopeName: string;
	market: string;
	locale: string;
	timezone: string;
	status: "planned" | "available" | "claimed" | "succeeded" | "failed" | "cancelled";
	promptId: string;
	promptText: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	model: string;
	targetLabel: string;
	launchUrl: string;
	evaluationRole: "scored" | "observation";
	sampleIndex: number;
	sessionRequirement: "none" | "anonymous_clean" | "new_account_clean";
	searchRequirement: "not_applicable" | "required" | "forbidden";
	claimCount: number;
	leaseGeneration: number;
	leaseExpiresAt: Date | null;
	minimumEvidenceArtifacts: number;
	requireEvidenceSha256: boolean;
	requirePageUrl: boolean;
	batch: { id: string; name: string; status: "draft" | "frozen" | "in_progress" | "completed" | "cancelled" };
	brand: { id: string; name: string };
	scope: { id: string; key: string; name: string; market: string; locale: string; timezone: string };
	target: { label: string; launchUrl: string; surfaceKind: string };
	protocol: DeliveryProtocol;
}

async function buildSamplingTaskDetail(task: DeliveryTaskView): Promise<SamplingTaskDetail> {
	const batch = await db.query.deliveryBatches.findFirst({
		where: and(eq(deliveryBatches.id, task.batchId), eq(deliveryBatches.brandId, task.brandId)),
	});
	if (!batch?.manifestSnapshot) throw new Error("Delivery task has no frozen batch manifest");
	const manifest = batch.manifestSnapshot as DeliveryManifestSnapshot;
	const presentation = getSamplingTargetPresentation(task.surfaceTargetKey);
	return {
		id: task.id,
		batchId: task.batchId,
		batchName: batch.name,
		brandId: task.brandId,
		brandName: manifest.brand.name,
		scopeId: task.scopeId,
		scopeName: manifest.scope.name,
		market: manifest.scope.market,
		locale: manifest.scope.locale,
		timezone: manifest.scope.timezone,
		status: task.status,
		promptId: task.promptId,
		promptText: task.promptText,
		surfaceTargetKey: task.surfaceTargetKey,
		captureRouteKey: task.captureRouteKey,
		model: presentation.model,
		targetLabel: presentation.label,
		launchUrl: presentation.launchUrl,
		evaluationRole: task.evaluationRole,
		sampleIndex: task.sampleIndex,
		sessionRequirement: task.sessionRequirement,
		searchRequirement: task.searchRequirement,
		claimCount: task.claimCount,
		leaseGeneration: task.leaseGeneration,
		leaseExpiresAt: task.leaseExpiresAt,
		minimumEvidenceArtifacts: manifest.protocol.evidence.minimumArtifacts,
		requireEvidenceSha256: manifest.protocol.evidence.requireSha256,
		requirePageUrl: manifest.protocol.evidence.requirePageUrl,
		batch: { id: batch.id, name: batch.name, status: batch.status },
		brand: { id: manifest.brand.id, name: manifest.brand.name },
		scope: manifest.scope,
		target: {
			label: presentation.label,
			launchUrl: presentation.launchUrl,
			surfaceKind: presentation.surfaceKind,
		},
		protocol: manifest.protocol,
	};
}

export const getSamplingContextFn = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: brandIdSchema.optional() }))
	.handler(async ({ data }) => {
		await requireSamplingAdmin();
		const brandRows = await db
			.select({ id: brands.id, name: brands.name })
			.from(brands)
			.orderBy(asc(brands.name), asc(brands.id));
		if (!data.brandId) return { brands: brandRows, selectedBrand: null, targets: SAMPLING_TARGETS };

		const { brand } = await requireSamplingAdminBrand(data.brandId);
		const [scopeRows, promptRows] = await Promise.all([
			db
				.select()
				.from(measurementScopes)
				.where(eq(measurementScopes.brandId, brand.id))
				.orderBy(desc(measurementScopes.isDefault), asc(measurementScopes.createdAt)),
			db
				.select({
					id: prompts.id,
					scopeId: prompts.scopeId,
					value: prompts.value,
					tags: prompts.tags,
					enabled: prompts.enabled,
				})
				.from(prompts)
				.where(eq(prompts.brandId, brand.id))
				.orderBy(asc(prompts.createdAt)),
		]);
		return {
			brands: brandRows,
			selectedBrand: {
				id: brand.id,
				name: brand.name,
				scopes: scopeRows.map((scope) => ({
					id: scope.id,
					key: scope.key,
					name: scope.name,
					market: scope.market,
					locale: scope.locale,
					timezone: scope.timezone,
					enabled: scope.enabled,
					manualOnly: scope.automaticTargetKeys !== null && scope.automaticTargetKeys.length === 0,
				})),
				prompts: promptRows,
			},
			targets: SAMPLING_TARGETS,
		};
	});

export const listSamplingBatchesFn = createServerFn({ method: "GET" })
	.validator(listSamplingBatchesInputSchema)
	.handler(async ({ data }) => {
		await requireSamplingAdminBrand(data.brandId);
		const conditions = [eq(deliveryBatches.brandId, data.brandId)];
		if (data.scopeId) conditions.push(eq(deliveryBatches.scopeId, data.scopeId));
		if (data.status) conditions.push(eq(deliveryBatches.status, data.status));

		const [[totalRow], batchesList] = await Promise.all([
			db
				.select({ count: count() })
				.from(deliveryBatches)
				.where(and(...conditions)),
			db
				.select()
				.from(deliveryBatches)
				.where(and(...conditions))
				.orderBy(desc(deliveryBatches.createdAt), desc(deliveryBatches.id))
				.limit(data.limit)
				.offset(data.offset),
		]);

		const batchesWithCoverage = await Promise.all(
			batchesList.map(async (batch) => {
				const taskRows = await db
					.select({ status: deliveryTasks.status, evaluationRole: deliveryTasks.evaluationRole })
					.from(deliveryTasks)
					.where(and(eq(deliveryTasks.batchId, batch.id), eq(deliveryTasks.brandId, batch.brandId)));
				return buildSamplingBatchSummary(batch, summarizeDeliveryCoverage(taskRows));
			}),
		);

		return {
			batches: batchesWithCoverage,
			total: Number(totalRow?.count ?? 0),
			limit: data.limit,
			offset: data.offset,
		};
	});

export const getSamplingTaskFn = createServerFn({ method: "GET" })
	.validator(samplingTaskSelectorSchema)
	.handler(async ({ data }) => {
		await requireSamplingAdminBrand(data.brandId);
		const task = await getDeliveryTask(data);
		if (!task) throw new Error(`Sampling task "${data.taskId}" not found`);
		return buildSamplingTaskDetail(task);
	});

export const createSamplingBatchFn = createServerFn({ method: "POST" })
	.validator(createSamplingBatchInputSchema)
	.handler(async ({ data }) => {
		const { session, brand } = await requireSamplingAdminBrand(data.brandId);
		if (!data.protocol.evidence.requireSha256 || !data.protocol.evidence.requirePageUrl) {
			throw new Error("Sampling batches require both page URLs and SHA-256 evidence digests");
		}
		if (new Set(data.promptIds).size !== data.promptIds.length) {
			throw new Error("promptIds must not contain duplicates");
		}
		const targetKeys = data.targets.map(({ surfaceTargetKey }) => surfaceTargetKey);
		if (new Set(targetKeys).size !== targetKeys.length) {
			throw new Error("A sampling batch can include each surface target only once");
		}

		const scope = await db.query.measurementScopes.findFirst({
			where: and(eq(measurementScopes.id, data.scopeId), eq(measurementScopes.brandId, brand.id)),
		});
		if (!scope) throw new Error(`Measurement scope "${data.scopeId}" was not found for this brand`);
		if (!scope.enabled) throw new Error(`Measurement scope "${scope.name}" is disabled`);
		if (scope.market === "ZZ" || scope.locale === "und") {
			throw new Error("Sampling batches require an explicit market and locale");
		}
		if (scope.automaticTargetKeys === null || scope.automaticTargetKeys.length > 0) {
			throw new Error("Sampling batches require a manual-only measurement scope");
		}

		for (const targetInput of data.targets) {
			const target = resolveManualObservationTarget(targetInput);
			if (target.surfaceKind === "search_surface" && targetInput.searchRequirement !== "required") {
				throw new Error(`Search surface ${target.surfaceTargetKey} must require search mode`);
			}
		}

		const promptRows = await db
			.select({ id: prompts.id, value: prompts.value, enabled: prompts.enabled })
			.from(prompts)
			.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), inArray(prompts.id, data.promptIds)));
		if (promptRows.length !== data.promptIds.length) {
			throw new Error("Every prompt must belong to the requested brand and measurement scope");
		}
		const disabledPrompt = promptRows.find(({ enabled }) => !enabled);
		if (disabledPrompt) throw new Error(`Prompt ${disabledPrompt.id} is disabled`);
		const promptById = new Map(promptRows.map((prompt) => [prompt.id, prompt]));

		const taskPlans: DeliveryTaskPlanInput[] = [];
		for (const promptId of data.promptIds) {
			const prompt = promptById.get(promptId);
			if (!prompt) throw new Error(`Prompt ${promptId} was not found`);
			for (const target of data.targets) {
				for (let sampleIndex = 1; sampleIndex <= target.samplesPerPrompt; sampleIndex++) {
					taskPlans.push({
						promptId,
						expectedPromptText: prompt.value,
						surfaceTargetKey: target.surfaceTargetKey,
						captureRouteKey: target.captureRouteKey,
						sampleIndex,
						sessionRequirement: target.sessionRequirement,
						searchRequirement: target.searchRequirement,
						evaluationRole: target.evaluationRole,
					});
				}
			}
		}
		if (taskPlans.length > MAX_SAMPLING_TASKS_PER_BATCH) {
			throw new Error(`A sampling batch cannot contain more than ${MAX_SAMPLING_TASKS_PER_BATCH} tasks`);
		}

		const batch = await createDraftDeliveryBatch({
			brandId: brand.id,
			scopeId: scope.id,
			idempotencyKey: data.idempotencyKey,
			name: data.name,
			protocol: data.protocol,
			createdBy: session.user.id,
		});
		const existing = await getDeliveryBatch({ brandId: brand.id, batchId: batch.id });
		if (!existing) throw new Error(`Delivery batch ${batch.id} could not be read after creation`);
		if (existing.tasks.length > 0) {
			const requestedTaskIdentities = taskPlans.map(deliveryTaskIdentity).sort();
			const existingTaskIdentities = existing.tasks.map(deliveryTaskIdentity).sort();
			if (
				requestedTaskIdentities.length !== existingTaskIdentities.length ||
				requestedTaskIdentities.some((identity, index) => identity !== existingTaskIdentities[index])
			) {
				throw new Error(`Delivery batch idempotency key ${data.idempotencyKey} is assigned to another manifest`);
			}
			if (batch.status !== "draft") {
				return buildSamplingBatchSummary(batch, summarizeDeliveryCoverage(existing.tasks));
			}
		} else if (batch.status !== "draft") {
			throw new Error(`Frozen delivery batch ${batch.id} has no manifest tasks`);
		}

		if (existing.tasks.length === 0) {
			await addDeliveryTasks({ brandId: brand.id, batchId: batch.id, tasks: taskPlans });
		}
		const frozen = await freezeDeliveryBatch({ brandId: brand.id, batchId: batch.id, frozenBy: session.user.id });
		const frozenBatch = await getDeliveryBatch({ brandId: brand.id, batchId: frozen.id });
		if (!frozenBatch) throw new Error(`Frozen delivery batch ${frozen.id} could not be read`);
		return buildSamplingBatchSummary(frozen, summarizeDeliveryCoverage(frozenBatch.tasks));
	});

export const cancelSamplingBatchFn = createServerFn({ method: "POST" })
	.validator(z.object({ brandId: brandIdSchema, batchId: guidSchema }))
	.handler(async ({ data }) => {
		const { session } = await requireSamplingAdminBrand(data.brandId);
		const batch = await cancelDeliveryBatch({ ...data, cancelledBy: session.user.id });
		const current = await getDeliveryBatch({ brandId: data.brandId, batchId: batch.id });
		return buildSamplingBatchSummary(batch, summarizeDeliveryCoverage(current?.tasks ?? []));
	});

export const claimSamplingTaskFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: brandIdSchema,
			batchId: guidSchema.optional(),
			surfaceTargetKeys: z.array(z.enum(MANUAL_OBSERVATION_SURFACE_TARGET_KEYS)).min(1).max(50).optional(),
		}),
	)
	.handler(async ({ data }) => {
		const { session } = await requireSamplingAdminBrand(data.brandId);
		const claimed = await claimNextDeliveryTask({
			...data,
			claimedBy: session.user.id,
			leaseDurationMs: SAMPLING_LEASE_MS,
		});
		if (!claimed) return null;
		return { task: await buildSamplingTaskDetail(claimed.task), leaseToken: claimed.leaseToken };
	});

export const heartbeatSamplingTaskFn = createServerFn({ method: "POST" })
	.validator(samplingTaskLeaseSchema)
	.handler(async ({ data }) => {
		const { session } = await requireSamplingAdminBrand(data.brandId);
		const task = await getDeliveryTask({ brandId: data.brandId, taskId: data.taskId });
		if (!task) throw new Error(`Sampling task "${data.taskId}" not found`);
		return heartbeatDeliveryTask({
			taskId: task.id,
			claimedBy: session.user.id,
			leaseToken: data.leaseToken,
			leaseGeneration: data.leaseGeneration,
			leaseDurationMs: SAMPLING_LEASE_MS,
		});
	});

export const releaseSamplingTaskFn = createServerFn({ method: "POST" })
	.validator(samplingTaskLeaseSchema)
	.handler(async ({ data }) => {
		const { session } = await requireSamplingAdminBrand(data.brandId);
		const task = await getDeliveryTask({ brandId: data.brandId, taskId: data.taskId });
		if (!task) throw new Error(`Sampling task "${data.taskId}" not found`);
		await releaseDeliveryTask({
			taskId: task.id,
			claimedBy: session.user.id,
			leaseToken: data.leaseToken,
			leaseGeneration: data.leaseGeneration,
		});
		return { success: true as const };
	});

export const failSamplingTaskFn = createServerFn({ method: "POST" })
	.validator(
		samplingTaskLeaseSchema.extend({
			errorCode: z.string().trim().min(1).max(100).optional(),
			errorMessage: z.string().trim().min(1).max(1_000),
		}),
	)
	.handler(async ({ data }) => {
		const { session } = await requireSamplingAdminBrand(data.brandId);
		const task = await getDeliveryTask({ brandId: data.brandId, taskId: data.taskId });
		if (!task) throw new Error(`Sampling task "${data.taskId}" not found`);
		const error = Object.assign(new Error(data.errorMessage), {
			name: "SamplingTaskError",
			...(data.errorCode ? { code: data.errorCode } : {}),
		});
		const claim = {
			taskId: task.id,
			claimedBy: session.user.id,
			leaseToken: data.leaseToken,
			leaseGeneration: data.leaseGeneration,
		};
		const updated = await failDeliveryTask({ ...claim, error });
		return buildSamplingTaskDetail(updated);
	});

export const submitSamplingTaskFn = createServerFn({ method: "POST" })
	.validator(samplingTaskLeaseSchema.extend({ observation: samplingObservationInputSchema }))
	.handler(async ({ data }) => {
		const { session, brand } = await requireSamplingAdminBrand(data.brandId);
		const task = await getDeliveryTask({ brandId: data.brandId, taskId: data.taskId });
		if (!task) throw new Error(`Sampling task "${data.taskId}" not found`);
		const deliveryClaim = {
			taskId: task.id,
			claimedBy: session.user.id,
			leaseToken: data.leaseToken,
			leaseGeneration: data.leaseGeneration,
		};
		if (task.status === "claimed") {
			await heartbeatDeliveryTask({ ...deliveryClaim, leaseDurationMs: SAMPLING_LEASE_MS });
		} else if (task.status !== "succeeded") {
			throw new Error(`Sampling task ${task.id} is ${task.status} and cannot accept a submission`);
		}
		const batchResult = await getDeliveryBatch({ brandId: data.brandId, batchId: task.batchId });
		if (!batchResult?.batch.manifestSnapshot) throw new Error("Sampling task has no frozen batch manifest");
		const manifest = batchResult.batch.manifestSnapshot as DeliveryManifestSnapshot;
		const scope = await db.query.measurementScopes.findFirst({
			where: and(eq(measurementScopes.id, task.scopeId), eq(measurementScopes.brandId, task.brandId)),
		});
		if (!scope) throw new Error("Sampling task measurement scope no longer exists");

		const prepared = prepareSamplingObservation({
			task,
			manifest,
			observation: data.observation,
			operatorUserId: session.user.id,
			leaseGeneration: data.leaseGeneration,
		});
		const attempt = await claimImportedObservationAttempt({
			sourceKey: `delivery-task:${task.id}`,
			promptId: task.promptId,
			promptText: task.promptText,
			brandId: task.brandId,
			scope,
			target: prepared.target,
			config: prepared.config,
			sampleIndex: task.sampleIndex,
			captureMetadata: prepared.captureMetadata,
			sampleFingerprint: prepared.sampleFingerprint,
		});

		if (attempt.state === "in_progress") {
			throw new Error("This sampling task submission is already in progress");
		}
		if (attempt.state === "completed") {
			if (task.status !== "succeeded") {
				await completeDeliveryTaskSuccess({
					...deliveryClaim,
					observationAttemptId: attempt.id,
				});
			}
			const promptRun =
				attempt.promptRunId ??
				(
					await db.query.promptRuns.findFirst({
						where: eq(promptRuns.observationAttemptId, attempt.id),
						columns: { id: true },
					})
				)?.id;
			return {
				task: await buildSamplingTaskDetail(
					(await getDeliveryTask({ brandId: task.brandId, taskId: task.id })) ?? task,
				),
				attemptId: attempt.id,
				promptRunId: promptRun ?? null,
				duplicate: true,
			};
		}

		try {
			const promptRun = await persistSuccessfulObservation({
				attemptId: attempt.id,
				startedAt: attempt.startedAt,
				observedAt: prepared.observedAt,
				promptId: task.promptId,
				brand,
				scope,
				target: prepared.target,
				config: prepared.config,
				recordedVersion: data.observation.modelVersion ?? "consumer-surface-unspecified",
				answerText: data.observation.answerText,
				rawOutput: prepared.rawOutput,
				webQueries: data.observation.webQueries,
				brandMentioned: prepared.mentionResult.brandMentioned,
				competitorsMentioned: prepared.mentionResult.competitorsMentioned,
				extractedCitations: prepared.citations,
				deliveryClaim,
			});
			const completed = await getDeliveryTask({ brandId: task.brandId, taskId: task.id });
			if (!completed || completed.status !== "succeeded") {
				throw new Error(`Sampling task ${task.id} was not completed with its observation`);
			}
			return {
				task: await buildSamplingTaskDetail(completed),
				attemptId: attempt.id,
				promptRunId: promptRun.id,
				duplicate: false,
			};
		} catch (error) {
			const currentAttempt = await db.query.observationAttempts.findFirst({
				where: eq(observationAttempts.id, attempt.id),
				columns: { status: true },
			});
			if (currentAttempt?.status === "running") {
				try {
					await markObservationFailed({
						attemptId: attempt.id,
						startedAt: attempt.startedAt,
						error,
						stage: "import",
						deliveryClaim,
					});
				} catch (markError) {
					console.error(`Failed to atomically mark sampling task ${task.id} after submission error:`, markError);
					try {
						await markObservationFailed({
							attemptId: attempt.id,
							startedAt: attempt.startedAt,
							error,
							stage: "import",
						});
					} catch (fallbackError) {
						console.error(`Failed to mark observation attempt ${attempt.id} after lease loss:`, fallbackError);
					}
				}
			}
			throw error;
		}
	});
