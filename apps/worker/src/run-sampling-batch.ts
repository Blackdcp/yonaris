import {
	requeueBrowserRunnerSafePreSubmitTransportFailures,
	startBrowserRunnerBatch,
} from "@workspace/lib/db/browser-runner";
import { db } from "@workspace/lib/db/db";
import {
	addDeliveryTasks,
	createDraftDeliveryBatch,
	freezeDeliveryBatch,
	getDeliveryBatch,
} from "@workspace/lib/db/delivery-batches";
import { brands, deliveryBatches, measurementScopes, prompts } from "@workspace/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
	executeSamplingBatchOperation,
	type ResolvedSamplingBatchSnapshot,
	type SamplingBatchExistingState,
	type SamplingBatchOperationGateway,
} from "./sampling-batch-operation";
import {
	parseSamplingBatchCliOptions,
	readSamplingBatchRequestFile,
	type SamplingBatchRequest,
	SamplingBatchRequestError,
} from "./sampling-batch-request";

function selectExactlyOne<T>(rows: T[], notFoundCode: string, ambiguousCode: string, entityName: string): T {
	if (rows.length === 0) {
		throw new SamplingBatchRequestError(notFoundCode, `No ${entityName} matched the exact reviewed selector`);
	}
	if (rows.length !== 1) {
		throw new SamplingBatchRequestError(ambiguousCode, `More than one ${entityName} matched the exact selector`);
	}
	return rows[0] as T;
}

async function resolveSnapshot(request: SamplingBatchRequest): Promise<ResolvedSamplingBatchSnapshot> {
	const brand = selectExactlyOne(
		await db
			.select({ id: brands.id, name: brands.name })
			.from(brands)
			.where(and(eq(brands.name, request.brand.nameExact), eq(brands.enabled, true)))
			.limit(2),
		"brand_not_found",
		"brand_ambiguous",
		"enabled StepFun brand",
	);
	const scope = selectExactlyOne(
		await db
			.select({
				id: measurementScopes.id,
				key: measurementScopes.key,
				market: measurementScopes.market,
				locale: measurementScopes.locale,
				timezone: measurementScopes.timezone,
				evaluationRole: measurementScopes.samplingEvaluationRole,
				automaticTargetKeys: measurementScopes.automaticTargetKeys,
			})
			.from(measurementScopes)
			.where(
				and(
					eq(measurementScopes.brandId, brand.id),
					eq(measurementScopes.key, request.scope.keyExact),
					eq(measurementScopes.enabled, true),
				),
			)
			.limit(2),
		"scope_not_found",
		"scope_ambiguous",
		"enabled StepFun CN scored scope",
	);
	const promptRows = await db
		.select({ id: prompts.id, value: prompts.value })
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)))
		.orderBy(asc(prompts.createdAt), asc(prompts.id));
	return { brand, scope, prompts: promptRows };
}

async function findExistingBatch(brandId: string, idempotencyKey: string): Promise<SamplingBatchExistingState | null> {
	const rows = await db
		.select({ id: deliveryBatches.id })
		.from(deliveryBatches)
		.where(and(eq(deliveryBatches.brandId, brandId), eq(deliveryBatches.idempotencyKey, idempotencyKey)))
		.limit(2);
	if (rows.length === 0) return null;
	if (rows.length !== 1) {
		throw new SamplingBatchRequestError("batch_identity_ambiguous", "The fixed batch identity resolved more than once");
	}
	const resolved = await getDeliveryBatch({ brandId, batchId: (rows[0] as { id: string }).id });
	if (!resolved) {
		throw new SamplingBatchRequestError(
			"batch_identity_unreadable",
			"The fixed batch identity could not be read consistently",
		);
	}
	return {
		batch: {
			id: resolved.batch.id,
			brandId: resolved.batch.brandId,
			scopeId: resolved.batch.scopeId,
			idempotencyKey: resolved.batch.idempotencyKey,
			name: resolved.batch.name,
			status: resolved.batch.status,
			executionMode: resolved.batch.executionMode,
			automationStatus: resolved.batch.automationStatus,
			plannedTaskCount: resolved.batch.plannedTaskCount,
			protocol: resolved.batch.protocol,
			automationStartedAt: resolved.batch.automationStartedAt,
			frozenAt: resolved.batch.frozenAt,
			completedAt: resolved.batch.completedAt,
		},
		tasks: resolved.tasks.map((task) => ({
			id: task.id,
			brandId: task.brandId,
			scopeId: task.scopeId,
			status: task.status,
			automationStatus: task.automationStatus,
			promptId: task.promptId,
			promptText: task.promptText,
			surfaceTargetKey: task.surfaceTargetKey,
			captureRouteKey: task.captureRouteKey,
			sampleIndex: task.sampleIndex,
			sessionRequirement: task.sessionRequirement,
			searchRequirement: task.searchRequirement,
			evaluationRole: task.evaluationRole,
			automationAttemptCount: task.automationAttemptCount,
			claimCount: task.claimCount,
			submitIntentAt: task.submitIntentAt,
			submitConfirmedAt: task.submitConfirmedAt,
			observationAttemptId: task.observationAttemptId,
			needsHumanCode: task.needsHumanCode,
			lastErrorCode: task.lastErrorCode,
		})),
	};
}

const gateway: SamplingBatchOperationGateway = {
	resolveSnapshot,
	findExistingBatch,
	currentTime: () => new Date(),
	async createDraft({ request, snapshot, protocol }) {
		const batch = await createDraftDeliveryBatch({
			brandId: snapshot.brand.id,
			scopeId: snapshot.scope.id,
			idempotencyKey: request.batch.idempotencyKey,
			name: request.batch.name,
			protocol,
			createdBy: `sampling-batch-op:${request.requestId}`,
			executionMode: "browser_runner",
		});
		return batch.id;
	},
	async addTasks(brandId, batchId, tasks) {
		await addDeliveryTasks({ brandId, batchId, tasks });
	},
	async freeze(brandId, batchId, requestId, measurementWindow) {
		await freezeDeliveryBatch({
			brandId,
			batchId,
			frozenBy: `sampling-batch-op:${requestId}`,
			measurementWindow,
		});
	},
	async start(brandId, batchId) {
		await startBrowserRunnerBatch({ brandId, batchId });
	},
	async requeueSafePreSubmitTransportFailures(brandId, batchId, expectedTaskCount) {
		await requeueBrowserRunnerSafePreSubmitTransportFailures({ brandId, batchId, expectedTaskCount });
	},
};

async function main(): Promise<void> {
	const options = parseSamplingBatchCliOptions(process.argv.slice(2));
	const request = await readSamplingBatchRequestFile(options.requestFile);
	const receipt = await executeSamplingBatchOperation(request, options.mode, gateway);
	process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

main().catch((error: unknown) => {
	const known = error instanceof SamplingBatchRequestError;
	process.stderr.write(
		`${JSON.stringify({
			ok: false,
			code: known ? error.code : "sampling_batch_operation_failed",
			message: known ? error.message : "The sampling batch operation failed",
		})}\n`,
	);
	process.exitCode = 1;
});
