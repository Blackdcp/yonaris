import type {
	BrowserExtensionClaim,
	BrowserExtensionSurface,
	BrowserTaskReconciliation,
	PairedDeviceConfig,
	TaskJournalEntry,
} from "../contracts";
import type { DeviceStorage } from "../storage";
import { readySurfaces } from "../surface-readiness";
import { AdaptiveSurfacePool } from "./concurrency";
import { DurableTaskJournal } from "./journal";
import { pollStartedWork, type SurfacePollSummary } from "./poller";
import { type RunnerApi, type RunnerTabDriver, runClaimedTask, type TaskRunResult } from "./task-runner";

export interface RunnerControlApi extends RunnerApi {
	claimNext(brandId: string, surface: BrowserExtensionSurface): Promise<BrowserExtensionClaim | null>;
	reconcileTask(taskId: string, brandId: string): Promise<BrowserTaskReconciliation>;
	resume(taskId: string, brandId: string, stage: RecoveryStage): Promise<BrowserExtensionClaim>;
}

type RecoveryStage = "pre_submit" | "post_submit";

export type ExtensionRunSummary = {
	bySurface: Record<BrowserExtensionSurface, SurfacePollSummary>;
	recovered: number;
	recoveryIncomplete: number;
};

export type ManualRecoveryResult =
	| ({ taskId: string } & TaskRunResult)
	| { taskId: string; status: "not_recoverable"; code: string };

export type ManualRecoveryCandidate = Pick<TaskJournalEntry, "taskId" | "surfaceTargetKey" | "updatedAt"> & {
	canAttemptRecovery: boolean;
	recoveryStage: RecoveryStage;
};

type ExtensionCoordinatorDependencies = {
	storage: DeviceStorage;
	apiFactory(device: PairedDeviceConfig): RunnerControlApi;
	tabs: RunnerTabDriver;
	browserVersion: string;
	notify?(result: TaskRunResult, surface: BrowserExtensionSurface): Promise<void> | void;
};

