import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionSurface,
	type PairedDeviceConfig,
	PORTAL_ORIGIN,
	type TaskJournalEntry,
	type TaskJournalPhase,
} from "./contracts";

const DEVICE_KEY = "browserRunnerDevice";
const JOURNAL_KEY = "browserRunnerJournal";
const DEVICE_TOKEN_PATTERN = /^yrd_[A-Za-z0-9_-]{43}$/;
const JOURNAL_PHASES = new Set<TaskJournalPhase>([
	"claimed",
	"prepared",
	"submit_intent",
	"submitted",
	"collected",
	"uploaded",
	"needs_human",
]);

export interface ExtensionStorageArea {
	get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
}

export class DeviceStorage {
	constructor(private readonly area: ExtensionStorageArea) {}

	async saveDevice(input: PairedDeviceConfig): Promise<void> {
		await this.area.set({ [DEVICE_KEY]: validateDevice(input) });
	}

	async loadDevice(): Promise<PairedDeviceConfig | null> {
		const raw = (await this.area.get(DEVICE_KEY))[DEVICE_KEY];
		if (raw === undefined) return null;
		return validateDevice(raw);
	}

	async saveJournal(input: TaskJournalEntry): Promise<void> {
		const entry = validateJournalEntry(input);
		const current = await this.loadJournal();
		await this.area.set({ [JOURNAL_KEY]: { ...current, [entry.taskId]: entry } });
	}

	async loadJournal(): Promise<Record<string, TaskJournalEntry>> {
		const raw = (await this.area.get(JOURNAL_KEY))[JOURNAL_KEY];
		if (raw === undefined) return {};
		if (!isRecord(raw)) throw new Error("Browser Runner task journal is invalid");
		const journal: Record<string, TaskJournalEntry> = {};
		for (const value of Object.values(raw)) {
			const entry = validateJournalEntry(value);
			journal[entry.taskId] = entry;
		}
		return journal;
	}

	async removeJournal(taskId: string): Promise<void> {
		const current = await this.loadJournal();
		delete current[requiredText(taskId, "taskId", 200)];
		if (Object.keys(current).length === 0) {
			await this.area.remove(JOURNAL_KEY);
			return;
		}
		await this.area.set({ [JOURNAL_KEY]: current });
	}

	async disconnect(): Promise<void> {
		await this.area.remove([DEVICE_KEY, JOURNAL_KEY]);
	}

	async dump(): Promise<Record<string, unknown>> {
		return this.area.get(null);
	}
}

export function chromeDeviceStorage(): DeviceStorage {
	return new DeviceStorage({
		get: (keys) => chrome.storage.local.get(keys ?? null),
		set: (items) => chrome.storage.local.set(items),
		remove: (keys) => chrome.storage.local.remove(keys),
	});
}

function validateDevice(value: unknown): PairedDeviceConfig {
	if (!isRecord(value)) throw new Error("Browser Runner device configuration is invalid");
	if (value.portalBaseUrl !== PORTAL_ORIGIN) throw new Error("Browser Runner Portal origin is invalid");
	const deviceId = requiredText(value.deviceId, "deviceId", 200);
	const deviceToken = requiredText(value.deviceToken, "deviceToken", 100);
	if (!DEVICE_TOKEN_PATTERN.test(deviceToken)) throw new Error("Browser Runner device token is invalid");
	if (!Array.isArray(value.allowedBrandIds) || value.allowedBrandIds.length < 1 || value.allowedBrandIds.length > 100) {
		throw new Error("Browser Runner brand assignments are invalid");
	}
	const allowedBrandIds = value.allowedBrandIds.map((brandId) => requiredText(brandId, "brandId", 200));
	if (new Set(allowedBrandIds).size !== allowedBrandIds.length) {
		throw new Error("Browser Runner brand assignments contain duplicates");
	}
	return { portalBaseUrl: PORTAL_ORIGIN, deviceId, deviceToken, allowedBrandIds };
}

function validateJournalEntry(value: unknown): TaskJournalEntry {
	if (!isRecord(value)) throw new Error("Browser Runner task journal entry is invalid");
	const taskId = requiredText(value.taskId, "taskId", 200);
	const batchId = requiredText(value.batchId, "batchId", 200);
	const brandId = requiredText(value.brandId, "brandId", 300);
	if (typeof value.phase !== "string" || !JOURNAL_PHASES.has(value.phase as TaskJournalPhase)) {
		throw new Error("Browser Runner task journal phase is invalid");
	}
	if (
		typeof value.surfaceTargetKey !== "string" ||
		!(BROWSER_EXTENSION_SURFACES as readonly string[]).includes(value.surfaceTargetKey)
	) {
		throw new Error("Browser Runner task journal surface is invalid");
	}
	const updatedAt = requiredText(value.updatedAt, "updatedAt", 50);
	if (!Number.isFinite(new Date(updatedAt).getTime())) throw new Error("Browser Runner task journal time is invalid");
	if (!Number.isSafeInteger(value.tabId) || (value.tabId as number) < 0) {
		throw new Error("Browser Runner task journal tabId is invalid");
	}
	const runnerSessionId = requiredText(value.runnerSessionId, "runnerSessionId", 300);
	const promptSha256 = requiredText(value.promptSha256, "promptSha256", 64);
	if (!/^[0-9a-f]{64}$/.test(promptSha256)) throw new Error("Browser Runner task journal prompt digest is invalid");
	return {
		taskId,
		batchId,
		brandId,
		phase: value.phase as TaskJournalPhase,
		surfaceTargetKey: value.surfaceTargetKey as BrowserExtensionSurface,
		tabId: value.tabId as number,
		runnerSessionId,
		promptSha256,
		updatedAt,
	};
}

function requiredText(value: unknown, field: string, maximum: number): string {
	if (typeof value !== "string") throw new Error(`Browser Runner ${field} is required`);
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) throw new Error(`Browser Runner ${field} is invalid`);
	return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
