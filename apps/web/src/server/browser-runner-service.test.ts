import { describe, expect, it, vi } from "vitest";
import {
	assertBrowserRunnerEvidenceSelection,
	type assertRunnerTask,
	authorizeRunnerTaskOperation,
	browserRunnerGlobalQueueState,
	browserRunnerLaunchUrl,
	browserRunnerObservationSchema,
	browserRunnerReconcileSchema,
	browserRunnerResumeSchema,
	browserRunnerSessionLeaseSchema,
	claimRunnerTask,
	reconcileRunnerTask,
} from "./browser-runner-service";
import { BrowserRunnerSnapshotCapacityError } from "./browser-runner-snapshot-policy";

const guid1 = "11111111-1111-4111-8111-111111111111";
const guid2 = "22222222-2222-4222-8222-222222222222";

type ExtensionTaskOperation = { kind: "resume" } | { kind: "complete"; adapterVersion: string };

async function authorizeExtensionTaskOperation(input: {
	surfaceTargetKey: "doubao.consumer_web" | "deepseek.consumer_web";
	readySurfaces: readonly ("doubao.consumer_web" | "deepseek.consumer_web")[];
	operation: ExtensionTaskOperation;
}) {
	return authorizeRunnerTaskOperation(
		"task-1",
		"stepfun",
		{
			kind: "browser_extension",
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: [input.surfaceTargetKey],
			readySurfaces: input.readySurfaces,
		},
		input.operation,
		{
			assertTask: async () =>
				({ surfaceTargetKey: input.surfaceTargetKey }) as Awaited<ReturnType<typeof assertRunnerTask>>,
		},
	);
}

function observationInput() {
	return {
		brandId: "stepfun",
		leaseToken: "lease-token-that-is-at-least-thirty-two-characters",
		leaseGeneration: 1,
		runnerSessionId: "cn-runner-session-1",
		adapterVersion: "doubao-v1",
		browserVersion: "Chromium 140",
		observation: {
			answerText: "阶跃星辰是一家人工智能公司。",
			answerHtml: '<section data-testid="answer">阶跃星辰是一家人工智能公司。</section>',
			observedAt: "2026-08-12T12:00:00.000+08:00",
			pageUrl: "https://www.doubao.com/chat/abc",
			sessionMode: "anonymous_clean" as const,
			searchMode: "off" as const,
			evidenceArtifactIds: [guid1, guid2],
			citations: [],
			webQueries: [],
		},
	};
}

