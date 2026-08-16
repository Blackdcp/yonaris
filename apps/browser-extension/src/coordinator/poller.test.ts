import { describe, expect, test } from "vitest";
import { pollStartedWork } from "./poller";
import { claimedTask } from "./test-fixture";

describe("pollStartedWork", () => {
	test("keeps DeepSeek running when Doubao is rate-limited", async () => {
		const completed: string[] = [];
		const claims = {
			"doubao.consumer_web": [claimedTask({ taskId: "doubao-1", surfaceTargetKey: "doubao.consumer_web" })],
			"deepseek.consumer_web": [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })],
		};
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => claims[surface].shift() ?? null,
			run: async (claim) => {
				if (claim.surfaceTargetKey === "doubao.consumer_web") {
					return { status: "needs_human" as const, code: "rate_limited" };
				}
				completed.push(claim.taskId);
				return { status: "succeeded" as const };
			},
			now: () => 1_000,
		});

		expect(completed).toEqual(["deepseek-1"]);
		expect(result.bySurface["doubao.consumer_web"].needsHuman).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
	});

	test("isolates a thrown task and continues the rest of the claimed round", async () => {
		const queue = [claimedTask({ taskId: "task-1" }), claimedTask({ taskId: "task-2" })];
		const completed: string[] = [];
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["deepseek.consumer_web"],
			claim: async () => queue.shift() ?? null,
			run: async (claim) => {
				if (claim.taskId === "task-1") throw new Error("unexpected local error");
				completed.push(claim.taskId);
				return { status: "succeeded" as const };
			},
		});
		expect(completed).toEqual(["task-2"]);
		expect(result.bySurface["deepseek.consumer_web"]).toMatchObject({ succeeded: 1, incomplete: 1 });
	});

	test("isolates a channel claim failure from the other channel", async () => {
		const deepseek = [claimedTask({ taskId: "deepseek-1", surfaceTargetKey: "deepseek.consumer_web" })];
		const result = await pollStartedWork({
			brandIds: ["stepfun"],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			claim: async (_brandId, surface) => {
				if (surface === "doubao.consumer_web") throw new Error("Portal timeout");
				return deepseek.shift() ?? null;
			},
			run: async () => ({ status: "succeeded" as const }),
		});
		expect(result.bySurface["doubao.consumer_web"].incomplete).toBe(1);
		expect(result.bySurface["deepseek.consumer_web"].succeeded).toBe(1);
	});
});
