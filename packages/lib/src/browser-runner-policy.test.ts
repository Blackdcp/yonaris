import { describe, expect, it } from "vitest";
import { isBrowserExtensionAdapterVersionBindingSatisfied } from "./browser-extension-contract";
import type { BrowserExtensionSurface } from "./browser-extension-surfaces";
import * as browserRunnerPolicy from "./browser-runner-policy";
import {
	assertBrowserRunnerEvidenceProtocol,
	assertPortalBrowserRunnerMutationAllowed,
	BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE,
	browserExtensionTaskOperationDenial,
	browserRunnerHumanFinalization,
	browserRunnerResumeDenial,
	canCancelBrowserRunnerAfterStart,
	decideBrowserRunnerFailure,
	deriveBrowserRunnerBatchStatus,
	deriveBrowserRunnerResultStatus,
	expiredBrowserRunnerClaimNeedsHuman,
	isBrowserRunnerCnScope,
	isSafePreSubmitBrokerTransportRecoveryCandidate,
	isSafePreSubmitDedicatedProfileBusyRecoveryCandidate,
} from "./browser-runner-policy";

type ExactTaskReconciliationInput = {
	deliveryStatus: string;
	automationStatus: "queued" | "running" | "needs_human" | "completed" | null;
	submitIntentAt: Date | null;
	originalClaimedBy: string | null;
	requestingClaimant: string;
	leaseExpiresAt: Date | null;
	now: Date;
};

type ExactTaskReconciliation = "terminal" | "released" | "resumable_pre" | "resumable_post" | "active" | "blocked";

function reconcileExactTask(input: ExactTaskReconciliationInput): ExactTaskReconciliation | "missing" {
	const candidate: unknown = Reflect.get(browserRunnerPolicy, "reconcileBrowserRunnerExactTask");
	return typeof candidate === "function"
		? (candidate as (value: ExactTaskReconciliationInput) => ExactTaskReconciliation)(input)
		: "missing";
}

