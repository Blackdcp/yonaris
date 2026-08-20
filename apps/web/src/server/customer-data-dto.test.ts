import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deriveCustomerScopeClassification, toCustomerBrandDto, toCustomerPromptRunDto } from "./customer-data-dto";

describe("customer brand DTO", () => {
	it("returns only customer-facing brand, prompt, competitor, model, and scope fields", () => {
		const dto = toCustomerBrandDto(
			{
				id: "stepfun",
				name: "StepFun",
				website: "https://stepfun.com",
				additionalDomains: ["stepfun.com"],
				aliases: ["阶跃星辰"],
				enabled: true,
				onboarded: true,
				delayOverrideHours: null,
				updatedAt: new Date("2026-08-12T10:00:00.000Z"),
				prompts: [
					{
						id: "prompt-1",
						scopeId: "scope-1",
						value: "阶跃星辰是什么公司？",
						enabled: true,
						tags: ["品牌观察"],
						systemTags: ["branded"],
						brandId: "stepfun",
						createdAt: new Date(),
					} as never,
				],
				competitors: [
					{
						id: "competitor-1",
						name: "Competitor",
						domains: ["competitor.example"],
						aliases: [],
						brandId: "stepfun",
						createdAt: new Date(),
					} as never,
				],
				measurementScopes: [
					{
						id: "scope-1",
						key: "cn-zh-scored",
						name: "China scored",
						market: "CN",
						locale: "zh-CN",
						timezone: "Asia/Shanghai",
						enabled: true,
						isDefault: false,
						automaticTargetKeys: [],
						samplingEvaluationRole: "scored",
						captureRouteKey: "assisted_browser.generic",
					} as never,
				],
				enabledModels: ["chatgpt:secret-provider"] as never,
				provider: "secret-provider" as never,
			} as never,
			["chatgpt", "chatgpt", "doubao"],
		);

		expect(dto.effectiveModels).toEqual(["chatgpt", "doubao"]);
		expect(dto.measurementScopes[0]).toMatchObject({ deliveryMode: "assisted", lane: "scored" });
		expect(dto).not.toHaveProperty("provider");
		expect(dto).not.toHaveProperty("enabledModels");
		expect(dto).not.toHaveProperty("organizationId");
		expect(dto.prompts[0]).not.toHaveProperty("brandId");
		expect(dto.prompts[0]).not.toHaveProperty("createdAt");
		expect(dto.competitors[0]).not.toHaveProperty("brandId");
		expect(dto.measurementScopes[0]).not.toHaveProperty("automaticTargetKeys");
		expect(dto.measurementScopes[0]).not.toHaveProperty("captureRouteKey");
	});

	it("exposes the first populated Program as the effective default when the stored default is empty", () => {
		const dto = toCustomerBrandDto(
			{
				id: "ppio",
				name: "PPIO",
				website: "https://ppio.com",
				additionalDomains: [],
				aliases: [],
				enabled: true,
				onboarded: true,
				delayOverrideHours: null,
				updatedAt: new Date("2026-08-18T00:00:00.000Z"),
				prompts: [
					{
						id: "prompt-cn",
						scopeId: "china",
						value: "国内提示词",
						enabled: true,
						tags: [],
						systemTags: [],
					},
				],
				competitors: [],
				measurementScopes: [
					{
						id: "legacy",
						key: "legacy-unspecified",
						name: "Legacy / Unspecified",
						market: "ZZ",
						locale: "und",
						timezone: "UTC",
						enabled: true,
						isDefault: true,
						automaticTargetKeys: null,
						samplingEvaluationRole: null,
					},
					{
						id: "china",
						key: "cn-zh",
						name: "China Market",
						market: "CN",
						locale: "zh-CN",
						timezone: "Asia/Shanghai",
						enabled: true,
						isDefault: false,
						automaticTargetKeys: [],
						samplingEvaluationRole: "scored",
					},
				],
			},
			["doubao"],
		);

		expect(dto.measurementScopes.map(({ id, isDefault }) => ({ id, isDefault }))).toEqual([
			{ id: "legacy", isDefault: false },
			{ id: "china", isDefault: true },
		]);
	});

	it.each([
		[
			{ automaticTargetKeys: null, samplingEvaluationRole: null },
			{ deliveryMode: "legacy", lane: "unspecified" },
		],
		[
			{ automaticTargetKeys: [], samplingEvaluationRole: null },
			{ deliveryMode: "assisted", lane: "consumer" },
		],
		[
			{ automaticTargetKeys: ["chatgpt:brightdata:online"], samplingEvaluationRole: null },
			{ deliveryMode: "automatic", lane: "consumer" },
		],
		[
			{ automaticTargetKeys: ["chatgpt:openai-api:gpt-5-mini"], samplingEvaluationRole: null },
			{ deliveryMode: "automatic", lane: "diagnostic" },
		],
	] as const)("derives a safe public delivery classification", (input, expected) => {
		expect(deriveCustomerScopeClassification(input)).toEqual(expected);
	});

	it("pins customer brand handlers to the customer DTO boundary", () => {
		const source = readFileSync(new URL("./brands.ts", import.meta.url), "utf8");
		const customerReadSection = source.slice(
			source.indexOf("async function getCustomerBrandFromDb"),
			source.indexOf("export const createBrandFn"),
		);

		expect(customerReadSection).toContain("return toCustomerBrandDto(");
		expect(customerReadSection).toContain("getCustomerBrandFromDb(data.brandId)");
		expect(customerReadSection).not.toContain("effectiveModelConfigs");
	});
});

