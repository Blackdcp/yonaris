import {
	type BrowserExtensionSurface,
	isBrowserExtensionCaptureRoute,
	isBrowserExtensionSurface,
	isCurrentBrowserExtensionAdapterVersionBindingSatisfied,
} from "./browser-extension-contract";

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

export type BrowserExtensionTaskOperation =
	| { kind: "resume"; adapterVersion?: string }
	| { kind: "heartbeat"; adapterVersion?: string }
	| { kind: "submit_intent"; adapterVersion?: string }
	| { kind: "submit_confirmed"; adapterVersion?: string }
	| { kind: "evidence"; adapterVersion?: string }
	| { kind: "complete"; adapterVersion: string };

export function browserExtensionTaskOperationDenial(
	input: {
		surfaceTargetKey: string;
		readySurfaces: readonly BrowserExtensionSurface[];
		operation: BrowserExtensionTaskOperation;
	},
	dependencies: {
		isAdapterVersionBindingSatisfied?: typeof isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	} = {},
): "surface_not_ready" | "adapter_version_not_approved" | null {
	if (!isBrowserExtensionSurface(input.surfaceTargetKey) || !input.readySurfaces.includes(input.surfaceTargetKey)) {
		return "surface_not_ready";
	}
	const isAdapterVersionBindingSatisfied =
		dependencies.isAdapterVersionBindingSatisfied ?? isCurrentBrowserExtensionAdapterVersionBindingSatisfied;
	if (!isAdapterVersionBindingSatisfied(input.surfaceTargetKey, input.operation.adapterVersion)) {
		return "adapter_version_not_approved";
	}
	return null;
}

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

export function assertBrowserRunnerEvidenceProtocol(
	minimumArtifacts: number,
	captureRouteKeys: readonly string[] = ["browser_runner.doubao"],
): void {
	const hasLegacy = captureRouteKeys.includes("browser_runner.doubao");
	const hasExtension = captureRouteKeys.some(isBrowserExtensionCaptureRoute);
	if (hasLegacy && hasExtension) {
		throw new Error("Browser Runner batches cannot mix legacy and extension evidence protocols");
	}
	if (hasExtension) {
		if (captureRouteKeys.some((route) => !isBrowserExtensionCaptureRoute(route)) || minimumArtifacts !== 1) {
			throw new Error("Browser extension batches require exactly one page snapshot");
		}
		return;
	}
	if (!hasLegacy || captureRouteKeys.some((route) => route !== "browser_runner.doubao") || minimumArtifacts !== 2) {
		throw new Error("Browser Runner batches require exactly two evidence artifacts (screenshot and page snapshot)");
	}
}

export function assertPortalBrowserRunnerMutationAllowed(
	input: { captureRouteKey: string; submitIntentAt: Date | null },
	action: "submit" | "release",
): void {
	if (
		(input.captureRouteKey === "browser_runner.doubao" || isBrowserExtensionCaptureRoute(input.captureRouteKey)) &&
		input.submitIntentAt !== null
	) {
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
}): "not_needs_human" | "wrong_runner" | null {
	if (input.deliveryStatus !== "available" || input.automationStatus !== "needs_human") return "not_needs_human";
	if (input.originalClaimedBy !== input.requestingClaimant) return "wrong_runner";
	return null;
}

export type BrowserRunnerExactTaskReconciliation =
	| "terminal"
	| "released"
	| "resumable_pre"
	| "resumable_post"
	| "active"
	| "blocked";

