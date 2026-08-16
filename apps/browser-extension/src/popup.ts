import { BrowserRunnerApiClient } from "./api-client";
import { PORTAL_ORIGIN } from "./contracts";
import { buildHeartbeat } from "./heartbeat";
import { chromeDeviceStorage } from "./storage";

const storage = chromeDeviceStorage();
const form = requiredElement<HTMLFormElement>("pairing-form");
const paired = requiredElement<HTMLElement>("paired");
const codeInput = requiredElement<HTMLInputElement>("pairing-code");
const pairButton = requiredElement<HTMLButtonElement>("pair");
const disconnectButton = requiredElement<HTMLButtonElement>("disconnect");
const refreshButton = requiredElement<HTMLButtonElement>("refresh");
const summary = requiredElement<HTMLElement>("device-summary");
const message = requiredElement<HTMLElement>("message");

form.addEventListener("submit", (event) => {
	event.preventDefault();
	void pair();
});
disconnectButton.addEventListener("click", () => void disconnect());
refreshButton.addEventListener("click", () => void refresh());

void render();

async function pair(): Promise<void> {
	setBusy(true);
	setMessage("");
	try {
		const client = new BrowserRunnerApiClient({ baseUrl: PORTAL_ORIGIN });
		const result = await client.pair({ code: codeInput.value, heartbeat: buildHeartbeat(navigator.userAgent) });
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
		setMessage(result?.ok ? "Portal status refreshed." : "Portal could not be reached.");
	} finally {
		setBusy(false);
	}
}

async function render(): Promise<void> {
	const device = await storage.loadDevice();
	form.hidden = device !== null;
	paired.hidden = device === null;
	if (device)
		summary.textContent = `Device ${device.deviceId.slice(0, 8)} · ${device.allowedBrandIds.length} customer assignment(s)`;
}

function setBusy(busy: boolean): void {
	pairButton.disabled = busy;
	disconnectButton.disabled = busy;
	refreshButton.disabled = busy;
}

function setMessage(value: string): void {
	message.textContent = value;
}

function requiredElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing extension UI element ${id}`);
	return element as T;
}
