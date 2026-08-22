import type { SearchEvidenceProbeCandidate, SearchEvidenceProbeReport } from "./adapters/evidence-probe";
import { BrowserRunnerApiClient } from "./api-client";
import type { BrowserExtensionReadiness, BrowserExtensionSurface } from "./contracts";
import { ChromeTabDriver } from "./coordinator/chrome-tabs";
import { ExtensionCoordinator, type ExtensionRunSummary } from "./coordinator/extension-coordinator";
import type { TaskRunResult } from "./coordinator/task-runner";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";
import { type QualificationReadinessPublisher, qualifyAndRecordActiveSurfaceTab } from "./surface-qualification-client";
import {
	type ExtensionSurfaceDefinition,
	extensionSurfaceDefinition,
	extensionSurfaceForUrl,
	isApprovedSurfaceConversationUrl,
} from "./surface-registry";

const HEARTBEAT_ALARM = "browser-runner-heartbeat";
const LEGACY_WORK_ALARM = "browser-runner-work";
const storage = chromeDeviceStorage();
const browserMetadata = buildHeartbeat(navigator.userAgent);
const coordinator = new ExtensionCoordinator({
	storage,
	apiFactory: (device) => new BrowserRunnerApiClient({ baseUrl: device.portalBaseUrl, token: device.deviceToken }),
	tabs: new ChromeTabDriver(),
	browserVersion: browserMetadata.browserVersion,
	notify: notifyNeedsAttention,
});
let running: Promise<ExtensionRunSummary | null> | null = null;
let manualRecoveryRunning = false;
let qualificationRunning: ReturnType<typeof qualifyAndRecordActiveSurfaceTab> | null = null;
let heartbeatTail: Promise<void> = Promise.resolve();
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
	if (message.type === "browser-runner:qualify-surface" || message.type === "browser-runner:qualify-doubao") {
		void qualifySurface()
			.then((result) => sendResponse({ ok: true, result }))
			.catch((error) => sendResponse({ ok: false, error: safeRuntimeError(error) }));
		return true;
	}
	if (message.type === "browser-runner:inspect-active-search-evidence") {
		void inspectActiveSearchEvidence()
			.then((report) => sendResponse({ ok: true, report }))
			.catch((error) => sendResponse({ ok: false, error: safeRuntimeError(error) }));
		return true;
	}
	if (message.type === "browser-runner:status") {
		sendResponse({
			ok: true,
			running: running !== null || manualRecoveryRunning || qualificationRunning !== null,
			lastRun,
		});
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

function sendHeartbeat(readiness?: BrowserExtensionReadiness): Promise<void> {
	const operation = heartbeatTail.then(() => sendHeartbeatNow(readiness));
	heartbeatTail = operation.catch(() => undefined);
	return operation;
}

async function inspectActiveSearchEvidence(): Promise<SearchEvidenceProbeReport> {
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const supported: Array<{ id: number; definition: ExtensionSurfaceDefinition }> = [];
	for (const tab of tabs) {
		if (!Number.isSafeInteger(tab.id) || typeof tab.url !== "string") continue;
		try {
			const definition = extensionSurfaceForUrl(new URL(tab.url));
			if (isApprovedSurfaceConversationUrl(definition, tab.url)) {
				supported.push({ id: tab.id as number, definition });
			}
		} catch {
			// Unsupported active tabs are ignored; the caller receives a bounded diagnostic below.
		}
	}
	if (supported.length === 0) throw new Error("No supported domestic AI conversation tab is active.");
	if (supported.length > 1) throw new Error("Multiple supported domestic AI conversation tabs are active.");
	const active = supported[0];
	if (!active) throw new Error("No supported domestic AI conversation tab is active.");
	const response = await chrome.tabs.sendMessage(active.id, {
		kind: "yonaris_adapter",
		action: "inspect_search_candidates",
	});
	if (!isRecord(response) || response.ok !== true) {
		throw new Error(adapterRuntimeFailure(response) ?? "The active page rejected the read-only evidence probe.");
	}
	return parseProbeReport(response.value, active.definition);
}

function parseProbeReport(value: unknown, definition: ExtensionSurfaceDefinition): SearchEvidenceProbeReport {
	if (!isRecord(value) || value.schemaVersion !== 1) throw new Error("The evidence probe returned an invalid report.");
	if (value.surface !== definition.surface || value.adapterVersion !== definition.adapterVersion) {
		throw new Error("The evidence probe returned a mismatched platform report.");
	}
	if (
		typeof value.pageUrlShape !== "string" ||
		!Number.isSafeInteger(value.answerCount) ||
		(value.answerCount as number) < 0 ||
		(value.answerCount as number) > 1_000 ||
		!Array.isArray(value.candidates) ||
		value.candidates.length > 200 ||
		typeof value.truncated !== "boolean"
	) {
		throw new Error("The evidence probe returned an invalid report.");
	}
	const candidates = value.candidates.map(parseProbeCandidate);
	const pageUrlShape = safeProbePageUrlShape(value.pageUrlShape, definition);
	return {
		schemaVersion: 1,
		surface: definition.surface,
		adapterVersion: definition.adapterVersion,
		pageUrlShape,
		answerCount: value.answerCount as number,
		candidates,
		truncated: value.truncated,
	};
}

function safeProbePageUrlShape(value: string, definition: ExtensionSurfaceDefinition): string {
	if (value.length > 1_000) throw new Error("The evidence probe returned an invalid report.");
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("The evidence probe returned an invalid report.");
	}
	const safePath = url.pathname
		.split("/")
		.filter(Boolean)
		.every((segment) => segment === ":segment");
	const safeSearch = [...url.searchParams].every(
		([key, entryValue]) => /^[\p{L}_][\p{L}\p{N}_-]{0,79}$/u.test(key) && entryValue === "",
	);
	if (!definition.approvedUrl(url) || url.port || url.hash || !safePath || !safeSearch) {
		throw new Error("The evidence probe returned an invalid report.");
	}
	return value;
}

