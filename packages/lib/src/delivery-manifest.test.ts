import { describe, expect, it } from "vitest";
import {
	assertDeliveryBatchTransition,
	buildDeliveryManifestHash,
	buildDeliveryManifestSnapshot,
	buildDeliveryTaskSlotKey,
	normalizeDeliveryTaskPlan,
	summarizeDeliveryCoverage,
	type DeliveryManifestContext,
	type DeliveryManifestTaskSnapshot,
} from "./delivery-manifest";

const context: DeliveryManifestContext = {
	batch: {
		id: "batch-1",
		brandId: "brand-1",
		scopeId: "scope-cn",
		idempotencyKey: "customer-delivery-2026-08-10",
		name: "August customer sample",
	},
	scope: {
		id: "scope-cn",
		key: "cn-zh",
		name: "China / Chinese",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
	},
	brand: {
		id: "brand-1",
		name: "StepFun",
		website: "stepfun.com",
		additionalDomains: ["b.stepfun.com", "a.stepfun.com"],
		aliases: ["阶跃星辰", "StepFun"],
	},
	competitors: [
		{ id: "competitor-2", name: "B", domains: ["b.example"], aliases: [] },
		{ id: "competitor-1", name: "A", domains: ["a.example"], aliases: ["Alpha"] },
	],
	protocol: {
		evidence: {
			minimumArtifacts: 1,
			requireSha256: true,
			requirePageUrl: true,
			allowedUriSchemes: ["https"],
		},
	},
};

function task(overrides: Partial<DeliveryManifestTaskSnapshot> = {}): DeliveryManifestTaskSnapshot {
	const plan = normalizeDeliveryTaskPlan({
		brandId: "brand-1",
		scopeId: "scope-cn",
		promptId: "prompt-1",
		promptText: "推荐一个通用大模型",
		surfaceTargetKey: "deepseek.consumer_web",
		captureRouteKey: "manual_import.generic",
		sampleIndex: 1,
		sessionRequirement: "anonymous_clean",
		searchRequirement: "forbidden",
		...overrides,
	});
	return {
		id: overrides.id ?? "task-1",
		...plan,
		slotKey: overrides.slotKey ?? buildDeliveryTaskSlotKey(plan),
	};
}

describe("delivery manifest", () => {
	it("produces the same hash regardless of source array ordering", () => {
		const second = task({ id: "task-2", promptId: "prompt-2", sampleIndex: 2 });
		const first = task();

		const left = buildDeliveryManifestSnapshot(context, [second, first]);
		const right = buildDeliveryManifestSnapshot(
			{
				...context,
				brand: {
					...context.brand,
					additionalDomains: [...context.brand.additionalDomains].reverse(),
				},
				competitors: [...context.competitors].reverse(),
			},
			[first, second],
		);

		expect(buildDeliveryManifestHash(left)).toBe(buildDeliveryManifestHash(right));
	});

	it("changes the manifest hash when frozen evaluation context changes", () => {
		const original = buildDeliveryManifestSnapshot(context, [task()]);
		const changed = buildDeliveryManifestSnapshot(
			{ ...context, brand: { ...context.brand, aliases: [...context.brand.aliases, "跃问"] } },
			[task()],
		);

		expect(buildDeliveryManifestHash(changed)).not.toBe(buildDeliveryManifestHash(original));
	});

	it("treats evaluation role as part of a task slot", () => {
		expect(buildDeliveryTaskSlotKey(task())).not.toBe(
			buildDeliveryTaskSlotKey({ ...task(), evaluationRole: "observation" }),
		);
	});

	it("defaults new tasks to the scored evaluation pool", () => {
		expect(normalizeDeliveryTaskPlan(task()).evaluationRole).toBe("scored");
	});

	it("rejects an empty manifest and invalid sample indexes", () => {
		expect(() => buildDeliveryManifestSnapshot(context, [])).toThrow("at least one task");
		expect(() => normalizeDeliveryTaskPlan({ ...task(), sampleIndex: 0 })).toThrow("sampleIndex");
	});

	it("reports overall coverage and keeps scored and observation pools separate", () => {
		const coverage = summarizeDeliveryCoverage([
			{ status: "succeeded", evaluationRole: "scored" },
			{ status: "failed", evaluationRole: "scored" },
			{ status: "available", evaluationRole: "observation" },
			{ status: "cancelled", evaluationRole: "observation" },
		]);

		expect(coverage.overall).toMatchObject({
			total: 4,
			attempted: 2,
			resolved: 3,
			succeeded: 1,
			failed: 1,
			successCoverage: 0.25,
			completionCoverage: 0.75,
		});
		expect(coverage.byEvaluationRole.scored).toMatchObject({ total: 2, succeeded: 1, failed: 1 });
		expect(coverage.byEvaluationRole.observation).toMatchObject({ total: 2, available: 1, cancelled: 1 });
	});

	it("rejects batch transitions that would reopen a frozen or terminal manifest", () => {
		expect(() => assertDeliveryBatchTransition("draft", "frozen")).not.toThrow();
		expect(() => assertDeliveryBatchTransition("frozen", "draft")).toThrow("cannot transition");
		expect(() => assertDeliveryBatchTransition("completed", "in_progress")).toThrow("cannot transition");
	});
});
