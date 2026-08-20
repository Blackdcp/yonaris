import { describe, expect, test } from "vitest";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import { pollStartedWork } from "./poller";
import { claimedTask } from "./test-fixture";

describe("pollStartedWork", () => {
	test("runs at most one claimed task globally across all surfaces", async () => {
		const runTaskIds: string[] = [];
		const claimSurfaces: string[] = [];
		const queues: Partial<Record<BrowserExtensionSurface, BrowserExtensionClaim[]>> = {
			"doubao.consumer_web": [claimedTask({ taskId: "doubao-1", surfaceTargetKey: "doubao.consumer_web" })],
			"deepseek.consumer_web": [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })],
		};

		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				claimSurfaces.push(surface);
				return queues[surface]?.shift() ?? null;
			},
			run: async (claim) => {
				runTaskIds.push(claim.taskId);
				return { status: "succeeded" as const };
			},
		});

		expect(runTaskIds).toEqual(["doubao-1"]);
		expect(claimSurfaces).toEqual(["doubao.consumer_web"]);
		expect(result.bySurface["doubao.consumer_web"].succeeded).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(0);
	});

	test.each([
		{ status: "needs_human" as const, code: "rate_limited", summaryKey: "needsHuman" as const },
		{ status: "retry_scheduled" as const, code: "page_load_timeout", summaryKey: "retryScheduled" as const },
		{ status: "incomplete" as const, code: "coordinator_unhandled", summaryKey: "incomplete" as const },
	])("stops claiming after the first $status result", async ({ status, code, summaryKey }) => {
		const claimSurfaces: string[] = [];
		const queues: Partial<Record<BrowserExtensionSurface, BrowserExtensionClaim[]>> = {
			"doubao.consumer_web": [claimedTask({ taskId: "doubao-1", surfaceTargetKey: "doubao.consumer_web" })],
			"deepseek.consumer_web": [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })],
		};

		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				claimSurfaces.push(surface);
				return queues[surface]?.shift() ?? null;
			},
			run: async () => ({ status, code }),
			now: () => 1_000,
		});

		expect(claimSurfaces).toEqual(["doubao.consumer_web"]);
		expect(result.bySurface["doubao.consumer_web"][summaryKey]).toBe(1);
		expect(queues["deepseek.consumer_web"]).toHaveLength(1);
	});

	test("stops the global poll when claiming one surface fails", async () => {
		const claimSurfaces: string[] = [];
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				claimSurfaces.push(surface);
				if (surface === "doubao.consumer_web") throw new Error("Portal timeout");
				return claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" });
			},
			run: async () => ({ status: "succeeded" as const }),
		});

		expect(claimSurfaces).toEqual(["doubao.consumer_web"]);
		expect(result.bySurface["doubao.consumer_web"].incomplete).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(0);
	});

	test("checks the next surface when the preceding surface has no work", async () => {
		const claimSurfaces: string[] = [];
		const deepseek = [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })];
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				claimSurfaces.push(surface);
				return surface === "deepseek.consumer_web" ? (deepseek.shift() ?? null) : null;
			},
			run: async () => ({ status: "succeeded" as const }),
		});

		expect(claimSurfaces).toEqual(["doubao.consumer_web", "deepseek.consumer_web"]);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
	});
});
