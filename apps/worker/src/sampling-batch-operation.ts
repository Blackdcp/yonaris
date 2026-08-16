import {
	isSafePreSubmitBrokerTransportRecoveryCandidate,
	isSafePreSubmitDedicatedProfileBusyRecoveryCandidate,
} from "@workspace/lib/browser-runner-policy";
import type { DeliveryTaskPlanInput } from "@workspace/lib/db/delivery-batches";
import {
	DEFAULT_DELIVERY_EVIDENCE_POLICY,
	type DeliveryProtocol,
	normalizeDeliveryProtocol,
} from "@workspace/lib/delivery-manifest";
import {
	EXPECTED_STEPFUN_PROMPTS,
	type SamplingBatchCliMode,
	type SamplingBatchRequest,
	SamplingBatchRequestError,
} from "./sampling-batch-request";

export type ResolvedSamplingBatchSnapshot = {
	brand: { id: string; name: string };
	scope: {
		id: string;
		key: string;
		market: string;
		locale: string;
		timezone: string;
		evaluationRole: string | null;
		automaticTargetKeys: string[] | null;
	};
	prompts: Array<{ id: string; value: string }>;
};

export type SamplingBatchTaskState = {
	id: string;
	brandId: string;
	scopeId: string;
	status: "planned" | "available" | "claimed" | "succeeded" | "failed" | "cancelled";
	automationStatus: "queued" | "running" | "needs_human" | "completed" | null;
	promptId: string;
	promptText: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	sampleIndex: number;
	sessionRequirement: string;
	searchRequirement: string;
	evaluationRole: string;
	automationAttemptCount: number;
	claimCount: number;
	submitIntentAt: Date | null;
	submitConfirmedAt: Date | null;
	observationAttemptId: string | null;
	needsHumanCode: string | null;
	lastErrorCode: string | null;
};

export type SamplingBatchExistingState = {
	batch: {
		id: string;
		brandId: string;
		scopeId: string;
		idempotencyKey: string;
		name: string;
		status: "draft" | "frozen" | "in_progress" | "completed" | "cancelled";
		executionMode: "manual" | "browser_runner";
		automationStatus: "not_started" | "running" | "needs_human" | "settled" | null;
		plannedTaskCount: number;
		protocol: unknown;
		automationStartedAt: Date | null;
		frozenAt: Date | null;
		completedAt: Date | null;
	};
	tasks: SamplingBatchTaskState[];
};

export type SamplingBatchOperationGateway = {
	resolveSnapshot(request: SamplingBatchRequest): Promise<ResolvedSamplingBatchSnapshot>;
	findExistingBatch(brandId: string, idempotencyKey: string): Promise<SamplingBatchExistingState | null>;
	currentTime(): Date;
	createDraft(input: {
		request: SamplingBatchRequest;
		snapshot: ResolvedSamplingBatchSnapshot;
		protocol: DeliveryProtocol;
	}): Promise<string>;
	addTasks(brandId: string, batchId: string, tasks: DeliveryTaskPlanInput[]): Promise<void>;
	freeze(
		brandId: string,
		batchId: string,
		requestId: string,
		measurementWindow: DeliveryProtocol["measurementWindow"],
	): Promise<void>;
	start(brandId: string, batchId: string): Promise<void>;
	requeueSafePreSubmitTransportFailures(brandId: string, batchId: string, expectedTaskCount: number): Promise<void>;
	requeueDedicatedProfileBusyTasks(
		brandId: string,
		batchId: string,
		expectedTaskCount: number,
		expectedRequeueCount: number,
	): Promise<void>;
};

export type SamplingBatchOperationReceipt = {
	ok: true;
	requestId: string;
	idempotencyKey: string;
	action:
		| "would_create_freeze_start"
		| "created_frozen_started"
		| "would_requeue_safe_pre_submit"
		| "requeued_safe_pre_submit"
		| "would_requeue_dedicated_profile_busy"
		| "requeued_dedicated_profile_busy"
		| "existing_noop";
	batchId: string | null;
	brandId: string;
	brandName: string;
	scopeId: string;
	scopeKey: string;
	status: SamplingBatchExistingState["batch"]["status"] | "absent";
	automationStatus: SamplingBatchExistingState["batch"]["automationStatus"];
	plannedTaskCount: number;
	succeededTaskCount: number;
	failedTaskCount: number;
	measurementWindow: DeliveryProtocol["measurementWindow"];
	timezone: "Asia/Shanghai";
};

