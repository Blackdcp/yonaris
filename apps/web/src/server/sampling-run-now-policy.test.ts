import { BROWSER_EXTENSION_SURFACES } from "@workspace/lib/browser-extension-contract";
import { describe, expect, it } from "vitest";
import { planSamplingRunNow, SAMPLING_RUN_NOW_SAMPLES } from "./sampling-run-now-policy";

describe("Sampling Run now planning", () => {
	it("plans exactly five tasks per enabled prompt and selected channel", () => {
		const plan = planSamplingRunNow({
			prompts: [
				{ id: "p1", value: "prompt one" },
				{ id: "p2", value: "prompt two" },
			],
			surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			samplesPerPrompt: 5,
			now: new Date("2026-08-16T08:00:00.000Z"),
		});

		expect(plan.samplesPerPrompt).toBe(SAMPLING_RUN_NOW_SAMPLES);
		expect(plan.taskCount).toBe(20);
		expect(
			new Set(plan.tasks.map((task) => `${task.promptId}:${task.surfaceTargetKey}:${task.sampleIndex}`)).size,
		).toBe(20);
		expect(plan.protocol).toMatchObject({
			measurementWindow: {
				startsAt: "2026-08-16T08:00:00.000Z",
				endsAt: "2026-08-17T08:00:00.000Z",
			},
			evidence: { minimumArtifacts: 1, requireSha256: true, requirePageUrl: true },
		});
		expect(plan.targets.map(({ captureRouteKey }) => captureRouteKey)).toEqual([
			"browser_extension.doubao",
			"browser_extension.deepseek",
		]);
	});

	it("plans one ordered task per Prompt across all six domestic surfaces", () => {
		const plan = planSamplingRunNow({
			prompts: [{ id: "p1", value: "prompt one" }],
			surfaces: BROWSER_EXTENSION_SURFACES,
			samplesPerPrompt: 1,
			now: new Date("2026-08-21T08:00:00.000Z"),
		});

		expect(plan.samplesPerPrompt).toBe(1);
		expect(plan.taskCount).toBe(6);
		expect(plan.tasks.map(({ surfaceTargetKey }) => surfaceTargetKey)).toEqual(BROWSER_EXTENSION_SURFACES);
		expect(plan.tasks.every(({ sampleIndex }) => sampleIndex === 1)).toBe(true);
	});

	it("plans sixty tasks for ten Prompts in the six-surface monitoring action", () => {
		const plan = planSamplingRunNow({
			prompts: Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, value: `prompt ${index}` })),
			surfaces: BROWSER_EXTENSION_SURFACES,
			samplesPerPrompt: 1,
			now: new Date("2026-08-21T08:00:00.000Z"),
		});

		expect(plan.taskCount).toBe(60);
	});

	it("rejects empty prompts, duplicate surfaces, and unsupported surfaces", () => {
		expect(() =>
			planSamplingRunNow({
				prompts: [],
				surfaces: ["doubao.consumer_web"],
				samplesPerPrompt: 5,
				now: new Date(),
			}),
		).toThrow(/enabled prompt/i);
		expect(() =>
			planSamplingRunNow({
				prompts: [{ id: "p1", value: "prompt" }],
				surfaces: ["doubao.consumer_web", "doubao.consumer_web"],
				samplesPerPrompt: 5,
				now: new Date(),
			}),
		).toThrow(/duplicate/i);
		expect(() =>
			planSamplingRunNow({
				prompts: [{ id: "p1", value: "prompt" }],
				surfaces: ["unsupported.consumer_web" as never],
				samplesPerPrompt: 5,
				now: new Date(),
			}),
		).toThrow(/unsupported/i);
	});

	it("rejects duplicate prompts and a plan above 10,000 tasks", () => {
		expect(() =>
			planSamplingRunNow({
				prompts: [
					{ id: "p1", value: "prompt" },
					{ id: "p1", value: "prompt" },
				],
				surfaces: ["doubao.consumer_web"],
				samplesPerPrompt: 5,
				now: new Date(),
			}),
		).toThrow(/duplicate prompt/i);
		const prompts = Array.from({ length: 1_001 }, (_, index) => ({ id: `p${index}`, value: `prompt ${index}` }));
		expect(() =>
			planSamplingRunNow({
				prompts,
				surfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
				samplesPerPrompt: 5,
				now: new Date(),
			}),
		).toThrow(/10,000/i);
	});

	it("builds a deterministic manifest fingerprint for an idempotent retry", () => {
		const input = {
			prompts: [{ id: "p1", value: "prompt" }],
			surfaces: ["deepseek.consumer_web" as const],
			samplesPerPrompt: 5 as const,
			now: new Date("2026-08-16T08:00:00.000Z"),
		};
		expect(planSamplingRunNow(input).manifestFingerprint).toBe(planSamplingRunNow(input).manifestFingerprint);
		expect(planSamplingRunNow(input).protocol.notes).toMatch(/^run-now:v1:[a-f0-9]{64}$/);
	});
});
