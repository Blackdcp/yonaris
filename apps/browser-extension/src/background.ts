import { BrowserRunnerApiClient } from "./api-client";
import type { BrowserExtensionSurface } from "./contracts";
import { ChromeTabDriver } from "./coordinator/chrome-tabs";
import { ExtensionCoordinator, type ExtensionRunSummary } from "./coordinator/extension-coordinator";
import type { TaskRunResult } from "./coordinator/task-runner";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";

const HEARTBEAT_ALARM = "browser-runner-heartbeat";
const WORK_ALARM = "browser-runner-work";
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
let lastRun: { finishedAt: string; summary: ExtensionRunSummary | null } | null = null;

chrome.runtime.onInstalled.addListener(ensureAlarms);
chrome.runtime.onStartup.addListener(ensureAlarms);

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === HEARTBEAT_ALARM) void sendHeartbeat();
	if (alarm.name === WORK_ALARM) void runNow();
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
		sendResponse({ ok: true, running: running !== null, lastRun });
		return false;
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

function ensureAlarms(): void {
	chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
	chrome.alarms.create(WORK_ALARM, { delayInMinutes: 0.2, periodInMinutes: 0.5 });
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

function notificationMessage(code: string): string {
	if (code === "signed_out") return "Please sign in, then choose Check for work now.";
	if (code === "captcha") return "Complete the verification in the preserved browser tab.";
	if (code === "rate_limited") return "This channel is cooling down; other channels will continue.";
	if (code === "page_drift") return "The consumer page changed and was stopped safely.";
	return "A browser task stopped safely and needs administrator review.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

ensureAlarms();