function parseProbeCandidate(value: unknown): SearchEvidenceProbeCandidate {
	if (!isRecord(value)) throw new Error("The evidence probe returned an invalid candidate.");
	const relation = oneOf(value.relation, ["inside_latest_answer", "adjacent_to_latest_answer", "page_other"] as const);
	const textCategory = oneOf(value.textCategory, ["search", "source", "citation", "reference", "unknown"] as const);
	const tag = safeProbeToken(value.tag, false);
	const role = value.role === null ? null : safeProbeToken(value.role, false);
	const classTokens = safeProbeTokenArray(value.classTokens);
	const ariaNames = safeProbeTokenArray(value.ariaNames);
	const dataAttributeNames = safeProbeTokenArray(value.dataAttributeNames);
	const hrefHostname = value.hrefHostname === null ? null : safeProbeHostname(value.hrefHostname);
	if (
		typeof value.visible !== "boolean" ||
		!Number.isSafeInteger(value.textLength) ||
		(value.textLength as number) < 0 ||
		(value.textLength as number) > 1_000_000 ||
		typeof value.textSha256 !== "string" ||
		!/^[a-f0-9]{64}$/u.test(value.textSha256)
	) {
		throw new Error("The evidence probe returned an invalid candidate.");
	}
	return {
		relation,
		tag,
		role,
		classTokens,
		ariaNames,
		dataAttributeNames,
		hrefHostname,
		visible: value.visible,
		textCategory,
		textLength: value.textLength as number,
		textSha256: value.textSha256,
	};
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
	if (typeof value !== "string" || !allowed.includes(value)) {
		throw new Error("The evidence probe returned an invalid candidate.");
	}
	return value as T[number];
}

function safeProbeToken(value: unknown, allowDataPrefix: boolean): string {
	if (
		typeof value !== "string" ||
		value.length > 80 ||
		!(allowDataPrefix ? /^data-[\p{L}\p{N}_-]+$/u : /^[\p{L}_][\p{L}\p{N}_-]*$/u).test(value)
	) {
		throw new Error("The evidence probe returned an invalid structural token.");
	}
	return value;
}

function safeProbeTokenArray(value: unknown): string[] {
	if (!Array.isArray(value) || value.length > 20) {
		throw new Error("The evidence probe returned an invalid structural token list.");
	}
	return value.map((item) => safeProbeToken(item, typeof item === "string" && item.startsWith("data-")));
}

function safeProbeHostname(value: unknown): string {
	if (typeof value !== "string" || value.length > 253 || !/^[a-z0-9.-]+$/u.test(value)) {
		throw new Error("The evidence probe returned an invalid hostname.");
	}
	return value;
}

function adapterRuntimeFailure(value: unknown): string | null {
	if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) return null;
	return typeof value.error.message === "string" && value.error.message.trim()
		? value.error.message.trim().slice(0, 500)
		: null;
}

async function sendHeartbeatNow(readiness?: BrowserExtensionReadiness): Promise<void> {
	const device = await storage.loadDevice();
	if (!device) return;
	const client = new BrowserRunnerApiClient({ baseUrl: device.portalBaseUrl, token: device.deviceToken });
	await client.heartbeat(buildHeartbeat(navigator.userAgent, readiness ?? (await storage.loadSurfaceReadiness())));
}

function runNow(): Promise<ExtensionRunSummary | null> {
	if (manualRecoveryRunning || qualificationRunning) return Promise.resolve(null);
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

function qualifySurface(): ReturnType<typeof qualifyAndRecordActiveSurfaceTab> {
	if (running || manualRecoveryRunning) {
		return Promise.reject(new Error("Browser Runner is busy; check the current page after the task finishes."));
	}
	if (qualificationRunning) return qualificationRunning;
	const publisher: QualificationReadinessPublisher = {
		confirmReadiness: (readiness) => sendHeartbeat(readiness),
	};
	const operation = qualifyAndRecordActiveSurfaceTab(storage, undefined, publisher);
	qualificationRunning = operation;
	void operation.then(
		() => {
			if (qualificationRunning === operation) qualificationRunning = null;
		},
		() => {
			if (qualificationRunning === operation) qualificationRunning = null;
		},
	);
	return operation;
}

async function recoverNeedsHuman(taskId: string) {
	if (running || manualRecoveryRunning || qualificationRunning) {
		return { taskId, status: "not_recoverable" as const, code: "runner_busy" };
	}
	manualRecoveryRunning = true;
	try {
		await sendHeartbeat();
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
	const channel = extensionSurfaceDefinition(surface).label;
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

function safeRuntimeError(error: unknown): string {
	return error instanceof Error && error.message.trim() ? error.message.slice(0, 500) : "The operation failed safely.";
}

ensureAlarms();
