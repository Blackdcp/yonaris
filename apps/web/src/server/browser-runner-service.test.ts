import {
	type BrowserExtensionSurface,
	isBrowserExtensionAdapterVersionBindingSatisfied,
} from "@workspace/lib/browser-extension-contract";
import { BROWSER_EXTENSION_SURFACE_DEFINITIONS } from "@workspace/lib/browser-extension-surfaces";
import { describe, expect, it, vi } from "vitest";
import {
	assertBrowserRunnerEvidenceSelection,
	type assertRunnerTask,
	authorizeRunnerEvidenceUpload,
	authorizeRunnerTaskOperation,
	browserRunnerClaimSchema,
	browserRunnerGlobalQueueState,
	browserRunnerLaunchUrl,
	browserRunnerLeaseSchema,
	browserRunnerObservationSchema,
	browserRunnerReconcileSchema,
	browserRunnerResumeSchema,
	browserRunnerSessionLeaseSchema,
	claimRunnerTask,
	heartbeatRunnerTask,
	reconcileRunnerTask,
	recordRunnerSubmitConfirmed,
	recordRunnerSubmitIntent,
	resumeRunnerTask,
} from "./browser-runner-service";
import { BrowserRunnerSnapshotCapacityError } from "./browser-runner-snapshot-policy";

const guid1 = "11111111-1111-4111-8111-111111111111";
const guid2 = "22222222-2222-4222-8222-222222222222";
const futureDoubaoV8Binding = (surface: BrowserExtensionSurface, requestedAdapterVersion: string | undefined) =>
	isBrowserExtensionAdapterVersionBindingSatisfied({
		surface,
		requestedAdapterVersion,
		approvedAdapterVersion: "doubao-web-20260821-localpc-v13",
	});

type ExtensionTaskOperation =
	| { kind: "resume"; adapterVersion?: string }
	| { kind: "heartbeat"; adapterVersion?: string }
	| { kind: "submit_intent"; adapterVersion?: string }
	| { kind: "submit_confirmed"; adapterVersion?: string }
	| { kind: "evidence"; adapterVersion?: string }
	| { kind: "complete"; adapterVersion: string };

