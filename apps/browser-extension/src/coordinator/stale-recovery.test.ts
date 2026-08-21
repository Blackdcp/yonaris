import { describe, expect, test } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "../storage";
import { ExtensionCoordinator } from "./extension-coordinator";
import { fakeAdapter, fakeRunnerApi, fakeTabDriver } from "./test-fixture";

describe("ExtensionCoordinator stale recovery reconciliation", () => {
	test("reconciles every exact journal and does not claim past a manual resumable task", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		await storage.saveJournal({
			taskId: "manual-task",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "needs_human",
			interruptedPhase: "prepared",
			surfaceTargetKey: "doubao.consumer_web",
			tabId: 43,
			runnerSessionId: "session-manual",
			promptSha256: await sha256("Prompt B"),
			updatedAt: "2026-08-18T00:01:00.000Z",
		});
		await storage.saveJournal({
			taskId: "terminal-task",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "uploaded",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 42,
			runnerSessionId: "session-terminal",
			promptSha256: await sha256("Prompt A"),
			updatedAt: "2026-08-18T00:02:00.000Z",
		});

		let claimCalls = 0;
		let resumeCalls = 0;
		const reconciledTaskIds: string[] = [];
		const api = {
			...fakeRunnerApi([]),
			claimNext: async () => {
				claimCalls += 1;
				return null;
			},
			resume: async () => {
				resumeCalls += 1;
				throw new Error("terminal tasks must not be resumed");
			},
			reconcileTask: async (taskId: string) => {
				reconciledTaskIds.push(taskId);
				if (taskId === "terminal-task") {
					return {
						state: "terminal" as const,
						task: {
							taskId,
							batchId: "batch-1",
							brandId: "stepfun",
							surfaceTargetKey: "deepseek.consumer_web" as const,
							promptText: "Prompt A",
						},
						runnerSessionId: "session-terminal",
					};
				}
				return {
					state: "resumable_pre" as const,
					task: {
						taskId,
						batchId: "batch-1",
						brandId: "stepfun",
						surfaceTargetKey: "doubao.consumer_web" as const,
						promptText: "Prompt B",
					},
					runnerSessionId: null,
				};
			},
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();

		expect(resumeCalls).toBe(0);
		expect(reconciledTaskIds).toEqual(["manual-task", "terminal-task"]);
		expect(claimCalls).toBe(0);
		expect(await storage.loadJournal()).toEqual({
			"manual-task": expect.objectContaining({
				taskId: "manual-task",
				phase: "needs_human",
				interruptedPhase: "prepared",
			}),
		});
	});

	test.each(["active", "blocked"] as const)(
		"preserves an exact needs-human journal and does not claim when the Portal reports %s",
		async (state) => {
			const storage = await pairedStorageWithManualTask();
			let claimCalls = 0;
			let reconcileCalls = 0;
			const coordinator = new ExtensionCoordinator({
				storage,
				apiFactory: () => ({
					...fakeRunnerApi([]),
					claimNext: async () => {
						claimCalls += 1;
						return null;
					},
					resume: async () => {
						throw new Error("automatic recovery is forbidden");
					},
					reconcileTask: async () => {
						reconcileCalls += 1;
						return manualTaskReconciliation(state);
					},
				}),
				tabs: fakeTabDriver([], fakeAdapter([])),
				browserVersion: "Chrome/140",
			});

			await coordinator.runOnce();

			expect(reconcileCalls).toBe(1);
			expect(claimCalls).toBe(0);
			await expect(storage.loadJournal()).resolves.toMatchObject({
				"manual-task": { phase: "needs_human", interruptedPhase: "prepared" },
			});
		},
	);

	test.each(["terminal", "released"] as const)(
		"clears an exact needs-human journal and allows polling when the Portal reports %s",
		async (state) => {
			const storage = await pairedStorageWithManualTask();
			let claimCalls = 0;
			let resumeCalls = 0;
			const coordinator = new ExtensionCoordinator({
				storage,
				apiFactory: () => ({
					...fakeRunnerApi([]),
					claimNext: async () => {
						claimCalls += 1;
						return null;
					},
					resume: async () => {
						resumeCalls += 1;
						throw new Error("terminal or released tasks must not be resumed");
					},
					reconcileTask: async () => manualTaskReconciliation(state),
				}),
				tabs: fakeTabDriver([], fakeAdapter([])),
				browserVersion: "Chrome/140",
			});

			await coordinator.runOnce();

			expect(resumeCalls).toBe(0);
			expect(claimCalls).toBeGreaterThan(0);
			await expect(storage.loadJournal()).resolves.toEqual({});
		},
	);

	test("aligns a server-authoritative post-submit handoff but never resumes or claims automatically", async () => {
		const storage = await pairedStorageWithManualTask();
		let claimCalls = 0;
		let resumeCalls = 0;
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi([]),
				claimNext: async () => {
					claimCalls += 1;
					return null;
				},
				resume: async () => {
					resumeCalls += 1;
					throw new Error("manual recovery must be administrator-started");
				},
				reconcileTask: async () => manualTaskReconciliation("resumable_post", "session-manual"),
			}),
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();

		expect(resumeCalls).toBe(0);
		expect(claimCalls).toBe(0);
		await expect(storage.loadJournal()).resolves.toMatchObject({
			"manual-task": { phase: "needs_human", interruptedPhase: "submit_intent" },
		});
	});
});

async function pairedStorageWithManualTask(): Promise<DeviceStorage> {
	const storage = new DeviceStorage(memoryStorage());
	await storage.saveDevice({
		portalBaseUrl: "https://portal.yonaris.com",
		deviceId: "device-1",
		deviceToken: `yrd_${"a".repeat(43)}`,
		allowedBrandIds: ["stepfun"],
	});
	await storage.saveSurfaceReadiness({
		"doubao.consumer_web": {
			status: "ready",
			adapterVersion: "doubao-web-20260821-localpc-v10",
			activeConcurrency: 0,
		},
		"deepseek.consumer_web": {
			status: "unavailable",
			adapterVersion: "deepseek-web-20260821-localpc-v5",
			activeConcurrency: 0,
		},
	});
	await storage.saveJournal({
		taskId: "manual-task",
		batchId: "batch-1",
		brandId: "stepfun",
		phase: "needs_human",
		interruptedPhase: "prepared",
		surfaceTargetKey: "doubao.consumer_web",
		tabId: 43,
		runnerSessionId: "session-manual",
		promptSha256: await sha256("Prompt B"),
		updatedAt: "2026-08-18T00:01:00.000Z",
	});
	return storage;
}

function manualTaskReconciliation(
	state: "active" | "blocked" | "terminal" | "released" | "resumable_post",
	runnerSessionId: string | null = null,
) {
	return {
		state,
		task: {
			taskId: "manual-task",
			batchId: "batch-1",
			brandId: "stepfun",
			surfaceTargetKey: "doubao.consumer_web" as const,
			promptText: "Prompt B",
		},
		runnerSessionId,
	};
}

function memoryStorage(): ExtensionStorageArea {
	const values: Record<string, unknown> = {};
	return {
		get: async () => ({ ...values }),
		set: async (items) => {
			Object.assign(values, items);
		},
		remove: async (keys) => {
			for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
		},
	};
}

async function sha256(value: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
