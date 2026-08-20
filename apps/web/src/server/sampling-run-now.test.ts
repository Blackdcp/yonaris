import type { BrowserExtensionSurface } from "@workspace/lib/browser-extension-contract";
import { describe, expect, it, vi } from "vitest";
import {
	executeSamplingRunNow,
	type SamplingRunNowDependencies,
	withBrowserExtensionOverlapProtection,
} from "./sampling";

const input: {
	brandId: string;
	scopeId: string;
	surfaces: readonly BrowserExtensionSurface[];
	idempotencyKey: string;
} = {
	brandId: "stepfun",
	scopeId: "11111111-1111-4111-8111-111111111111",
	surfaces: ["doubao.consumer_web", "deepseek.consumer_web"] as const,
	idempotencyKey: "run-now-click-1",
};

describe("administrator Sampling Run now orchestration", () => {
	it("rejects a customer identity before reading or mutating batch state", async () => {
		const readScope = vi.fn();
		await expect(
			executeSamplingRunNow(input, {
				requirePlatformAdminBrand: async () => {
					throw new Error("Forbidden: Platform administrator access required");
				},
				readScope,
			}),
		).rejects.toThrow(/platform administrator/i);
		expect(readScope).not.toHaveBeenCalled();
	});

	it("creates, freezes, and starts one five-sample-per-channel batch without requiring an online device", async () => {
		const harness = runNowHarness();
		const result = await executeSamplingRunNow(input, harness.dependencies);

		expect(result.batch).toMatchObject({ status: "in_progress", automationStatus: "running" });
		expect(result.tasks).toHaveLength(20);
		expect(harness.createDraft).toHaveBeenCalledTimes(1);
		expect(harness.addTasks).toHaveBeenCalledTimes(1);
		expect(harness.freeze).toHaveBeenCalledTimes(1);
		expect(harness.start).toHaveBeenCalledTimes(1);
	});

	it("absorbs a concurrent start only after rereading the same running batch", async () => {
		const harness = runNowHarness({ concurrentStart: true });
		const result = await executeSamplingRunNow(input, harness.dependencies);

		expect(result.batch).toMatchObject({ status: "in_progress", automationStatus: "running" });
		expect(harness.start).toHaveBeenCalledTimes(1);
	});

	it("absorbs a concurrent add/freeze/start only after the exact manifest is visible", async () => {
		const harness = runNowHarness({ concurrentAdd: true });
		const result = await executeSamplingRunNow(input, harness.dependencies);

		expect(result.batch).toMatchObject({ status: "in_progress", automationStatus: "running" });
		expect(result.tasks).toHaveLength(20);
		expect(harness.addTasks).toHaveBeenCalledTimes(1);
		expect(harness.freeze).not.toHaveBeenCalled();
		expect(harness.start).not.toHaveBeenCalled();
	});

	it("returns an idempotent retry without rebuilding or restarting the existing batch", async () => {
		const harness = runNowHarness();
		await executeSamplingRunNow(input, harness.dependencies);
		harness.createDraft.mockClear();
		harness.addTasks.mockClear();
		harness.freeze.mockClear();
		harness.start.mockClear();

		const result = await executeSamplingRunNow(input, harness.dependencies);

		expect(result.batch).toMatchObject({ status: "in_progress", automationStatus: "running" });
		expect(harness.createDraft).not.toHaveBeenCalled();
		expect(harness.addTasks).not.toHaveBeenCalled();
		expect(harness.freeze).not.toHaveBeenCalled();
		expect(harness.start).not.toHaveBeenCalled();
	});

	it("rejects a new run when an active batch already contains a requested channel", async () => {
		const harness = runNowHarness();
		const findOverlappingActive = vi.fn(async () => ({
			id: "33333333-3333-4333-8333-333333333333",
			name: "Existing Doubao run",
			surfaceTargetKey: "doubao.consumer_web" as const,
		}));

		await expect(
			executeSamplingRunNow(input, {
				...harness.dependencies,
				findOverlappingActive,
			}),
		).rejects.toThrow(/active browser runner batch.*Existing Doubao run.*doubao/i);
		expect(harness.createDraft).not.toHaveBeenCalled();
	});

	it("fails closed when an idempotency key is retried with a changed Prompt manifest", async () => {
		const harness = runNowHarness();
		await executeSamplingRunNow(input, harness.dependencies);
		harness.setPrompts([
			{ id: "p1", value: "changed prompt one" },
			{ id: "p2", value: "prompt two" },
		]);

		await expect(executeSamplingRunNow(input, harness.dependencies)).rejects.toThrow(/another batch|another manifest/i);
	});
});

