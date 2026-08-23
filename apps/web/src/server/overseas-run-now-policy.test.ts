import { describe, expect, it } from "vitest";
import {
	assertOverseasRunNowChannelsAvailable,
	assertOverseasRunNowChannelsReady,
	assertOverseasRunNowProvidersConfigured,
	getOverseasRunNowReadiness,
	OVERSEAS_RUN_NOW_CHANNELS,
	OVERSEAS_RUN_NOW_SAMPLES,
	planOverseasRunNow,
} from "./overseas-run-now-policy";

const ppioPrompts = Array.from({ length: 10 }, (_, index) => ({
	id: `ppio-prompt-${String(index + 1).padStart(2, "0")}`,
	value: `PPIO overseas prompt ${index + 1}`,
}));

describe("Overseas Run now planning", () => {
	it("registers the exact six supported channels in product order", () => {
		expect(OVERSEAS_RUN_NOW_CHANNELS.map(({ key }) => key)).toEqual([
			"chatgpt",
			"perplexity",
			"gemini",
			"copilot",
			"google-ai-mode",
			"google-ai-overview",
		]);
		expect(Object.fromEntries(OVERSEAS_RUN_NOW_CHANNELS.map(({ key, config }) => [key, config.provider]))).toEqual({
			chatgpt: "brightdata",
			perplexity: "dataforseo",
			gemini: "dataforseo",
			copilot: "brightdata",
			"google-ai-mode": "brightdata",
			"google-ai-overview": "brightdata",
		});
	});

	it("checks every selected provider before creating paid calls", () => {
		const plan = planOverseasRunNow({
			prompts: ppioPrompts.slice(0, 1),
			channelKeys: ["chatgpt", "gemini", "perplexity"],
			scope: { market: "US", locale: "en-US", timezone: "UTC" },
		});
		const checked: string[] = [];

		expect(() =>
			assertOverseasRunNowProvidersConfigured(plan.channels, (provider) => {
				checked.push(provider);
				return provider === "brightdata";
			}),
		).toThrow(/DataForSEO is not configured/);
		expect(checked).toEqual(["brightdata", "dataforseo"]);
	});

	it("only makes Google AI Overview selectable when an explicit SERP zone is configured", () => {
		expect(getOverseasRunNowReadiness({})).toEqual({ googleAiOverviewReady: false });
		expect(getOverseasRunNowReadiness({ BRIGHTDATA_SERP_ZONE: "  ppio_serp  " })).toEqual({
			googleAiOverviewReady: true,
		});
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

	it("rejects an unavailable channel before a cohort can dispatch paid calls", () => {
		const plan = planOverseasRunNow({
			prompts: ppioPrompts.slice(0, 1),
			channelKeys: ["google-ai-overview"],
			scope: { market: "US", locale: "en-US", timezone: "UTC" },
		});

		expect(() =>
			assertOverseasRunNowChannelsAvailable(plan.channels, (config) =>
				config.model === "google-ai-overview"
					? "Google AI Overview is unavailable: configure BRIGHTDATA_SERP_ZONE"
					: null,
			),
		).toThrow(/BRIGHTDATA_SERP_ZONE/);
	});

	it("blocks a configured-but-missing Google AI Overview zone before paid cohort dispatch", async () => {
		const plan = planOverseasRunNow({
			prompts: ppioPrompts.slice(0, 1),
			channelKeys: ["google-ai-overview"],
			scope: { market: "US", locale: "en-US", timezone: "UTC" },
		});
		let preflightCalls = 0;

		await expect(
			assertOverseasRunNowChannelsReady(
				plan.channels,
				() => null,
				async (config) => {
					preflightCalls += 1;
					return config.model === "google-ai-overview"
						? "Google AI Overview is unavailable: configured Bright Data SERP zone is not active"
						: null;
				},
			),
		).rejects.toThrow(/not active/);
		expect(preflightCalls).toBe(1);
	});
});
