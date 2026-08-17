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
const JOURNAL_ENTRY_KEY_PREFIX = `${JOURNAL_KEY}:`;
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
const POST_SUBMIT_JOURNAL_PHASES = new Set<TaskJournalPhase>(["submit_intent", "submitted", "collected", "uploaded"]);

export interface ExtensionStorageArea {
	get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
}

export class DeviceStorage {
	#journalMigration: Promise<void> | null = null;

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
		await this.#ensureJournalMigrated();
		await this.area.set({ [journalEntryKey(entry.taskId)]: entry });
	}

	async loadJournal(): Promise<Record<string, TaskJournalEntry>> {
		await this.#ensureJournalMigrated();
		const stored = await this.area.get(null);
		const journal: Record<string, TaskJournalEntry> = {};
		const legacy = stored[JOURNAL_KEY];
		if (legacy !== undefined) {
			if (!isRecord(legacy)) throw new Error("Browser Runner task journal is invalid");
			for (const value of Object.values(legacy)) {
				const entry = validateJournalEntry(value);
				journal[entry.taskId] = entry;
			}
		}
		for (const [key, value] of Object.entries(stored)) {
			if (!key.startsWith(JOURNAL_ENTRY_KEY_PREFIX)) continue;
			const entry = validateJournalEntry(value);
			journal[entry.taskId] = entry;
		}
		return journal;
	}

	async removeJournal(taskId: string): Promise<void> {
		const key = journalEntryKey(taskId);
		await this.#ensureJournalMigrated();
		await this.area.remove(key);
	}

	async disconnect(): Promise<void> {
		const stored = await this.area.get(null);
		const keys = Object.keys(stored).filter(
			(key) => key === DEVICE_KEY || key === JOURNAL_KEY || key.startsWith(JOURNAL_ENTRY_KEY_PREFIX),
		);
		if (keys.length > 0) await this.area.remove(keys);
	}

	async dump(): Promise<Record<string, unknown>> {
		return this.area.get(null);
	}

	async #ensureJournalMigrated(): Promise<void> {
		this.#journalMigration ??= this.#migrateLegacyJournal();
		await this.#journalMigration;
	}

	async #migrateLegacyJournal(): Promise<void> {
		const stored = await this.area.get(null);
		const raw = stored[JOURNAL_KEY];
		if (raw === undefined) return;
		if (!isRecord(raw)) throw new Error("Browser Runner task journal is invalid");
		const migrated: Record<string, TaskJournalEntry> = {};
		for (const value of Object.values(raw)) {
			const entry = validateJournalEntry(value);
			const key = journalEntryKey(entry.taskId);
			const existing = stored[key] === undefined ? null : validateJournalEntry(stored[key]);
			if (!existing || (hasPostSubmitBoundary(entry) && !hasPostSubmitBoundary(existing))) {
				migrated[key] = entry;
			}
		}
		if (Object.keys(migrated).length > 0) await this.area.set(migrated);
		await this.area.remove(JOURNAL_KEY);
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
	let interruptedPhase: Exclude<TaskJournalPhase, "needs_human"> | undefined;
	if (value.interruptedPhase !== undefined) {
		if (
			value.phase !== "needs_human" ||
			typeof value.interruptedPhase !== "string" ||
			!JOURNAL_PHASES.has(value.interruptedPhase as TaskJournalPhase) ||
			value.interruptedPhase === "needs_human"
		) {
			throw new Error("Browser Runner interrupted journal phase is invalid");
		}
		interruptedPhase = value.interruptedPhase as Exclude<TaskJournalPhase, "needs_human">;
	}
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
		...(interruptedPhase ? { interruptedPhase } : {}),
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

function journalEntryKey(taskId: string): string {
	return `${JOURNAL_ENTRY_KEY_PREFIX}${requiredText(taskId, "taskId", 200)}`;
}

function hasPostSubmitBoundary(entry: TaskJournalEntry): boolean {
	const phase = entry.phase === "needs_human" ? entry.interruptedPhase : entry.phase;
	return phase !== undefined && POST_SUBMIT_JOURNAL_PHASES.has(phase);
}
