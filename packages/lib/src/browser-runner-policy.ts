export const BROWSER_RUNNER_MAX_PRE_SUBMIT_ATTEMPTS = 2;
export const BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE = "broker_create_transport_failure";
export const BROWSER_RUNNER_DEDICATED_PROFILE_BUSY_CODE = "dedicated_profile_busy";
const BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_ATTEMPT_COUNT = 1;
export const BROWSER_RUNNER_RETRYABLE_PRE_SUBMIT_CODES = [
	"navigation_timeout",
	"page_load_timeout",
	"network_transient",
	"browser_crash_before_submit",
] as const;

export type BrowserRunnerTaskAutomationStatus = "queued" | "running" | "needs_human" | "completed";

export function isSafePreSubmitBrokerTransportRecoveryCandidate(input: {
	deliveryStatus: string;
	automationStatus: BrowserRunnerTaskAutomationStatus | null;
	automationAttemptCount: number;
	claimCount: number;
	submitIntentAt: Date | null;
	submitConfirmedAt: Date | null;
	observationAttemptId: string | null;
	needsHumanCode: string | null;
	lastErrorCode: string | null;
}): boolean {
	return (
		input.deliveryStatus === "available" &&
		input.automationStatus === "needs_human" &&
		input.automationAttemptCount === BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_ATTEMPT_COUNT &&
		input.claimCount === BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_ATTEMPT_COUNT &&
		input.submitIntentAt === null &&
		input.submitConfirmedAt === null &&
		input.observationAttemptId === null &&
		input.needsHumanCode === BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE &&
		input.lastErrorCode === BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE
	);
}

export function isSafePreSubmitDedicatedProfileBusyRecoveryCandidate(input: {
	deliveryStatus: string;
	automationStatus: BrowserRunnerTaskAutomationStatus | null;
	automationAttemptCount: number;
	claimCount: number;
	submitIntentAt: Date | null;
	submitConfirmedAt: Date | null;
	observationAttemptId: string | null;
	needsHumanCode: string | null;
	lastErrorCode: string | null;
}): boolean {
	return (
		input.deliveryStatus === "available" &&
		input.automationStatus === "needs_human" &&
		input.automationAttemptCount === 1 &&
		input.claimCount === 1 &&
		input.submitIntentAt === null &&
		input.submitConfirmedAt === null &&
		input.observationAttemptId === null &&
		input.needsHumanCode === BROWSER_RUNNER_DEDICATED_PROFILE_BUSY_CODE &&
		input.lastErrorCode === BROWSER_RUNNER_DEDICATED_PROFILE_BUSY_CODE
	);
}

export function isBrowserRunnerCnScope(input: { market: string; locale: string; timezone: string }): boolean {
	return input.market === "CN" && input.locale === "zh-CN" && input.timezone === "Asia/Shanghai";
}

export function assertBrowserRunnerEvidenceProtocol(minimumArtifacts: number): void {
	if (minimumArtifacts !== 2) {
		throw new Error("Browser Runner batches require exactly two evidence artifacts (screenshot and page snapshot)");
	}
}

export function assertPortalBrowserRunnerMutationAllowed(
	input: { captureRouteKey: string; submitIntentAt: Date | null },
	action: "submit" | "release",
): void {
	if (input.captureRouteKey === "browser_runner.doubao" && input.submitIntentAt !== null) {
		throw new Error(
			`Post-submit Browser Runner tasks cannot be ${action === "submit" ? "submitted" : "released"} from the portal; resume the original runner session or finalize a terminal failure`,
		);
	}
}

export function decideBrowserRunnerFailure(input: {
	stage: "pre_submit" | "post_submit";
	code: string;
	automationAttemptCount: number;
	submitIntentAt: Date | null;
	submitConfirmedAt: Date | null;
}): "retry" | "needs_human" {
	return input.stage === "pre_submit" &&
		(BROWSER_RUNNER_RETRYABLE_PRE_SUBMIT_CODES as readonly string[]).includes(input.code.trim().toLowerCase()) &&
		input.submitIntentAt === null &&
		input.submitConfirmedAt === null &&
		input.automationAttemptCount < BROWSER_RUNNER_MAX_PRE_SUBMIT_ATTEMPTS
		? "retry"
		: "needs_human";
}

export function expiredBrowserRunnerClaimNeedsHuman(input: {
	deliveryStatus: string;
	automationStatus: BrowserRunnerTaskAutomationStatus | null;
}): boolean {
	return input.deliveryStatus === "claimed" && input.automationStatus === "running";
}

export function deriveBrowserRunnerBatchStatus(
	states: readonly (BrowserRunnerTaskAutomationStatus | null)[],
): "running" | "needs_human" | "settled" {
	if (states.some((state) => state === "queued" || state === "running")) return "running";
	if (states.some((state) => state === "needs_human")) return "needs_human";
	return "settled";
}

export function deriveBrowserRunnerResultStatus(input: {
	isSettled: boolean;
	total: number;
	succeeded: number;
}): "provisional" | "final" | "incomplete" {
	if (!input.isSettled) return "provisional";
	return input.total > 0 && input.succeeded === input.total ? "final" : "incomplete";
}

export function browserRunnerResumeDenial(input: {
	deliveryStatus: string;
	automationStatus: BrowserRunnerTaskAutomationStatus | null;
	submitIntentAt: Date | null;
	originalClaimedBy: string | null;
	requestingClaimant: string;
}): "not_needs_human" | "no_submit_intent" | "wrong_runner" | null {
	if (input.deliveryStatus !== "available" || input.automationStatus !== "needs_human") return "not_needs_human";
	if (input.submitIntentAt === null) return "no_submit_intent";
	if (input.originalClaimedBy !== input.requestingClaimant) return "wrong_runner";
	return null;
}

export function canCancelBrowserRunnerAfterStart(
	tasks: readonly {
		status: string;
		automationStatus: BrowserRunnerTaskAutomationStatus | null;
		automationAttemptCount: number;
		claimCount: number;
		submitIntentAt: Date | null;
		observationAttemptId: string | null;
	}[],
): boolean {
	return tasks.every(
		(task) =>
			task.status === "available" &&
			task.automationStatus === "queued" &&
			task.automationAttemptCount === 0 &&
			task.claimCount === 0 &&
			task.submitIntentAt === null &&
			task.observationAttemptId === null,
	);
}

export function browserRunnerHumanFinalization(input: {
	executionMode: string;
	automationStartedAt: Date | null;
	tasks: readonly {
		status: string;
		automationStatus: BrowserRunnerTaskAutomationStatus | null;
		needsHumanCode: string | null;
		leaseExpiresAt: Date | null;
	}[];
	now: Date;
}): { canFinalize: boolean; count: number } {
	if (input.executionMode !== "browser_runner" || input.automationStartedAt === null) {
		return { canFinalize: false, count: 0 };
	}
	if (input.tasks.some(({ automationStatus }) => automationStatus === "queued")) {
		return { canFinalize: false, count: 0 };
	}
	const unresolved = input.tasks.filter(({ status }) => status === "available" || status === "claimed");
	if (unresolved.length === 0) return { canFinalize: false, count: 0 };
	if (
		unresolved.some(
			(task) =>
				task.needsHumanCode === null ||
				(task.automationStatus !== "needs_human" && task.automationStatus !== "running") ||
				(task.status === "claimed" && task.leaseExpiresAt !== null && task.leaseExpiresAt > input.now),
		)
	) {
		return { canFinalize: false, count: 0 };
	}
	return { canFinalize: true, count: unresolved.length };
}
