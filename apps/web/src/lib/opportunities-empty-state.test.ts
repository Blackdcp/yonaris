import { describe, expect, it } from "vitest";
import { opportunityEmptyMessage } from "./opportunities-empty-state";

describe("opportunityEmptyMessage", () => {
	it.each([
		["not_generated", "An administrator has not generated opportunities for this program yet."],
		["insufficient-data", "We need more tracking data before opportunities can be recommended."],
		["temporarily-unavailable", "Simplified Chinese opportunities are temporarily unavailable."],
	] as const)("maps %s to distinct English customer copy", (reason, expected) => {
		expect(opportunityEmptyMessage(reason, "en")).toBe(expected);
	});

	it.each([
		["not_generated", "管理员尚未为此项目生成优化机会"],
		["insufficient-data", "需要更多追踪数据后才能推荐优化机会。"],
		["temporarily-unavailable", "简体中文优化机会暂时不可用，请稍后重试。"],
	] as const)("maps %s to distinct Chinese customer copy", (reason, expected) => {
		expect(opportunityEmptyMessage(reason, "zh-CN")).toBe(expected);
	});
});
