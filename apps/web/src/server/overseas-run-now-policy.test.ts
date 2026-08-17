import { describe, expect, it } from "vitest";
import { OVERSEAS_RUN_NOW_CHANNELS, OVERSEAS_RUN_NOW_SAMPLES, planOverseasRunNow } from "./overseas-run-now-policy";

const ppioPrompts = Array.from({ length: 10 }, (_, index) => ({
	id: `ppio-prompt-${String(index + 1).padStart(2, "0")}`,
	value: `PPIO overseas prompt ${index + 1}`,
}));

describe("Overseas Bright Data Run now planning", () => {
	it("registers the exact six supported channels in product order", () => {
		expect(OVERSEAS_RUN_NOW_CHANNELS.map(({ key }) => key)).toEqual([
			"chatgpt",
			"perplexity",
			"gemini",
			"copilot",
			"google-ai-mode",
			"google-ai-overview",
		]);
		expect(OVERSEAS_RUN_NOW_CHANNELS.every(({ config }) => config.provider === "brightdata")).toBe(true);
	});

	it("plans 300 unique calls for PPIO's 10 prompts, all channels, and five samples", () => {
		const plan = planOverseasRunNow({
			prompts: ppioPrompts,
			channelKeys: OVERSEAS_RUN_NOW_CHANNELS.map(({ key }) => key),
			scope: { market: "US", locale: "en-US", timezone: "America/Los_Angeles" },
		});

		expect(plan.samplesPerChannel).toBe(OVERSEAS_RUN_NOW_SAMPLES);
		expect(plan.callCount).toBe(300);
		expect(plan.calls).toHaveLength(300);
		expect(new Set(plan.calls.map(({ identity }) => identity)).size).toBe(300);
		expect(new Set(plan.calls.map(({ sampleIndex }) => sampleIndex))).toEqual(new Set([1, 2, 3, 4, 5]));
		expect(plan.channels.map(({ key }) => key)).toEqual(OVERSEAS_RUN_NOW_CHANNELS.map(({ key }) => key));
		expect(plan.manifestFingerprint).toMatch(/^[a-f0-9]{64}$/);
	});

	it("rejects China Programs and duplicate or unknown channels", () => {
		const base = {
			prompts: ppioPrompts.slice(0, 1),
			scope: { market: "US", locale: "en-US", timezone: "UTC" },
		};
		expect(() =>
			planOverseasRunNow({
				...base,
				scope: { market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" },
				channelKeys: ["chatgpt"],
			}),
		).toThrow(/non-China/i);
		expect(() => planOverseasRunNow({ ...base, channelKeys: ["chatgpt", "chatgpt"] })).toThrow(/duplicate/i);
		expect(() => planOverseasRunNow({ ...base, channelKeys: ["claude" as never] })).toThrow(/unsupported/i);
	});

	it("is deterministic and rejects plans above 10,000 paid calls", () => {
		const input = {
			prompts: ppioPrompts,
			channelKeys: ["chatgpt", "perplexity"] as const,
			scope: { market: "US", locale: "en-US", timezone: "UTC" },
		};
		expect(planOverseasRunNow(input).manifestFingerprint).toBe(planOverseasRunNow(input).manifestFingerprint);

		const tooManyPrompts = Array.from({ length: 2_001 }, (_, index) => ({
			id: `prompt-${index}`,
			value: `Prompt ${index}`,
		}));
		expect(() => planOverseasRunNow({ ...input, prompts: tooManyPrompts, channelKeys: ["chatgpt"] })).toThrow(
			/10,000/i,
		);
	});
});
