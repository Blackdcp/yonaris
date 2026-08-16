import { BrowserRunnerApiClient } from "./api-client";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";

const HEARTBEAT_ALARM = "browser-runner-heartbeat";

chrome.runtime.onInstalled.addListener(() => {
	chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
	chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: 0.1, periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === HEARTBEAT_ALARM) void sendHeartbeat();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!isRecord(message) || message.type !== "browser-runner:heartbeat") return false;
	void sendHeartbeat()
		.then(() => sendResponse({ ok: true }))
		.catch(() => sendResponse({ ok: false }));
	return true;
});

async function sendHeartbeat(): Promise<void> {
	const device = await chromeDeviceStorage().loadDevice();
	if (!device) return;
	const client = new BrowserRunnerApiClient({ baseUrl: device.portalBaseUrl, token: device.deviceToken });
	await client.heartbeat(buildHeartbeat(navigator.userAgent));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