describe("Browser Runner service contracts", () => {
	it("checks snapshot capacity before allocating a task lease", async () => {
		const claim = vi.fn();
		await expect(
			claimRunnerTask(
				{ brandId: "stepfun", surfaceTargetKeys: ["doubao.consumer_web"] },
				{ kind: "legacy_host", id: "runner-cn-1", market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" },
				{
					assertCapacity: async () => {
						throw new BrowserRunnerSnapshotCapacityError("full");
					},
					claim,
				},
			),
		).rejects.toMatchObject({ status: 503 });
		expect(claim).not.toHaveBeenCalled();
	});

	it("limits paired-device claims to assigned brands and ready declared surfaces", async () => {
		const claim = vi.fn(async () => null);
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const, "deepseek.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};

		await claimRunnerTask(
			{
				brandId: "stepfun",
				surfaceTargetKeys: ["doubao.consumer_web", "deepseek.consumer_web"],
			},
			principal,
			{ assertCapacity: async () => null, claim },
		);

		expect(claim).toHaveBeenCalledWith(
			expect.objectContaining({
				captureTargets: [
					{
						surfaceTargetKey: "doubao.consumer_web",
						captureRouteKey: "browser_extension.doubao",
					},
				],
			}),
		);
		claim.mockClear();
		await expect(
			claimRunnerTask({ brandId: "another-brand" }, principal, {
				assertCapacity: async () => null,
				claim,
			}),
		).rejects.toMatchObject({ status: 403 });
		expect(claim).not.toHaveBeenCalled();
	});

	it("fails closed with an actionable response when an installed device has no ready requested surface", async () => {
		const claim = vi.fn(async () => null);
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const, "deepseek.consumer_web" as const],
			readySurfaces: [],
		};

		await expect(
			claimRunnerTask({ brandId: "stepfun", surfaceTargetKeys: ["doubao.consumer_web"] }, principal, {
				assertCapacity: async () => null,
				claim,
			}),
		).rejects.toMatchObject({ status: 409 });
		expect(claim).not.toHaveBeenCalled();
	});

	it("rejects an exact DeepSeek resume when the authenticated device has no approved ready DeepSeek surface", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "deepseek.consumer_web",
				readySurfaces: [],
				operation: { kind: "resume" },
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("rejects completion from stale Doubao v6 even when the authenticated surface is ready", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "complete", adapterVersion: "doubao-web-20260818-localpc-v6" },
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("accepts completion only when authenticated readiness and the current approved Doubao v7 agree", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "complete", adapterVersion: "doubao-web-20260818-localpc-v7" },
			}),
		).resolves.toMatchObject({ surfaceTargetKey: "doubao.consumer_web" });
	});

	it("distinguishes pending work, a drained human queue, and a fully idle global poll", () => {
		expect(browserRunnerGlobalQueueState(true, false)).toBe("waiting");
		expect(browserRunnerGlobalQueueState(false, true)).toBe("drained");
		expect(browserRunnerGlobalQueueState(false, false)).toBe("settled");
	});

	it("returns the exact launch URL for each approved extension surface", () => {
		expect(browserRunnerLaunchUrl("doubao.consumer_web")).toBe("https://www.doubao.com/chat/");
		expect(browserRunnerLaunchUrl("deepseek.consumer_web")).toBe("https://chat.deepseek.com/");
		expect(() => browserRunnerLaunchUrl("unknown.consumer_web")).toThrow(/unsupported launch surface/i);
	});

	it("requires a durable runner session on intent, confirmation, and completion payloads", () => {
		const complete = observationInput();
		const {
			observation: _observation,
			adapterVersion: _adapterVersion,
			browserVersion: _browserVersion,
			...lease
		} = complete;
		expect(browserRunnerSessionLeaseSchema.safeParse(lease).success).toBe(true);
		expect(browserRunnerSessionLeaseSchema.safeParse({ ...lease, runnerSessionId: "" }).success).toBe(false);
		expect(browserRunnerObservationSchema.safeParse(complete).success).toBe(true);
		expect(browserRunnerObservationSchema.safeParse({ ...complete, runnerSessionId: undefined }).success).toBe(false);
	});

	it("accepts an explicit extension stage while preserving legacy post-submit resume compatibility", () => {
		expect(browserRunnerResumeSchema.safeParse({ brandId: "stepfun", stage: "pre_submit" }).success).toBe(true);
		expect(browserRunnerResumeSchema.safeParse({ brandId: "stepfun", stage: "post_submit" }).success).toBe(true);
		expect(browserRunnerResumeSchema.safeParse({ brandId: "stepfun" }).success).toBe(true);
		expect(browserRunnerResumeSchema.safeParse({ brandId: "stepfun", stage: "unknown" }).success).toBe(false);
	});

	it("accepts only a brand-scoped exact-task reconciliation payload", () => {
		expect(browserRunnerReconcileSchema.safeParse({ brandId: "stepfun" }).success).toBe(true);
		expect(browserRunnerReconcileSchema.safeParse({ brandId: "stepfun", taskId: "spoofed" }).success).toBe(false);
	});

	it("returns the server-authoritative exact-task state without allocating a lease", async () => {
		const reconcile = vi.fn(async () => ({
			state: "resumable_pre" as const,
			task: {
				id: "task-1",
				batchId: "batch-1",
				brandId: "stepfun",
				surfaceTargetKey: "deepseek.consumer_web",
				promptText: "Prompt A",
				runnerSessionId: null,
				claimedBy: "browser-runner:11111111-1111-4111-8111-111111111111",
			},
		}));
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["deepseek.consumer_web" as const],
			readySurfaces: ["deepseek.consumer_web" as const],
		};

		await expect(
			reconcileRunnerTask("task-1", { brandId: "stepfun" }, principal, {
				reconcile,
				assertTask: async () => null,
			}),
		).resolves.toEqual({
			state: "resumable_pre",
			task: {
				taskId: "task-1",
				batchId: "batch-1",
				brandId: "stepfun",
				surfaceTargetKey: "deepseek.consumer_web",
				promptText: "Prompt A",
			},
			runnerSessionId: null,
		});
		expect(reconcile).toHaveBeenCalledWith({
			brandId: "stepfun",
			taskId: "task-1",
			runnerId: "11111111-1111-4111-8111-111111111111",
		});
	});

	it("does not disclose an exact task or runner session to another paired device", async () => {
		const reconcile = vi.fn(async () => ({
			state: "blocked" as const,
			task: {
				id: "task-1",
				batchId: "batch-1",
				brandId: "stepfun",
				surfaceTargetKey: "deepseek.consumer_web",
				promptText: "Confidential frozen prompt",
				runnerSessionId: "session-owned-by-device-a",
				claimedBy: "browser-runner:22222222-2222-4222-8222-222222222222",
			},
		}));
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["deepseek.consumer_web" as const],
			readySurfaces: ["deepseek.consumer_web" as const],
		};

		await expect(
			reconcileRunnerTask("task-1", { brandId: "stepfun" }, principal, {
				reconcile,
				assertTask: async () => null,
			}),
		).rejects.toThrow(/not claimed by this Browser Runner device/i);
	});

	it("rejects operator attestation in machine-authored observations", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: { ...input.observation, operatorAttested: true },
			}).success,
		).toBe(false);
	});

	it("requires bounded answer-container HTML for every machine-authored completion", () => {
		const input = observationInput();
		const { answerHtml: _answerHtml, ...withoutAnswerHtml } = input.observation;
		expect(browserRunnerObservationSchema.safeParse({ ...input, observation: withoutAnswerHtml }).success).toBe(false);
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: { ...input.observation, answerHtml: "中".repeat(2 * 1024 * 1024) },
			}).success,
		).toBe(false);
	});

	it("accepts native-auto search with an explicitly unknown observation", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: {
					...input.observation,
					searchMode: "native_auto",
					webSearchObserved: null,
				},
			}).success,
		).toBe(true);
	});

	it("accepts the honest dedicated sampling profile session mode", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: {
					...input.observation,
					sessionMode: "dedicated_sampling_profile",
					searchMode: "native_auto",
					webSearchObserved: null,
				},
			}).success,
		).toBe(true);
	});

	it("keeps the legacy host screenshot plus page-snapshot evidence contract", () => {
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				"browser_runner.doubao",
				[
					{ id: guid1, kind: "screenshot" },
					{ id: guid2, kind: "page_snapshot" },
				],
				[guid1, guid2],
			),
		).not.toThrow();
		for (const artifacts of [
			[
				{ id: guid1, kind: "screenshot" as const },
				{ id: guid2, kind: "screenshot" as const },
			],
			[{ id: guid1, kind: "screenshot" as const }],
		]) {
			expect(() => assertBrowserRunnerEvidenceSelection("browser_runner.doubao", artifacts, [guid1, guid2])).toThrow(
				/exactly one staged/,
			);
		}
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				"browser_runner.doubao",
				[
					{ id: guid1, kind: "screenshot" },
					{ id: guid2, kind: "page_snapshot" },
					{ id: "33333333-3333-4333-8333-333333333333", kind: "screenshot" },
				],
				[guid1, guid2, "33333333-3333-4333-8333-333333333333"],
			),
		).toThrow(/exactly one staged/);
	});

	it("requires one page snapshot and no screenshot for extension completion", () => {
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				"browser_extension.deepseek",
				[{ id: guid1, kind: "page_snapshot" }],
				[guid1],
			),
		).not.toThrow();
		expect(() =>
			assertBrowserRunnerEvidenceSelection("browser_extension.doubao", [{ id: guid1, kind: "screenshot" }], [guid1]),
		).toThrow(/exactly one page snapshot/i);
	});
});
