import { summarizeDeliveryCoverage } from "@workspace/lib/delivery-manifest";
import { describe, expect, it } from "vitest";
import { calculateVisibilityPercentages } from "@/lib/chart-utils";

describe("Browser extension Elmo metric regression", () => {
	it("keeps a technical failure in delivery coverage but out of the successful visibility denominator", () => {
		const coverage = summarizeDeliveryCoverage([
			{ status: "succeeded", evaluationRole: "scored" },
			{ status: "succeeded", evaluationRole: "scored" },
			{ status: "failed", evaluationRole: "scored" },
		]);
		const chart = calculateVisibilityPercentages(
			[
				{ createdAt: new Date("2026-08-17T01:00:00.000Z"), brandMentioned: true, competitorsMentioned: [] },
				{ createdAt: new Date("2026-08-17T02:00:00.000Z"), brandMentioned: false, competitorsMentioned: [] },
			],
			{ id: "stepfun" } as never,
			[],
			"all",
			"Asia/Shanghai",
		);

		expect(coverage.overall).toMatchObject({ total: 3, succeeded: 2, failed: 1, successCoverage: 2 / 3 });
		expect(chart).toEqual([{ date: "2026-08-17", stepfun: 50 }]);
	});
});
