import type { BrowserExtensionClaim, BrowserExtensionSurface, PairedDeviceConfig } from "../contracts";
import type { DeviceStorage } from "../storage";
import { AdaptiveSurfacePool } from "./concurrency";
import { DurableTaskJournal } from "./journal";
import { pollStartedWork, type SurfacePollSummary } from "./poller";
import { type RunnerApi, type RunnerTabDriver, runClaimedTask, type TaskRunResult } from "./task-runner";

export interface RunnerControlApi extends RunnerApi {
	claimNext(brandId: string, surface: BrowserExtensionSurface): Promise<BrowserExtensionClaim | null>;
	resume(taskId: string, brandId: string): Promise<BrowserExtensionClaim>;
}

export type ExtensionRunSummary = {
	bySurface: Record<BrowserExtensionSurface, SurfacePollSummary>;
	recovered: number;
	recoveryIncomplete: number;
};

type ExtensionCoordinatorDependencies = {
	storage: DeviceStorage;
	apiFactory(device: PairedDeviceConfig): RunnerControlApi;
	tabs: RunnerTabDriver;
	browserVersion: string;
	notify?(result: TaskRunResult, surface: BrowserExtensionSurface): Promise<void> | void;
};

const SURFACES: readonly BrowserExtensionSurface[] = ["doubao.consumer_web", "deepseek.consumer_web"];

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
		const recovery = await this.#recoverPostSubmit(api, journal);
		const polled = await pollStartedWork({
			brandIds: device.allowedBrandIds,
			surfaces: SURFACES,
			pools: this.#pools,
			claim: (brandId, surface) => api.claimNext(brandId, surface),
			run: async (claim) => {
				const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
				await this.#dependencies.notify?.(result, claim.surfaceTargetKey);
				return result;
			},
		});
		return { ...polled, ...recovery };
	}

	async #recoverPostSubmit(
		api: RunnerControlApi,
		journal: DurableTaskJournal,
	): Promise<{ recovered: number; recoveryIncomplete: number }> {
		let recovered = 0;
		let recoveryIncomplete = 0;
		for (const entry of Object.values(await journal.entries())) {
			if (!isPostSubmitPhase(entry.phase)) continue;
			try {
				const claim = await api.resume(entry.taskId, entry.brandId);
				const result = await runClaimedTask(claim, this.#taskDependencies(api, journal));
				await this.#dependencies.notify?.(result, entry.surfaceTargetKey);
				if (result.status === "succeeded") recovered += 1;
				else if (result.status === "incomplete") recoveryIncomplete += 1;
			} catch (error) {
				if (isConflict(error)) continue;
				recoveryIncomplete += 1;
			}
		}
		return { recovered, recoveryIncomplete };
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

function isPostSubmitPhase(phase: string): boolean {
	return ["submit_intent", "submitted", "collected", "uploaded", "needs_human"].includes(phase);
}

function isConflict(error: unknown): boolean {
	return typeof error === "object" && error !== null && "status" in error && error.status === 409;
}
