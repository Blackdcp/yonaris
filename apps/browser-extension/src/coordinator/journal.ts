import type { BrowserExtensionClaim, TaskJournalEntry, TaskJournalPhase } from "../contracts";
import type { DeviceStorage } from "../storage";

const PHASE_ORDER: Record<Exclude<TaskJournalPhase, "needs_human">, number> = {
	claimed: 0,
	prepared: 1,
	submit_intent: 2,
	submitted: 3,
	collected: 4,
	uploaded: 5,
};

export class DurableTaskJournal {
	readonly #storage: DeviceStorage;
	readonly #onWrite?: (phase: TaskJournalPhase) => void;
	readonly #now: () => Date;

	constructor(storage: DeviceStorage, onWrite?: (phase: TaskJournalPhase) => void, now: () => Date = () => new Date()) {
		this.#storage = storage;
		this.#onWrite = onWrite;
		this.#now = now;
	}

	async start(
		claim: BrowserExtensionClaim,
		input: { tabId: number; runnerSessionId: string; promptSha256: string },
	): Promise<TaskJournalEntry> {
		const entries = await this.entries();
		if (entries[claim.taskId]) throw new Error("Task journal entry already exists");
		const entry: TaskJournalEntry = {
			taskId: claim.taskId,
			batchId: claim.batchId,
			brandId: claim.brandId,
			phase: "claimed",
			surfaceTargetKey: claim.surfaceTargetKey,
			tabId: input.tabId,
			runnerSessionId: input.runnerSessionId,
			promptSha256: input.promptSha256,
			updatedAt: this.#now().toISOString(),
		};
		await this.#storage.saveJournal(entry);
		this.#onWrite?.(entry.phase);
		return entry;
	}

	async advance(taskId: string, phase: Exclude<TaskJournalPhase, "claimed">): Promise<TaskJournalEntry> {
		const current = (await this.entries())[taskId];
		if (!current) throw new Error("Task journal entry does not exist");
		if (phase === current.phase) return current;
		if (current.phase === "needs_human" || current.phase === "uploaded") {
			throw new Error("Task journal phase is terminal");
		}
		if (phase !== "needs_human" && PHASE_ORDER[phase] <= PHASE_ORDER[current.phase]) {
			throw new Error("Task journal phase cannot move backwards");
		}
		const next = { ...current, phase, updatedAt: this.#now().toISOString() };
		await this.#storage.saveJournal(next);
		this.#onWrite?.(phase);
		return next;
	}

	async entries(): Promise<Record<string, TaskJournalEntry>> {
		return this.#storage.loadJournal();
	}

	async resumePostSubmit(taskId: string): Promise<TaskJournalEntry> {
		const current = (await this.entries())[taskId];
		if (!current || !["submitted", "collected", "uploaded", "needs_human"].includes(current.phase)) {
			throw new Error("Only a post-submit task can resume its original session");
		}
		const next = { ...current, phase: "submit_intent" as const, updatedAt: this.#now().toISOString() };
		await this.#storage.saveJournal(next);
		this.#onWrite?.(next.phase);
		return next;
	}

	async remove(taskId: string): Promise<void> {
		await this.#storage.removeJournal(taskId);
	}
}
