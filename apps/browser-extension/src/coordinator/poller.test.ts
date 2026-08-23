import { describe, expect, test } from "vitest";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import { BROWSER_EXTENSION_SURFACES } from "../contracts";
import { pollStartedWork } from "./poller";
import { claimedTask } from "./test-fixture";

describe("pollStartedWork", () => {
	test("drains every started task for a ready surface after one explicit work check", async () => {
		const runTaskIds: string[] = [];
		const queue = [
			claimedTask({ taskId: "doubao-1", surfaceTargetKey: "doubao.consumer_web" }),
			claimedTask({ taskId: "doubao-2", surfaceTargetKey: "doubao.consumer_web" }),
			claimedTask({ taskId: "doubao-3", surfaceTargetKey: "doubao.consumer_web" }),
		];

		const result = await pollStartedWork({
			brandIds: ["ppio"],
			surfaces: ["doubao.consumer_web"],
			claim: async () => queue.shift() ?? null,
			run: async (claim) => {
				runTaskIds.push(claim.taskId);
				return { status: "succeeded" as const };
			},
		});

		expect(runTaskIds).toEqual(["doubao-1", "doubao-2", "doubao-3"]);
		expect(result.bySurface["doubao.consumer_web"].succeeded).toBe(3);
	});

	test("runs claimed tasks sequentially across every ready surface", async () => {
		const runTaskIds: string[] = [];
		const claimSurfaces: string[] = [];
		let active = 0;
		let maximumActive = 0;
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
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				await Promise.resolve();
				runTaskIds.push(claim.taskId);
				active -= 1;
				return { status: "succeeded" as const };
			},
		});

		expect(runTaskIds).toEqual(["doubao-1", "deepseek-1"]);
		expect(claimSurfaces).toEqual([
			"doubao.consumer_web",
			"doubao.consumer_web",
			"deepseek.consumer_web",
			"deepseek.consumer_web",
		]);
		expect(maximumActive).toBe(1);
		expect(result.bySurface["doubao.consumer_web"].succeeded).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
	});

	test.each([
		{ status: "needs_human" as const, code: "rate_limited", summaryKey: "needsHuman" as const },
		{ status: "retry_scheduled" as const, code: "page_load_timeout", summaryKey: "retryScheduled" as const },
		{ status: "incomplete" as const, code: "coordinator_unhandled", summaryKey: "incomplete" as const },
	])("continues to the next surface after a $status result", async ({ status, code, summaryKey }) => {
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
			run: async (claim) =>
				claim.surfaceTargetKey === "doubao.consumer_web" ? { status, code } : { status: "succeeded" as const },
			now: () => 1_000,
		});

		expect(claimSurfaces).toEqual(["doubao.consumer_web", "deepseek.consumer_web", "deepseek.consumer_web"]);
		expect(result.bySurface["doubao.consumer_web"][summaryKey]).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
		expect(queues["deepseek.consumer_web"]).toHaveLength(0);
	});

	test("continues the global poll when claiming one surface fails", async () => {
		const claimSurfaces: string[] = [];
		const deepseek = [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })];
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				claimSurfaces.push(surface);
				if (surface === "doubao.consumer_web") throw new Error("Portal timeout");
				return deepseek.shift() ?? null;
			},
			run: async () => ({ status: "succeeded" as const }),
		});

		expect(claimSurfaces).toEqual(["doubao.consumer_web", "deepseek.consumer_web", "deepseek.consumer_web"]);
		expect(result.bySurface["doubao.consumer_web"].incomplete).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
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

		expect(claimSurfaces).toEqual(["doubao.consumer_web", "deepseek.consumer_web", "deepseek.consumer_web"]);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
	});

	test("visits all seven surfaces in registry order and isolates a Kimi retry", async () => {
		const attemptedSurfaces: BrowserExtensionSurface[] = [];
		let active = 0;
		let maximumActive = 0;
		const queues = Object.fromEntries(
			BROWSER_EXTENSION_SURFACES.map((surface, index) => [
				surface,
				[claimedTask({ taskId: `task-${index}`, surfaceTargetKey: surface })],
			]),
		) as Record<BrowserExtensionSurface, BrowserExtensionClaim[]>;

		const summary = await pollStartedWork({
			brandIds: ["ppio"],
			surfaces: BROWSER_EXTENSION_SURFACES,
			claim: async (_brandId, surface) => queues[surface].shift() ?? null,
			run: async (claim) => {
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				attemptedSurfaces.push(claim.surfaceTargetKey);
				await Promise.resolve();
				active -= 1;
				return claim.surfaceTargetKey === "kimi.consumer_web"
					? { status: "retry_scheduled" as const, code: "page_load_timeout" }
					: { status: "succeeded" as const };
			},
		});

		expect(maximumActive).toBe(1);
		expect(attemptedSurfaces).toEqual(BROWSER_EXTENSION_SURFACES);
		expect(summary.bySurface["kimi.consumer_web"].retryScheduled).toBe(1);
		expect(summary.bySurface["wenxin.consumer_web"].succeeded).toBe(1);
	});
});
