import type { StructuredSearchQualification } from "./adapters/search-evidence";
import type { BrowserExtensionReadiness, BrowserExtensionSurface } from "./contracts";
import { CURRENT_ADAPTER_VERSIONS } from "./surface-readiness";
import { type ExtensionSurfaceDefinition, extensionSurfaceForUrl } from "./surface-registry";

export type QualificationTab = { id?: number; url?: string };

export interface QualificationTabsGateway {
	queryActive(): Promise<QualificationTab[]>;
	get?(tabId: number): Promise<QualificationTab>;
	sendMessage(
		tabId: number,
		command: { kind: "yonaris_adapter"; action: "inspect_search_evidence" | "preflight" },
	): Promise<unknown>;
}

export interface QualificationReadinessStore {
	loadSurfaceReadiness(): Promise<BrowserExtensionReadiness>;
	saveSurfaceReadiness(readiness: BrowserExtensionReadiness): Promise<void>;
}

export interface QualificationReadinessPublisher {
	confirmReadiness(readiness: BrowserExtensionReadiness): Promise<void>;
}

let qualificationTail: Promise<void> = Promise.resolve();

export type SurfaceQualification = Omit<StructuredSearchQualification, "status"> & {
	surface: BrowserExtensionSurface;
	label: string;
	status: StructuredSearchQualification["status"] | "ready";
};

export function qualifyAndRecordActiveSurfaceTab(
	store: QualificationReadinessStore,
	gateway: QualificationTabsGateway | undefined,
	publisher: QualificationReadinessPublisher,
): Promise<SurfaceQualification> {
	const tabsGateway = gateway ?? chromeQualificationTabsGateway();
	const attempt = qualificationTail.then(async () => {
		const active = await detectActiveSurface(tabsGateway);
		return performSurfaceQualification(store, active, tabsGateway, publisher);
	});
	qualificationTail = attempt.then(
		() => undefined,
		() => undefined,
	);
	return attempt;
}

export function qualifyAndRecordSurfaceTab(
	store: QualificationReadinessStore,
	tab: QualificationTab,
	gateway: QualificationTabsGateway,
	publisher: QualificationReadinessPublisher,
): Promise<SurfaceQualification> {
	const attempt = qualificationTail.then(() =>
		performSurfaceQualification(store, detectSurface(tab), gateway, publisher),
	);
	qualificationTail = attempt.then(
		() => undefined,
		() => undefined,
	);
	return attempt;
}

async function performSurfaceQualification(
	store: QualificationReadinessStore,
	active: { tabId: number; url: string; definition: ExtensionSurfaceDefinition },
	gateway: QualificationTabsGateway,
	publisher: QualificationReadinessPublisher,
): Promise<SurfaceQualification> {
	await assertQualificationTargetUnchanged(active, gateway);
	const readiness = await store.loadSurfaceReadiness();
	const revokedReadiness: BrowserExtensionReadiness = {
		...readiness,
		[active.definition.surface]: {
			status: "unavailable",
			adapterVersion: CURRENT_ADAPTER_VERSIONS[active.definition.surface],
			activeConcurrency: 0,
		},
	};
	await store.saveSurfaceReadiness(revokedReadiness);
	await publisher.confirmReadiness(revokedReadiness);
	const result = await inspectActiveSurface(active, gateway);
	if (result.status !== "ready" && result.status !== "qualified") return result;
	await assertQualificationTargetUnchanged(active, gateway);
	const readyReadiness: BrowserExtensionReadiness = {
		...revokedReadiness,
		[active.definition.surface]: {
			status: "ready",
			adapterVersion: CURRENT_ADAPTER_VERSIONS[active.definition.surface],
			activeConcurrency: 0,
		},
	};
	await store.saveSurfaceReadiness(readyReadiness);
	try {
		await publisher.confirmReadiness(readyReadiness);
	} catch (error) {
		await store.saveSurfaceReadiness(revokedReadiness);
		await publisher.confirmReadiness(revokedReadiness).catch(() => undefined);
		throw error;
	}
	return result;
}

async function assertQualificationTargetUnchanged(
	active: { tabId: number; url: string; definition: ExtensionSurfaceDefinition },
	gateway: QualificationTabsGateway,
): Promise<void> {
	if (!gateway.get) return;
	const current = detectSurface(await gateway.get(active.tabId));
	if (
		current.tabId !== active.tabId ||
		current.url !== active.url ||
		current.definition.surface !== active.definition.surface
	) {
		throw new Error("The supported AI page changed during qualification.");
	}
}

async function detectActiveSurface(gateway: QualificationTabsGateway): Promise<{
	tabId: number;
	url: string;
	definition: ExtensionSurfaceDefinition;
}> {
	const tabs = await gateway.queryActive();
	const tab = tabs.length === 1 ? tabs[0] : undefined;
	return detectSurface(tab);
}

function detectSurface(tab: QualificationTab | undefined): {
	tabId: number;
	url: string;
	definition: ExtensionSurfaceDefinition;
} {
	if (!tab || !Number.isSafeInteger(tab.id) || typeof tab.url !== "string") {
		throw new Error("Open one active supported domestic AI page before checking it.");
	}
	let definition: ExtensionSurfaceDefinition;
	try {
		definition = extensionSurfaceForUrl(new URL(tab.url));
	} catch {
		throw new Error("Open one active supported domestic AI page before checking it.");
	}
	return { tabId: tab.id as number, url: tab.url, definition };
}

