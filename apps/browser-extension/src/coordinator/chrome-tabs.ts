import {
	AdapterError,
	type CollectedAnswer,
	type ConsumerWebAdapter,
	type EvidenceViewportRect,
} from "../adapters/contracts";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import { extensionSurfaceDefinition } from "../surface-registry";
import { captureCroppedJpeg } from "./screenshot";
import { type RunnerTab, type RunnerTabDriver, RunnerTabOpenError } from "./task-runner";

type AdapterCommand =
	| { kind: "yonaris_adapter"; action: "preflight" | "open_new_conversation" | "collect_current_answer" }
	| {
			kind: "yonaris_adapter";
			action: "prepare" | "submit_once" | "confirm_submitted" | "resume_submitted";
			promptText: string;
	  };

type BrowserTab = { id?: number; windowId?: number; active?: boolean; url?: string; status?: string };

export interface ChromeTabsGateway {
	create(url: string, options: { active: boolean }): Promise<BrowserTab>;
	get(tabId: number): Promise<BrowserTab>;
	query(options: { active: true; lastFocusedWindow: true }): Promise<BrowserTab[]>;
	remove(tabId: number): Promise<void>;
	activate(tabId: number): Promise<void>;
	captureVisibleTab(windowId: number, options: { format: "jpeg"; quality: 82 }): Promise<string>;
	sendMessage(tabId: number, command: AdapterCommand): Promise<unknown>;
}

export class ChromeTabDriver implements RunnerTabDriver {
	readonly #gateway: ChromeTabsGateway;
	readonly #wait: (milliseconds: number) => Promise<void>;
	readonly #captureCroppedJpeg: typeof captureCroppedJpeg;

	constructor(
		gateway: ChromeTabsGateway = chromeTabsGateway(),
		options: { wait?: (milliseconds: number) => Promise<void>; captureCroppedJpeg?: typeof captureCroppedJpeg } = {},
	) {
		this.#gateway = gateway;
		this.#wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
		this.#captureCroppedJpeg = options.captureCroppedJpeg ?? captureCroppedJpeg;
	}

	async open(claim: BrowserExtensionClaim): Promise<RunnerTab> {
		assertApprovedUrl(claim.launchUrl, claim.surfaceTargetKey);
		const created = await this.#gateway.create(claim.launchUrl, { active: true });
		if (!Number.isSafeInteger(created.id)) throw new Error("Chrome did not create a Browser Runner tab");
		const tab = this.#runnerTab(created.id as number, claim.surfaceTargetKey);
		try {
			await this.#waitForReady(created.id as number, claim.surfaceTargetKey);
			return tab;
		} catch (error) {
			throw new RunnerTabOpenError(tab, error);
		}
	}

	async attach(tabId: number, surface: BrowserExtensionSurface): Promise<RunnerTab> {
		if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Browser Runner tab id is invalid");
		await this.#waitForReady(tabId, surface);
		return this.#runnerTab(tabId, surface);
	}

	async activate(tabId: number): Promise<void> {
		if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Browser Runner tab id is invalid");
		await this.#gateway.activate(tabId);
	}

	async resolveManualRecoveryTab(tabId: number, surface: BrowserExtensionSurface): Promise<number> {
		if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Browser Runner tab id is invalid");
		const activeApprovedTabs = (await this.#gateway.query({ active: true, lastFocusedWindow: true })).filter(
			(tab) => Number.isSafeInteger(tab.id) && (tab.id ?? -1) >= 0 && isApprovedUrl(tab.url, surface),
		);
		if (activeApprovedTabs.length > 1) throw new Error("Active Browser Runner tab is ambiguous");
		if (activeApprovedTabs[0]?.id !== undefined) return activeApprovedTabs[0].id;

		const preserved = await this.#gateway.get(tabId);
		if (preserved.id !== undefined && preserved.id !== tabId) {
			throw new Error("Chrome returned a different Browser Runner tab");
		}
		if (!preserved.url) throw new Error("Browser Runner tab URL is unavailable");
		assertApprovedUrl(preserved.url, surface);
		return tabId;
	}

	async #waitForReady(tabId: number, surface: BrowserExtensionSurface): Promise<void> {
		for (let attempt = 0; attempt < 60; attempt += 1) {
			const tab = await this.#gateway.get(tabId);
			if (tab.url) assertApprovedUrl(tab.url, surface);
			if (tab.status === "complete") return;
			await this.#wait(500);
		}
		throw new Error("Consumer page did not finish loading");
	}

	#runnerTab(tabId: number, surface: BrowserExtensionSurface): RunnerTab {
		return {
			tabId,
			adapter: new ContentScriptAdapter(this.#gateway, tabId, surface),
			captureEvidence: (rect) => this.#captureEvidence(tabId, surface, rect),
			close: () => this.#gateway.remove(tabId),
		};
	}

	async #captureEvidence(
		tabId: number,
		surface: BrowserExtensionSurface,
		rect: EvidenceViewportRect,
	): Promise<Uint8Array> {
		const before = await this.#gateway.get(tabId);
		const windowId = assertCapturableTab(before, tabId, surface);
		await this.#gateway.activate(tabId);
		const active = await this.#gateway.get(tabId);
		assertSameActiveTab(active, tabId, windowId, before.url, surface);
		const dataUrl = await this.#gateway.captureVisibleTab(windowId, { format: "jpeg", quality: 82 });
		const after = await this.#gateway.get(tabId);
		assertSameActiveTab(after, tabId, windowId, active.url, surface);
		return this.#captureCroppedJpeg(dataUrl, rect);
	}
}

