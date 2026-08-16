import { AdapterError, type CollectedAnswer, type ConsumerWebAdapter } from "../adapters/contracts";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import type { RunnerTab, RunnerTabDriver } from "./task-runner";

type AdapterCommand =
	| { kind: "yonaris_adapter"; action: "preflight" | "open_new_conversation" | "collect_current_answer" }
	| { kind: "yonaris_adapter"; action: "prepare" | "submit_once" | "confirm_submitted"; promptText: string };

type BrowserTab = { id?: number; url?: string; status?: string };

export interface ChromeTabsGateway {
	create(url: string): Promise<BrowserTab>;
	get(tabId: number): Promise<BrowserTab>;
	remove(tabId: number): Promise<void>;
	sendMessage(tabId: number, command: AdapterCommand): Promise<unknown>;
}

export class ChromeTabDriver implements RunnerTabDriver {
	readonly #gateway: ChromeTabsGateway;
	readonly #wait: (milliseconds: number) => Promise<void>;

	constructor(
		gateway: ChromeTabsGateway = chromeTabsGateway(),
		options: { wait?: (milliseconds: number) => Promise<void> } = {},
	) {
		this.#gateway = gateway;
		this.#wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	}

	async open(claim: BrowserExtensionClaim): Promise<RunnerTab> {
		assertApprovedUrl(claim.launchUrl, claim.surfaceTargetKey);
		const created = await this.#gateway.create(claim.launchUrl);
		if (!Number.isSafeInteger(created.id)) throw new Error("Chrome did not create a Browser Runner tab");
		return this.#waitForReady(created.id as number, claim.surfaceTargetKey);
	}

	async attach(tabId: number, surface: BrowserExtensionSurface): Promise<RunnerTab> {
		if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Browser Runner tab id is invalid");
		return this.#waitForReady(tabId, surface);
	}

	async #waitForReady(tabId: number, surface: BrowserExtensionSurface): Promise<RunnerTab> {
		for (let attempt = 0; attempt < 60; attempt += 1) {
			const tab = await this.#gateway.get(tabId);
			if (tab.url) assertApprovedUrl(tab.url, surface);
			if (tab.status === "complete") return this.#runnerTab(tabId, surface);
			await this.#wait(500);
		}
		throw new Error("Consumer page did not finish loading");
	}

	#runnerTab(tabId: number, surface: BrowserExtensionSurface): RunnerTab {
		return {
			tabId,
			adapter: new ContentScriptAdapter(this.#gateway, tabId, surface),
			close: () => this.#gateway.remove(tabId),
		};
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
		this.launchUrl = surface === "doubao.consumer_web" ? "https://www.doubao.com/chat/" : "https://chat.deepseek.com/";
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
		create: (url) => chrome.tabs.create({ url, active: false }),
		get: (tabId) => chrome.tabs.get(tabId),
		remove: (tabId) => chrome.tabs.remove(tabId),
		sendMessage: (tabId, command) => chrome.tabs.sendMessage(tabId, command),
	};
}

function assertApprovedUrl(value: string, surface: BrowserExtensionSurface): void {
	const url = new URL(value);
	const approved =
		surface === "doubao.consumer_web"
			? url.protocol === "https:" && (url.hostname === "doubao.com" || url.hostname.endsWith(".doubao.com"))
			: url.protocol === "https:" && url.hostname === "chat.deepseek.com";
	if (!approved || url.username || url.password) throw new Error("Browser Runner tab left the approved channel");
}

function adapterCode(value: unknown): AdapterError["code"] {
	if (
		value === "signed_out" ||
		value === "captcha" ||
		value === "rate_limited" ||
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
