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
	readonly #taskMutations = new Map<string, Promise<void>>();

	constructor(storage: DeviceStorage, onWrite?: (phase: TaskJournalPhase) => void, now: () => Date = () => new Date()) {
		this.#storage = storage;
		this.#onWrite = onWrite;
		this.#now = now;
	}

	async start(
		claim: BrowserExtensionClaim,
		input: { tabId: number; runnerSessionId: string; promptSha256: string },
	): Promise<TaskJournalEntry> {
		return this.#mutate(claim.taskId, async () => {
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
		});
	}

	async advance(taskId: string, phase: Exclude<TaskJournalPhase, "claimed">): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (!current) throw new Error("Task journal entry does not exist");
			if (phase === current.phase) return current;
			if (current.phase === "needs_human" || current.phase === "uploaded") {
				throw new Error("Task journal phase is terminal");
			}
			if (phase !== "needs_human" && PHASE_ORDER[phase] <= PHASE_ORDER[current.phase]) {
				throw new Error("Task journal phase cannot move backwards");
			}
			const next: TaskJournalEntry = {
				...current,
				phase,
				...(phase === "needs_human" ? { interruptedPhase: current.phase } : {}),
				updatedAt: this.#now().toISOString(),
			};
			await this.#storage.saveJournal(next);
			this.#onWrite?.(phase);
			return next;
		});
	}

	async entries(): Promise<Record<string, TaskJournalEntry>> {
		return this.#storage.loadJournal();
	}

	async resumePostSubmit(taskId: string): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			const interruptedPhase = current?.phase === "needs_human" ? current.interruptedPhase : current?.phase;
			if (!current || !interruptedPhase || !isPostSubmitPhase(interruptedPhase)) {
				throw new Error("Only a post-submit task can resume its original session");
			}
			const { interruptedPhase: _discarded, ...entry } = current;
			const next = { ...entry, phase: "submit_intent" as const, updatedAt: this.#now().toISOString() };
			await this.#storage.saveJournal(next);
			this.#onWrite?.(next.phase);
			return next;
		});
	}

	async resumePreSubmit(taskId: string): Promise<TaskJournalEntry> {
		return this.#resumePreSubmit(taskId, false);
	}

	async resumeServerAuthorizedPreSubmit(taskId: string): Promise<TaskJournalEntry> {
		return this.#resumePreSubmit(taskId, true);
	}

	#resumePreSubmit(taskId: string, serverAuthorized: boolean): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			const interruptedPhase = current?.phase === "needs_human" ? current.interruptedPhase : undefined;
			if (
				current?.phase !== "needs_human" ||
				(!serverAuthorized && (!interruptedPhase || isPostSubmitPhase(interruptedPhase)))
			) {
				throw new Error("Only a pre-submit needs-human task can resume in its original tab");
			}
			const { interruptedPhase: _discarded, ...entry } = current;
			const next = { ...entry, phase: "claimed" as const, updatedAt: this.#now().toISOString() };
			await this.#storage.saveJournal(next);
			this.#onWrite?.(next.phase);
			return next;
		});
	}

	async markPostSubmitBoundary(
		taskId: string,
		phase: "submit_intent" | "submitted" | "collected" | "uploaded",
	): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (current?.phase !== "needs_human") {
				throw new Error("Only a needs-human task can record a post-submit boundary");
			}
			const next = { ...current, interruptedPhase: phase, updatedAt: this.#now().toISOString() };
			await this.#storage.saveJournal(next);
			this.#onWrite?.(next.phase);
			return next;
		});
	}

	async alignNeedsHuman(taskId: string, stage: "pre_submit" | "post_submit"): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (!current) throw new Error("Task journal entry does not exist");
			const currentBoundary = current.phase === "needs_human" ? current.interruptedPhase : current.phase;
			const interruptedPhase =
				stage === "pre_submit"
					? currentBoundary && !isPostSubmitPhase(currentBoundary)
						? currentBoundary
						: "claimed"
					: currentBoundary && isPostSubmitPhase(currentBoundary)
						? currentBoundary
						: "submit_intent";
			const next: TaskJournalEntry = {
				...current,
				phase: "needs_human",
				interruptedPhase,
				updatedAt: this.#now().toISOString(),
			};
			await this.#storage.saveJournal(next);
			this.#onWrite?.(next.phase);
			return next;
		});
	}

	async remove(taskId: string): Promise<void> {
		await this.#mutate(taskId, () => this.#storage.removeJournal(taskId));
	}

	#mutate<T>(taskId: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.#taskMutations.get(taskId) ?? Promise.resolve();
		const result = previous.then(operation, operation);
		const settled = result.then(
			() => undefined,
			() => undefined,
		);
		this.#taskMutations.set(taskId, settled);
		void settled.then(() => {
			if (this.#taskMutations.get(taskId) === settled) this.#taskMutations.delete(taskId);
		});
		return result;
	}
}

function isPostSubmitPhase(phase: TaskJournalPhase): boolean {
	return ["submit_intent", "submitted", "collected", "uploaded"].includes(phase);
}