async function inspectActiveSurface(
	active: { tabId: number; url: string; definition: ExtensionSurfaceDefinition },
	gateway: QualificationTabsGateway,
): Promise<SurfaceQualification> {
	const structured = active.definition.contract.searchEvidence !== null;
	if (structured && !isApprovedDoubaoConversationUrl(active.url)) {
		throw new Error("Open one active Doubao conversation tab before checking the page.");
	}
	const response = await gateway.sendMessage(active.tabId, {
		kind: "yonaris_adapter",
		action: structured ? "inspect_search_evidence" : "preflight",
	});
	if (!isRecord(response) || response.ok !== true) {
		throw new Error(adapterFailureMessage(response) ?? "The active AI page could not be checked safely.");
	}
	if (!structured) {
		return {
			surface: active.definition.surface,
			label: active.definition.label,
			status: "ready",
			answerCount: 0,
			queryCount: 0,
			citationCount: 0,
		};
	}
	if (!isRecord(response.value)) throw new Error("The active Doubao page could not be checked safely.");
	return {
		...parseQualification(response.value),
		surface: active.definition.surface,
		label: active.definition.label,
	};
}

export function qualifyAndRecordActiveDoubaoTab(
	store: QualificationReadinessStore,
	gateway: QualificationTabsGateway | undefined,
	publisher: QualificationReadinessPublisher,
): Promise<StructuredSearchQualification> {
	const attempt = qualificationTail.then(() => performQualification(store, gateway, publisher));
	qualificationTail = attempt.then(
		() => undefined,
		() => undefined,
	);
	return attempt;
}

async function performQualification(
	store: QualificationReadinessStore,
	gateway: QualificationTabsGateway | undefined,
	publisher: QualificationReadinessPublisher,
): Promise<StructuredSearchQualification> {
	const readiness = await store.loadSurfaceReadiness();
	const revokedReadiness: BrowserExtensionReadiness = {
		...readiness,
		"doubao.consumer_web": {
			status: "unavailable",
			adapterVersion: CURRENT_ADAPTER_VERSIONS["doubao.consumer_web"],
			activeConcurrency: 0,
		},
	};
	await store.saveSurfaceReadiness(revokedReadiness);
	await publisher.confirmReadiness(revokedReadiness);
	const result = await qualifyActiveDoubaoTab(gateway);
	if (result.status !== "qualified") return result;
	const readyReadiness: BrowserExtensionReadiness = {
		...revokedReadiness,
		"doubao.consumer_web": {
			status: "ready",
			adapterVersion: CURRENT_ADAPTER_VERSIONS["doubao.consumer_web"],
			activeConcurrency: 0,
		},
	};
	// Persist the completed qualification before publishing it. A worker stop here leaves the Portal unavailable;
	// a later heartbeat can safely publish this durable result. Publishing first could leave remote-only stale readiness.
	await store.saveSurfaceReadiness(readyReadiness);
	try {
		await publisher.confirmReadiness(readyReadiness);
	} catch (error) {
		await store.saveSurfaceReadiness(revokedReadiness);
		await publisher.confirmReadiness(revokedReadiness).catch(() => undefined);
		throw error;
	}
	return result;
}

export async function qualifyActiveDoubaoTab(
	gateway: QualificationTabsGateway = chromeQualificationTabsGateway(),
): Promise<StructuredSearchQualification> {
	const tabs = await gateway.queryActive();
	if (tabs.length !== 1) throw new Error("Open one active Doubao conversation tab before checking the page.");
	const tab = tabs[0];
	if (
		!tab ||
		!Number.isSafeInteger(tab.id) ||
		typeof tab.url !== "string" ||
		!isApprovedDoubaoConversationUrl(tab.url)
	) {
		throw new Error("Open one active Doubao conversation tab before checking the page.");
	}
	const response = await gateway.sendMessage(tab.id as number, {
		kind: "yonaris_adapter",
		action: "inspect_search_evidence",
	});
	if (!isRecord(response) || response.ok !== true || !isRecord(response.value)) {
		throw new Error(adapterFailureMessage(response) ?? "The active Doubao page could not be checked safely.");
	}
	return parseQualification(response.value);
}

function adapterFailureMessage(value: unknown): string | null {
	if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) return null;
	const message = value.error.message;
	if (typeof message !== "string" || !message.trim()) return null;
	return message.trim().slice(0, 500);
}

function chromeQualificationTabsGateway(): QualificationTabsGateway {
	return {
		queryActive: () => chrome.tabs.query({ active: true, currentWindow: true }),
		get: (tabId) => chrome.tabs.get(tabId),
		sendMessage: (tabId, command) => chrome.tabs.sendMessage(tabId, command),
	};
}

export function isApprovedDoubaoConversationUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return (
		url.protocol === "https:" &&
		!url.port &&
		!url.username &&
		!url.password &&
		!url.search &&
		!url.hash &&
		(url.hostname === "doubao.com" || url.hostname.endsWith(".doubao.com")) &&
		/^\/chat\/(?:[0-9]+|local_[0-9]+)$/u.test(url.pathname)
	);
}

function parseQualification(value: Record<string, unknown>): StructuredSearchQualification {
	const status = value.status;
	if (
		status !== "qualified" &&
		status !== "no_answer" &&
		status !== "no_search_evidence" &&
		status !== "no_citation_evidence" &&
		status !== "page_drift"
	) {
		throw new Error("The Doubao page check returned an invalid status.");
	}
	const answerCount = safeCount(value.answerCount, 1_000);
	const queryCount = safeCount(value.queryCount, 32);
	const citationCount = safeCount(value.citationCount, 100);
	if (
		status === "qualified"
			? queryCount < 1 || citationCount < 1 || answerCount < 1
			: queryCount !== 0 || citationCount !== 0
	) {
		throw new Error("The Doubao page check returned inconsistent counts.");
	}
	return { status, answerCount, queryCount, citationCount };
}

function safeCount(value: unknown, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
		throw new Error("The Doubao page check returned an invalid count.");
	}
	return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