export function buildSamplingBatchProtocol(request: SamplingBatchRequest): DeliveryProtocol {
	return normalizeDeliveryProtocol({
		measurementWindow: {
			startsAt: request.measurementWindow.startsAt,
			endsAt: request.measurementWindow.endsAt,
		},
		evidence: { ...DEFAULT_DELIVERY_EVIDENCE_POLICY, minimumArtifacts: 2 },
		notes: "StepFun CN Doubao one-shot validation; 3 enabled prompts x 6 samples; no schedule.",
	});
}

export function assertResolvedSamplingBatchSnapshot(
	request: SamplingBatchRequest,
	snapshot: ResolvedSamplingBatchSnapshot,
): void {
	if (snapshot.brand.name !== request.brand.nameExact || !snapshot.brand.id.trim()) {
		throw new SamplingBatchRequestError("brand_snapshot_mismatch", "The enabled StepFun brand did not resolve exactly");
	}
	if (
		!snapshot.scope.id.trim() ||
		snapshot.scope.key !== request.scope.keyExact ||
		snapshot.scope.market !== request.scope.marketExact ||
		snapshot.scope.locale !== request.scope.localeExact ||
		snapshot.scope.timezone !== request.scope.timezoneExact ||
		snapshot.scope.evaluationRole !== request.scope.evaluationRoleExact ||
		!Array.isArray(snapshot.scope.automaticTargetKeys) ||
		snapshot.scope.automaticTargetKeys.length !== 0
	) {
		throw new SamplingBatchRequestError(
			"scope_snapshot_mismatch",
			"The enabled StepFun CN scored scope did not resolve exactly",
		);
	}
	if (
		snapshot.prompts.length !== request.promptSelection.enabledCountExact ||
		new Set(snapshot.prompts.map(({ id }) => id)).size !== snapshot.prompts.length ||
		new Set(snapshot.prompts.map(({ value }) => value)).size !== snapshot.prompts.length
	) {
		throw new SamplingBatchRequestError(
			"prompt_snapshot_mismatch",
			"The enabled prompt count or identity does not match the reviewed manifest",
		);
	}
	const actualTexts = snapshot.prompts.map(({ value }) => canonicalReviewedPromptText(value)).sort();
	const expectedTexts = [...EXPECTED_STEPFUN_PROMPTS].map((value) => canonicalReviewedPromptText(value)).sort();
	if (!actualTexts.every((value, index) => value === expectedTexts[index])) {
		throw new SamplingBatchRequestError(
			"prompt_snapshot_mismatch",
			"The enabled prompt texts do not match the reviewed manifest",
		);
	}
}

export function buildSamplingTaskPlans(
	request: SamplingBatchRequest,
	snapshot: ResolvedSamplingBatchSnapshot,
): DeliveryTaskPlanInput[] {
	assertResolvedSamplingBatchSnapshot(request, snapshot);
	const promptByText = new Map(snapshot.prompts.map((prompt) => [canonicalReviewedPromptText(prompt.value), prompt]));
	const tasks: DeliveryTaskPlanInput[] = [];
	for (const promptText of EXPECTED_STEPFUN_PROMPTS) {
		const prompt = promptByText.get(canonicalReviewedPromptText(promptText));
		if (!prompt) {
			throw new SamplingBatchRequestError("prompt_snapshot_mismatch", "A reviewed prompt could not be resolved");
		}
		for (let sampleIndex = 1; sampleIndex <= request.execution.samplesPerPrompt; sampleIndex++) {
			tasks.push({
				promptId: prompt.id,
				expectedPromptText: prompt.value,
				surfaceTargetKey: request.execution.surfaceTargetKey,
				captureRouteKey: request.execution.captureRouteKey,
				sampleIndex,
				sessionRequirement: request.execution.sessionRequirement,
				searchRequirement: request.execution.searchRequirement,
				evaluationRole: request.scope.evaluationRoleExact,
			});
		}
	}
	return tasks;
}

function canonicalTask(
	task: Pick<
		SamplingBatchTaskState,
		| "brandId"
		| "scopeId"
		| "promptId"
		| "promptText"
		| "surfaceTargetKey"
		| "captureRouteKey"
		| "sampleIndex"
		| "sessionRequirement"
		| "searchRequirement"
		| "evaluationRole"
	>,
): string {
	return JSON.stringify({
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
	});
}

