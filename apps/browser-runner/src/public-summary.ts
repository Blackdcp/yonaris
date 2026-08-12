import type { RunSummary } from "./contracts.js";

export function publicSummary(summary: RunSummary) {
	return {
		runId: summary.runId,
		status: summary.status,
		queuedRemaining: summary.queuedRemaining,
		startedAt: summary.startedAt,
		completedAt: summary.completedAt,
		total: summary.total,
		succeeded: summary.succeeded,
		retryQueued: summary.retryQueued,
		needsHuman: summary.needsHuman,
	};
}
