import type { SearchEvidenceProbeReport } from "./adapters/evidence-probe";
import { BrowserRunnerApiClient } from "./api-client";
import { BROWSER_EXTENSION_SURFACES, type BrowserExtensionSurface, PORTAL_ORIGIN } from "./contracts";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";
import type { SurfaceQualification } from "./surface-qualification-client";
import { extensionSurfaceDefinition } from "./surface-registry";

type SurfaceSummary = { succeeded: number; retryScheduled: number; needsHuman: number; incomplete: number };
type RuntimeSummary = {
	bySurface: Partial<Record<BrowserExtensionSurface, SurfaceSummary>>;
};
type ManualRecoveryCandidate = {
	taskId: string;
	surfaceTargetKey: BrowserExtensionSurface;
	updatedAt: string;
	canAttemptRecovery: boolean;
	recoveryStage: "pre_submit" | "post_submit";
};

const storage = chromeDeviceStorage();
const form = requiredElement<HTMLFormElement>("pairing-form");
const paired = requiredElement<HTMLElement>("paired");
const codeInput = requiredElement<HTMLInputElement>("pairing-code");
const pairButton = requiredElement<HTMLButtonElement>("pair");
const disconnectButton = requiredElement<HTMLButtonElement>("disconnect");
const refreshButton = requiredElement<HTMLButtonElement>("refresh");
const runNowButton = requiredElement<HTMLButtonElement>("run-now");
const inspectSurfaceButton = requiredElement<HTMLButtonElement>("inspect-surface");
const inspectSearchEvidenceButton = requiredElement<HTMLButtonElement>("inspect-search-evidence");
const searchEvidenceReport = requiredElement<HTMLElement>("search-evidence-report");
const searchEvidenceSummary = requiredElement<HTMLElement>("search-evidence-summary");
const searchEvidenceCandidates = requiredElement<HTMLElement>("search-evidence-candidates");
const copySearchEvidenceButton = requiredElement<HTMLButtonElement>("copy-search-evidence");
const summary = requiredElement<HTMLElement>("device-summary");
const channels = requiredElement<HTMLElement>("channels");
const surfaceStatuses = createSurfaceRows(channels);
const manualRecovery = requiredElement<HTMLElement>("manual-recovery");
const manualRecoveryList = requiredElement<HTMLElement>("manual-recovery-list");
const message = requiredElement<HTMLElement>("message");
let lastSearchEvidenceReport: SearchEvidenceProbeReport | null = null;

form.addEventListener("submit", (event) => {
	event.preventDefault();
	void pair();
});
disconnectButton.addEventListener("click", () => void disconnect());
refreshButton.addEventListener("click", () => void refresh());
runNowButton.addEventListener("click", () => void runNow());
inspectSurfaceButton.addEventListener("click", () => void inspectSurface());
inspectSearchEvidenceButton.addEventListener("click", () => void inspectSearchEvidence());
copySearchEvidenceButton.addEventListener("click", () => void copySearchEvidence());

void render();

async function pair(): Promise<void> {
	setBusy(true);
	setMessage("");
	try {
		const client = new BrowserRunnerApiClient({ baseUrl: PORTAL_ORIGIN });
		const result = await client.pair({
			code: codeInput.value,
			heartbeat: buildHeartbeat(navigator.userAgent, await storage.loadSurfaceReadiness()),
		});
		await storage.saveDevice({ portalBaseUrl: PORTAL_ORIGIN, ...result });
		codeInput.value = "";
		await chrome.runtime.sendMessage({ type: "browser-runner:heartbeat" });
		await render();
	} catch (error) {
		setMessage(error instanceof Error ? error.message : "Pairing failed.");
	} finally {
		setBusy(false);
	}
}

async function disconnect(): Promise<void> {
	if (!globalThis.confirm("Disconnect this Chrome from Yonaris?")) return;
	await storage.disconnect();
	await render();
}

async function refresh(): Promise<void> {
	setBusy(true);
	try {
		const result = (await chrome.runtime.sendMessage({ type: "browser-runner:heartbeat" })) as { ok?: boolean };
		await renderRuntimeStatus();
		setMessage(result?.ok ? "Portal status refreshed." : "Portal could not be reached.");
	} finally {
		setBusy(false);
	}
}

