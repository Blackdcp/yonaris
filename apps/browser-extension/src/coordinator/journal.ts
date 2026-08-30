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
const POST_SUBMIT_PHASES = new Set<TaskJournalPhase>(["submit_intent", "submitted", "collected", "uploaded"]);
const AUTOMATIC_RECOVERY_BLOCKING_FAILURE_CODES = new Set([
	"signed_out",
	"captcha",
	"account_restricted",
	"rate_limited",
	"page_drift",
]);
const FIRST_AUTOMATIC_RECOVERY_DELAY_MS = 2 * 60 * 1_000;
const SECOND_AUTOMATIC_RECOVERY_DELAY_MS = 10 * 60 * 1_000;

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

	async markNeedsHuman(taskId: string, failureCode: string): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (!current) throw new Error("Task journal entry does not exist");
			const interruptedPhase = current.phase === "needs_human" ? current.interruptedPhase : current.phase;
			if (!interruptedPhase) throw new Error("Task journal interrupted phase is unavailable");
			const next: TaskJournalEntry = {
				...current,
				phase: "needs_human",
				interruptedPhase,
				needsHumanFailureCode: failureCode,
				updatedAt: this.#now().toISOString(),
			};
			await this.#storage.saveJournal(next);
			this.#onWrite?.(next.phase);
			return next;
		});
	}

	async recordNeedsHumanFailure(taskId: string, failureCode: string): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (current?.phase !== "needs_human") {
				throw new Error("Only a needs-human task can record its failure code");
			}
			const next = { ...current, needsHumanFailureCode: failureCode };
			await this.#storage.saveJournal(next);
			return next;
		});
	}

	async duePostSubmitRecoveries(): Promise<TaskJournalEntry[]> {
		const now = this.#now().getTime();
		return Object.values(await this.entries())
			.filter((entry) => {
				const dueAt = automaticRecoveryDueAt(entry);
				return dueAt !== null && dueAt <= now;
			})
			.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.taskId.localeCompare(right.taskId));
	}

	async recordPostSubmitRecoveryAttempt(taskId: string): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			const current = (await this.entries())[taskId];
			if (!current) throw new Error("Task journal entry does not exist");
			const attemptCount = current.autoRecoveryAttemptCount ?? 0;
			if (attemptCount >= 2) throw new Error("Automatic recovery attempts exhausted");
			const now = this.#now();
			const dueAt = automaticRecoveryDueAt(current);
			if (dueAt === null || dueAt > now.getTime()) {
				throw new Error("Task is not eligible for automatic post-submit recovery");
			}
			const { autoRecoveryNextAt: _discarded, ...entry } = current;
			const nextAttemptCount = attemptCount + 1;
			const next: TaskJournalEntry = {
				...entry,
				autoRecoveryAttemptCount: nextAttemptCount,
				...(nextAttemptCount === 1
					? { autoRecoveryNextAt: new Date(now.getTime() + SECOND_AUTOMATIC_RECOVERY_DELAY_MS).toISOString() }
					: {}),
			};
			await this.#storage.saveJournal(next);
			return next;
		});
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
			if (current.phase === "needs_human" && current.interruptedPhase === interruptedPhase) return current;
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

	async rebindNeedsHumanTab(taskId: string, tabId: number): Promise<TaskJournalEntry> {
		return this.#mutate(taskId, async () => {
			if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("Browser Runner tab id is invalid");
			const current = (await this.entries())[taskId];
			if (current?.phase !== "needs_human") {
				throw new Error("Only a needs-human task can rebind its browser tab");
			}
			if (current.tabId === tabId) return current;
			const next = { ...current, tabId, updatedAt: this.#now().toISOString() };
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
	return POST_SUBMIT_PHASES.has(phase);
}

function automaticRecoveryDueAt(entry: TaskJournalEntry): number | null {
	if (
		entry.phase !== "needs_human" ||
		!entry.interruptedPhase ||
		!isPostSubmitPhase(entry.interruptedPhase) ||
		(entry.needsHumanFailureCode && AUTOMATIC_RECOVERY_BLOCKING_FAILURE_CODES.has(entry.needsHumanFailureCode))
	) {
		return null;
	}
	const attemptCount = entry.autoRecoveryAttemptCount ?? 0;
	if (attemptCount === 0) return new Date(entry.updatedAt).getTime() + FIRST_AUTOMATIC_RECOVERY_DELAY_MS;
	if (attemptCount === 1 && entry.autoRecoveryNextAt) return new Date(entry.autoRecoveryNextAt).getTime();
	return null;
}