describe("customer prompt-run DTO", () => {
	it("keeps the answer and public observation metadata without execution internals", () => {
		const dto = toCustomerPromptRunDto({
			id: "run-1",
			model: "doubao",
			version: "displayed-version",
			observedAt: new Date("2026-08-12T11:00:00.000Z"),
			createdAt: new Date("2026-08-12T11:01:00.000Z"),
			webSearchEnabled: false,
			answerText: "完整回答",
			webQueries: [],
			brandMentioned: true,
			competitorsMentioned: ["Competitor"],
				snapshot: {
					id: "snapshot-1",
					status: "ready",
					schemaVersion: "response-snapshot.v2",
					contentSource: "rendered_from_structured_response",
				createdAt: new Date("2026-08-12T11:01:30.000Z"),
				expiresAt: new Date("2026-11-10T11:00:00.000Z"),
				htmlSha256: "a".repeat(64),
				jsonSha256: "b".repeat(64),
				visualEvidence: {
					mediaType: "image/jpeg",
					sha256: "c".repeat(64),
					bytes: 12345,
				},
				storageBackend: "filesystem",
				storageKey: "private/key",
			},
			provider: "internal-provider",
			captureRouteKey: "assisted_browser.generic",
			rawOutput: { secret: true },
			observationAttemptId: "attempt-1",
		} as never);

		expect(dto).toEqual({
			id: "run-1",
			model: "doubao",
			version: "displayed-version",
			observedAt: "2026-08-12T11:00:00.000Z",
			webSearchEnabled: false,
			answerText: "完整回答",
			webQueries: [],
			brandMentioned: true,
			competitorsMentioned: ["Competitor"],
				snapshot: {
					id: "snapshot-1",
					status: "ready",
					schemaVersion: "response-snapshot.v2",
					contentSource: "rendered_from_structured_response",
				createdAt: "2026-08-12T11:01:30.000Z",
				expiresAt: "2026-11-10T11:00:00.000Z",
				htmlSha256: "a".repeat(64),
				jsonSha256: "b".repeat(64),
				visualEvidence: {
					mediaType: "image/jpeg",
					sha256: "c".repeat(64),
					bytes: 12345,
				},
			},
		});
		expect(dto).not.toHaveProperty("rawOutput");
		expect(dto).not.toHaveProperty("provider");
		expect(dto).not.toHaveProperty("captureRouteKey");
		expect(dto).not.toHaveProperty("observationAttemptId");
		expect(dto.snapshot).not.toHaveProperty("storageBackend");
		expect(dto.snapshot).not.toHaveProperty("storageKey");
	});

	it("does not expose a legacy snapshot's attached administrator screenshot as customer evidence", () => {
		const dto = toCustomerPromptRunDto({
			id: "run-v1",
			model: "doubao",
			version: "legacy",
			observedAt: new Date("2026-08-12T11:00:00.000Z"),
			createdAt: new Date("2026-08-12T11:01:00.000Z"),
			webSearchEnabled: false,
			answerText: "Legacy answer",
			webQueries: [],
			brandMentioned: false,
			competitorsMentioned: [],
			snapshot: {
				id: "snapshot-v1",
				status: "ready",
				schemaVersion: "response-snapshot.v1",
				contentSource: "browser_answer_html",
				createdAt: new Date("2026-08-12T11:01:30.000Z"),
				expiresAt: new Date("2026-11-10T11:00:00.000Z"),
				htmlSha256: "a".repeat(64),
				jsonSha256: "b".repeat(64),
				visualEvidence: { mediaType: "image/jpeg", sha256: "c".repeat(64), bytes: 12_345 },
			},
		} as never);

		expect(dto.snapshot?.visualEvidence).toBeNull();
	});

	it("pins the prompt-runs handler to an explicit safe projection", () => {
		const source = readFileSync(new URL("./prompts.ts", import.meta.url), "utf8");
		const handler = source.slice(
			source.indexOf("export const getPromptRunsFn"),
			source.indexOf("export const updatePromptsFn"),
		);

		expect(handler).toContain("answerText: promptRuns.answerText");
		expect(handler).toContain("responseSnapshots.isCurrent");
		expect(handler).toContain("status: responseSnapshots.status");
		expect(handler).toContain("runs.map(toCustomerPromptRunDto)");
		expect(handler).toContain("evidenceArtifacts.observationAttemptId");
		expect(handler).toContain("evidenceArtifacts.brandId");
		expect(handler).toContain("evidenceArtifacts.scopeId");
		expect(handler).toContain("evidenceArtifacts.status} = 'attached'");
		expect(handler).toContain("evidenceArtifacts.mediaType} = 'image/jpeg'");
		expect(handler).toContain("responseSnapshots.schemaVersion} = 'response-snapshot.v2'");
		expect(handler).toContain("responseSnapshots.expiresAt} > now()");
		expect(handler).not.toContain("promptRuns.rawOutput");
		expect(handler).not.toContain("promptRuns.provider");
		expect(handler).not.toContain("promptRuns.captureRouteKey");
		expect(handler).not.toContain("observationAttemptId: promptRuns.observationAttemptId");
		expect(handler).not.toContain("responseSnapshots.storageBackend");
		expect(handler).not.toContain("responseSnapshots.storageKey");
	});
});