async function runNow(): Promise<void> {
	setBusy(true);
	setMessage("Checking for started work. You can close this popup.");
	try {
		const result = (await chrome.runtime.sendMessage({ type: "browser-runner:run-now" })) as {
			ok?: boolean;
			summary?: RuntimeSummary | null;
		};
		if (!result.ok) throw new Error("Browser Runner could not check for work.");
		renderSummary(result.summary ?? null);
		setMessage(result.summary ? "Work check finished." : "Pair this Chrome before running work.");
	} catch (error) {
		setMessage(error instanceof Error ? error.message : "Browser Runner could not check for work.");
	} finally {
		setBusy(false);
	}
}

async function inspectSurface(): Promise<void> {
	setBusy(true);
	setMessage("Checking the current AI page without creating a conversation or sending a prompt.");
	try {
		const response = (await chrome.runtime.sendMessage({ type: "browser-runner:qualify-surface" })) as {
			ok?: boolean;
			result?: SurfaceQualification;
			error?: string;
		};
		if (!response.ok || !response.result) {
			throw new Error(response.error ?? "The active AI page could not be checked safely.");
		}
		const result = response.result;
		if (result.status === "ready") {
			setMessage(`${result.label} page controls are ready. This platform is now enabled. No prompt was sent.`);
		} else if (result.status === "qualified") {
			setMessage(
				`${result.label} search and source structure passed: ${result.queryCount} quer${result.queryCount === 1 ? "y" : "ies"}, ${result.citationCount} citation${result.citationCount === 1 ? "" : "s"}. No prompt was sent.`,
			);
		} else if (result.status === "no_search_evidence") {
			setMessage(`${result.label} has no visible search block. Open an existing searched answer and check again.`);
		} else if (result.status === "no_citation_evidence") {
			setMessage(
				`${result.label} has no visible source link. Open an answer with at least one source and check again.`,
			);
		} else if (result.status === "no_answer") {
			setMessage(`${result.label} has no visible answer to check.`);
		} else {
			setMessage(`${result.label} did not pass the read-only page check.`);
		}
	} catch (error) {
		setMessage(error instanceof Error ? error.message : "The active AI page could not be checked safely.");
	} finally {
		setBusy(false);
	}
}

async function inspectSearchEvidence(): Promise<void> {
	setBusy(true);
	setMessage("Inspecting the active conversation without sending a prompt.");
	searchEvidenceReport.hidden = true;
	try {
		const response = (await chrome.runtime.sendMessage({
			type: "browser-runner:inspect-active-search-evidence",
		})) as { ok?: boolean; report?: SearchEvidenceProbeReport; error?: string };
		if (!response.ok || !response.report) throw new Error(response.error ?? "The evidence probe failed safely.");
		lastSearchEvidenceReport = response.report;
		renderSearchEvidenceReport(response.report);
		setMessage("Read-only evidence inspection finished. No prompt was sent.");
	} catch (error) {
		lastSearchEvidenceReport = null;
		setMessage(error instanceof Error ? error.message : "The evidence probe failed safely.");
	} finally {
		setBusy(false);
	}
}

function renderSearchEvidenceReport(report: SearchEvidenceProbeReport): void {
	searchEvidenceSummary.textContent = `${extensionSurfaceDefinition(report.surface).label} · ${report.adapterVersion} · ${report.answerCount} answer(s) · ${report.candidates.length} candidate(s)${report.truncated ? " · truncated" : ""} · ${report.pageUrlShape}`;
	searchEvidenceCandidates.replaceChildren();
	for (const candidate of report.candidates) {
		const item = document.createElement("li");
		const structural = [
			candidate.relation,
			candidate.textCategory,
			candidate.tag,
			candidate.role,
			...candidate.classTokens,
			...candidate.ariaNames,
			...candidate.dataAttributeNames,
			candidate.hrefHostname,
		].filter((value): value is string => Boolean(value));
		item.textContent = structural.join(" · ");
		searchEvidenceCandidates.append(item);
	}
	searchEvidenceReport.hidden = false;
}

async function copySearchEvidence(): Promise<void> {
	if (!lastSearchEvidenceReport) return;
	await navigator.clipboard.writeText(JSON.stringify(lastSearchEvidenceReport, null, 2));
	setMessage("Redacted evidence report copied.");
}

async function render(): Promise<void> {
	const device = await storage.loadDevice();
	form.hidden = device !== null;
	paired.hidden = device === null;
	if (device) {
		summary.textContent = `Device ${device.deviceId.slice(0, 8)} · ${device.allowedBrandIds.length} customer assignment(s)`;
		await renderRuntimeStatus();
		await renderManualRecoveries();
	}
}