export function reconcileBrowserRunnerExactTask(input: {
	deliveryStatus: string;
	automationStatus: BrowserRunnerTaskAutomationStatus | null;
	submitIntentAt: Date | null;
	originalClaimedBy: string | null;
	requestingClaimant: string;
	leaseExpiresAt: Date | null;
	now: Date;
}): BrowserRunnerExactTaskReconciliation {
	if (
		["succeeded", "failed", "cancelled"].includes(input.deliveryStatus) &&
		input.automationStatus === "completed" &&
		input.leaseExpiresAt === null
	) {
		return "terminal";
	}
	if (
		input.deliveryStatus === "available" &&
		input.automationStatus === "queued" &&
		input.submitIntentAt === null &&
		input.leaseExpiresAt === null
	) {
		return "released";
	}
	if (
		input.deliveryStatus === "available" &&
		input.automationStatus === "needs_human" &&
		input.leaseExpiresAt === null
	) {
		if (input.originalClaimedBy !== input.requestingClaimant) return "blocked";
		return input.submitIntentAt === null ? "resumable_pre" : "resumable_post";
	}
	if (input.deliveryStatus === "claimed" && input.automationStatus === "running" && input.leaseExpiresAt !== null) {
		if (input.originalClaimedBy !== input.requestingClaimant) return "blocked";
		if (input.leaseExpiresAt > input.now) return "active";
		return input.submitIntentAt === null ? "resumable_pre" : "resumable_post";
	}
	return "blocked";
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

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1_000;

/**
 * Domestic browser batches become final at noon on the next Shanghai
 * calendar day. A frozen measurement window may close the batch earlier,
 * but never later. Calendar arithmetic is deliberate: this is not a rolling
 * 24-hour timeout.
 */
export function browserRunnerDailySettlementCutoff(input: {
	automationStartedAt: Date;
	measurementWindowEndsAt: Date;
}): Date {
	const startedAtMs = input.automationStartedAt.getTime();
	const windowEndsAtMs = input.measurementWindowEndsAt.getTime();
	if (!Number.isFinite(startedAtMs) || !Number.isFinite(windowEndsAtMs)) {
		throw new Error("Browser Runner daily settlement requires valid dates");
	}
	const shanghaiStartedAt = new Date(startedAtMs + SHANGHAI_UTC_OFFSET_MS);
	const nextShanghaiNoonMs = Date.UTC(
		shanghaiStartedAt.getUTCFullYear(),
		shanghaiStartedAt.getUTCMonth(),
		shanghaiStartedAt.getUTCDate() + 1,
		4,
		0,
		0,
		0,
	);
	return new Date(Math.min(nextShanghaiNoonMs, windowEndsAtMs));
}

export type BrowserRunnerDailySettlementDisposition =
	| { kind: "defer_live_lease" }
	| { kind: "terminal_failure"; code: string; reason: string };

export function browserRunnerDailySettlementDisposition(input: {
	status: string;
	leaseExpiresAt: Date | null;
	submitIntentAt: Date | null;
	needsHumanCode: string | null;
	needsHumanReason: string | null;
	now: Date;
}): BrowserRunnerDailySettlementDisposition {
	if (input.status !== "available" && input.status !== "claimed") {
		throw new Error(`Delivery task status ${input.status} cannot be settled`);
	}
	if (input.status === "claimed" && input.leaseExpiresAt !== null && input.leaseExpiresAt > input.now) {
		return { kind: "defer_live_lease" };
	}
	const existingCode = input.needsHumanCode?.trim();
	const existingReason = input.needsHumanReason?.trim();
	if (existingCode && existingReason) {
		return { kind: "terminal_failure", code: existingCode, reason: existingReason };
	}
	if (input.submitIntentAt !== null) {
		return {
			kind: "terminal_failure",
			code: "submit_outcome_unknown",
			reason: "Daily truth cutoff passed after durable submit intent; the outcome could not be verified and automatic replay is forbidden",
		};
	}
	if (input.status === "claimed") {
		return {
			kind: "terminal_failure",
			code: "runner_lease_expired",
			reason: "Daily truth cutoff passed after the Browser Runner lease expired without a verified result",
		};
	}
	return {
		kind: "terminal_failure",
		code: "daily_cutoff_unresolved",
		reason: "Daily truth cutoff passed before this frozen Browser Runner slot produced a verified result",
	};
}
