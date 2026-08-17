import { BrowserRunnerApiClient } from "./api-client";
import type { BrowserExtensionSurface } from "./contracts";
import { ChromeTabDriver } from "./coordinator/chrome-tabs";
import { ExtensionCoordinator, type ExtensionRunSummary } from "./coordinator/extension-coordinator";
import type { TaskRunResult } from "./coordinator/task-runner";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";

const HEARTBEAT_ALARM = "browser-runner-heartbeat";
const LEGACY_WORK_ALARM = "browser-runner-work";
const storage = chromeDeviceStorage();
const heartbeat = buildHeartbeat(navigator.userAgent);
const coordinator = new ExtensionCoordinator({
	storage,
	apiFactory: (device) => new BrowserRunnerApiClient({ baseUrl: device.portalBaseUrl, token: device.deviceToken }),
	tabs: new ChromeTabDriver(),
	browserVersion: heartbeat.browserVersion,
	notify: notifyNeedsAttention,
});
let running: Promise<ExtensionRunSummary | null> | null = null;
let manualRecoveryRunning = false;
let lastRun: { finishedAt: string; summary: ExtensionRunSummary | null } | null = null;

chrome.runtime.onInstalled.addListener(ensureAlarms);
chrome.runtime.onStartup.addListener(ensureAlarms);

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === HEARTBEAT_ALARM) void sendHeartbeat();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!isRecord(message)) return false;
	if (message.type === "browser-runner:heartbeat") {
		void sendHeartbeat()
			.then(() => sendResponse({ ok: true }))
			.catch(() => sendResponse({ ok: false }));
		return true;
	}
	if (message.type === "browser-runner:run-now") {
		void runNow()
			.then((summary) => sendResponse({ ok: true, summary, finishedAt: lastRun?.finishedAt ?? null }))
			.catch(() => sendResponse({ ok: false }));
		return true;
	}
	if (message.type === "browser-runner:status") {
		sendResponse({ ok: true, running: running !== null || manualRecoveryRunning, lastRun });
		return false;
	}
	if (message.type === "browser-runner:manual-recovery-list") {
		void coordinator
			.listNeedsHuman()
			.then((entries) => sendResponse({ ok: true, entries }))
			.catch(() => sendResponse({ ok: false, entries: [] }));
		return true;
	}
	if (message.type === "browser-runner:manual-recovery-run") {
		const taskId = runtimeTaskId(message.taskId);
		if (!taskId) {
			sendResponse({ ok: false });
			return false;
		}
		void recoverNeedsHuman(taskId)
			.then((result) => sendResponse({ ok: true, result }))
			.catch(() => sendResponse({ ok: false }));
		return true;
	}
	return false;
});

async function sendHeartbeat(): Promise<void> {
	const device = await storage.loadDevice();
	if (!device) return;
	const client = new BrowserRunnerApiClient({ baseUrl: device.portalBaseUrl, token: device.deviceToken });
	await client.heartbeat(heartbeat);
}

function runNow(): Promise<ExtensionRunSummary | null> {
	if (manualRecoveryRunning) return Promise.resolve(null);
	if (running) return running;
	running = coordinator.runOnce();
	void running
		.then((summary) => {
			lastRun = { finishedAt: new Date().toISOString(), summary };
		})
		.finally(() => {
			running = null;
		});
	return running;
}

async function recoverNeedsHuman(taskId: string) {
	if (running || manualRecoveryRunning) {
		return { taskId, status: "not_recoverable" as const, code: "runner_busy" };
	}
	manualRecoveryRunning = true;
	try {
		return await coordinator.recoverNeedsHuman(taskId);
	} finally {
		manualRecoveryRunning = false;
	}
}

function ensureAlarms(): void {
	void chrome.alarms.clear(LEGACY_WORK_ALARM);
	chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
}

async function notifyNeedsAttention(result: TaskRunResult, surface: BrowserExtensionSurface): Promise<void> {
	if (result.status !== "needs_human" && result.status !== "incomplete") return;
	const channel = surface === "doubao.consumer_web" ? "Doubao" : "DeepSeek";
	await chrome.notifications.create({
		type: "basic",
		iconUrl: chrome.runtime.getURL("icon.svg"),
		title: `${channel} needs attention`,
		message: notificationMessage(result.code),
		priority: 1,
	});
}

export function notificationMessage(code: string): string {
	if (code === "signed_out") return "Please sign in in the preserved browser tab, then resume that exact task.";
	if (code === "captcha") return "Complete the verification in the preserved browser tab.";
	if (code === "rate_limited") return "This task stopped after a rate limit and needs administrator review.";
	if (code === "account_restricted") return "This account is restricted. No further tasks will be submitted.";
	if (code === "page_drift") return "The consumer page changed and was stopped safely.";
	return "A browser task stopped safely and needs administrator review.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runtimeTaskId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const taskId = value.trim();
	return taskId && taskId.length <= 200 ? taskId : null;
}

ensureAlarms();