export class ExtensionCoordinator {
	readonly #dependencies: ExtensionCoordinatorDependencies;
	readonly #pools: Record<BrowserExtensionSurface, AdaptiveSurfacePool> = {
		"doubao.consumer_web": new AdaptiveSurfacePool(),
		"deepseek.consumer_web": new AdaptiveSurfacePool(),
	};

	constructor(dependencies: ExtensionCoordinatorDependencies) {
		this.#dependencies = dependencies;
	}

	async runOnce(): Promise<ExtensionRunSummary | null> {
		const device = await this.#dependencies.storage.loadDevice();
		if (!device) return null;
		const api = this.#dependencies.apiFactory(device);
		const journal = new DurableTaskJournal(this.#dependencies.storage);
		if ((await this.#reconcileJournalBeforePoll(api, journal)) === "stop") {
			return { bySurface: emptySurfaceSummaries(), recovered: 0, recoveryIncomplete: 0 };
		}
		const surfaces = readySurfaces(await this.#dependencies.storage.loadSurfaceReadiness());
		const polled = await pollStartedWork({
			brandIds: device.allowedBrandIds,
			surfaces,
			pools: this.#pools,
			claim: (brandId, surface) => api.claimNext(brandId, surface),
			run: async (claim) => {
				const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
				await this.#dependencies.notify?.(result, claim.surfaceTargetKey);
				return result;
			},
		});
		return { ...polled, recovered: 0, recoveryIncomplete: 0 };
	}

	async recoverNeedsHuman(taskId: string): Promise<ManualRecoveryResult> {
		const device = await this.#dependencies.storage.loadDevice();
		if (!device) return { taskId, status: "not_recoverable", code: "device_not_paired" };
		const api = this.#dependencies.apiFactory(device);
		const journal = new DurableTaskJournal(this.#dependencies.storage);
		const entry = (await journal.entries())[taskId];
		if (entry?.phase !== "needs_human") {
			return { taskId, status: "not_recoverable", code: "local_task_not_waiting" };
		}
		const requestedStage = manualRecoveryStage(entry);
		let recoveryStage = requestedStage;

		let claim: BrowserExtensionClaim | undefined;
		try {
			claim = await api.resume(entry.taskId, entry.brandId, requestedStage);
			recoveryStage = claim.postSubmitAssist ? "post_submit" : "pre_submit";
			await assertManualResumeClaim(entry, claim, recoveryStage);
			await this.#dependencies.tabs.activate(entry.tabId);
			if (recoveryStage === "pre_submit") {
				if (requestedStage === "pre_submit") await journal.resumePreSubmit(taskId);
				else await journal.resumeServerAuthorizedPreSubmit(taskId);
			} else if (requestedStage === "pre_submit" || !entry.interruptedPhase) {
				await journal.markPostSubmitBoundary(taskId, claim.submitConfirmed ? "submitted" : "submit_intent");
			}
		} catch {
			if (claim) {
				await api
					.failTask(claim, {
						stage: recoveryStage,
						code: "manual_resume_failed",
						reason: "The exact local browser task could not be resumed after a new lease was issued",
					})
					.catch(() => undefined);
			}
			return { taskId, status: "needs_human", code: "manual_resume_failed" };
		}

		const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
		await this.#dependencies.notify?.(result, entry.surfaceTargetKey);
		return { taskId, ...result };
	}

	async listNeedsHuman(): Promise<ManualRecoveryCandidate[]> {
		const journal = new DurableTaskJournal(this.#dependencies.storage);
		return Object.values(await journal.entries())
			.filter((entry) => entry.phase === "needs_human")
			.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
			.map((entry) => ({
				taskId: entry.taskId,
				surfaceTargetKey: entry.surfaceTargetKey,
				updatedAt: entry.updatedAt,
				canAttemptRecovery: true,
				recoveryStage: manualRecoveryStage(entry),
			}));
	}

	async #reconcileJournalBeforePoll(api: RunnerControlApi, journal: DurableTaskJournal): Promise<"continue" | "stop"> {
		let shouldStop = false;
		for (const entry of Object.values(await journal.entries())) {
			let reconciliation: BrowserTaskReconciliation;
			try {
				reconciliation = await api.reconcileTask(entry.taskId, entry.brandId);
				await assertTaskReconciliation(entry, reconciliation);
			} catch {
				return "stop";
			}
			switch (reconciliation.state) {
				case "terminal":
					await journal.remove(entry.taskId);
					continue;
				case "released":
					await journal.remove(entry.taskId);
					continue;
				case "active":
				case "blocked":
					shouldStop = true;
					continue;
				case "resumable_pre":
					await journal.alignNeedsHuman(entry.taskId, "pre_submit");
					shouldStop = true;
					continue;
				case "resumable_post":
					if (reconciliation.runnerSessionId !== entry.runnerSessionId) {
						shouldStop = true;
						continue;
					}
					await journal.alignNeedsHuman(entry.taskId, "post_submit");
					shouldStop = true;
					continue;
			}
		}
		return shouldStop ? "stop" : "continue";
	}

	#taskDependencies(api: RunnerControlApi, journal: DurableTaskJournal) {
		return {
			api,
			journal,
			tabs: this.#dependencies.tabs,
			browserVersion: this.#dependencies.browserVersion,
		};
	}
}

function emptySurfaceSummaries(): Record<BrowserExtensionSurface, SurfacePollSummary> {
	return {
		"doubao.consumer_web": { succeeded: 0, retryScheduled: 0, needsHuman: 0, incomplete: 0 },
		"deepseek.consumer_web": { succeeded: 0, retryScheduled: 0, needsHuman: 0, incomplete: 0 },
	};
}

function isPostSubmitPhase(phase: string): boolean {
	return ["submit_intent", "submitted", "collected", "uploaded"].includes(phase);
}

function manualRecoveryStage(entry: TaskJournalEntry): RecoveryStage {
	return entry.interruptedPhase && !isPostSubmitPhase(entry.interruptedPhase) ? "pre_submit" : "post_submit";
}

async function assertManualResumeClaim(
	entry: TaskJournalEntry,
	claim: BrowserExtensionClaim,
	stage: RecoveryStage,
): Promise<void> {
	if (
		claim.taskId !== entry.taskId ||
		claim.batchId !== entry.batchId ||
		claim.brandId !== entry.brandId ||
		claim.surfaceTargetKey !== entry.surfaceTargetKey ||
		(await sha256(claim.promptText)) !== entry.promptSha256
	) {
		throw new Error("Portal did not authorize this exact browser task");
	}
	if (stage === "post_submit") {
		if (!claim.postSubmitAssist || claim.runnerSessionId !== entry.runnerSessionId) {
			throw new Error("Portal did not authorize this exact post-submit browser session");
		}
	} else if (claim.postSubmitAssist || claim.submitConfirmed || claim.runnerSessionId !== null) {
		throw new Error("Portal did not authorize this exact pre-submit browser task");
	}
}

async function assertTaskReconciliation(
	entry: TaskJournalEntry,
	reconciliation: BrowserTaskReconciliation,
): Promise<void> {
	if (
		reconciliation.task.taskId !== entry.taskId ||
		reconciliation.task.batchId !== entry.batchId ||
		reconciliation.task.brandId !== entry.brandId ||
		reconciliation.task.surfaceTargetKey !== entry.surfaceTargetKey ||
		(await sha256(reconciliation.task.promptText)) !== entry.promptSha256
	) {
		throw new Error("Portal did not reconcile this exact browser task");
	}
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
