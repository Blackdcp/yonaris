import type { ClaimedRunnerTask, ClaimedTaskSource, FixtureTask } from "./contracts.js";

export class FixtureTaskSource implements ClaimedTaskSource {
	readonly #tasks: FixtureTask[];
	#nextIndex = 0;

	constructor(tasks: readonly FixtureTask[]) {
		this.#tasks = [...tasks];
	}

	async claimNext(batchId?: string): Promise<ClaimedRunnerTask | null> {
		while (this.#nextIndex < this.#tasks.length) {
			const task = this.#tasks[this.#nextIndex++];
			if (!task) return null;
			if (batchId && task.batchId !== batchId) continue;
			return { task };
		}
		return null;
	}

	queueState() {
		return this.#nextIndex >= this.#tasks.length ? ("settled" as const) : ("waiting" as const);
	}

	async retryPreSubmit(claimed: ClaimedRunnerTask) {
		return {
			state: "reclaimed" as const,
			claimed: {
				...claimed,
				task: {
					...claimed.task,
					automationAttemptCount: claimed.task.automationAttemptCount + 1,
					leaseGeneration: claimed.task.leaseGeneration + 1,
				},
			},
		};
	}

	async recordSubmitIntent(): Promise<void> {}

	async confirmPromptSubmitted(): Promise<void> {}
}
