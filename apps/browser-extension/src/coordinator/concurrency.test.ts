import { describe, expect, test } from "vitest";
import { AdaptiveSurfacePool, orderClaimsFairly } from "./concurrency";
import { claimedTask } from "./test-fixture";

describe("AdaptiveSurfacePool", () => {
	test("defaults to one task because the local browser runner is globally sequential", () => {
		const pool = new AdaptiveSurfacePool();
		expect(pool.current).toBe(1);
		for (let index = 0; index < 50; index += 1) pool.recordStableSuccess();
		expect(pool.current).toBe(1);
	});

	test("starts at five and stays within one through ten", () => {
		const pool = new AdaptiveSurfacePool({ initial: 5, minimum: 1, maximum: 10, successWindow: 2 });
		expect(pool.current).toBe(5);
		for (let index = 0; index < 20; index += 1) pool.recordStableSuccess();
		expect(pool.current).toBe(10);
		pool.recordRateLimit(1_000);
		expect(pool.current).toBeLessThan(10);
		expect(pool.current).toBeGreaterThanOrEqual(1);
		expect(pool.canStart(1_000)).toBe(false);
	});

	test("orders a sample round by rotating prompt IDs instead of bursting one prompt", () => {
		const ordered = orderClaimsFairly([
			claimedTask({ promptId: "p2", sampleIndex: 1 }),
			claimedTask({ promptId: "p1", sampleIndex: 2 }),
			claimedTask({ promptId: "p1", sampleIndex: 1 }),
			claimedTask({ promptId: "p2", sampleIndex: 2 }),
		]);
		expect(ordered.map(({ promptId, sampleIndex }) => `${sampleIndex}:${promptId}`)).toEqual([
			"1:p1",
			"1:p2",
			"2:p1",
			"2:p2",
		]);
	});
});
