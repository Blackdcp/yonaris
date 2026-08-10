import type { DeliveryTaskView } from "@workspace/lib/db/delivery-batches";
import {
	buildDeliveryTaskSlotKey,
	type DeliveryManifestSnapshot,
	type DeliveryManifestTaskSnapshot,
} from "@workspace/lib/delivery-manifest";
import { describe, expect, it } from "vitest";
import { prepareSamplingObservation, type SamplingObservationInput } from "./sampling-observation";

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

const observation: SamplingObservationInput = {
	answerText: "阶跃星辰的 StepFun 是一个可考虑的选项。",
	observedAt: "2020-08-10T02:00:00.000Z",
	pageUrl: "https://chat.deepseek.com/a/chat/s/sample",
	sessionMode: "anonymous_clean",
	searchMode: "off",
	operatorAttested: true,
	evidenceRefs: [
		{
			type: "screenshot",
			uri: "https://evidence.example/sample.png",
			sha256: "a".repeat(64),
		},
	],
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
				observation: { ...observation, evidenceRefs: [] },
				operatorUserId: "admin-1",
				leaseGeneration: 1,
			}),
		).toThrow("At least 1 evidence artifact");
	});
});
