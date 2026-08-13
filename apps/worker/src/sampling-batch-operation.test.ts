import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DeliveryProtocol } from "@workspace/lib/delivery-manifest";
import {
	assertExistingSamplingBatchMatches,
	buildSamplingTaskPlans,
	executeSamplingBatchOperation,
	type ResolvedSamplingBatchSnapshot,
	type SamplingBatchExistingState,
	type SamplingBatchOperationGateway,
} from "./sampling-batch-operation";
import { SamplingBatchRequestError } from "./sampling-batch-request";
import { validSamplingBatchManifest } from "./sampling-batch-test-fixture";

const snapshot: ResolvedSamplingBatchSnapshot = {
	brand: { id: "stepfun-brand", name: "StepFun" },
	scope: {
		id: "11111111-1111-4111-8111-111111111111",
		key: "cn-zh-scored",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		evaluationRole: "scored",
		automaticTargetKeys: [],
	},
	prompts: [
		{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", value: "国内有哪些主流大模型公司？" },
		{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", value: "如果我要选择国产大模型服务商,有哪些推荐？" },
		{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", value: "阶跃星辰 StepFun 是一家什么公司？" },
	],
};

const protocol: DeliveryProtocol = {
	measurementWindow: {
		startsAt: "2026-08-12T16:00:00.000Z",
		endsAt: "2026-08-20T15:59:59.000Z",
	},
	evidence: {
		minimumArtifacts: 2,
		requireSha256: true,
		requirePageUrl: true,
		allowedUriSchemes: ["http", "https"],
	},
	notes: "StepFun CN Doubao one-shot validation; 3 enabled prompts x 6 samples; no schedule.",
};

function exactExistingState(
	status: SamplingBatchExistingState["batch"]["status"] = "in_progress",
): SamplingBatchExistingState {
	const tasks = buildSamplingTaskPlans(validSamplingBatchManifest, snapshot);
	return {
		batch: {
			id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
			brandId: snapshot.brand.id,
			scopeId: snapshot.scope.id,
			idempotencyKey: validSamplingBatchManifest.batch.idempotencyKey,
			name: validSamplingBatchManifest.batch.name,
			status,
			executionMode: "browser_runner" as const,
			automationStatus: status === "frozen" ? ("not_started" as const) : ("running" as const),
			plannedTaskCount: 18,
			protocol,
			automationStartedAt: status === "frozen" ? null : new Date("2026-08-13T01:00:00.000Z"),
			frozenAt: new Date("2026-08-13T00:59:00.000Z"),
			completedAt: null,
		},
		tasks: tasks.map((task, index) => ({
			id: `task-${index + 1}`,
			brandId: snapshot.brand.id,
			scopeId: snapshot.scope.id,
			status: status === "completed" ? ("succeeded" as const) : ("available" as const),
			automationStatus: status === "completed" ? ("completed" as const) : ("queued" as const),
			promptId: task.promptId,
			promptText: task.expectedPromptText ?? "",
			surfaceTargetKey: task.surfaceTargetKey,
			captureRouteKey: task.captureRouteKey,
			sampleIndex: task.sampleIndex,
			sessionRequirement: task.sessionRequirement,
			searchRequirement: task.searchRequirement,
			evaluationRole: task.evaluationRole ?? "scored",
		})),
	} satisfies SamplingBatchExistingState;
}

function draftAfterCreateState(): SamplingBatchExistingState {
	const state = exactExistingState("frozen");
	state.batch.status = "draft";
	state.batch.automationStatus = "not_started";
	state.batch.plannedTaskCount = 0;
	state.batch.automationStartedAt = null;
	state.batch.frozenAt = null;
	state.tasks = [];
	return state;
}

function draftAfterAddState(): SamplingBatchExistingState {
	const state = exactExistingState("frozen");
	state.batch.status = "draft";
	state.batch.automationStatus = "not_started";
	state.batch.plannedTaskCount = 0;
	state.batch.automationStartedAt = null;
	state.batch.frozenAt = null;
	state.tasks = state.tasks.map((task) => ({ ...task, status: "planned" }));
	return state;
}

function cancelledAfterFreezeState(): SamplingBatchExistingState {
	const state = exactExistingState("frozen");
	state.batch.status = "cancelled";
	state.batch.automationStatus = "settled";
	state.tasks = state.tasks.map((task) => ({
		...task,
		status: "cancelled",
		automationStatus: "completed",
	}));
	return state;
}

class InMemoryGateway implements SamplingBatchOperationGateway {
	state: SamplingBatchExistingState | null;
	readonly mutations: string[] = [];
	now = new Date("2026-08-13T01:00:00.000Z");

	constructor(existing: SamplingBatchExistingState | null = null) {
		this.state = existing;
	}

	async resolveSnapshot() {
		return snapshot;
	}

	async findExistingBatch() {
		return this.state;
	}

	currentTime() {
		return this.now;
	}

	async createDraft() {
		this.mutations.push("create");
		this.state = exactExistingState("frozen");
		this.state.batch.status = "draft";
		this.state.batch.automationStatus = "not_started";
		this.state.batch.plannedTaskCount = 0;
		this.state.batch.frozenAt = null;
		this.state.tasks = [];
		return this.state.batch.id;
	}

	async addTasks(_brandId: string, _batchId: string, tasks: ReturnType<typeof buildSamplingTaskPlans>) {
		this.mutations.push("add-tasks");
		if (!this.state) throw new Error("missing state");
		this.state.tasks = tasks.map((task, index) => ({
			id: `task-${index + 1}`,
			brandId: snapshot.brand.id,
			scopeId: snapshot.scope.id,
			status: "planned",
			automationStatus: "queued",
			promptId: task.promptId,
			promptText: task.expectedPromptText ?? "",
			surfaceTargetKey: task.surfaceTargetKey,
			captureRouteKey: task.captureRouteKey,
			sampleIndex: task.sampleIndex,
			sessionRequirement: task.sessionRequirement,
			searchRequirement: task.searchRequirement,
			evaluationRole: task.evaluationRole ?? "scored",
		}));
	}

	async freeze(
		_brandId: string,
		_batchId: string,
		_requestId: string,
		_measurementWindow: DeliveryProtocol["measurementWindow"],
	) {
		this.mutations.push("freeze");
		if (!this.state) throw new Error("missing state");
		this.state.batch.status = "frozen";
		this.state.batch.plannedTaskCount = 18;
		this.state.batch.frozenAt = new Date("2026-08-13T00:59:00.000Z");
		this.state.tasks = this.state.tasks.map((task) => ({ ...task, status: "available" }));
	}

	async start() {
		this.mutations.push("start");
		if (!this.state) throw new Error("missing state");
		this.state.batch.status = "in_progress";
		this.state.batch.automationStatus = "running";
		this.state.batch.automationStartedAt = new Date("2026-08-13T01:00:00.000Z");
	}
}

class ConcurrentStartGateway extends InMemoryGateway {
	private startAttempts = 0;
	private releaseStarts: (() => void) | null = null;
	private readonly startsAligned = new Promise<void>((resolve) => {
		this.releaseStarts = resolve;
	});
	successfulStarts = 0;

	override async findExistingBatch() {
		return this.state ? structuredClone(this.state) : null;
	}

	override async start() {
		this.mutations.push("start");
		this.startAttempts++;
		if (this.startAttempts === 2) this.releaseStarts?.();
		await this.startsAligned;
		if (this.state?.batch.status !== "frozen") {
			throw new Error("The delivery batch is not ready to start");
		}
		this.successfulStarts++;
		this.state.batch.status = "in_progress";
		this.state.batch.automationStatus = "running";
		this.state.batch.automationStartedAt = new Date("2026-08-13T01:00:00.000Z");
	}
}

class WindowClosingFreezeGateway extends InMemoryGateway {
	override async freeze(
		_brandId: string,
		_batchId: string,
		_requestId: string,
		measurementWindow: DeliveryProtocol["measurementWindow"],
	) {
		this.mutations.push("freeze");
		this.now = new Date(protocol.measurementWindow.endsAt);
		if (this.now >= new Date(measurementWindow.endsAt)) {
			throw new Error("The delivery batch measurement window ended before freeze");
		}
		if (!this.state) throw new Error("missing state");
		this.state.batch.status = "frozen";
		this.state.batch.plannedTaskCount = 18;
		this.state.batch.frozenAt = this.now;
		this.state.tasks = this.state.tasks.map((task) => ({ ...task, status: "available" }));
	}
}

describe("StepFun sampling task plan", () => {
	it("freezes exactly six scored Doubao slots for each of the three enabled prompts", () => {
		const tasks = buildSamplingTaskPlans(validSamplingBatchManifest, snapshot);
		assert.equal(tasks.length, 18);
		for (const prompt of snapshot.prompts) {
			const promptTasks = tasks.filter((task) => task.promptId === prompt.id);
			assert.deepEqual(
				promptTasks.map((task) => task.sampleIndex),
				[1, 2, 3, 4, 5, 6],
			);
			assert.ok(promptTasks.every((task) => task.expectedPromptText === prompt.value));
		}
		assert.ok(
			tasks.every(
				(task) =>
					task.surfaceTargetKey === "doubao.consumer_web" &&
					task.captureRouteKey === "browser_runner.doubao" &&
					task.sessionRequirement === "dedicated_sampling_profile" &&
					task.searchRequirement === "platform_default" &&
					task.evaluationRole === "scored",
			),
		);
	});

	it("rejects any extra enabled prompt before creating task slots", () => {
		assert.throws(
			() =>
				buildSamplingTaskPlans(validSamplingBatchManifest, {
					...snapshot,
					prompts: [...snapshot.prompts, { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", value: "额外启用的提示词" }],
				}),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "prompt_snapshot_mismatch",
		);
	});
});

describe("StepFun sampling existing batch identity", () => {
	it("accepts only the exact 18-slot brand, scope, protocol, and prompt-text manifest", () => {
		assert.doesNotThrow(() =>
			assertExistingSamplingBatchMatches(validSamplingBatchManifest, snapshot, exactExistingState()),
		);
		const altered = exactExistingState();
		altered.tasks[0] = { ...altered.tasks[0], promptText: "被篡改的提示词" };
		assert.throws(
			() => assertExistingSamplingBatchMatches(validSamplingBatchManifest, snapshot, altered),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "existing_batch_conflict",
		);
		const alteredProtocol = exactExistingState();
		alteredProtocol.batch.protocol = {
			...protocol,
			measurementWindow: { ...protocol.measurementWindow, endsAt: "2026-08-21T15:59:59.000Z" },
		};
		assert.throws(
			() => assertExistingSamplingBatchMatches(validSamplingBatchManifest, snapshot, alteredProtocol),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "existing_batch_conflict",
		);
	});
});

describe("StepFun sampling one-shot operation", () => {
	it("does not mutate an existing fixed batch in any mode", async () => {
		for (const mode of ["dry-run", "apply", "status-only"] as const) {
			const gateway = new InMemoryGateway(exactExistingState());
			const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, mode, gateway);
			assert.equal(receipt.action, "existing_noop");
			assert.equal(receipt.batchId, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
			assert.deepEqual(gateway.mutations, []);
		}
	});

	it("does not mutate a settled fixed batch", async () => {
		const gateway = new InMemoryGateway(cancelledAfterFreezeState());
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway);
		assert.equal(receipt.action, "existing_noop");
		assert.equal(receipt.status, "cancelled");
		assert.deepEqual(gateway.mutations, []);
	});

	it("keeps dry-run read-only and reports the exact 18-slot plan", async () => {
		const gateway = new InMemoryGateway();
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "dry-run", gateway);
		assert.equal(receipt.action, "would_create_freeze_start");
		assert.equal(receipt.plannedTaskCount, 18);
		assert.equal(receipt.batchId, null);
		assert.deepEqual(gateway.mutations, []);
	});

	it("refuses an absent dry-run before the fixed measurement window starts", async () => {
		const gateway = new InMemoryGateway();
		gateway.now = new Date("2026-08-12T15:59:59.999Z");
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "dry-run", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "measurement_window_not_started",
		);
		assert.deepEqual(gateway.mutations, []);
	});

	it("refuses an absent dry-run when the fixed measurement window has ended", async () => {
		const gateway = new InMemoryGateway();
		gateway.now = new Date("2026-08-20T15:59:59.000Z");
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "dry-run", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "measurement_window_closed",
		);
		assert.deepEqual(gateway.mutations, []);
	});

	it("creates, freezes, and explicitly starts one batch only when apply is set", async () => {
		const gateway = new InMemoryGateway();
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway);
		assert.equal(receipt.action, "created_frozen_started");
		assert.equal(receipt.status, "in_progress");
		assert.equal(receipt.plannedTaskCount, 18);
		assert.deepEqual(gateway.mutations, ["create", "add-tasks", "freeze", "start"]);
	});

	it("resumes after draft creation without creating another batch", async () => {
		const gateway = new InMemoryGateway(draftAfterCreateState());
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway);
		assert.equal(receipt.action, "created_frozen_started");
		assert.equal(receipt.status, "in_progress");
		assert.deepEqual(gateway.mutations, ["add-tasks", "freeze", "start"]);
	});

	it("resumes after tasks were added without adding them again", async () => {
		const gateway = new InMemoryGateway(draftAfterAddState());
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway);
		assert.equal(receipt.action, "created_frozen_started");
		assert.equal(receipt.status, "in_progress");
		assert.deepEqual(gateway.mutations, ["freeze", "start"]);
	});

	it("resumes after freezing without freezing or adding tasks again", async () => {
		const gateway = new InMemoryGateway(exactExistingState("frozen"));
		const receipt = await executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway);
		assert.equal(receipt.action, "created_frozen_started");
		assert.equal(receipt.status, "in_progress");
		assert.deepEqual(gateway.mutations, ["start"]);
	});

	it("treats a concurrent successful start as an idempotent no-op", async () => {
		const gateway = new ConcurrentStartGateway(exactExistingState("frozen"));
		const receipts = await Promise.all([
			executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
			executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
		]);
		assert.deepEqual(receipts.map(({ action }) => action).sort(), ["created_frozen_started", "existing_noop"]);
		assert.equal(gateway.successfulStarts, 1);
		assert.equal(gateway.state?.batch.status, "in_progress");
	});

	it("does not freeze when the measurement window closes at the transaction boundary", async () => {
		const gateway = new WindowClosingFreezeGateway(draftAfterAddState());
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "measurement_window_closed",
		);
		assert.equal(gateway.state?.batch.status, "draft");
		assert.equal(gateway.state?.batch.frozenAt, null);
		assert.deepEqual(gateway.mutations, ["freeze"]);
	});

	it("refuses to resume a frozen batch after its measurement window closes", async () => {
		const gateway = new InMemoryGateway(exactExistingState("frozen"));
		gateway.now = new Date("2026-08-20T16:00:00.000Z");
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "measurement_window_closed",
		);
		assert.deepEqual(gateway.mutations, []);
	});

	it("fails closed when a resumable batch has an impossible task lifecycle state", async () => {
		const inconsistent = draftAfterAddState();
		inconsistent.tasks[0] = { ...inconsistent.tasks[0], status: "available" };
		const gateway = new InMemoryGateway(inconsistent);
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "existing_batch_conflict",
		);
		assert.deepEqual(gateway.mutations, []);
	});

	it("refuses apply outside the fixed measurement window before creating a draft", async () => {
		const gateway = new InMemoryGateway();
		gateway.now = new Date("2026-08-20T16:00:00.000Z");
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "apply", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "measurement_window_closed",
		);
		assert.deepEqual(gateway.mutations, []);
	});

	it("status-only refuses to create an absent batch", async () => {
		const gateway = new InMemoryGateway();
		await assert.rejects(
			() => executeSamplingBatchOperation(validSamplingBatchManifest, "status-only", gateway),
			(error: unknown) => error instanceof SamplingBatchRequestError && error.code === "batch_not_found",
		);
		assert.deepEqual(gateway.mutations, []);
	});
});
