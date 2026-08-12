import type { RunSummary } from "./contracts.js";
import { type BrowserRunnerError, normalizeRunnerError } from "./errors.js";
import type { RunBatchOptions } from "./run-batch.js";
import { runBatch } from "./run-batch.js";

export async function pollStartedBatches(input: {
	createOptions: () => Promise<RunBatchOptions>;
	onRunCompleted?: (summary: RunSummary) => Promise<void> | void;
	onRunError?: (error: BrowserRunnerError) => Promise<void> | void;
	onMaintenanceError?: (error: BrowserRunnerError) => Promise<void> | void;
	maintenance?: () => Promise<void>;
	maintenanceIntervalMs?: number;
	idlePollMs?: number;
	signal?: AbortSignal;
}): Promise<void> {
	const idlePollMs = input.idlePollMs ?? 15_000;
	const maintenanceIntervalMs = input.maintenanceIntervalMs ?? 60 * 60 * 1_000;
	if (!Number.isSafeInteger(idlePollMs) || idlePollMs < 1_000 || idlePollMs > 60_000) {
		throw new Error("idlePollMs must be an integer between 1000 and 60000");
	}
	if (
		!Number.isSafeInteger(maintenanceIntervalMs) ||
		maintenanceIntervalMs < 60_000 ||
		maintenanceIntervalMs > 24 * 60 * 60 * 1_000
	) {
		throw new Error("maintenanceIntervalMs must be an integer between 60000 and 86400000");
	}
	let consecutiveErrors = 0;
	let nextMaintenanceAt = 0;
	while (!input.signal?.aborted) {
		if (input.maintenance && Date.now() >= nextMaintenanceAt) {
			nextMaintenanceAt = Date.now() + maintenanceIntervalMs;
			try {
				await input.maintenance();
			} catch (error) {
				await input.onMaintenanceError?.(normalizeRunnerError(error, "persist"));
			}
		}
		try {
			const summary = await runBatch(await input.createOptions());
			consecutiveErrors = 0;
			if (summary.total > 0 || summary.status === "incomplete") {
				await input.onRunCompleted?.(summary);
				if (summary.total > 0) continue;
			}
			await abortableDelay(idlePollMs, input.signal);
		} catch (error) {
			const normalized = normalizeRunnerError(error, "claim");
			if (isFatalPollError(normalized)) throw normalized;
			consecutiveErrors += 1;
			await input.onRunError?.(normalized);
			await abortableDelay(Math.min(30_000, 1_000 * 2 ** Math.min(consecutiveErrors - 1, 5)), input.signal);
		}
	}
}

function isFatalPollError(error: BrowserRunnerError): boolean {
	if (error.code === "runner_api_http_401" || error.code === "runner_api_http_403") return true;
	return error.code === "runner_api_http_503" && /disabled|not configured/i.test(error.message);
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const timer = setTimeout(done, milliseconds);
		timer.unref();
		function done() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		}
		signal?.addEventListener("abort", done, { once: true });
	});
}