class ContentScriptAdapter implements ConsumerWebAdapter {
	readonly surface: BrowserExtensionSurface;
	readonly launchUrl: string;
	readonly adapterVersion = "content-script-v1";
	readonly #gateway: ChromeTabsGateway;
	readonly #tabId: number;

	constructor(gateway: ChromeTabsGateway, tabId: number, surface: BrowserExtensionSurface) {
		this.#gateway = gateway;
		this.#tabId = tabId;
		this.surface = surface;
		this.launchUrl = extensionSurfaceDefinition(surface).launchUrl;
	}

	async preflight(): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "preflight" });
	}

	async openNewConversation(): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "open_new_conversation" });
	}

	async prepare(promptText: string): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "prepare", promptText });
	}

	async submitOnce(promptText: string): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "submit_once", promptText });
	}

	async confirmSubmitted(promptText: string): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "confirm_submitted", promptText });
	}

	async resumeSubmitted(promptText: string): Promise<void> {
		await this.#command({ kind: "yonaris_adapter", action: "resume_submitted", promptText });
	}

	async collectCurrentAnswer(): Promise<CollectedAnswer> {
		return (await this.#command({ kind: "yonaris_adapter", action: "collect_current_answer" })) as CollectedAnswer;
	}

	async #command(command: AdapterCommand): Promise<unknown> {
		const response = await this.#gateway.sendMessage(this.#tabId, command);
		if (!isRecord(response) || typeof response.ok !== "boolean") throw new Error("Content adapter response is invalid");
		if (response.ok) return response.value;
		if (!isRecord(response.error)) throw new Error("Content adapter response is invalid");
		const code = adapterCode(response.error.code);
		const stage = response.error.stage === "post_submit" ? "post_submit" : "pre_submit";
		const message =
			typeof response.error.message === "string" ? response.error.message : "Consumer page adapter failed";
		throw new AdapterError(code, stage, message.slice(0, 1_000));
	}
}

export function chromeTabsGateway(): ChromeTabsGateway {
	return {
		create: (url, options) => chrome.tabs.create({ url, active: options.active }),
		get: (tabId) => chrome.tabs.get(tabId),
		query: (options) => chrome.tabs.query(options),
		remove: (tabId) => chrome.tabs.remove(tabId),
		activate: async (tabId) => {
			await chrome.tabs.update(tabId, { active: true });
		},
		captureVisibleTab: (windowId, options) => chrome.tabs.captureVisibleTab(windowId, options),
		sendMessage: (tabId, command) => chrome.tabs.sendMessage(tabId, command),
	};
}

function assertCapturableTab(tab: BrowserTab, tabId: number, surface: BrowserExtensionSurface): number {
	if (tab.id !== undefined && tab.id !== tabId) throw new Error("Chrome returned a different Browser Runner tab");
	if (!tab.url) throw new Error("Browser Runner tab URL is unavailable");
	assertApprovedUrl(tab.url, surface);
	if (!Number.isSafeInteger(tab.windowId) || (tab.windowId ?? -1) < 0) {
		throw new Error("Browser Runner tab window is unavailable");
	}
	return tab.windowId as number;
}

function assertSameActiveTab(
	tab: BrowserTab,
	tabId: number,
	windowId: number,
	expectedUrl: string | undefined,
	surface: BrowserExtensionSurface,
): void {
	const currentWindowId = assertCapturableTab(tab, tabId, surface);
	if (currentWindowId !== windowId || tab.active !== true || tab.url !== expectedUrl) {
		throw new AdapterError("page_drift", "post_submit", "Browser Runner tab changed during evidence capture");
	}
}

function assertApprovedUrl(value: string, surface: BrowserExtensionSurface): void {
	const url = new URL(value);
	if (!extensionSurfaceDefinition(surface).approvedUrl(url)) {
		throw new AdapterError("page_drift", "pre_submit", "Browser Runner tab left the approved channel");
	}
}

function isApprovedUrl(value: string | undefined, surface: BrowserExtensionSurface): boolean {
	if (!value) return false;
	try {
		return extensionSurfaceDefinition(surface).approvedUrl(new URL(value));
	} catch {
		return false;
	}
}

function adapterCode(value: unknown): AdapterError["code"] {
	if (
		value === "signed_out" ||
		value === "captcha" ||
		value === "rate_limited" ||
		value === "account_restricted" ||
		value === "page_drift" ||
		value === "response_timeout" ||
		value === "post_submit_unknown"
	) {
		return value;
	}
	return "page_drift";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
