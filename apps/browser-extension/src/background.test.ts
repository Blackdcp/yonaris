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
	let storageSetImplementation: (items: Record<string, unknown>) => Promise<void> = async () => undefined;
	let tabsQueryCalls = 0;
	let tabsQueryImplementation: () => Promise<Array<{ id?: number; url?: string }>> = async () => [];
	let tabsSendMessageImplementation: (tabId: number, message: unknown) => Promise<unknown> = async () => undefined;
	let fetchImplementation: (request: Request) => Promise<Response> = async () =>
		new Response(JSON.stringify({ deviceId: "device-1", serverTime: "2026-08-18T00:00:00.000Z" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
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
					set: (items: Record<string, unknown>) => storageSetImplementation(items),
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
			tabs: {
				query: async () => {
					tabsQueryCalls += 1;
					return tabsQueryImplementation();
				},
				sendMessage: (tabId: number, message: unknown) => tabsSendMessageImplementation(tabId, message),
			},
			notifications: { create: async () => "notification-id" },
		} as unknown as typeof chrome);
		vi.stubGlobal("fetch", (request: Request) => fetchImplementation(request));

		const background = await import("./background");
		notificationMessage = (background as { notificationMessage?: (code: string) => string }).notificationMessage;
	});

	beforeEach(() => {
		storageGetCalls = 0;
		storageGetImplementation = async () => ({});
		storageSetImplementation = async () => undefined;
		tabsQueryCalls = 0;
		tabsQueryImplementation = async () => [];
		tabsSendMessageImplementation = async () => undefined;
		fetchImplementation = async () =>
			new Response(JSON.stringify({ deviceId: "device-1", serverTime: "2026-08-18T00:00:00.000Z" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
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

	test("heartbeats the persisted per-surface qualification without promoting DeepSeek", async () => {
		const requests: unknown[] = [];
		storageGetImplementation = async () => ({
			browserRunnerDevice: {
				portalBaseUrl: "https://portal.yonaris.com",
				deviceId: "device-1",
				deviceToken: `yrd_${"a".repeat(43)}`,
				allowedBrandIds: ["stepfun"],
			},
			browserRunnerSurfaceReadiness: {
				"doubao.consumer_web": {
					status: "signed_out",
					adapterVersion: "doubao-web-20260819-localpc-v8",
					activeConcurrency: 0,
				},
				"deepseek.consumer_web": {
					status: "unavailable",
					adapterVersion: "deepseek-web-20260814-uat1",
					activeConcurrency: 0,
				},
			},
		});
		fetchImplementation = async (request) => {
			requests.push(await request.json());
			return new Response(
				JSON.stringify({
					deviceId: "device-1",
					serverTime: "2026-08-18T00:00:00.000Z",
					featureVersion: "browser-extension.v1",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		};

		const response = await new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:heartbeat" }, {}, resolve);
		});

		expect(response).toEqual({ ok: true });
		expect(requests).toMatchObject([
			{
				readiness: {
					"doubao.consumer_web": { status: "signed_out" },
					"deepseek.consumer_web": { status: "unavailable" },
				},
			},
		]);
	});

	test("confirms paired-device unavailability before inspecting Doubao and publishes qualified v8 immediately", async () => {
		const events: string[] = [];
		const values: Record<string, unknown> = {
			browserRunnerDevice: pairedDevice(),
			browserRunnerSurfaceReadiness: {
				"doubao.consumer_web": {
					status: "ready",
					adapterVersion: "doubao-web-20260818-localpc-v7",
					activeConcurrency: 0,
				},
				"deepseek.consumer_web": {
					status: "unavailable",
					adapterVersion: "deepseek-web-20260814-uat1",
					activeConcurrency: 0,
				},
			},
		};
		storageGetImplementation = async () => ({ ...values });
		storageSetImplementation = async (items) => {
			Object.assign(values, items);
		};
		fetchImplementation = async (request) => {
			const body = (await request.json()) as {
				readiness?: { "doubao.consumer_web"?: { status?: string; adapterVersion?: string } };
			};
			const state = body.readiness?.["doubao.consumer_web"];
			events.push(`portal:${state?.status}:${state?.adapterVersion}`);
			return heartbeatResponse();
		};
		tabsQueryImplementation = async () => {
			events.push("dom:query");
			return [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
		};
		tabsSendMessageImplementation = async () => {
			events.push("dom:inspect");
			return {
				ok: true,
				value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 },
			};
		};
		const responses: unknown[] = [];

		const handled = runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, (value) =>
			responses.push(value),
		);

		expect(handled).toBe(true);
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0]).toMatchObject({ ok: true, result: { status: "qualified" } });
		expect(events).toEqual([
			"portal:unavailable:doubao-web-20260819-localpc-v8",
			"dom:query",
			"dom:inspect",
			"portal:ready:doubao-web-20260819-localpc-v8",
		]);
		expect(values.browserRunnerSurfaceReadiness).toMatchObject({
			"doubao.consumer_web": {
				status: "ready",
				adapterVersion: "doubao-web-20260819-localpc-v8",
			},
		});
	});

	test("orders an older heartbeat before qualification revocation so stale ready cannot land last", async () => {
		const values: Record<string, unknown> = {
			browserRunnerDevice: pairedDevice(),
			browserRunnerSurfaceReadiness: readyV8Readiness(),
		};
		storageGetImplementation = async () => ({ ...values });
		storageSetImplementation = async (items) => {
			Object.assign(values, items);
		};
		const events: string[] = [];
		const firstHeartbeatGate = deferred<Response>();
		let requestCount = 0;
		fetchImplementation = async (request) => {
			requestCount += 1;
			const body = (await request.json()) as {
				readiness?: { "doubao.consumer_web"?: { status?: string } };
			};
			const status = body.readiness?.["doubao.consumer_web"]?.status;
			events.push(`portal:start:${status}`);
			if (requestCount === 1) {
				const response = await firstHeartbeatGate.promise;
				events.push(`portal:finish:${status}`);
				return response;
			}
			events.push(`portal:finish:${status}`);
			return heartbeatResponse();
		};
		tabsQueryImplementation = async () => {
			events.push("dom:query");
			return [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
		};
		tabsSendMessageImplementation = async () => ({
			ok: true,
			value: { status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 },
		});
		const heartbeatResult = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:heartbeat" }, {}, resolve);
		});
		await vi.waitFor(() => expect(requestCount).toBe(1));
		const qualificationResult = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, resolve);
		});
		await vi.waitFor(() =>
			expect(values.browserRunnerSurfaceReadiness).toMatchObject({
				"doubao.consumer_web": { status: "unavailable" },
			}),
		);

		try {
			expect(requestCount).toBe(1);
			expect(tabsQueryCalls).toBe(0);
		} finally {
			firstHeartbeatGate.resolve(heartbeatResponse());
		}
		await expect(heartbeatResult).resolves.toEqual({ ok: true });
		await expect(qualificationResult).resolves.toMatchObject({ ok: true, result: { status: "page_drift" } });
		expect(events).toEqual([
			"portal:start:ready",
			"portal:finish:ready",
			"portal:start:unavailable",
			"portal:finish:unavailable",
			"dom:query",
		]);
	});

	test("does not poll for work while Doubao qualification is waiting on the live page", async () => {
		const values: Record<string, unknown> = {
			browserRunnerDevice: pairedDevice(),
			browserRunnerSurfaceReadiness: readyV8Readiness(),
		};
		storageGetImplementation = async () => ({ ...values });
		storageSetImplementation = async (items) => {
			Object.assign(values, items);
		};
		fetchImplementation = async () => heartbeatResponse();
		const inspectionGate = deferred<unknown>();
		tabsQueryImplementation = async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
		tabsSendMessageImplementation = async () => inspectionGate.promise;
		const qualificationResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, resolve);
		});
		await vi.waitFor(() => expect(tabsQueryCalls).toBe(1));
		const getCallsBeforeRun = storageGetCalls;

		try {
			const runResponse = await new Promise<unknown>((resolve) => {
				runtimeMessageListener?.({ type: "browser-runner:run-now" }, {}, resolve);
			});
			expect(runResponse).toMatchObject({ ok: true, summary: null });
			expect(storageGetCalls).toBe(getCallsBeforeRun);
		} finally {
			inspectionGate.resolve({
				ok: true,
				value: { status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 },
			});
			await qualificationResponse;
		}
	});

	test("does not resume manual recovery while Doubao qualification owns the background", async () => {
		const values: Record<string, unknown> = {
			browserRunnerDevice: pairedDevice(),
			browserRunnerSurfaceReadiness: readyV8Readiness(),
		};
		storageGetImplementation = async () => ({ ...values });
		storageSetImplementation = async (items) => {
			Object.assign(values, items);
		};
		fetchImplementation = async () => heartbeatResponse();
		const inspectionGate = deferred<unknown>();
		tabsQueryImplementation = async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
		tabsSendMessageImplementation = async () => inspectionGate.promise;
		const qualificationResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, resolve);
		});
		await vi.waitFor(() => expect(tabsQueryCalls).toBe(1));

		try {
			const recoveryResponse = await new Promise<unknown>((resolve) => {
				runtimeMessageListener?.({ type: "browser-runner:manual-recovery-run", taskId: "task-exact" }, {}, resolve);
			});
			expect(recoveryResponse).toMatchObject({
				ok: true,
				result: { taskId: "task-exact", status: "not_recoverable", code: "runner_busy" },
			});
		} finally {
			inspectionGate.resolve({
				ok: true,
				value: { status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 },
			});
			await qualificationResponse;
		}
	});

	test("refuses Doubao qualification while a run-now poll owns the background runner", async () => {
		const runGate = deferred<Record<string, unknown>>();
		storageGetImplementation = () => runGate.promise;
		const runResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:run-now" }, {}, resolve);
		});
		await vi.waitFor(() => expect(storageGetCalls).toBe(1));

		try {
			const responses: unknown[] = [];
			const handled = runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, (value) =>
				responses.push(value),
			);
			expect(handled).toBe(true);
			await vi.waitFor(() => expect(responses).toHaveLength(1));
			expect(responses[0]).toMatchObject({ ok: false, error: expect.stringMatching(/runner.*busy/i) });
			expect(tabsQueryCalls).toBe(0);
		} finally {
			runGate.resolve({});
			await runResponse;
		}
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

	test("requires a current device heartbeat before manual recovery can resume a task", async () => {
		storageGetImplementation = async () => ({
			browserRunnerDevice: pairedDevice(),
			browserRunnerSurfaceReadiness: readyV8Readiness(),
		});
		fetchImplementation = async () => {
			throw new Error("Portal offline");
		};
		const responses: unknown[] = [];

		const handled = runtimeMessageListener?.(
			{ type: "browser-runner:manual-recovery-run", taskId: "task-exact" },
			{},
			(value) => responses.push(value),
		);

		expect(handled).toBe(true);
		await vi.waitFor(() => expect(responses).toHaveLength(1));
		expect(responses[0]).toEqual({ ok: false });
		expect(tabsQueryCalls).toBe(0);
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

	test("refuses Doubao qualification while manual recovery owns the background", async () => {
		const recoveryGate = deferred<Record<string, unknown>>();
		storageGetImplementation = () => recoveryGate.promise;
		const recoveryResponse = new Promise<unknown>((resolve) => {
			runtimeMessageListener?.({ type: "browser-runner:manual-recovery-run", taskId: "task-exact" }, {}, resolve);
		});
		await vi.waitFor(() => expect(storageGetCalls).toBe(1));

		try {
			const qualificationResponses: unknown[] = [];
			const handled = runtimeMessageListener?.({ type: "browser-runner:qualify-doubao" }, {}, (value) =>
				qualificationResponses.push(value),
			);
			expect(handled).toBe(true);
			await vi.waitFor(() => expect(qualificationResponses).toHaveLength(1));
			expect(qualificationResponses[0]).toMatchObject({
				ok: false,
				error: expect.stringMatching(/runner.*busy/i),
			});
			expect(tabsQueryCalls).toBe(0);
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

function pairedDevice() {
	return {
		portalBaseUrl: "https://portal.yonaris.com",
		deviceId: "device-1",
		deviceToken: `yrd_${"a".repeat(43)}`,
		allowedBrandIds: ["stepfun"],
	};
}

function readyV8Readiness() {
	return {
		"doubao.consumer_web": {
			status: "ready",
			adapterVersion: "doubao-web-20260819-localpc-v8",
			activeConcurrency: 0,
		},
		"deepseek.consumer_web": {
			status: "unavailable",
			adapterVersion: "deepseek-web-20260814-uat1",
			activeConcurrency: 0,
		},
	};
}

function heartbeatResponse(): Response {
	return new Response(
		JSON.stringify({
			deviceId: "device-1",
			serverTime: "2026-08-18T00:00:00.000Z",
			featureVersion: "browser-extension.v1",
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}
