import { createHash } from "node:crypto";
import type { RunnerTask } from "./contracts.js";

/**
 * A browser session belongs to the centrally-accounted server attempt and its
 * original lease. It must not depend on an in-process retry-loop counter.
 */
export function runnerSessionIdForTask(task: RunnerTask): string {
	const digest = createHash("sha256")
		.update(task.id)
		.update("\0")
		.update(String(task.automationAttemptCount))
		.update("\0")
		.update(String(task.leaseGeneration))
		.digest("hex");
	return `doubao:${digest}`;
}
