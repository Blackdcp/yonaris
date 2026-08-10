import { describe, expect, it } from "vitest";
import { calculateObservationCoverage, summarizeObservationCoverage } from "./observation-coverage";

describe("observation coverage", () => {
	it("reports measurements without attempts as unavailable", () => {
		expect(summarizeObservationCoverage([])).toEqual({
			planned: 0,
			pending: 0,
			running: 0,
			succeeded: 0,
			failed: 0,
			cancelled: 0,
			available: false,
			coverage: null,
		});
	});

	it("uses every planned sample as the coverage denominator", () => {
		expect(
			summarizeObservationCoverage([
				{ status: "succeeded", count: 17 },
				{ status: "failed", count: 2 },
				{ status: "running", count: 1 },
			]),
		).toEqual({
			planned: 20,
			pending: 0,
			running: 1,
			succeeded: 17,
			failed: 2,
			cancelled: 0,
			available: true,
			coverage: 0.85,
		});
	});

	it("does not mix markets or AI surfaces", () => {
		const attempts = [
			{
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.consumer_web",
				status: "succeeded" as const,
			},
			{
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.consumer_web",
				status: "failed" as const,
			},
			{
				brandId: "brand-1",
				scopeId: "scope-us",
				surfaceTargetKey: "chatgpt.consumer_web",
				status: "succeeded" as const,
			},
			{
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.api",
				status: "succeeded" as const,
			},
			{
				brandId: "brand-2",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.consumer_web",
				status: "succeeded" as const,
			},
		];

		expect(
			calculateObservationCoverage(attempts, {
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.consumer_web",
			}),
		).toMatchObject({ planned: 2, succeeded: 1, failed: 1, coverage: 0.5 });
	});

	it("can aggregate all surfaces in one scope", () => {
		const attempts = [
			{
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "doubao.consumer_web",
				status: "succeeded" as const,
			},
			{
				brandId: "brand-1",
				scopeId: "scope-cn",
				surfaceTargetKey: "deepseek.consumer_web",
				status: "cancelled" as const,
			},
		];

		expect(calculateObservationCoverage(attempts, { brandId: "brand-1", scopeId: "scope-cn" })).toMatchObject({
			planned: 2,
			succeeded: 1,
			cancelled: 1,
			coverage: 0.5,
		});
	});
});