describe("Browser Extension batch overlap protection", () => {
	it("excludes an idempotent retry's own batch from overlap detection", async () => {
		const result = await withBrowserExtensionOverlapProtection(
			{
				brandId: input.brandId,
				scopeId: input.scopeId,
				surfaces: ["doubao.consumer_web"],
				idempotencyKey: "same-create-click",
			},
			async () => "existing manifest",
			{
				withLocks: async (_lockInput, operation) => operation(),
				findExistingBatchId: async () => "22222222-2222-4222-8222-222222222222",
				findOverlappingActive: async ({ excludeBatchId }) =>
					excludeBatchId === "22222222-2222-4222-8222-222222222222"
						? null
						: {
								id: "22222222-2222-4222-8222-222222222222",
								name: "This idempotent batch",
								surfaceTargetKey: "doubao.consumer_web",
							},
			},
		);

		expect(result).toBe("existing manifest");
	});

	it("serializes Create batch and Run now so only one overlapping batch is created", async () => {
		const withLocks = serialSurfaceLock();
		let activeBatch = false;
		const dependencies = {
			withLocks,
			findExistingBatchId: async () => null,
			findOverlappingActive: async () =>
				activeBatch
					? {
							id: "33333333-3333-4333-8333-333333333333",
							name: "First extension run",
							surfaceTargetKey: "doubao.consumer_web" as const,
						}
					: null,
		};
		const create = (idempotencyKey: string, surfaces: (typeof input.surfaces)[number][]) =>
			withBrowserExtensionOverlapProtection(
				{ brandId: input.brandId, scopeId: input.scopeId, surfaces, idempotencyKey },
				async () => {
					activeBatch = true;
					return idempotencyKey;
				},
				dependencies,
			);

		const results = await Promise.allSettled([
			create("create-batch-click", ["doubao.consumer_web", "deepseek.consumer_web"]),
			create("run-now-click", ["deepseek.consumer_web", "doubao.consumer_web"]),
		]);

		expect(results.map(({ status }) => status)).toEqual(["fulfilled", "rejected"]);
		expect(results[1]).toMatchObject({
			reason: expect.objectContaining({ message: expect.stringMatching(/active/i) }),
		});
	});
});

type OverlapProtectionInput = {
	brandId: string;
	scopeId: string;
	surfaces: readonly (typeof input.surfaces)[number][];
	idempotencyKey: string;
};

type OverlapProtectionDependencies = {
	withLocks: <T>(input: Omit<OverlapProtectionInput, "idempotencyKey">, operation: () => Promise<T>) => Promise<T>;
	findExistingBatchId: (input: { brandId: string; idempotencyKey: string }) => Promise<string | null>;
	findOverlappingActive: (
		input: Omit<OverlapProtectionInput, "idempotencyKey"> & { excludeBatchId?: string },
	) => Promise<{
		id: string;
		name: string;
		surfaceTargetKey: (typeof input.surfaces)[number];
	} | null>;
};

function serialSurfaceLock(): OverlapProtectionDependencies["withLocks"] {
	let tail = Promise.resolve();
	return async <T>(_input: Omit<OverlapProtectionInput, "idempotencyKey">, operation: () => Promise<T>) => {
		const previous = tail;
		let release: () => void = () => undefined;
		tail = new Promise<void>((resolve) => {
			release = resolve;
		});
		await previous;
		try {
			return await operation();
		} finally {
			release();
		}
	};
}

function runNowHarness(options: { concurrentAdd?: boolean; concurrentStart?: boolean } = {}) {
	let current: Awaited<ReturnType<SamplingRunNowDependencies["readBatch"]>> = null;
	let promptRows = [
		{ id: "p1", value: "prompt one" },
		{ id: "p2", value: "prompt two" },
	];
	const createDraft = vi.fn(async (request: Parameters<SamplingRunNowDependencies["createDraft"]>[0]) => {
		current = {
			batch: {
				id: "22222222-2222-4222-8222-222222222222",
				brandId: request.brandId,
				scopeId: request.scopeId,
				idempotencyKey: request.idempotencyKey,
				name: request.name,
				protocol: request.protocol,
				executionMode: "browser_runner",
				status: "draft",
				automationStatus: "not_started",
			},
			tasks: [],
		};
		return { id: current.batch.id };
	});
	const addTasks = vi.fn(async (request: Parameters<SamplingRunNowDependencies["addTasks"]>[0]) => {
		if (!current) throw new Error("missing batch");
		current.tasks = request.tasks.map((task, index) => ({
			...task,
			id: `task-${index}`,
			promptText: task.expectedPromptText ?? "",
			evaluationRole: task.evaluationRole ?? "scored",
		}));
		if (options.concurrentAdd) {
			current.batch.status = "in_progress";
			current.batch.automationStatus = "running";
			throw new Error("Delivery batch manifest was frozen concurrently");
		}
	});
	const freeze = vi.fn(async () => {
		if (!current) throw new Error("missing batch");
		current.batch.status = "frozen";
	});
	const start = vi.fn(async () => {
		if (!current) throw new Error("missing batch");
		current.batch.status = "in_progress";
		current.batch.automationStatus = "running";
		if (options.concurrentStart) throw new Error("The delivery batch is not ready to start");
	});
	const dependencies: SamplingRunNowDependencies = {
		requirePlatformAdminBrand: async () => ({ userId: "admin-1", brandId: "stepfun" }),
		assertFeatureEnabled: () => undefined,
		readScope: async () => ({
			id: input.scopeId,
			brandId: input.brandId,
			name: "China · Simplified Chinese · Scored",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			enabled: true,
			automaticTargetKeys: [],
			samplingEvaluationRole: "scored",
		}),
		listEnabledPrompts: async () => promptRows,
		findExisting: async () => current,
		findOverlappingActive: async () => null,
		createDraft,
		readBatch: async () => current,
		addTasks,
		freeze,
		start,
		now: () => new Date("2026-08-16T08:00:00.000Z"),
	};
	return {
		dependencies,
		createDraft,
		addTasks,
		freeze,
		start,
		setPrompts: (next: typeof promptRows) => {
			promptRows = next;
		},
	};
}
