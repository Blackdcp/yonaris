import { describe, expect, it } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "./storage";

function memoryStorage(initial: Record<string, unknown> = {}): ExtensionStorageArea {
	const values: Record<string, unknown> = { ...initial };
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

describe("DeviceStorage", () => {
	it("persists the paired device configuration in local extension storage", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});

		await expect(storage.loadDevice()).resolves.toMatchObject({ deviceId: "device-1", allowedBrandIds: ["stepfun"] });
	});

	it("keeps all seven candidate surfaces unavailable by default", async () => {
		const storage = new DeviceStorage(memoryStorage());

		await expect(storage.loadSurfaceReadiness()).resolves.toEqual({
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "unavailable",
				adapterVersion: "deepseek-web-20260822-localpc-v9",
				activeConcurrency: 0,
			},
			"qwen.consumer_web": {
				status: "unavailable",
				adapterVersion: "qwen-web-20260822-localpc-v10",
				activeConcurrency: 0,
			},
			"kimi.consumer_web": {
				status: "unavailable",
				adapterVersion: "kimi-web-20260823-localpc-v14",
				activeConcurrency: 0,
			},
			"wenxin.consumer_web": {
				status: "unavailable",
				adapterVersion: "wenxin-web-20260822-localpc-v12",
				activeConcurrency: 0,
			},
			"yuanbao.consumer_web": {
				status: "unavailable",
				adapterVersion: "yuanbao-web-20260822-localpc-v11",
				activeConcurrency: 0,
			},
			"zhipu.consumer_web": {
				status: "unavailable",
				adapterVersion: "zhipu-web-20260822-localpc-v5",
				activeConcurrency: 0,
			},
		});
		expect(await storage.dump()).toHaveProperty("browserRunnerSurfaceReadiness");
	});

	it("does not promote a qualified Doubao v7 state before v8 is activated", async () => {
		const storage = new DeviceStorage(
			memoryStorage({
				browserRunnerSurfaceReadiness: {
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-20260818-localpc-v7",
						activeConcurrency: 0,
					},
					"deepseek.consumer_web": {
						status: "unavailable",
						adapterVersion: "deepseek-web-20260822-localpc-v9",
						activeConcurrency: 0,
					},
				},
			}),
		);

		await expect(storage.loadSurfaceReadiness()).resolves.toMatchObject({
			"doubao.consumer_web": {
				status: "adapter_incompatible",
				adapterVersion: "doubao-web-20260821-localpc-v13",
			},
			"deepseek.consumer_web": {
				status: "unavailable",
				adapterVersion: "deepseek-web-20260822-localpc-v9",
			},
		});
	});

	it.each(["signed_out", "paused_by_risk_control", "unavailable", "adapter_incompatible"] as const)(
		"never promotes a Doubao v7 %s state while v8 is qualification-only",
		async (status) => {
			const storage = new DeviceStorage(
				memoryStorage({
					browserRunnerSurfaceReadiness: {
						"doubao.consumer_web": {
							status,
							adapterVersion: "doubao-web-20260818-localpc-v7",
							activeConcurrency: 0,
						},
					},
				}),
			);

			await expect(storage.loadSurfaceReadiness()).resolves.toMatchObject({
				"doubao.consumer_web": {
					status: "adapter_incompatible",
					adapterVersion: "doubao-web-20260821-localpc-v13",
				},
			});
		},
	);

	it("does not promote an older unqualified Doubao adapter during the v8 migration", async () => {
		const storage = new DeviceStorage(
			memoryStorage({
				browserRunnerSurfaceReadiness: {
					"doubao.consumer_web": {
						status: "ready",
						adapterVersion: "doubao-web-20260818-localpc-v6",
						activeConcurrency: 0,
					},
				},
			}),
		);

		await expect(storage.loadSurfaceReadiness()).resolves.toMatchObject({
			"doubao.consumer_web": {
				status: "adapter_incompatible",
				adapterVersion: "doubao-web-20260821-localpc-v13",
			},
		});
	});

	it("keeps an explicitly qualified surface ready only for its exact installed adapter version", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveSurfaceReadiness({
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "ready",
				adapterVersion: "deepseek-web-20260822-localpc-v9",
				activeConcurrency: 0,
			},
		});

		await expect(storage.loadSurfaceReadiness()).resolves.toMatchObject({
			"doubao.consumer_web": { status: "unavailable" },
			"deepseek.consumer_web": { status: "ready" },
		});

		await storage.saveSurfaceReadiness({
			"deepseek.consumer_web": {
				status: "ready",
				adapterVersion: "deepseek-web-stale",
				activeConcurrency: 0,
			},
		});
		await expect(storage.loadSurfaceReadiness()).resolves.toMatchObject({
			"deepseek.consumer_web": {
				status: "adapter_incompatible",
				adapterVersion: "deepseek-web-20260822-localpc-v9",
			},
		});
	});

	it("stores only task journal metadata and strips response content", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveJournal({
			taskId: "task-1",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "submitted",
			surfaceTargetKey: "doubao.consumer_web",
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
			updatedAt: "2026-08-16T00:00:00.000Z",
			answerText: "must never persist",
		} as never);

		const serialized = JSON.stringify(await storage.dump());
		expect(serialized).toContain("task-1");
		expect(serialized).not.toContain("must never persist");
		expect(serialized).not.toContain("answerText");
	});

	it("keeps every task when journal entries are saved concurrently", async () => {
		const storage = new DeviceStorage(memoryStorage());

		await Promise.all([
			storage.saveJournal({
				taskId: "task-1",
				batchId: "batch-1",
				brandId: "stepfun",
				phase: "submitted",
				surfaceTargetKey: "deepseek.consumer_web",
				tabId: 41,
				runnerSessionId: "session-1",
				promptSha256: "a".repeat(64),
				updatedAt: "2026-08-16T00:00:00.000Z",
			}),
			storage.saveJournal({
				taskId: "task-2",
				batchId: "batch-1",
				brandId: "stepfun",
				phase: "claimed",
				surfaceTargetKey: "doubao.consumer_web",
				tabId: 42,
				runnerSessionId: "session-2",
				promptSha256: "b".repeat(64),
				updatedAt: "2026-08-16T00:00:01.000Z",
			}),
		]);

		await expect(storage.loadJournal()).resolves.toMatchObject({
			"task-1": { phase: "submitted" },
			"task-2": { phase: "claimed" },
		});
	});

	it("does not resurrect a removed task while another task is saved", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveJournal({
			taskId: "task-1",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "submitted",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 41,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
			updatedAt: "2026-08-16T00:00:00.000Z",
		});

		await Promise.all([
			storage.removeJournal("task-1"),
			storage.saveJournal({
				taskId: "task-2",
				batchId: "batch-1",
				brandId: "stepfun",
				phase: "claimed",
				surfaceTargetKey: "doubao.consumer_web",
				tabId: 42,
				runnerSessionId: "session-2",
				promptSha256: "b".repeat(64),
				updatedAt: "2026-08-16T00:00:01.000Z",
			}),
		]);

		await expect(storage.loadJournal()).resolves.toEqual({
			"task-2": expect.objectContaining({ phase: "claimed" }),
		});
	});

	it("migrates a legacy post-submit journal without losing its recovery state", async () => {
		const legacyEntry = {
			taskId: "task-legacy",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "submitted" as const,
			surfaceTargetKey: "deepseek.consumer_web" as const,
			tabId: 41,
			runnerSessionId: "session-legacy",
			promptSha256: "c".repeat(64),
			updatedAt: "2026-08-16T00:00:00.000Z",
		};
		const storage = new DeviceStorage(memoryStorage({ browserRunnerJournal: { "task-legacy": legacyEntry } }));

		await expect(storage.loadJournal()).resolves.toEqual({ "task-legacy": legacyEntry });
		await expect(storage.dump()).resolves.toEqual({
			"browserRunnerJournal:task-legacy": legacyEntry,
		});
	});

	it("keeps a legacy post-submit boundary over a conflicting pre-submit entry", async () => {
		const submittedEntry = {
			taskId: "task-legacy",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "submitted" as const,
			surfaceTargetKey: "deepseek.consumer_web" as const,
			tabId: 41,
			runnerSessionId: "session-legacy",
			promptSha256: "c".repeat(64),
			updatedAt: "2026-08-16T00:00:00.000Z",
		};
		const storage = new DeviceStorage(
			memoryStorage({
				browserRunnerJournal: { "task-legacy": submittedEntry },
				"browserRunnerJournal:task-legacy": { ...submittedEntry, phase: "claimed" },
			}),
		);

		await expect(storage.loadJournal()).resolves.toMatchObject({
			"task-legacy": { phase: "submitted" },
		});
	});

	it("clears the device secret and journal on explicit disconnect", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.loadSurfaceReadiness();
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		await storage.saveJournal({
			taskId: "task-1",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "claimed",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: "a".repeat(64),
			updatedAt: "2026-08-16T00:00:00.000Z",
		});

		await storage.disconnect();
		expect(await storage.dump()).toEqual({});
	});
});