async function authorizeExtensionTaskOperation(input: {
	surfaceTargetKey: BrowserExtensionSurface;
	readySurfaces: readonly BrowserExtensionSurface[];
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
	it("accepts a claim request spanning every registered browser surface", () => {
		expect(
			browserRunnerClaimSchema.safeParse({
				brandId: "stepfun",
				adapterVersion: "surface-adapter-v1",
				surfaceTargetKeys: BROWSER_EXTENSION_SURFACE_DEFINITIONS.map(({ key }) => key),
			}).success,
		).toBe(true);
	});

	it("binds evidence upload to the confirmed runner session and approved adapter", async () => {
		const principal = {
			kind: "browser_extension" as const,
			id: guid1,
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};
		const task = {
			surfaceTargetKey: "doubao.consumer_web",
			runnerSessionId: "session-current",
			submitIntentAt: new Date("2026-08-20T00:00:00Z"),
			submitConfirmedAt: new Date("2026-08-20T00:00:01Z"),
		} as Awaited<ReturnType<typeof assertRunnerTask>>;
		const dependencies = {
			assertTask: async () => task,
			isAdapterVersionBindingSatisfied: futureDoubaoV8Binding,
		};

		await expect(
			authorizeRunnerEvidenceUpload(
				"task-1",
				"stepfun",
				{ runnerSessionId: "session-current", adapterVersion: "doubao-web-20260821-localpc-v13" },
				principal,
				dependencies,
			),
		).resolves.toBe(task);
		await expect(
			authorizeRunnerEvidenceUpload(
				"task-1",
				"stepfun",
				{ runnerSessionId: "session-stale", adapterVersion: "doubao-web-20260821-localpc-v13" },
				principal,
				dependencies,
			),
		).rejects.toMatchObject({ status: 409 });
		await expect(
			authorizeRunnerEvidenceUpload(
				"task-1",
				"stepfun",
				{ runnerSessionId: "session-current", adapterVersion: "doubao-web-20260818-localpc-v7" },
				principal,
				dependencies,
			),
		).rejects.toMatchObject({ status: 409 });
	});

	it("rejects omitted evidence bindings after Doubao v8 activation", async () => {
		const principal = {
			kind: "browser_extension" as const,
			id: guid1,
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};
		const task = { surfaceTargetKey: "doubao.consumer_web" } as Awaited<ReturnType<typeof assertRunnerTask>>;

		await expect(
			authorizeRunnerEvidenceUpload("task-1", "stepfun", {}, principal, { assertTask: async () => task }),
		).rejects.toMatchObject({ status: 409 });
	});
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
				adapterVersion: "doubao-web-20260821-localpc-v13",
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

	it("accepts an exact v8 claim after production activation", async () => {
		const claim = vi.fn(async () => null);
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};

		await expect(
			claimRunnerTask(
				{
					brandId: "stepfun",
					surfaceTargetKeys: ["doubao.consumer_web"],
					adapterVersion: "doubao-web-20260821-localpc-v13",
				},
				principal,
				{ assertCapacity: async () => null, claim },
			),
		).resolves.toBeNull();
		expect(claim).toHaveBeenCalled();
	});

	it("rejects an omitted claim binding after production activation", async () => {
		const claim = vi.fn(async () => null);
		const principal = {
			kind: "browser_extension" as const,
			id: "11111111-1111-4111-8111-111111111111",
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};

		await expect(
			claimRunnerTask({ brandId: "stepfun", surfaceTargetKeys: ["doubao.consumer_web"] }, principal, {
				assertCapacity: async () => null,
				claim,
			}),
		).rejects.toMatchObject({ status: 409 });
		expect(claim).not.toHaveBeenCalled();
	});

	it.each([undefined, "doubao-web-20260818-localpc-v7"])(
		"rejects a %s claim before allocating a lease when the ready surface is simulated as approved v8",
		async (adapterVersion) => {
			const claim = vi.fn(async () => null);
			const assertCapacity = vi.fn(async () => null);
			const principal = {
				kind: "browser_extension" as const,
				id: "11111111-1111-4111-8111-111111111111",
				market: "CN" as const,
				locale: "zh-CN" as const,
				timezone: "Asia/Shanghai" as const,
				allowedBrandIds: ["stepfun"],
				supportedSurfaces: ["doubao.consumer_web" as const],
				readySurfaces: ["doubao.consumer_web" as const],
			};

			await expect(
				claimRunnerTask(
					{
						brandId: "stepfun",
						surfaceTargetKeys: ["doubao.consumer_web"],
						adapterVersion,
					},
					principal,
					{
						assertCapacity,
						claim,
						isAdapterVersionBindingSatisfied: futureDoubaoV8Binding,
					},
				),
			).rejects.toMatchObject({ status: 409 });
			expect(assertCapacity).not.toHaveBeenCalled();
			expect(claim).not.toHaveBeenCalled();
		},
	);

	it.each([undefined, "doubao-web-20260818-localpc-v7"])(
		"rejects a %s resume before allocating a lease when the ready surface is simulated as approved v8",
		async (adapterVersion) => {
			const resume = vi.fn(async () => {
				throw new Error("lease allocated");
			});
			const principal = {
				kind: "browser_extension" as const,
				id: "11111111-1111-4111-8111-111111111111",
				market: "CN" as const,
				locale: "zh-CN" as const,
				timezone: "Asia/Shanghai" as const,
				allowedBrandIds: ["stepfun"],
				supportedSurfaces: ["doubao.consumer_web" as const],
				readySurfaces: ["doubao.consumer_web" as const],
			};

			await expect(
				resumeRunnerTask("task-1", { brandId: "stepfun", adapterVersion }, principal, {
					assertTask: async () =>
						({ surfaceTargetKey: "doubao.consumer_web" }) as Awaited<ReturnType<typeof assertRunnerTask>>,
					resume,
					isAdapterVersionBindingSatisfied: futureDoubaoV8Binding,
				}),
			).rejects.toMatchObject({ status: 409 });
			expect(resume).not.toHaveBeenCalled();
		},
	);

	it("rejects an exact DeepSeek resume when the authenticated device has no approved ready DeepSeek surface", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "deepseek.consumer_web",
				readySurfaces: [],
				operation: { kind: "resume" },
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("accepts a Doubao v8 resume after production activation", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "resume", adapterVersion: "doubao-web-20260821-localpc-v13" },
			}),
		).resolves.toMatchObject({ surfaceTargetKey: "doubao.consumer_web" });
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

	it("accepts completion from the production-approved Doubao v8 adapter", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "complete", adapterVersion: "doubao-web-20260821-localpc-v13" },
			}),
		).resolves.toMatchObject({ surfaceTargetKey: "doubao.consumer_web" });
	});

	it("rejects completion from the retired explicit v7 adapter version", async () => {
		await expect(
			authorizeExtensionTaskOperation({
				surfaceTargetKey: "doubao.consumer_web",
				readySurfaces: ["doubao.consumer_web"],
				operation: { kind: "complete", adapterVersion: "doubao-web-20260818-localpc-v7" },
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("distinguishes pending work, a drained human queue, and a fully idle global poll", () => {
		expect(browserRunnerGlobalQueueState(true, false)).toBe("waiting");
		expect(browserRunnerGlobalQueueState(false, true)).toBe("drained");
		expect(browserRunnerGlobalQueueState(false, false)).toBe("settled");
	});

	it("returns the exact launch URL for each approved extension surface", () => {
		for (const { key, launchUrl } of BROWSER_EXTENSION_SURFACE_DEFINITIONS) {
			expect(browserRunnerLaunchUrl(key)).toBe(launchUrl);
		}
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
		expect(
			browserRunnerLeaseSchema.safeParse({
				brandId: lease.brandId,
				leaseToken: lease.leaseToken,
				leaseGeneration: lease.leaseGeneration,
				adapterVersion: "doubao-web-20260821-localpc-v13",
			}).success,
		).toBe(true);
		expect(
			browserRunnerSessionLeaseSchema.safeParse({
				...lease,
				adapterVersion: "doubao-web-20260821-localpc-v13",
			}).success,
		).toBe(true);
		expect(browserRunnerSessionLeaseSchema.safeParse({ ...lease, runnerSessionId: "" }).success).toBe(false);
		expect(browserRunnerObservationSchema.safeParse(complete).success).toBe(true);
		expect(browserRunnerObservationSchema.safeParse({ ...complete, runnerSessionId: undefined }).success).toBe(false);
	});

	it.each([
		["heartbeat", heartbeatRunnerTask],
		["submit_intent", recordRunnerSubmitIntent],
		["submit_confirmed", recordRunnerSubmitConfirmed],
	] as const)("rejects stale v7 %s before mutating a lease after simulated v8 activation", async (kind, mutate) => {
		const principal = {
			kind: "browser_extension" as const,
			id: guid1,
			market: "CN" as const,
			locale: "zh-CN" as const,
			timezone: "Asia/Shanghai" as const,
			allowedBrandIds: ["stepfun"],
			supportedSurfaces: ["doubao.consumer_web" as const],
			readySurfaces: ["doubao.consumer_web" as const],
		};
		const write = vi.fn(async () => ({ ok: true }));
		const input = {
			brandId: "stepfun",
			leaseToken: "lease-token-that-is-at-least-thirty-two-characters",
			leaseGeneration: 1,
			adapterVersion: "doubao-web-20260818-localpc-v7",
			...(kind === "heartbeat" ? {} : { runnerSessionId: "runner-session-1" }),
		};

		await expect(
			mutate("task-1", input as never, principal, {
				assertTask: async () =>
					({ surfaceTargetKey: "doubao.consumer_web" }) as Awaited<ReturnType<typeof assertRunnerTask>>,
				write,
				isAdapterVersionBindingSatisfied: futureDoubaoV8Binding,
			} as never),
		).rejects.toMatchObject({ status: 409 });
		expect(write).not.toHaveBeenCalled();
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

	it("accepts only the strict structured body for the Doubao v8 completion protocol", () => {
		const legacy = observationInput();
		const { answerHtml: _answerHtml, ...structuredFields } = legacy.observation;
		const structured = {
			...legacy,
			adapterVersion: "doubao-web-20260821-localpc-v13",
			observation: {
				...structuredFields,
				schemaVersion: "browser-runner-observation.v2",
				evidenceArtifactIds: [guid1],
				captureDiagnostics: { answerCount: 1, queryCount: 0, citationCount: 0, completionCount: 1 },
			},
		};

		expect(browserRunnerObservationSchema.safeParse(structured).success).toBe(true);
		expect(
			browserRunnerObservationSchema.safeParse({
				...legacy,
				adapterVersion: "doubao-web-20260821-localpc-v13",
			}).success,
		).toBe(false);
		expect(
			browserRunnerObservationSchema.safeParse({
				...structured,
				observation: { ...structured.observation, answerHtml: legacy.observation.answerHtml },
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
				"deepseek-web-20260814-uat1",
			),
		).not.toThrow();
		expect(
			assertBrowserRunnerEvidenceSelection(
				"browser_extension.doubao",
				[{ id: guid1, kind: "screenshot", mediaType: "image/jpeg", byteSize: 512_000, sha256: "a".repeat(64) }],
				[guid1],
				"doubao-web-20260821-localpc-v13",
			),
		).toEqual({
			artifactId: guid1,
			mediaType: "image/jpeg",
			sha256: "a".repeat(64),
			bytes: 512_000,
		});
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				"browser_extension.doubao",
				[{ id: guid1, kind: "page_snapshot", mediaType: "text/html", byteSize: 512_000, sha256: "a".repeat(64) }],
				[guid1],
				"doubao-web-20260821-localpc-v13",
			),
		).toThrow(/bounded JPEG screenshot/i);
	});

	it.each(BROWSER_EXTENSION_SURFACE_DEFINITIONS)(
		"accepts one session-bound JPEG for $label structured completion",
		({ captureRoute, adapterVersion }) => {
			expect(
				assertBrowserRunnerEvidenceSelection(
					captureRoute,
					[
						{
							id: guid1,
							kind: "screenshot",
							mediaType: "image/jpeg",
							byteSize: 512_000,
							sha256: "a".repeat(64),
						},
					],
					[guid1],
					adapterVersion,
				),
			).toEqual({ artifactId: guid1, mediaType: "image/jpeg", sha256: "a".repeat(64), bytes: 512_000 });
			expect(() =>
				assertBrowserRunnerEvidenceSelection(
					captureRoute,
					[{ id: guid1, kind: "page_snapshot", mediaType: "text/html", byteSize: 128, sha256: "a".repeat(64) }],
					[guid1],
					adapterVersion,
				),
			).toThrow(/bounded JPEG screenshot/i);
		},
	);
});
