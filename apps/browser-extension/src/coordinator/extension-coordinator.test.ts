import { describe, expect, test } from "vitest";
import { DeviceStorage, type ExtensionStorageArea } from "../storage";
import { ExtensionCoordinator } from "./extension-coordinator";
import { DurableTaskJournal } from "./journal";
import { claimedTask, fakeAdapter, fakeRunnerApi, fakeTabDriver } from "./test-fixture";

describe("ExtensionCoordinator", () => {
	test("polls every paired brand only on locally ready channels", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun", "customer-2"],
		});
		const claims: string[] = [];
		const api = {
			...fakeRunnerApi([]),
			claimNext: async (brandId: string, surface: string) => {
				claims.push(`${brandId}:${surface}`);
				if (surface === "deepseek.consumer_web") throw new Error("Unavailable DeepSeek must not be polled");
				return null;
			},
			resume: async () => claimedTask(),
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		const result = await coordinator.runOnce();
		expect(new Set(claims)).toEqual(new Set(["stepfun:doubao.consumer_web", "customer-2:doubao.consumer_web"]));
		expect(result?.bySurface["deepseek.consumer_web"].incomplete).toBe(0);
	});

	test("polls an explicitly qualified DeepSeek surface without claiming unavailable Doubao", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		await storage.saveSurfaceReadiness({
			"doubao.consumer_web": {
				status: "unavailable",
				adapterVersion: "doubao-web-20260818-localpc-v7",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "ready",
				adapterVersion: "deepseek-web-20260814-uat1",
				activeConcurrency: 0,
			},
		});
		const claims: string[] = [];
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi([]),
				claimNext: async (brandId, surface) => {
					claims.push(`${brandId}:${surface}`);
					return null;
				},
				resume: async () => claimedTask(),
			}),
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		const summary = await coordinator.runOnce();

		expect(claims).toEqual(["stepfun:deepseek.consumer_web"]);
		expect(summary?.bySurface["doubao.consumer_web"].incomplete).toBe(0);
		expect(summary?.bySurface["deepseek.consumer_web"].incomplete).toBe(0);
	});

	test("moves an already-submitted task to exact manual recovery without resuming or claiming", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "submit_intent");
		let claimCalls = 0;
		let resumeCalls = 0;
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => {
				claimCalls += 1;
				return null;
			},
			resume: async () => {
				resumeCalls += 1;
				return claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" });
			},
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();
		expect(resumeCalls).toBe(0);
		expect(claimCalls).toBe(0);
		expect(events).not.toContain("adapter:submit");
		expect(events).not.toContain("adapter:resume");
		expect(events).not.toContain("api:complete");
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "submit_intent" },
		});
	});

	test("reconciles an existing needs-human post-submit task before polling without resuming it", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "submit_intent");
		await journal.advance("task-1", "needs_human");
		let claimCalls = 0;
		let resumeCalls = 0;
		const api = {
			...fakeRunnerApi([]),
			claimNext: async () => {
				claimCalls += 1;
				return null;
			},
			resume: async () => {
				resumeCalls += 1;
				return claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" });
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
		expect(claimCalls).toBe(0);
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "submit_intent" },
		});
	});

	test("reconciles all resumable post-submit journals into manual recovery without auto-resume", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		for (const [taskId, tabId] of [
			["task-1", 42],
			["task-2", 43],
		] as const) {
			await journal.start(claimedTask({ taskId }), {
				tabId,
				runnerSessionId: `session-${taskId}`,
				promptSha256: await sha256(`Prompt ${taskId}`),
			});
			await journal.advance(taskId, "submit_intent");
		}
		const resumeTaskIds: string[] = [];
		const reconciledTaskIds: string[] = [];
		let claimCalls = 0;
		const api = {
			...fakeRunnerApi([]),
			claimNext: async () => {
				claimCalls += 1;
				return null;
			},
			resume: async (taskId: string) => {
				resumeTaskIds.push(taskId);
				throw new Error("Portal unavailable");
			},
			reconcileTask: async (taskId: string) => {
				reconciledTaskIds.push(taskId);
				return {
					state: "resumable_post" as const,
					task: {
						...reconciliationTask(),
						taskId,
						promptText: `Prompt ${taskId}`,
					},
					runnerSessionId: `session-${taskId}`,
				};
			},
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		const summary = await coordinator.runOnce();

		expect(reconciledTaskIds).toEqual(["task-1", "task-2"]);
		expect(resumeTaskIds).toHaveLength(0);
		expect(summary).toMatchObject({ recovered: 0, recoveryIncomplete: 0 });
		expect(claimCalls).toBe(0);
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "submit_intent" },
			"task-2": { phase: "needs_human", interruptedPhase: "submit_intent" },
		});
	});

	test("does not automatically resume a journal entry that already needs human review", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "needs_human");
		let resumeCalls = 0;
		const api = {
			...fakeRunnerApi([]),
			claimNext: async () => null,
			resume: async () => {
				resumeCalls += 1;
				return claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" });
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
		expect((await journal.entries())["task-1"]?.phase).toBe("needs_human");
	});

	test.each(["claimed", "prepared"] as const)(
		"reconciles a crash-window %s journal into an exact pre-submit handoff before polling",
		async (phase) => {
			const events: string[] = [];
			const storage = new DeviceStorage(memoryStorage());
			await storage.saveDevice({
				portalBaseUrl: "https://portal.yonaris.com",
				deviceId: "device-1",
				deviceToken: `yrd_${"a".repeat(43)}`,
				allowedBrandIds: ["stepfun"],
			});
			const journal = new DurableTaskJournal(storage);
			await journal.start(claimedTask(), {
				tabId: 42,
				runnerSessionId: "session-1",
				promptSha256: await sha256("Prompt A"),
			});
			if (phase === "prepared") await journal.advance("task-1", "prepared");
			const coordinator = new ExtensionCoordinator({
				storage,
				apiFactory: () => ({
					...fakeRunnerApi(events),
					claimNext: async () => {
						events.push("api:claim");
						return null;
					},
					resume: async () => claimedTask(),
					reconcileTask: async () => {
						events.push("api:reconcile:task-1");
						return {
							state: "resumable_pre" as const,
							task: reconciliationTask(),
							runnerSessionId: null,
						};
					},
				}),
				tabs: fakeTabDriver(events, fakeAdapter(events)),
				browserVersion: "Chrome/140",
			});

			await coordinator.runOnce();

			expect(events).toContain("api:reconcile:task-1");
			expect(events).not.toContain("api:claim");
			await expect(journal.entries()).resolves.toMatchObject({
				"task-1": { phase: "needs_human", interruptedPhase: phase, tabId: 42 },
			});
		},
	);

	test("does not poll while an exact local task still has an active server lease", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi(events),
				claimNext: async () => {
					events.push("api:claim");
					return null;
				},
				resume: async () => claimedTask(),
				reconcileTask: async () => ({
					state: "active" as const,
					task: reconciliationTask(),
					runnerSessionId: null,
				}),
			}),
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();

		expect(events).not.toContain("api:claim");
		await expect(journal.entries()).resolves.toMatchObject({ "task-1": { phase: "claimed" } });
	});

	test("does not poll or discard the exact local journal when reconciliation is unavailable", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi(events),
				claimNext: async () => {
					events.push("api:claim");
					return null;
				},
				resume: async () => claimedTask(),
				reconcileTask: async () => {
					throw new Error("Portal unavailable");
				},
			}),
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await coordinator.runOnce();

		expect(events).not.toContain("api:claim");
		await expect(journal.entries()).resolves.toMatchObject({ "task-1": { phase: "claimed" } });
	});

	test("recovers only the exact post-submit needs-human task requested by an administrator", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "submit_intent");
		await journal.advance("task-1", "needs_human");
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => null,
			resume: async (taskId: string, _brandId: string, stage: string) => {
				events.push(`api:resume:${taskId}:${stage}`);
				return claimedTask({ postSubmitAssist: true, submitConfirmed: true, runnerSessionId: "session-1" });
			},
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toMatchObject({
			taskId: "task-1",
			status: "succeeded",
		});
		expect(events).toContain("api:resume:task-1:post_submit");
		expect(events).toContain("tab:activate:42");
		expect(events).toContain("adapter:resume");
		expect(events).not.toContain("adapter:submit");
		expect(await journal.entries()).toEqual({});
	});

	test("uses the server-authoritative pre-submit stage when durable intent never reached the Portal", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "submit_intent");
		await journal.advance("task-1", "needs_human");
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi(events),
				claimNext: async () => null,
				resume: async (_taskId: string, _brandId: string, requestedStage: string) => {
					events.push(`api:requested:${requestedStage}`);
					return claimedTask({ postSubmitAssist: false, submitConfirmed: false, runnerSessionId: null });
				},
			}),
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toEqual({
			taskId: "task-1",
			status: "succeeded",
		});
		expect(events).toContain("api:requested:post_submit");
		expect(events.filter((event) => event === "adapter:submit")).toHaveLength(1);
		expect(events).not.toContain("adapter:resume");
	});

	test("recovers only the exact pre-submit task in its preserved tab and does not claim another", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "prepared");
		await journal.advance("task-1", "needs_human");
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => {
				events.push("api:claim");
				return null;
			},
			resume: async (taskId: string, _brandId: string, stage: string) => {
				events.push(`api:resume:${taskId}:${stage}`);
				return claimedTask({ postSubmitAssist: false, submitConfirmed: false, runnerSessionId: null });
			},
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toEqual({
			taskId: "task-1",
			status: "succeeded",
		});
		expect(events).toContain("api:resume:task-1:pre_submit");
		expect(events).toContain("tab:activate:42");
		expect(events).toContain("adapter:preflight");
		expect(events).toContain("adapter:new_conversation");
		expect(events.filter((event) => event === "adapter:submit")).toHaveLength(1);
		expect(events).not.toContain("adapter:resume");
		expect(events).not.toContain("api:claim");
		await expect(journal.entries()).resolves.toEqual({});
	});

	test("keeps a pre-submit handoff recoverable when its preserved tab cannot be activated", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "prepared");
		await journal.advance("task-1", "needs_human");
		const tabs = fakeTabDriver(events, fakeAdapter(events));
		tabs.activate = async () => {
			throw new Error("tab was temporarily unavailable");
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi(events),
				claimNext: async () => null,
				resume: async () => claimedTask({ postSubmitAssist: false, submitConfirmed: false, runnerSessionId: null }),
			}),
			tabs,
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toEqual({
			taskId: "task-1",
			status: "needs_human",
			code: "manual_resume_failed",
		});
		await expect(journal.entries()).resolves.toMatchObject({
			"task-1": { phase: "needs_human", interruptedPhase: "prepared", tabId: 42 },
		});
		expect(events).toContain("api:needs_human");
		expect(events).not.toContain("adapter:submit");
	});

	test("rejects a pre-submit recovery whose frozen prompt no longer matches the local exact task", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveDevice({
			portalBaseUrl: "https://portal.yonaris.com",
			deviceId: "device-1",
			deviceToken: `yrd_${"a".repeat(43)}`,
			allowedBrandIds: ["stepfun"],
		});
		const journal = new DurableTaskJournal(storage);
		await journal.start(claimedTask(), {
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
		});
		await journal.advance("task-1", "needs_human");
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => ({
				...fakeRunnerApi(events),
				claimNext: async () => null,
				resume: async () =>
					claimedTask({
						promptText: "Prompt B",
						postSubmitAssist: false,
						submitConfirmed: false,
						runnerSessionId: null,
					}),
			}),
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toEqual({
			taskId: "task-1",
			status: "needs_human",
			code: "manual_resume_failed",
		});
		expect(events).not.toContain("tab:activate:42");
		expect(events).not.toContain("adapter:submit");
		expect(events).toContain("api:needs_human");
		await expect(journal.entries()).resolves.toMatchObject({ "task-1": { phase: "needs_human" } });
	});

	test("lists exact local needs-human task ids without selecting one automatically", async () => {
		const storage = new DeviceStorage(memoryStorage());
		await storage.saveJournal({
			taskId: "task-older",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "needs_human",
			interruptedPhase: "prepared",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 41,
			runnerSessionId: "session-older",
			promptSha256: "a".repeat(64),
			updatedAt: "2026-08-18T00:01:00.000Z",
		});
		await storage.saveJournal({
			taskId: "task-newer",
			batchId: "batch-1",
			brandId: "stepfun",
			phase: "needs_human",
			interruptedPhase: "submitted",
			surfaceTargetKey: "doubao.consumer_web",
			tabId: 42,
			runnerSessionId: "session-newer",
			promptSha256: "b".repeat(64),
			updatedAt: "2026-08-18T00:02:00.000Z",
		});
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => {
				throw new Error("listing local tasks must not call the Portal");
			},
			tabs: fakeTabDriver([], fakeAdapter([])),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.listNeedsHuman()).resolves.toEqual([
			{
				taskId: "task-newer",
				surfaceTargetKey: "doubao.consumer_web",
				updatedAt: "2026-08-18T00:02:00.000Z",
				canAttemptRecovery: true,
				recoveryStage: "post_submit",
			},
			{
				taskId: "task-older",
				surfaceTargetKey: "deepseek.consumer_web",
				updatedAt: "2026-08-18T00:01:00.000Z",
				canAttemptRecovery: true,
				recoveryStage: "pre_submit",
			},
		]);
	});

	test("uses the Portal post-submit claim to authorize one legacy local recovery", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
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
			phase: "needs_human",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
			updatedAt: "2026-08-18T00:02:00.000Z",
		});
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => null,
			resume: async () =>
				claimedTask({
					postSubmitAssist: true,
					submitConfirmed: true,
					runnerSessionId: "session-1",
				}),
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toMatchObject({ status: "succeeded" });
		expect(events).toContain("adapter:resume");
		expect(events).not.toContain("adapter:submit");
	});

	test("does not touch the tab when the Portal claim is for a different runner session", async () => {
		const events: string[] = [];
		const storage = new DeviceStorage(memoryStorage());
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
			phase: "needs_human",
			surfaceTargetKey: "deepseek.consumer_web",
			tabId: 42,
			runnerSessionId: "session-1",
			promptSha256: await sha256("Prompt A"),
			updatedAt: "2026-08-18T00:02:00.000Z",
		});
		const api = {
			...fakeRunnerApi(events),
			claimNext: async () => null,
			resume: async () =>
				claimedTask({
					postSubmitAssist: true,
					submitConfirmed: true,
					runnerSessionId: "different-session",
				}),
		};
		const coordinator = new ExtensionCoordinator({
			storage,
			apiFactory: () => api,
			tabs: fakeTabDriver(events, fakeAdapter(events)),
			browserVersion: "Chrome/140",
		});

		await expect(coordinator.recoverNeedsHuman("task-1")).resolves.toEqual({
			taskId: "task-1",
			status: "needs_human",
			code: "manual_resume_failed",
		});
		expect(events).not.toContain("tab:activate:42");
		expect(events).not.toContain("adapter:resume");
		expect(events).not.toContain("adapter:submit");
		expect((await new DurableTaskJournal(storage).entries())["task-1"]?.phase).toBe("needs_human");
	});
});

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

function reconciliationTask() {
	return {
		taskId: "task-1",
		batchId: "batch-1",
		brandId: "stepfun",
		surfaceTargetKey: "deepseek.consumer_web" as const,
		promptText: "Prompt A",
	};
}
