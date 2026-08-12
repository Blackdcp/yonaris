import type { RunnerPhase } from "./contracts.js";

export type RunnerErrorDisposition = "safe_pre_submit_retry" | "recover_same_session" | "needs_human";

export function sanitizeDiagnostic(message: string): string {
	return message
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/(api[-_ ]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
		.slice(0, 1_000);
}

export class BrowserRunnerError extends Error {
	constructor(
		public readonly code: string,
		public readonly phase: RunnerPhase,
		public readonly disposition: RunnerErrorDisposition,
		message: string,
		options?: ErrorOptions,
	) {
		super(sanitizeDiagnostic(message), options);
		this.name = "BrowserRunnerError";
	}
}

export function normalizeRunnerError(error: unknown, phase: RunnerPhase): BrowserRunnerError {
	if (error instanceof BrowserRunnerError) return error;
	return new BrowserRunnerError(
		"unexpected_runner_error",
		phase,
		"needs_human",
		error instanceof Error ? error.message : String(error),
		{ cause: error },
	);
}
