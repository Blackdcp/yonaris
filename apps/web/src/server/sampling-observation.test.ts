import type { DeliveryTaskView } from "@workspace/lib/db/delivery-batches";
import {
	buildDeliveryTaskSlotKey,
	type DeliveryManifestSnapshot,
	type DeliveryManifestTaskSnapshot,
} from "@workspace/lib/delivery-manifest";
import { describe, expect, it } from "vitest";
import {
	browserRunnerStructuredObservationSchema,
	prepareSamplingObservation,
	type SamplingObservationInput,
	samplingObservationInputSchema,
} from "./sampling-observation";

const frozenTask: DeliveryManifestTaskSnapshot = {
	id: "10000000-0000-4000-8000-000000000001",
	brandId: "brand-1",
	scopeId: "20000000-0000-4000-8000-000000000001",
	promptId: "30000000-0000-4000-8000-000000000001",
	promptText: "推荐一个适合企业使用的通用大模型",
	surfaceTargetKey: "deepseek.consumer_web",
	captureRouteKey: "assisted_browser.generic",
	sampleIndex: 1,
	sessionRequirement: "anonymous_clean",
	searchRequirement: "forbidden",
	evaluationRole: "scored",
	slotKey: "",
};
frozenTask.slotKey = buildDeliveryTaskSlotKey(frozenTask);

const manifest: DeliveryManifestSnapshot = {
	schemaVersion: 1,
	batch: {
		id: "40000000-0000-4000-8000-000000000001",
		brandId: frozenTask.brandId,
		scopeId: frozenTask.scopeId,
		idempotencyKey: "customer-acceptance-1",
		name: "Customer acceptance",
	},
	scope: {
		id: frozenTask.scopeId,
		key: "cn-clean",
		name: "China clean-session sampling",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
	},
	brand: {
		id: frozenTask.brandId,
		name: "StepFun",
		website: "stepfun.com",
		additionalDomains: [],
		aliases: ["阶跃星辰"],
	},
	competitors: [],
	protocol: {
		measurementWindow: {
			startsAt: "2020-08-10T00:00:00.000Z",
			endsAt: "2020-08-11T00:00:00.000Z",
		},
		evidence: {
			minimumArtifacts: 1,
			requireSha256: true,
			requirePageUrl: true,
			allowedUriSchemes: ["https"],
		},
	},
	tasks: [frozenTask],
};

const task: DeliveryTaskView = {
	...frozenTask,
	batchId: manifest.batch.id,
	status: "claimed",
	automationStatus: null,
	automationAttemptCount: 0,
	runnerSessionId: null,
	submitIntentAt: null,
	submitConfirmedAt: null,
	needsHumanCode: null,
	needsHumanReason: null,
	observationAttemptId: null,
	claimedBy: "admin-1",
	leaseGeneration: 1,
	leaseExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
	claimCount: 1,
	lastErrorClass: null,
	lastErrorCode: null,
	lastErrorMessage: null,
	availableAt: new Date("2020-08-10T00:00:00.000Z"),
	claimedAt: new Date("2020-08-10T00:01:00.000Z"),
	succeededAt: null,
	failedAt: null,
	cancelledAt: null,
	createdAt: new Date("2020-08-10T00:00:00.000Z"),
	updatedAt: new Date("2020-08-10T00:01:00.000Z"),
};

const evidenceArtifactId = "50000000-0000-4000-8000-000000000001";

const observation: SamplingObservationInput = {
	answerText: "阶跃星辰的 StepFun 是一个可考虑的选项。",
	observedAt: "2020-08-10T02:00:00.000Z",
	pageUrl: "https://chat.deepseek.com/a/chat/s/sample",
	sessionMode: "anonymous_clean",
	searchMode: "off",
	operatorAttested: true,
	evidenceArtifactIds: [evidenceArtifactId],
	citations: [],
	webQueries: [],
};

