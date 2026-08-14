import { describe, expect, it, vi } from "vitest";
import {
	assertBrowserRunnerEvidenceSelection,
	browserRunnerGlobalQueueState,
	browserRunnerObservationSchema,
	browserRunnerSessionLeaseSchema,
	claimRunnerTask,
} from "./browser-runner-service";
import { BrowserRunnerSnapshotCapacityError } from "./browser-runner-snapshot-policy";

const guid1 = "11111111-1111-4111-8111-111111111111";
const guid2 = "22222222-2222-4222-8222-222222222222";

function observationInput() {
	return {
		brandId: "stepfun",
		leaseToken: "lease-token-that-is-at-least-thirty-two-characters",
		leaseGeneration: 1,
		runnerSessionId: "cn-runner-session-1",
		adapterVersion: "doubao-v1",
		browserVersion: "Chromium 140",
		observation: {
			answerText: "阶跃星辰是一家人工智能公司。",
			answerHtml: '<section data-testid="answer">阶跃星辰是一家人工智能公司。</section>',
			observedAt: "2026-08-12T12:00:00.000+08:00",
			pageUrl: "https://www.doubao.com/chat/abc",
			sessionMode: "anonymous_clean" as const,
			searchMode: "off" as const,
			evidenceArtifactIds: [guid1, guid2],
			citations: [],
			webQueries: [],
		},
	};
}

describe("Browser Runner service contracts", () => {
	it("checks snapshot capacity before allocating a task lease", async () => {
		const claim = vi.fn();
		await expect(
			claimRunnerTask(
				{ brandId: "stepfun", surfaceTargetKeys: ["doubao.consumer_web"] },
				{ id: "runner-cn-1", market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" },
				{
					assertCapacity: async () => {
						throw new BrowserRunnerSnapshotCapacityError("full");
					},
					claim,
				},
			),
		).rejects.toMatchObject({ status: 503 });
		expect(claim).not.toHaveBeenCalled();
	});

	it("distinguishes pending work, a drained human queue, and a fully idle global poll", () => {
		expect(browserRunnerGlobalQueueState(true, false)).toBe("waiting");
		expect(browserRunnerGlobalQueueState(false, true)).toBe("drained");
		expect(browserRunnerGlobalQueueState(false, false)).toBe("settled");
	});

	it("requires a durable runner session on intent, confirmation, and completion payloads", () => {
		const complete = observationInput();
		const {
			observation: _observation,
			adapterVersion: _adapterVersion,
			browserVersion: _browserVersion,
			...lease
		} = complete;
		expect(browserRunnerSessionLeaseSchema.safeParse(lease).success).toBe(true);
		expect(browserRunnerSessionLeaseSchema.safeParse({ ...lease, runnerSessionId: "" }).success).toBe(false);
		expect(browserRunnerObservationSchema.safeParse(complete).success).toBe(true);
		expect(browserRunnerObservationSchema.safeParse({ ...complete, runnerSessionId: undefined }).success).toBe(false);
	});

	it("rejects operator attestation in machine-authored observations", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: { ...input.observation, operatorAttested: true },
			}).success,
		).toBe(false);
	});

	it("requires bounded answer-container HTML for every machine-authored completion", () => {
		const input = observationInput();
		const { answerHtml: _answerHtml, ...withoutAnswerHtml } = input.observation;
		expect(browserRunnerObservationSchema.safeParse({ ...input, observation: withoutAnswerHtml }).success).toBe(false);
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: { ...input.observation, answerHtml: "中".repeat(2 * 1024 * 1024) },
			}).success,
		).toBe(false);
	});

	it("accepts native-auto search with an explicitly unknown observation", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: {
					...input.observation,
					searchMode: "native_auto",
					webSearchObserved: null,
				},
			}).success,
		).toBe(true);
	});

	it("accepts the honest dedicated sampling profile session mode", () => {
		const input = observationInput();
		expect(
			browserRunnerObservationSchema.safeParse({
				...input,
				observation: {
					...input.observation,
					sessionMode: "dedicated_sampling_profile",
					searchMode: "native_auto",
					webSearchObserved: null,
				},
			}).success,
		).toBe(true);
	});

	it("accepts exactly one staged screenshot and one staged page snapshot", () => {
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				[
					{ id: guid1, kind: "screenshot" },
					{ id: guid2, kind: "page_snapshot" },
				],
				[guid1, guid2],
			),
		).not.toThrow();
		for (const artifacts of [
			[
				{ id: guid1, kind: "screenshot" as const },
				{ id: guid2, kind: "screenshot" as const },
			],
			[{ id: guid1, kind: "screenshot" as const }],
		]) {
			expect(() => assertBrowserRunnerEvidenceSelection(artifacts, [guid1, guid2])).toThrow(/exactly one staged/);
		}
		expect(() =>
			assertBrowserRunnerEvidenceSelection(
				[
					{ id: guid1, kind: "screenshot" },
					{ id: guid2, kind: "page_snapshot" },
					{ id: "33333333-3333-4333-8333-333333333333", kind: "screenshot" },
				],
				[guid1, guid2, "33333333-3333-4333-8333-333333333333"],
			),
		).toThrow(/exactly one staged/);
	});
});