describe("Browser Runner retry policy", () => {
	it("authorizes an exact approved operation for every registered surface", () => {
		for (const [surfaceTargetKey, adapterVersion] of [
			["doubao.consumer_web", "doubao-web-20260821-localpc-v13"],
			["deepseek.consumer_web", "deepseek-web-20260821-localpc-v8"],
			["qwen.consumer_web", "qwen-web-20260822-localpc-v7"],
			["kimi.consumer_web", "kimi-web-20260822-localpc-v11"],
			["wenxin.consumer_web", "wenxin-web-20260822-localpc-v8"],
			["yuanbao.consumer_web", "yuanbao-web-20260821-localpc-v6"],
			["zhipu.consumer_web", "zhipu-web-20260822-localpc-v3"],
		] as const) {
			expect(
				browserExtensionTaskOperationDenial({
					surfaceTargetKey,
					readySurfaces: [surfaceTargetKey],
					operation: { kind: "complete", adapterVersion },
				}),
			).toBeNull();
		}
	});

	it("rejects omitted resume bindings after Doubao v8 production activation", () => {
		expect(
			browserExtensionTaskOperationDenial({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "resume" },
			}),
		).toBe("adapter_version_not_approved");
	});

	it("requires an exact adapter binding for resume under a simulated Doubao v8 approval", () => {
		const dependencies = {
			isAdapterVersionBindingSatisfied: (
				surface: BrowserExtensionSurface,
				requestedAdapterVersion: string | undefined,
			) =>
				isBrowserExtensionAdapterVersionBindingSatisfied({
					surface,
					requestedAdapterVersion,
					approvedAdapterVersion: "doubao-web-20260821-localpc-v13",
				}),
		};
		const base = {
			surfaceTargetKey: "doubao.consumer_web",
			readySurfaces: ["doubao.consumer_web" as const],
		};

		for (const operation of [
			{ kind: "resume" as const },
			{ kind: "resume" as const, adapterVersion: "doubao-web-20260818-localpc-v7" },
		]) {
			expect(browserExtensionTaskOperationDenial({ ...base, operation }, dependencies)).toBe(
				"adapter_version_not_approved",
			);
		}
		expect(
			browserExtensionTaskOperationDenial(
				{
					...base,
					operation: { kind: "resume", adapterVersion: "doubao-web-20260821-localpc-v13" },
				},
				dependencies,
			),
		).toBeNull();
	});

	it.each(["heartbeat", "submit_intent", "submit_confirmed", "evidence"] as const)(
		"requires an exact adapter binding for %s under a simulated Doubao v8 approval",
		(kind) => {
			const dependencies = {
				isAdapterVersionBindingSatisfied: (
					surface: BrowserExtensionSurface,
					requestedAdapterVersion: string | undefined,
				) =>
					isBrowserExtensionAdapterVersionBindingSatisfied({
						surface,
						requestedAdapterVersion,
						approvedAdapterVersion: "doubao-web-20260821-localpc-v13",
					}),
			};
			const base = {
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web" as const],
			};

			for (const adapterVersion of [undefined, "doubao-web-20260818-localpc-v7"]) {
				expect(
					browserExtensionTaskOperationDenial({ ...base, operation: { kind, adapterVersion } }, dependencies),
				).toBe("adapter_version_not_approved");
			}
			expect(
				browserExtensionTaskOperationDenial(
					{ ...base, operation: { kind, adapterVersion: "doubao-web-20260821-localpc-v13" } },
					dependencies,
				),
			).toBeNull();
		},
	);

	it("permits one explicit recovery only for the untouched first broker transport failure", () => {
		const candidate = {
			deliveryStatus: "available",
			automationStatus: "needs_human" as const,
			automationAttemptCount: 1,
			claimCount: 1,
			submitIntentAt: null,
			submitConfirmedAt: null,
			observationAttemptId: null,
			needsHumanCode: BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE,
			lastErrorCode: BROWSER_RUNNER_SAFE_TRANSPORT_RECOVERY_CODE,
		};

		expect(isSafePreSubmitBrokerTransportRecoveryCandidate(candidate)).toBe(true);
		for (const unsafe of [
			{ ...candidate, claimCount: 2 },
			{ ...candidate, automationAttemptCount: 2 },
			{ ...candidate, submitIntentAt: new Date() },
			{ ...candidate, observationAttemptId: "attempt-id" },
			{ ...candidate, needsHumanCode: "login_required" },
			{ ...candidate, deliveryStatus: "claimed" },
		]) {
			expect(isSafePreSubmitBrokerTransportRecoveryCandidate(unsafe)).toBe(false);
		}
	});

	it("permits requeueing an untouched task that only lost the shared dedicated profile", () => {
		const candidate = {
			deliveryStatus: "available",
			automationStatus: "needs_human" as const,
			automationAttemptCount: 1,
			claimCount: 1,
			submitIntentAt: null,
			submitConfirmedAt: null,
			observationAttemptId: null,
			needsHumanCode: "dedicated_profile_busy",
			lastErrorCode: "dedicated_profile_busy",
		};

		expect(isSafePreSubmitDedicatedProfileBusyRecoveryCandidate(candidate)).toBe(true);
		for (const unsafe of [
			{ ...candidate, claimCount: 2 },
			{ ...candidate, submitIntentAt: new Date() },
			{ ...candidate, observationAttemptId: "attempt-id" },
			{ ...candidate, needsHumanCode: "login_required" },
		]) {
			expect(isSafePreSubmitDedicatedProfileBusyRecoveryCandidate(unsafe)).toBe(false);
		}
	});

	it("accepts only the registered mainland-China scope contract", () => {
		expect(isBrowserRunnerCnScope({ market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" })).toBe(true);
		expect(isBrowserRunnerCnScope({ market: "CN", locale: "zh-CN", timezone: "UTC" })).toBe(false);
		expect(isBrowserRunnerCnScope({ market: "SG", locale: "zh-CN", timezone: "Asia/Shanghai" })).toBe(false);
	});

	it("freezes the Browser Runner evidence denominator at exactly two artifacts", () => {
		expect(() => assertBrowserRunnerEvidenceProtocol(2)).not.toThrow();
		expect(() => assertBrowserRunnerEvidenceProtocol(1)).toThrow(/exactly two/);
		expect(() => assertBrowserRunnerEvidenceProtocol(3)).toThrow(/exactly two/);
	});

	it("freezes extension batches at exactly one page snapshot", () => {
		expect(() =>
			assertBrowserRunnerEvidenceProtocol(1, ["browser_extension.doubao", "browser_extension.deepseek"]),
		).not.toThrow();
		expect(() => assertBrowserRunnerEvidenceProtocol(2, ["browser_extension.deepseek"])).toThrow(
			/exactly one page snapshot/i,
		);
		expect(() =>
			assertBrowserRunnerEvidenceProtocol(1, ["browser_runner.doubao", "browser_extension.deepseek"]),
		).toThrow(/cannot mix legacy and extension/i);
	});

	it("blocks portal submit and release after durable Browser Runner submit intent", () => {
		for (const captureRouteKey of ["browser_runner.doubao", "browser_extension.doubao", "browser_extension.deepseek"]) {
			const postSubmit = { captureRouteKey, submitIntentAt: new Date() };
			expect(() => assertPortalBrowserRunnerMutationAllowed(postSubmit, "submit")).toThrow(/cannot be submitted/);
			expect(() => assertPortalBrowserRunnerMutationAllowed(postSubmit, "release")).toThrow(/cannot be released/);
			expect(() =>
				assertPortalBrowserRunnerMutationAllowed({ ...postSubmit, submitIntentAt: null }, "submit"),
			).not.toThrow();
		}
		expect(() =>
			assertPortalBrowserRunnerMutationAllowed(
				{ captureRouteKey: "manual_import.generic", submitIntentAt: new Date() },
				"submit",
			),
		).not.toThrow();
	});

	it("retries one pre-submit failure and escalates the second across process restarts", () => {
		expect(
			decideBrowserRunnerFailure({
				stage: "pre_submit",
				code: "network_transient",
				automationAttemptCount: 1,
				submitIntentAt: null,
				submitConfirmedAt: null,
			}),
		).toBe("retry");
		expect(
			decideBrowserRunnerFailure({
				stage: "pre_submit",
				code: "network_transient",
				automationAttemptCount: 2,
				submitIntentAt: null,
				submitConfirmedAt: null,
			}),
		).toBe("needs_human");
	});

	it("never automatically replays after durable submit intent or a post-submit failure", () => {
		const submitIntentAt = new Date("2026-08-12T12:00:00.000Z");
		expect(
			decideBrowserRunnerFailure({
				stage: "pre_submit",
				code: "network_transient",
				automationAttemptCount: 1,
				submitIntentAt,
				submitConfirmedAt: null,
			}),
		).toBe("needs_human");
		expect(expiredBrowserRunnerClaimNeedsHuman({ deliveryStatus: "claimed", automationStatus: "running" })).toBe(true);
		expect(
			decideBrowserRunnerFailure({
				stage: "post_submit",
				code: "network_transient",
				automationAttemptCount: 1,
				submitIntentAt,
				submitConfirmedAt: submitIntentAt,
			}),
		).toBe("needs_human");
	});

	it("never automatically reclaims an expired running lease, even before submit intent", () => {
		expect(expiredBrowserRunnerClaimNeedsHuman({ deliveryStatus: "claimed", automationStatus: "running" })).toBe(true);
		expect(expiredBrowserRunnerClaimNeedsHuman({ deliveryStatus: "available", automationStatus: "queued" })).toBe(
			false,
		);
	});

	it("escalates semantic and identity failures immediately", () => {
		for (const code of ["captcha", "login_required", "page_drift", "adapter_unverified"]) {
			expect(
				decideBrowserRunnerFailure({
					stage: "pre_submit",
					code,
					automationAttemptCount: 1,
					submitIntentAt: null,
					submitConfirmedAt: null,
				}),
			).toBe("needs_human");
		}
	});

	it("keeps the automatic lane running while other slots remain queued", () => {
		expect(deriveBrowserRunnerBatchStatus(["needs_human", "queued", "completed"])).toBe("running");
		expect(deriveBrowserRunnerBatchStatus(["needs_human", "completed"])).toBe("needs_human");
		expect(deriveBrowserRunnerBatchStatus(["completed", "completed"])).toBe("settled");
	});

	it("publishes final results only when every frozen slot succeeded", () => {
		expect(deriveBrowserRunnerResultStatus({ isSettled: false, total: 10, succeeded: 9 })).toBe("provisional");
		expect(deriveBrowserRunnerResultStatus({ isSettled: true, total: 10, succeeded: 10 })).toBe("final");
		expect(deriveBrowserRunnerResultStatus({ isSettled: true, total: 10, succeeded: 9 })).toBe("incomplete");
		expect(deriveBrowserRunnerResultStatus({ isSettled: true, total: 0, succeeded: 0 })).toBe("incomplete");
	});

	it("lets the server derive the authoritative pre- or post-submit stage for the original runner", () => {
		const base = {
			deliveryStatus: "available",
			automationStatus: "needs_human" as const,
			submitIntentAt: new Date("2026-08-12T12:00:00Z"),
			originalClaimedBy: "browser-runner:cn-1",
			requestingClaimant: "browser-runner:cn-1",
		};
		expect(browserRunnerResumeDenial(base)).toBeNull();
		expect(browserRunnerResumeDenial({ ...base, requestingClaimant: "browser-runner:cn-2" })).toBe("wrong_runner");
		expect(browserRunnerResumeDenial({ ...base, submitIntentAt: null })).toBeNull();
		expect(browserRunnerResumeDenial({ ...base, deliveryStatus: "succeeded", automationStatus: "completed" })).toBe(
			"not_needs_human",
		);
	});

	it("allows cancelling a started batch only before any frozen slot was attempted", () => {
		const untouched = {
			status: "available",
			automationStatus: "queued" as const,
			automationAttemptCount: 0,
			claimCount: 0,
			submitIntentAt: null,
			observationAttemptId: null,
		};
		expect(canCancelBrowserRunnerAfterStart([untouched, untouched])).toBe(true);
		expect(canCancelBrowserRunnerAfterStart([{ ...untouched, automationAttemptCount: 1 }])).toBe(false);
		expect(canCancelBrowserRunnerAfterStart([{ ...untouched, claimCount: 1 }])).toBe(false);
		expect(canCancelBrowserRunnerAfterStart([{ ...untouched, status: "claimed", automationStatus: "running" }])).toBe(
			false,
		);
	});

	it("finalizes only after automatic work drained and every unresolved lease is inactive", () => {
		const now = new Date("2026-08-12T12:00:00Z");
		const needsHuman = {
			status: "available",
			automationStatus: "needs_human" as const,
			needsHumanCode: "captcha",
			leaseExpiresAt: null,
		};
		expect(
			browserRunnerHumanFinalization({
				executionMode: "browser_runner",
				automationStartedAt: now,
				tasks: [needsHuman],
				now,
			}),
		).toEqual({ canFinalize: true, count: 1 });
		expect(
			browserRunnerHumanFinalization({
				executionMode: "browser_runner",
				automationStartedAt: now,
				tasks: [needsHuman, { ...needsHuman, automationStatus: "queued", needsHumanCode: null }],
				now,
			}),
		).toEqual({ canFinalize: false, count: 0 });
		expect(
			browserRunnerHumanFinalization({
				executionMode: "browser_runner",
				automationStartedAt: now,
				tasks: [
					{
						...needsHuman,
						status: "claimed",
						automationStatus: "running",
						leaseExpiresAt: new Date("2026-08-12T12:01:00Z"),
					},
				],
				now,
			}),
		).toEqual({ canFinalize: false, count: 0 });
	});
});

describe("Browser Runner exact-task reconciliation policy", () => {
	const now = new Date("2026-08-18T04:00:00.000Z");
	const claimant = "browser-runner:device-1";
	const base: ExactTaskReconciliationInput = {
		deliveryStatus: "available",
		automationStatus: "queued",
		submitIntentAt: null,
		originalClaimedBy: claimant,
		requestingClaimant: claimant,
		leaseExpiresAt: null,
		now,
	};

	it.each(["succeeded", "failed", "cancelled"])("classifies a valid %s task as terminal", (deliveryStatus) => {
		expect(
			reconcileExactTask({
				...base,
				deliveryStatus,
				automationStatus: "completed",
			}),
		).toBe("terminal");
	});

	it("classifies only an untouched available queued task as released", () => {
		expect(reconcileExactTask(base)).toBe("released");

		for (const invalid of [
			{ ...base, deliveryStatus: "planned" },
			{ ...base, submitIntentAt: new Date("2026-08-18T03:59:00.000Z") },
			{ ...base, leaseExpiresAt: new Date("2026-08-18T04:01:00.000Z") },
		]) {
			expect(reconcileExactTask(invalid)).toBe("blocked");
		}
	});

	it.each([
		{ submitIntentAt: null, expected: "resumable_pre" },
		{ submitIntentAt: new Date("2026-08-18T03:59:00.000Z"), expected: "resumable_post" },
	] as const)(
		"resumes an available needs-human task at $expected for its original runner",
		({ submitIntentAt, expected }) => {
			expect(
				reconcileExactTask({
					...base,
					automationStatus: "needs_human",
					submitIntentAt,
				}),
			).toBe(expected);
		},
	);

	it("blocks an available needs-human task for a different runner", () => {
		expect(
			reconcileExactTask({
				...base,
				automationStatus: "needs_human",
				requestingClaimant: "browser-runner:device-2",
			}),
		).toBe("blocked");
	});

	it.each([
		{ submitIntentAt: null, leaseExpiresAt: new Date("2026-08-18T04:00:01.000Z") },
		{
			submitIntentAt: new Date("2026-08-18T03:59:00.000Z"),
			leaseExpiresAt: new Date("2026-08-18T04:00:01.000Z"),
		},
	] as const)("keeps an unexpired claimed running task active", ({ submitIntentAt, leaseExpiresAt }) => {
		expect(
			reconcileExactTask({
				...base,
				deliveryStatus: "claimed",
				automationStatus: "running",
				submitIntentAt,
				leaseExpiresAt,
			}),
		).toBe("active");
	});

	it.each([
		{ submitIntentAt: null, leaseExpiresAt: new Date("2026-08-18T04:00:00.000Z"), expected: "resumable_pre" },
		{
			submitIntentAt: new Date("2026-08-18T03:59:00.000Z"),
			leaseExpiresAt: new Date("2026-08-18T03:59:59.999Z"),
			expected: "resumable_post",
		},
	] as const)(
		"derives $expected for an expired claimed running task",
		({ submitIntentAt, leaseExpiresAt, expected }) => {
			expect(
				reconcileExactTask({
					...base,
					deliveryStatus: "claimed",
					automationStatus: "running",
					submitIntentAt,
					leaseExpiresAt,
				}),
			).toBe(expected);
		},
	);

	it("blocks a claimed running task for a different runner", () => {
		expect(
			reconcileExactTask({
				...base,
				deliveryStatus: "claimed",
				automationStatus: "running",
				leaseExpiresAt: new Date("2026-08-18T04:00:01.000Z"),
				requestingClaimant: "browser-runner:device-2",
			}),
		).toBe("blocked");
	});

	it.each([
		{ ...base, deliveryStatus: "available", automationStatus: "running" as const },
		{ ...base, deliveryStatus: "claimed", automationStatus: "queued" as const },
		{ ...base, deliveryStatus: "claimed", automationStatus: "running" as const, leaseExpiresAt: null },
		{ ...base, deliveryStatus: "succeeded", automationStatus: "running" as const },
	])("blocks an illegal delivery/automation/lease combination", (input) => {
		expect(reconcileExactTask(input)).toBe("blocked");
	});
});
