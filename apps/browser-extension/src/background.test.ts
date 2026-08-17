import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

type AlarmListener = (alarm: { name: string }) => void;
type RuntimeMessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

describe.sequential("Browser Runner background scheduling", () => {
	const createdAlarms: Array<{ name: string; info: unknown }> = [];
	const clearedAlarms: string[] = [];
	let alarmListener: AlarmListener | null = null;
	let runtimeMessageListener: RuntimeMessageListener | null = null;
	let storageGetCalls = 0;
	let storageGetImplementation: () => Promise<Record<string, unknown>> = async () => ({});
	let notificationMessage: ((code: string) => string) | undefined;

	beforeAll(async () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36",
		});
		vi.stubGlobal("chrome", {
			storage: {
				local: {
					get: async () => {
						storageGetCalls += 1;
						return storageGetImplementation();
					},
					set: async () => undefined,
					remove: async () => undefined,
				},
			},
			runtime: {
				onInstalled: { addListener: () => undefined },
				onStartup: { addListener: () => undefined },
				onMessage: {
					addListener: (listener: RuntimeMessageListener) => {
						runtimeMessageListener = listener;
					},
				},
				getURL: (path: string) => path,
			},
			alarms: {
				create: (name: string, info: unknown) => {
					createdAlarms.push({ name, info });
				},
				clear: async (name: string) => {
					clearedAlarms.push(name);
					return true;
				},
				onAlarm: {
					addListener: (listener: AlarmListener) => {
						alarmListener = listener;
					},
				},
			},
			tabs: {},
			notifications: { create: async () => "notification-id" },
		} as unknown as typeof chrome);

		const background = await import("./background");
		notificationMessage = (background as { notificationMessage?: (code: string) => string }).notificationMessage;
	});

	beforeEach(() => {
		storageGetCalls = 0;
		storageGetImplementation = async () => ({});
	});

	test("clears the legacy work alarm during setup", () => {
		expect(clearedAlarms).toEqual(["browser-runner-work"]);
	});

	afterAll(() => {
		vi.unstubAllGlobals();
	});

	test("creates only the heartbeat alarm", () => {
		expect(createdAlarms).toEqual([
			{
				name: "browser-runner-heartbeat",
				info: { delayInMinutes: 0.1, periodInMinutes: 1 },
			},
		]);
	});

	test("ignores a legacy work alarm", async () => {
		storageGetCalls = 0;
		expect(alarmListener).not.toBeNull();
		alarmListener?.({ name: "browser-runner-work" });
		await Promise.resolve();
		expect(storageGetCalls).toBe(0);
	});

	test("checks for work only after an explicit runtime message", async () => {
		storageGetCalls = 0;
		expect(runtimeMessageListener).not.toBeNull();
		const response = await new Promise<unknown>((resolve) => {
			const handled = runtimeMessageListener?.({ type: "browser-runner:run-now" }, {}, resolve);
			expect(handled).toBe(true);
		});

		expect(response).toMatchObject({ ok: true });
		expect(storageGetCalls).toBeGreaterThan(0);
	});

	test("accepts an exact local task id only through the manual recovery message", async () => {
		expect(runtimeMessageListener).not.toBeNull();
		const responses: unknown[] = [];
		const handled = runtimeMessageListener?.(
			{ type: "browser-runner:manual-recovery-run", taskId: "task-exact" },
			{},
			(response) => responses.push(response),
		);

		expect(handled).toBe(true);
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0]).toMatchObject({
			ok: true,
			result: { taskId: "task-exact", status: "not_recoverable" },
		});
	});

	test("does not start a run-now poll while manual recovery is active", async () => {
		expect(runtimeMessageListener).not.toBeNull();
		const recoveryGate = deferred<Record<string, unknown>>();
		let getOrdinal = 0;
		storageGetImplementation = async () => {
			getOrdinal += 1;
			return getOrdinal === 1 ? recoveryGate.promise : {};
		};
		const recoveryResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:manual-recovery-run", taskId: "task-exact" }, {}, resolve);
		});
		await vi.waitFor(() => expect(storageGetCalls).toBe(1));

		try {
			const runResponse = await new Promise<unknown>((resolve) => {
				runtimeMessageListener?.({ type: "browser-runner:run-now" }, {}, resolve);
			});
			expect(runResponse).toMatchObject({ ok: true, summary: null });
			expect(storageGetCalls).toBe(1);
		} finally {
			recoveryGate.resolve({});
			await recoveryResponse;
		}
	});

	test("refuses manual recovery while a run-now poll is active", async () => {
		expect(runtimeMessageListener).not.toBeNull();
		const runGate = deferred<Record<string, unknown>>();
		storageGetImplementation = () => runGate.promise;
		const runResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:run-now" }, {}, resolve);
		});
		await vi.waitFor(() => expect(storageGetCalls).toBe(1));

		try {
			const recoveryResponse = await new Promise<unknown>((resolve) => {
				runtimeMessageListener?.({ type: "browser-runner:manual-recovery-run", taskId: "task-exact" }, {}, resolve);
			});
			expect(recoveryResponse).toMatchObject({
				ok: true,
				result: { taskId: "task-exact", status: "not_recoverable", code: "runner_busy" },
			});
			expect(storageGetCalls).toBe(1);
		} finally {
			runGate.resolve({});
			await runResponse;
		}
	});

	test("signed-out guidance resumes the preserved task instead of claiming new work", () => {
		expect(notificationMessage?.("signed_out")).toBe(
			"Please sign in in the preserved browser tab, then resume that exact task.",
		);
	});

	test("rate-limit guidance describes only the stopped task", () => {
		expect(notificationMessage?.("rate_limited")).toBe(
			"This task stopped after a rate limit and needs administrator review.",
		);
	});
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}