function canonicalReviewedPromptText(value: string): string {
	return value.normalize("NFKC");
}

type SamplingBatchRecoveryStep =
	| "add_tasks"
	| "freeze"
	| "start"
	| "requeue_safe_pre_submit"
	| "requeue_dedicated_profile_busy"
	| "none";

function existingBatchConflict(): never {
	throw new SamplingBatchRequestError(
		"existing_batch_conflict",
		"The fixed idempotency key already belongs to a different or incomplete batch manifest",
	);
}

function taskLifecycleMatches(
	task: SamplingBatchTaskState,
	allowed: ReadonlyArray<readonly [SamplingBatchTaskState["status"], SamplingBatchTaskState["automationStatus"]]>,
): boolean {
	return allowed.some(
		([status, automationStatus]) => task.status === status && task.automationStatus === automationStatus,
	);
}

function recoveryStepForExistingSamplingBatch(
	request: SamplingBatchRequest,
	snapshot: ResolvedSamplingBatchSnapshot,
	existing: SamplingBatchExistingState,
): SamplingBatchRecoveryStep {
	const expectedProtocol = buildSamplingBatchProtocol(request);
	const expectedTasks = buildSamplingTaskPlans(request, snapshot).map((task) =>
		canonicalTask({
			brandId: snapshot.brand.id,
			scopeId: snapshot.scope.id,
			promptId: task.promptId,
			promptText: task.expectedPromptText ?? "",
			surfaceTargetKey: task.surfaceTargetKey,
			captureRouteKey: task.captureRouteKey,
			sampleIndex: task.sampleIndex,
			sessionRequirement: task.sessionRequirement,
			searchRequirement: task.searchRequirement,
			evaluationRole: task.evaluationRole ?? "scored",
		}),
	);
	let actualProtocol: DeliveryProtocol;
	try {
		actualProtocol = normalizeDeliveryProtocol(existing.batch.protocol as DeliveryProtocol);
	} catch {
		return existingBatchConflict();
	}
	if (
		existing.batch.brandId !== snapshot.brand.id ||
		existing.batch.scopeId !== snapshot.scope.id ||
		existing.batch.idempotencyKey !== request.batch.idempotencyKey ||
		existing.batch.name !== request.batch.name ||
		existing.batch.executionMode !== request.execution.mode ||
		JSON.stringify(actualProtocol) !== JSON.stringify(expectedProtocol)
	) {
		return existingBatchConflict();
	}

	const actualTasks = existing.tasks.map((task) => canonicalTask(task));
	const expectedTaskSet = new Set(expectedTasks);
	const actualTaskSet = new Set(actualTasks);
	const exactTaskManifest =
		actualTasks.length === expectedTasks.length &&
		actualTaskSet.size === expectedTaskSet.size &&
		[...expectedTaskSet].every((task) => actualTaskSet.has(task));
	const noCompletion = existing.batch.completedAt === null;
	const notStarted = existing.batch.automationStartedAt === null;
	const notFrozen = existing.batch.frozenAt === null;
	const windowStartsAt = new Date(expectedProtocol.measurementWindow.startsAt);
	const windowEndsAt = new Date(expectedProtocol.measurementWindow.endsAt);
	const frozenWithinWindow =
		existing.batch.frozenAt !== null &&
		existing.batch.frozenAt >= windowStartsAt &&
		existing.batch.frozenAt < windowEndsAt;

	if (existing.batch.status === "draft") {
		if (
			existing.batch.automationStatus !== "not_started" ||
			existing.batch.plannedTaskCount !== 0 ||
			!notStarted ||
			!notFrozen ||
			!noCompletion
		) {
			return existingBatchConflict();
		}
		if (existing.tasks.length === 0) return "add_tasks";
		if (exactTaskManifest && existing.tasks.every((task) => taskLifecycleMatches(task, [["planned", "queued"]]))) {
			return "freeze";
		}
		return existingBatchConflict();
	}

	if (!exactTaskManifest || existing.batch.plannedTaskCount !== expectedTasks.length || !frozenWithinWindow) {
		return existingBatchConflict();
	}
	if (existing.batch.status === "frozen") {
		if (
			existing.batch.automationStatus === "not_started" &&
			notStarted &&
			noCompletion &&
			existing.tasks.every((task) => taskLifecycleMatches(task, [["available", "queued"]]))
		) {
			return "start";
		}
		return existingBatchConflict();
	}
	if (existing.batch.status === "in_progress") {
		const tasksMatchActiveLifecycle = existing.tasks.every((task) =>
			taskLifecycleMatches(task, [
				["available", "queued"],
				["claimed", "running"],
				["available", "needs_human"],
				["succeeded", "completed"],
				["failed", "completed"],
			]),
		);
		const derivedAutomationStatus = existing.tasks.some(
			({ automationStatus }) => automationStatus === "queued" || automationStatus === "running",
		)
			? "running"
			: existing.tasks.some(({ automationStatus }) => automationStatus === "needs_human")
				? "needs_human"
				: "settled";
		if (
			tasksMatchActiveLifecycle &&
			existing.batch.automationStartedAt !== null &&
			noCompletion &&
			existing.batch.automationStatus === derivedAutomationStatus &&
			derivedAutomationStatus !== "settled"
		) {
			if (
				derivedAutomationStatus === "needs_human" &&
				existing.tasks.length === expectedTasks.length &&
				existing.tasks.every((task) =>
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
				return "requeue_safe_pre_submit";
			}
			const succeededTasks = existing.tasks.filter(
				(task) =>
					task.status === "succeeded" &&
					task.automationStatus === "completed" &&
					task.submitIntentAt !== null &&
					task.submitConfirmedAt !== null &&
					task.observationAttemptId !== null,
			);
			const dedicatedProfileBusyTasks = existing.tasks.filter((task) =>
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
				derivedAutomationStatus === "needs_human" &&
				existing.tasks.length === expectedTasks.length &&
				succeededTasks.length === 1 &&
				dedicatedProfileBusyTasks.length === expectedTasks.length - 1
			) {
				return "requeue_dedicated_profile_busy";
			}
			return "none";
		}
		return existingBatchConflict();
	}
	if (
		(existing.batch.status === "completed" || existing.batch.status === "cancelled") &&
		existing.batch.automationStatus === "settled" &&
		(existing.batch.status === "cancelled" || existing.batch.automationStartedAt !== null) &&
		(existing.batch.status === "cancelled" || existing.batch.completedAt !== null) &&
		existing.tasks.every((task) =>
			taskLifecycleMatches(task, [
				["succeeded", "completed"],
				["failed", "completed"],
				["cancelled", "completed"],
			]),
		)
	) {
		return "none";
	}
	return existingBatchConflict();
}

export function assertExistingSamplingBatchMatches(
	request: SamplingBatchRequest,
	snapshot: ResolvedSamplingBatchSnapshot,
	existing: SamplingBatchExistingState,
): void {
	recoveryStepForExistingSamplingBatch(request, snapshot, existing);
}

function assertMeasurementWindowOpen(protocol: DeliveryProtocol, now: Date): void {
	if (now < new Date(protocol.measurementWindow.startsAt)) {
		throw new SamplingBatchRequestError(
			"measurement_window_not_started",
			"The fixed measurement window has not started; the batch cannot be created or resumed",
		);
	}
	if (now >= new Date(protocol.measurementWindow.endsAt)) {
		throw new SamplingBatchRequestError(
			"measurement_window_closed",
			"The fixed measurement window has ended; the batch cannot be created or resumed",
		);
	}
}

function receiptForState(
	request: SamplingBatchRequest,
	snapshot: ResolvedSamplingBatchSnapshot,
	action: SamplingBatchOperationReceipt["action"],
	existing: SamplingBatchExistingState | null,
): SamplingBatchOperationReceipt {
	const protocol = buildSamplingBatchProtocol(request);
	return {
		ok: true,
		requestId: request.requestId,
		idempotencyKey: request.batch.idempotencyKey,
		action,
		batchId: existing?.batch.id ?? null,
		brandId: snapshot.brand.id,
		brandName: snapshot.brand.name,
		scopeId: snapshot.scope.id,
		scopeKey: snapshot.scope.key,
		status: existing?.batch.status ?? "absent",
		automationStatus: existing?.batch.automationStatus ?? null,
		plannedTaskCount:
			existing?.tasks.length ?? request.promptSelection.enabledCountExact * request.execution.samplesPerPrompt,
		succeededTaskCount: existing?.tasks.filter(({ status }) => status === "succeeded").length ?? 0,
		failedTaskCount: existing?.tasks.filter(({ status }) => status === "failed").length ?? 0,
		measurementWindow: protocol.measurementWindow,
		timezone: request.measurementWindow.timezone,
	};
}

export async function executeSamplingBatchOperation(
	request: SamplingBatchRequest,
	mode: SamplingBatchCliMode,
	gateway: SamplingBatchOperationGateway,
): Promise<SamplingBatchOperationReceipt> {
	const snapshot = await gateway.resolveSnapshot(request);
	assertResolvedSamplingBatchSnapshot(request, snapshot);
	let existing = await gateway.findExistingBatch(snapshot.brand.id, request.batch.idempotencyKey);
	if (mode === "status-only") {
		if (existing) {
			assertExistingSamplingBatchMatches(request, snapshot, existing);
			return receiptForState(request, snapshot, "existing_noop", existing);
		}
		throw new SamplingBatchRequestError(
			"batch_not_found",
			"The fixed batch is absent; status-only mode will not create it",
		);
	}
	const protocol = buildSamplingBatchProtocol(request);
	if (mode === "dry-run") {
		if (existing) {
			const recoveryStep = recoveryStepForExistingSamplingBatch(request, snapshot, existing);
			const action =
				recoveryStep === "requeue_safe_pre_submit"
					? "would_requeue_safe_pre_submit"
					: recoveryStep === "requeue_dedicated_profile_busy"
						? "would_requeue_dedicated_profile_busy"
						: "existing_noop";
			return receiptForState(request, snapshot, action, existing);
		}
		assertMeasurementWindowOpen(protocol, gateway.currentTime());
		buildSamplingTaskPlans(request, snapshot);
		return receiptForState(request, snapshot, "would_create_freeze_start", null);
	}

	const tasks = buildSamplingTaskPlans(request, snapshot);
	let batchId = existing?.batch.id ?? null;
	let mutated = false;
	let requeuedSafePreSubmit = false;
	let requeuedDedicatedProfileBusy = false;
	for (;;) {
		if (!existing) {
			assertMeasurementWindowOpen(protocol, gateway.currentTime());
			batchId = await gateway.createDraft({ request, snapshot, protocol });
			mutated = true;
		} else {
			const recoveryStep = recoveryStepForExistingSamplingBatch(request, snapshot, existing);
			if (recoveryStep === "none") {
				return receiptForState(
					request,
					snapshot,
					requeuedDedicatedProfileBusy
						? "requeued_dedicated_profile_busy"
						: requeuedSafePreSubmit
							? "requeued_safe_pre_submit"
							: mutated
								? "created_frozen_started"
								: "existing_noop",
					existing,
				);
			}
			assertMeasurementWindowOpen(protocol, gateway.currentTime());
			try {
				if (recoveryStep === "add_tasks") {
					await gateway.addTasks(snapshot.brand.id, existing.batch.id, tasks);
				} else if (recoveryStep === "freeze") {
					await gateway.freeze(snapshot.brand.id, existing.batch.id, request.requestId, protocol.measurementWindow);
				} else if (recoveryStep === "start") {
					await gateway.start(snapshot.brand.id, existing.batch.id);
				} else if (recoveryStep === "requeue_safe_pre_submit") {
					await gateway.requeueSafePreSubmitTransportFailures(snapshot.brand.id, existing.batch.id, tasks.length);
					requeuedSafePreSubmit = true;
				} else {
					await gateway.requeueDedicatedProfileBusyTasks(
						snapshot.brand.id,
						existing.batch.id,
						tasks.length,
						tasks.length - 1,
					);
					requeuedDedicatedProfileBusy = true;
				}
			} catch (error) {
				const concurrent = await gateway.findExistingBatch(snapshot.brand.id, request.batch.idempotencyKey);
				if (!concurrent || concurrent.batch.id !== batchId) throw error;
				const concurrentStep = recoveryStepForExistingSamplingBatch(request, snapshot, concurrent);
				if (concurrentStep === recoveryStep) {
					if (recoveryStep === "freeze") assertMeasurementWindowOpen(protocol, gateway.currentTime());
					throw error;
				}
				existing = concurrent;
				continue;
			}
			mutated = true;
		}
		existing = await gateway.findExistingBatch(snapshot.brand.id, request.batch.idempotencyKey);
		if (!existing || existing.batch.id !== batchId) {
			throw new SamplingBatchRequestError(
				"batch_completion_unverified",
				"The batch could not be resolved by its fixed identity after a recovery step",
			);
		}
	}
}