async function renderManualRecoveries(): Promise<void> {
	const response = (await chrome.runtime.sendMessage({ type: "browser-runner:manual-recovery-list" })) as {
		ok?: boolean;
		entries?: ManualRecoveryCandidate[];
	};
	const entries = response.ok && Array.isArray(response.entries) ? response.entries : [];
	manualRecoveryList.replaceChildren();
	for (const entry of entries) {
		const button = document.createElement("button");
		button.type = "button";
		button.dataset.recoverable = String(entry.canAttemptRecovery);
		button.disabled = !entry.canAttemptRecovery;
		button.textContent = `${recoveryLabel(entry)} ${channelName(entry.surfaceTargetKey)} …${entry.taskId.slice(-8)} · ${new Date(entry.updatedAt).toLocaleString()}`;
		button.addEventListener("click", () => void resumeNeedsHuman(entry));
		manualRecoveryList.append(button);
	}
	manualRecovery.hidden = entries.length === 0;
}

async function resumeNeedsHuman(entry: ManualRecoveryCandidate): Promise<void> {
	const { taskId } = entry;
	setBusy(true);
	setMessage(
		entry.recoveryStage === "pre_submit"
			? `Continuing task …${taskId.slice(-8)} after the administrator check.`
			: `Recovering stopped session …${taskId.slice(-8)} without resubmitting.`,
	);
	try {
		const response = (await chrome.runtime.sendMessage({
			type: "browser-runner:manual-recovery-run",
			taskId,
		})) as { ok?: boolean; result?: { status?: string; code?: string } };
		if (!response.ok || !response.result) throw new Error("The stopped session could not be recovered.");
		setMessage(
			response.result.status === "succeeded"
				? `Recovered session …${taskId.slice(-8)}.`
				: `Session …${taskId.slice(-8)} still needs attention (${response.result.code ?? response.result.status}).`,
		);
		await renderManualRecoveries();
	} catch (error) {
		setMessage(error instanceof Error ? error.message : "The stopped session could not be recovered.");
	} finally {
		setBusy(false);
	}
}

async function renderRuntimeStatus(): Promise<void> {
	const status = (await chrome.runtime.sendMessage({ type: "browser-runner:status" })) as {
		running?: boolean;
		lastRun?: { summary?: RuntimeSummary | null } | null;
	};
	if (status.running) {
		for (const element of surfaceStatuses.values()) element.textContent = "Running";
		return;
	}
	renderSummary(status.lastRun?.summary ?? null);
}

function renderSummary(value: RuntimeSummary | null): void {
	for (const surface of BROWSER_EXTENSION_SURFACES) {
		const element = surfaceStatuses.get(surface);
		if (element) element.textContent = channelSummary(value?.bySurface?.[surface]);
	}
}

function channelSummary(value: SurfaceSummary | undefined): string {
	if (!value) return "Waiting";
	if (value.needsHuman > 0 || value.incomplete > 0) return "Needs attention";
	if (value.succeeded > 0) return `${value.succeeded} completed`;
	if (value.retryScheduled > 0) return "Retry queued";
	return "No started work";
}

function channelName(surface: ManualRecoveryCandidate["surfaceTargetKey"]): string {
	return extensionSurfaceDefinition(surface).label;
}

function recoveryLabel(entry: ManualRecoveryCandidate): string {
	if (!entry.canAttemptRecovery) return "Review";
	return entry.recoveryStage === "pre_submit" ? "Continue" : "Recover response";
}

function setBusy(busy: boolean): void {
	pairButton.disabled = busy;
	disconnectButton.disabled = busy;
	refreshButton.disabled = busy;
	runNowButton.disabled = busy;
	inspectSurfaceButton.disabled = busy;
	inspectSearchEvidenceButton.disabled = busy;
	copySearchEvidenceButton.disabled = busy;
	for (const button of manualRecoveryList.querySelectorAll("button")) {
		button.disabled = busy || button.dataset.recoverable !== "true";
	}
}

function createSurfaceRows(container: HTMLElement): Map<BrowserExtensionSurface, HTMLElement> {
	const statuses = new Map<BrowserExtensionSurface, HTMLElement>();
	container.replaceChildren();
	for (const surface of BROWSER_EXTENSION_SURFACES) {
		const row = document.createElement("p");
		row.dataset.surface = surface;
		const label = document.createElement("span");
		label.textContent = extensionSurfaceDefinition(surface).label;
		const status = document.createElement("strong");
		status.textContent = "Waiting";
		row.append(label, status);
		container.append(row);
		statuses.set(surface, status);
	}
	return statuses;
}

function setMessage(value: string): void {
	message.textContent = value;
}

function requiredElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing extension UI element ${id}`);
	return element as T;
}