describe("prepareSamplingObservation", () => {
	it("derives formal capture identity from the frozen task", () => {
		const prepared = prepareSamplingObservation({
			task,
			manifest,
			observation,
			operatorUserId: "admin-1",
			leaseGeneration: 1,
		});

		expect(prepared.target).toMatchObject({
			surfaceTargetKey: "deepseek.consumer_web",
			captureRouteKey: "assisted_browser.generic",
		});
		expect(prepared.mentionResult.brandMentioned).toBe(true);
		expect(prepared.captureMetadata).toMatchObject({
			measurementEligibility: "operator_attested_clean_session",
			reportedMarket: "CN",
			reportedLocale: "zh-CN",
			executionMarketVerified: false,
			deliveryTaskId: task.id,
		});
	});

	it("rejects observations outside the frozen measurement window", () => {
		expect(() =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: { ...observation, observedAt: "2020-08-12T00:00:00.000Z" },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			}),
		).toThrow("outside this batch's frozen measurement window");
	});

	it("rejects a mismatched clean-session mode, search mode, or platform host", () => {
		const prepare = (patch: Partial<SamplingObservationInput>) =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: { ...observation, ...patch },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			});

		expect(() => prepare({ sessionMode: "new_account_clean" })).toThrow("requires session mode");
		expect(() => prepare({ searchMode: "on" })).toThrow("requires search mode to be off");
		expect(() => prepare({ pageUrl: "https://example.com/fake-result" })).toThrow("does not match");
	});

	it("requires the evidence policy frozen in the manifest", () => {
		expect(() =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: { ...observation, evidenceArtifactIds: [] },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			}),
		).toThrow("At least 1 evidence artifact");
	});

	it("rejects duplicate artifact IDs and client-authored evidence references", () => {
		expect(() =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: {
					...observation,
					evidenceArtifactIds: [evidenceArtifactId, evidenceArtifactId],
				},
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			}),
		).toThrow("must not contain duplicates");

		expect(
			samplingObservationInputSchema.safeParse({
				...observation,
				evidenceRefs: [
					{
						type: "screenshot",
						uri: "https://attacker.example/fabricated.png",
						sha256: "a".repeat(64),
					},
				],
			}).success,
		).toBe(false);
	});

	it("keeps the observation fingerprint stable when a retry uses a new lease generation's artifacts", () => {
		const prepare = (artifactId: string) =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: { ...observation, evidenceArtifactIds: [artifactId] },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			});

		expect(prepare("50000000-0000-4000-8000-000000000001").sampleFingerprint).toBe(
			prepare("50000000-0000-4000-8000-000000000002").sampleFingerprint,
		);
	});

	it("keeps answer-container HTML outside the metric idempotency identity", () => {
		const prepare = (answerHtml: string) =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: { ...observation, answerHtml },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			});

		expect(prepare("<section>first rendering</section>").sampleFingerprint).toBe(
			prepare('<section data-render-id="second">first rendering</section>').sampleFingerprint,
		);
	});

	it("does not claim that a registered CN runner verified its network egress", () => {
		const runnerTask = {
			...task,
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_runner.doubao",
			automationStatus: "running" as const,
			automationAttemptCount: 1,
		};
		const runnerFrozenTask = {
			...frozenTask,
			surfaceTargetKey: runnerTask.surfaceTargetKey,
			captureRouteKey: runnerTask.captureRouteKey,
		};
		runnerFrozenTask.slotKey = buildDeliveryTaskSlotKey(runnerFrozenTask);
		runnerTask.slotKey = runnerFrozenTask.slotKey;
		const runnerManifest = { ...manifest, tasks: [runnerFrozenTask] };
		const prepared = prepareSamplingObservation({
			task: runnerTask,
			manifest: runnerManifest,
			observation: {
				...observation,
				pageUrl: "https://www.doubao.com/chat/sample",
				operatorAttested: undefined,
			},
			captureActor: {
				kind: "browser_runner",
				id: "cn-runner-1",
				adapterVersion: "doubao-v1",
				browserVersion: "Chromium 140",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
			},
			leaseGeneration: 1,
		});

		expect(prepared.captureMetadata).toMatchObject({
			executionMarketVerified: false,
			localizationEvidence: "runner_registered_cn_unverified",
			registeredMarket: "CN",
			registeredLocale: "zh-CN",
			registeredTimezone: "Asia/Shanghai",
		});
		expect(prepared.captureMetadata).not.toHaveProperty("operatorAttested");
	});

	it("preserves DeepSeek channel identity for browser-extension observations", () => {
		const extensionTask = {
			...task,
			captureRouteKey: "browser_extension.deepseek",
			sessionRequirement: "dedicated_sampling_profile" as const,
			searchRequirement: "platform_default" as const,
			automationStatus: "running" as const,
			automationAttemptCount: 1,
		};
		const extensionFrozenTask = {
			...frozenTask,
			captureRouteKey: extensionTask.captureRouteKey,
			sessionRequirement: extensionTask.sessionRequirement,
			searchRequirement: extensionTask.searchRequirement,
		};
		extensionFrozenTask.slotKey = buildDeliveryTaskSlotKey(extensionFrozenTask);
		extensionTask.slotKey = extensionFrozenTask.slotKey;

		const prepared = prepareSamplingObservation({
			task: extensionTask,
			manifest: { ...manifest, tasks: [extensionFrozenTask] },
			observation: {
				...observation,
				sessionMode: "dedicated_sampling_profile",
				searchMode: "native_auto",
				webSearchObserved: null,
				operatorAttested: undefined,
			},
			captureActor: {
				kind: "browser_runner",
				id: "device-1",
				adapterVersion: "deepseek-extension-v1",
				browserVersion: "Chrome 140",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
			},
			leaseGeneration: 1,
		});

		expect(prepared.target).toMatchObject({
			surfaceTargetKey: "deepseek.consumer_web",
			captureRouteKey: "browser_extension.deepseek",
			model: "deepseek",
		});
		expect(prepared.config.provider).toBe("browser-runner");
		expect(prepared.webSearchObserved).toBeNull();
	});

	it("preserves unknown native-auto search instead of converting it to false", () => {
		const nativeTask = { ...task, searchRequirement: "platform_default" as const };
		const nativeFrozenTask = { ...frozenTask, searchRequirement: "platform_default" as const };
		nativeFrozenTask.slotKey = buildDeliveryTaskSlotKey(nativeFrozenTask);
		nativeTask.slotKey = nativeFrozenTask.slotKey;

		const prepared = prepareSamplingObservation({
			task: nativeTask,
			manifest: { ...manifest, tasks: [nativeFrozenTask] },
			observation: {
				...observation,
				searchMode: "native_auto",
				webSearchObserved: null,
			},
			operatorUserId: "admin-1",
			leaseGeneration: 1,
		});

		expect(prepared.config.webSearch).toBe(true);
		expect(prepared.webSearchObserved).toBeNull();
		expect(prepared.captureMetadata).toMatchObject({
			searchMode: "native_auto",
			webSearchObserved: null,
		});
		expect(prepared.rawOutput).toMatchObject({ webSearchObserved: null });
	});

	it("preserves Doubao observed search and citations from the browser extension", () => {
		const extensionTask = {
			...task,
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_extension.doubao",
			sessionRequirement: "dedicated_sampling_profile" as const,
			searchRequirement: "platform_default" as const,
			automationStatus: "running" as const,
			automationAttemptCount: 1,
		};
		const extensionFrozenTask = {
			...frozenTask,
			surfaceTargetKey: extensionTask.surfaceTargetKey,
			captureRouteKey: extensionTask.captureRouteKey,
			sessionRequirement: extensionTask.sessionRequirement,
			searchRequirement: extensionTask.searchRequirement,
		};
		extensionFrozenTask.slotKey = buildDeliveryTaskSlotKey(extensionFrozenTask);
		extensionTask.slotKey = extensionFrozenTask.slotKey;

		const prepared = prepareSamplingObservation({
			task: extensionTask,
			manifest: { ...manifest, tasks: [extensionFrozenTask] },
			observation: {
				...observation,
				pageUrl: "https://www.doubao.com/chat/123456",
				sessionMode: "dedicated_sampling_profile",
				searchMode: "native_auto",
				webSearchObserved: true,
				webQueries: ["国产 GPU API", "AI inference pricing"],
				citations: [{ url: "https://www.source.example/report", title: "Source report" }],
				operatorAttested: undefined,
			},
			captureActor: {
				kind: "browser_runner",
				id: "device-1",
				adapterVersion: "doubao-web-20260819-localpc-v8",
				browserVersion: "Chrome 151",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
			},
			leaseGeneration: 1,
		});

		expect(prepared.webSearchObserved).toBe(true);
		expect(prepared.citations).toEqual([
			{
				url: "https://www.source.example/report",
				domain: "source.example",
				title: "Source report",
				citationIndex: 0,
			},
		]);
		expect(prepared.rawOutput).toMatchObject({
			webSearchObserved: true,
			citations: [{ domain: "source.example", title: "Source report" }],
		});
	});

	it("accepts strict structured runner observations without provider DOM HTML", () => {
		const structured = {
			schemaVersion: "browser-runner-observation.v2" as const,
			answerText: "PPIO 提供云服务。",
			observedAt: "2020-08-10T01:02:03.000Z",
			pageUrl: "https://www.doubao.com/chat/123456",
			sessionMode: "dedicated_sampling_profile" as const,
			searchMode: "native_auto" as const,
			webSearchObserved: true,
			evidenceArtifactIds: ["11111111-1111-4111-8111-111111111111"],
			citations: [],
			webQueries: ["PPIO 云服务"],
			captureDiagnostics: { answerCount: 1 as const, queryCount: 1, citationCount: 0, completionCount: 1 as const },
		};

		expect(browserRunnerStructuredObservationSchema.safeParse(structured).success).toBe(true);
		expect(
			browserRunnerStructuredObservationSchema.safeParse({ ...structured, answerHtml: "<p>provider DOM</p>" }).success,
		).toBe(false);
		expect(
			browserRunnerStructuredObservationSchema.safeParse({
				...structured,
				captureDiagnostics: { ...structured.captureDiagnostics, queryCount: 0 },
			}).success,
		).toBe(false);

		const extensionTask = {
			...task,
			surfaceTargetKey: "doubao.consumer_web",
			captureRouteKey: "browser_extension.doubao",
			sessionRequirement: "dedicated_sampling_profile" as const,
			searchRequirement: "platform_default" as const,
		};
		const extensionFrozenTask = {
			...frozenTask,
			surfaceTargetKey: extensionTask.surfaceTargetKey,
			captureRouteKey: extensionTask.captureRouteKey,
			sessionRequirement: extensionTask.sessionRequirement,
			searchRequirement: extensionTask.searchRequirement,
		};
		extensionFrozenTask.slotKey = buildDeliveryTaskSlotKey(extensionFrozenTask);
		extensionTask.slotKey = extensionFrozenTask.slotKey;
		const prepared = prepareSamplingObservation({
			task: extensionTask,
			manifest: { ...manifest, tasks: [extensionFrozenTask] },
			observation: structured,
			captureActor: {
				kind: "browser_runner",
				id: "device-1",
				adapterVersion: "doubao-web-20260819-localpc-v8",
				browserVersion: "Chrome 151",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
			},
			leaseGeneration: 1,
		});
		expect(prepared.captureMetadata).toMatchObject({
			responseSnapshotSchemaVersion: "response-snapshot.v2",
			adapterVersion: "doubao-web-20260819-localpc-v8",
			captureDiagnostics: structured.captureDiagnostics,
		});
	});

	it("rejects structured citation payloads that cannot be archived unchanged", () => {
		const structured = {
			schemaVersion: "browser-runner-observation.v2" as const,
			answerText: "PPIO 提供云服务。",
			observedAt: "2026-08-20T01:02:03.000Z",
			pageUrl: "https://www.doubao.com/chat/123456",
			sessionMode: "dedicated_sampling_profile" as const,
			searchMode: "native_auto" as const,
			webSearchObserved: true,
			evidenceArtifactIds: ["11111111-1111-4111-8111-111111111111"],
			webQueries: ["PPIO 云服务"],
			captureDiagnostics: { answerCount: 1 as const, queryCount: 1, citationCount: 1, completionCount: 1 as const },
		};
		const validCitation = { url: "https://source.example/report", title: "Source report" };

		for (const citations of [
			[{ ...validCitation, providerHtml: "<script>secret</script>" }],
			[{ ...validCitation, url: `https://source.example/${"a".repeat(10_000)}` }],
			[{ ...validCitation, title: "" }],
			[{ url: "https://source.example/untitled" }],
			[
				{ ...validCitation, citationIndex: 0 },
				{ ...validCitation, url: "https://source.example/other", citationIndex: 0 },
			],
			[validCitation, { ...validCitation }],
		]) {
			expect(
				browserRunnerStructuredObservationSchema.safeParse({
					...structured,
					citations,
					captureDiagnostics: { ...structured.captureDiagnostics, citationCount: citations.length },
				}).success,
			).toBe(false);
		}
	});

	it("rejects citation URLs that contain embedded credentials", () => {
		const parsed = samplingObservationInputSchema.safeParse({
			...observation,
			citations: [{ url: "https://user:secret@source.example/report", title: "Unsafe source" }],
		});

		expect(parsed.success).toBe(false);
	});

	it("returns a validation failure instead of throwing for a malformed URL", () => {
		const parse = () =>
			samplingObservationInputSchema.safeParse({
				...observation,
				pageUrl: "not-a-url",
			});

		expect(parse).not.toThrow();
		expect(parse().success).toBe(false);
	});

	it("rejects native-auto search on a frozen forbidden task", () => {
		expect(() =>
			prepareSamplingObservation({
				task,
				manifest,
				observation: {
					...observation,
					searchMode: "native_auto",
					webSearchObserved: null,
				},
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			}),
		).toThrow("requires search mode to be off");
	});
});
