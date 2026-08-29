import { mapBrowserExtensionSurfaces } from "@workspace/lib/browser-extension-surfaces";
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
	resume(
		taskId: string,
		brandId: string,
		stage: RecoveryStage,
		surface: BrowserExtensionSurface,
	): Promise<BrowserExtensionClaim>;
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
	now?: () => Date;
};

export class ExtensionCoordinator {
	readonly #dependencies: ExtensionCoordinatorDependencies;
	readonly #pools = mapBrowserExtensionSurfaces(() => new AdaptiveSurfacePool());

	constructor(dependencies: ExtensionCoordinatorDependencies) {
		this.#dependencies = dependencies;
	}

	async runOnce(): Promise<ExtensionRunSummary | null> {
		const device = await this.#dependencies.storage.loadDevice();
		if (!device) return null;
		const api = this.#dependencies.apiFactory(device);
		const journal = new DurableTaskJournal(this.#dependencies.storage, undefined, this.#dependencies.now);
		const blockedSurfaces = await this.#reconcileJournalBeforePoll(api, journal);
		if (!blockedSurfaces) {
			return { bySurface: emptySurfaceSummaries(), recovered: 0, recoveryIncomplete: 0 };
		}
		const recovery = await this.#recoverDuePostSubmit(api, journal);
		const surfaces = readySurfaces(await this.#dependencies.storage.loadSurfaceReadiness()).filter(
			(surface) => !blockedSurfaces.has(surface),
		);
		const polled = await pollStartedWork({
			brandIds: device.allowedBrandIds,
			surfaces,
			pools: this.#pools,
			claim: (brandId, surface) => api.claimNext(brandId, surface),
			run: async (claim) => {
				const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
				await this.#rememberNeedsHumanFailure(journal, claim.taskId, result);
				await this.#dependencies.notify?.(result, claim.surfaceTargetKey);
				return result;
			},
		});
		return { ...polled, ...recovery };
	}

	async recoverNeedsHuman(taskId: string): Promise<ManualRecoveryResult> {
		const device = await this.#dependencies.storage.loadDevice();
		if (!device) return { taskId, status: "not_recoverable", code: "device_not_paired" };
		const api = this.#dependencies.apiFactory(device);
		const journal = new DurableTaskJournal(this.#dependencies.storage, undefined, this.#dependencies.now);
		const entry = (await journal.entries())[taskId];
		if (entry?.phase !== "needs_human") {
			return { taskId, status: "not_recoverable", code: "local_task_not_waiting" };
		}
		const result = await this.#recoverEntry(api, journal, entry, false);
		await this.#rememberNeedsHumanFailure(journal, taskId, result);
		return result;
	}

	async #recoverEntry(
		api: RunnerControlApi,
		journal: DurableTaskJournal,
		entry: TaskJournalEntry,
		automaticPostSubmit: boolean,
	): Promise<ManualRecoveryResult> {
		const taskId = entry.taskId;
		const requestedStage = automaticPostSubmit ? "post_submit" : manualRecoveryStage(entry);
		let recoveryStage = requestedStage;

		let claim: BrowserExtensionClaim;
		try {
			claim = await api.resume(entry.taskId, entry.brandId, requestedStage, entry.surfaceTargetKey);
		} catch {
			return { taskId, status: "needs_human", code: "resume_authorization_failed" };
		}

		recoveryStage = claim.postSubmitAssist ? "post_submit" : "pre_submit";
		try {
			if (automaticPostSubmit && recoveryStage !== "post_submit") {
				throw new Error("Automatic recovery is restricted to post-submit sessions");
			}
			await assertManualResumeClaim(entry, claim, recoveryStage);
		} catch {
			return this.#manualRecoveryFailure(api, claim, taskId, recoveryStage, "resume_claim_mismatch");
		}

		let recoveryTabId: number;
		try {
			recoveryTabId = !automaticPostSubmit && this.#dependencies.tabs.resolveManualRecoveryTab
				? await this.#dependencies.tabs.resolveManualRecoveryTab(entry.tabId, entry.surfaceTargetKey)
				: entry.tabId;
		} catch {
			return this.#manualRecoveryFailure(api, claim, taskId, recoveryStage, "recovery_tab_unavailable");
		}

		try {
			if (!automaticPostSubmit && recoveryTabId !== entry.tabId) {
				await journal.rebindNeedsHumanTab(taskId, recoveryTabId);
			}
		} catch {
			return this.#manualRecoveryFailure(api, claim, taskId, recoveryStage, "local_journal_persistence_failed");
		}

		try {
			await this.#dependencies.tabs.activate(recoveryTabId);
		} catch {
			return this.#manualRecoveryFailure(api, claim, taskId, recoveryStage, "recovery_tab_unavailable");
		}

		try {
			if (recoveryStage === "pre_submit") {
				if (requestedStage === "pre_submit") await journal.resumePreSubmit(taskId);
				else await journal.resumeServerAuthorizedPreSubmit(taskId);
			} else if (requestedStage === "pre_submit" || !entry.interruptedPhase) {
				await journal.markPostSubmitBoundary(taskId, claim.submitConfirmed ? "submitted" : "submit_intent");
			}
		} catch {
			return this.#manualRecoveryFailure(api, claim, taskId, recoveryStage, "local_journal_persistence_failed");
		}

		const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
		await this.#dependencies.notify?.(result, entry.surfaceTargetKey);
		return { taskId, ...result };
	}

	async listNeedsHuman(): Promise<ManualRecoveryCandidate[]> {
		const journal = new DurableTaskJournal(this.#dependencies.storage, undefined, this.#dependencies.now);
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

	async #recoverDuePostSubmit(
		api: RunnerControlApi,
		journal: DurableTaskJournal,
	): Promise<Pick<ExtensionRunSummary, "recovered" | "recoveryIncomplete">> {
		let recovered = 0;
		let recoveryIncomplete = 0;
		for (const due of await journal.duePostSubmitRecoveries()) {
			try {
				const entry = await journal.recordPostSubmitRecoveryAttempt(due.taskId);
				const result = await this.#recoverEntry(api, journal, entry, true);
				await this.#rememberNeedsHumanFailure(journal, entry.taskId, result);
				if (result.status === "succeeded") recovered += 1;
				else recoveryIncomplete += 1;
			} catch {
				recoveryIncomplete += 1;
			}
		}
		return { recovered, recoveryIncomplete };
	}

	async #rememberNeedsHumanFailure(
		journal: DurableTaskJournal,
		taskId: string,
		result: TaskRunResult | ManualRecoveryResult,
	): Promise<void> {
		if (result.status !== "needs_human") return;
		await journal.recordNeedsHumanFailure(taskId, result.code).catch(() => undefined);
	}

	async #reconcileJournalBeforePoll(
		api: RunnerControlApi,
		journal: DurableTaskJournal,
	): Promise<Set<BrowserExtensionSurface> | null> {
		const blockedSurfaces = new Set<BrowserExtensionSurface>();
		for (const entry of Object.values(await journal.entries())) {
			let reconciliation: BrowserTaskReconciliation;
			try {
				reconciliation = await api.reconcileTask(entry.taskId, entry.brandId);
				await assertTaskReconciliation(entry, reconciliation);
			} catch {
				return null;
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
					blockedSurfaces.add(entry.surfaceTargetKey);
					continue;
				case "resumable_pre":
					await journal.alignNeedsHuman(entry.taskId, "pre_submit");
					continue;
				case "resumable_post":
					if (reconciliation.runnerSessionId !== entry.runnerSessionId) {
						blockedSurfaces.add(entry.surfaceTargetKey);
						continue;
					}
					await journal.alignNeedsHuman(entry.taskId, "post_submit");
					continue;
			}
		}
		return blockedSurfaces;
	}

	async #manualRecoveryFailure(
		api: RunnerControlApi,
		claim: BrowserExtensionClaim,
		taskId: string,
		stage: RecoveryStage,
		code: string,
	): Promise<ManualRecoveryResult> {
		await api
			.failTask(claim, {
				stage,
				code,
				reason: "The exact local browser task could not be resumed after a new lease was issued",
			})
			.catch(() => undefined);
		return { taskId, status: "needs_human", code };
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
	return mapBrowserExtensionSurfaces(() => ({ succeeded: 0, retryScheduled: 0, needsHuman: 0, incomplete: 0 }));
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
