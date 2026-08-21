import { describe, expect, test } from "vitest";
import { createDeepSeekAdapter, deepSeekSelectorContract } from "./deepseek";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("DeepSeek browser-extension adapter", () => {
	test("uses the structured DeepSeek v2 contract", () => {
		expect(deepSeekSelectorContract.version).toBe("deepseek-web-20260821-localpc-v6");
	});
	test("waits for the page composer to become ready before declaring page drift", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ composerReadyDelayMs: 1_000 }));
		const adapter = createDeepSeekAdapter(port);

		await expect(adapter.preflight()).resolves.toBeUndefined();
		expect(port.elapsedMs).toBeGreaterThanOrEqual(1_000);
	});

	test("classifies an explicit account restriction before entering a prompt", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ accountRestricted: true }));
		const adapter = createDeepSeekAdapter(port);

		await expect(adapter.preflight()).rejects.toMatchObject({
			code: "account_restricted",
			stage: "pre_submit",
		});
		expect(port.submitCount).toBe(0);
	});

	test("waits through a transient composer rerender before filling the prompt", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ composerMatchTimeline: [1, 1, 0, 1] }));
		const adapter = createDeepSeekAdapter(port);
		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");

		await expect(adapter.submitOnce("Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("extracts only the answer created by this task", async () => {
		const fixture = createAdapterFixture({
			priorAnswers: [{ text: "Old answer", html: "<div>Old answer</div>" }],
			answer: { text: "Current answer", html: "<div>Current answer</div>" },
		});
		const adapter = createDeepSeekAdapter(new FixtureDomPort(fixture));

		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");
		await adapter.submitOnce("Prompt A");
		await adapter.confirmSubmitted("Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
		});
	});

	test("requires one visible composer, send action, and new-conversation action", async () => {
		for (const override of [{ composerMatches: 2 }, { sendMatches: 0 }, { newConversationMatches: 2 }]) {
			const adapter = createDeepSeekAdapter(new FixtureDomPort(createAdapterFixture(override)));
			await expect(adapter.preflight()).rejects.toMatchObject({ code: "page_drift", stage: "pre_submit" });
		}
	});

	test("reports only safe selector counts when page readiness times out", async () => {
		const adapter = createDeepSeekAdapter(new FixtureDomPort(createAdapterFixture({ composerMatches: 2 })));
		await expect(adapter.preflight()).rejects.toMatchObject({
			code: "page_drift",
			message: "Consumer page controls did not become uniquely ready (composer=2, send=1, newConversation=1)",
		});
	});

	test.each([
		["signed_out", { signedOut: true }],
		["captcha", { captcha: true }],
		["rate_limited", { rateLimited: true }],
	] as const)("classifies %s before entering a prompt", async (code, override) => {
		const adapter = createDeepSeekAdapter(new FixtureDomPort(createAdapterFixture(override)));
		await expect(adapter.preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
	});

	test("requires the exact frozen prompt to appear as the latest user message", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ submittedPrompt: "Different prompt" }));
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");
		await adapter.submitOnce("Prompt A");

		await expect(adapter.confirmSubmitted("Prompt A")).rejects.toMatchObject({
			code: "post_submit_unknown",
			stage: "post_submit",
		});
	});

	test("waits for the approved generation marker to disappear and eight stable seconds", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({ answerTimeline: ["短答", "较长的流式回答", "较长的流式回答"] }),
		);
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");
		await adapter.submitOnce("Prompt A");
		await adapter.confirmSubmitted("Prompt A");
		const answer = await adapter.collectCurrentAnswer();

		expect(answer.answerText).toBe("较长的流式回答");
		expect(port.elapsedMs).toBeGreaterThanOrEqual(8_000);
	});

	test("accepts an answer that is already stable when the generation marker finished before polling", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ generatingDurationMs: 0 }));
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
		expect(port.elapsedMs).toBeGreaterThanOrEqual(8_000);
	});

	test.each([
		[1, 0, true],
		[0, 1, false],
		[0, 0, null],
	] as const)("maps native-auto search markers %i/%i to %s", async (used, notUsed, expected) => {
		const port = new FixtureDomPort(createAdapterFixture({ searchUsedCount: used, searchNotUsedCount: notUsed }));
		const adapter = createDeepSeekAdapter(port, searchTestContract({ queryItem: "[data-query]" }));
		await port.completeOneTask(adapter, "Prompt A");
		expect((await adapter.collectCurrentAnswer()).webSearchObserved).toBe(expected);
	});

	test("fails closed when search evidence conflicts", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ searchUsedCount: 1, searchNotUsedCount: 1 }));
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await port.completeOneTask(adapter, "Prompt A");
		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({ code: "page_drift" });
	});

	test("preserves a short answer, zero brand mentions, citations, and visible query fan-out", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				answer: {
					text: "没有。",
					html: "<p>没有。</p>",
					citations: [
						{ url: "https://example.com/a", title: "Source A" },
						{ url: "https://example.com/a", title: "Duplicate" },
					],
					queries: ["国产大模型", " 国产大模型 ", "大模型公司"],
				},
			}),
		);
		const adapter = createDeepSeekAdapter(port, searchTestContract({ queryItem: "[data-query]" }));
		await port.completeOneTask(adapter, "Prompt A");

		expect(await adapter.collectCurrentAnswer()).toMatchObject({
			answerText: "没有。",
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			citations: [{ url: "https://example.com/a", title: "Source A" }],
			webQueries: ["国产大模型", "大模型公司"],
			adapterVersion: "deepseek-web-20260821-localpc-v6",
		});
	});

	test("accepts duplicate visible DOM copies of the same submitted prompt", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ submittedPromptCopies: 2 }));
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("accepts the exact submitted prompt when another visible user message is also present", async () => {
		const port = new FixtureDomPort(createAdapterFixture({ submittedPromptTexts: ["Earlier prompt", "Prompt A"] }));
		const adapter = createDeepSeekAdapter(port, searchTestContract());
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("resumes when the preserved page contains duplicate exact prompt DOM copies", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({ initiallySubmitted: true, submittedPrompt: "Prompt A", submittedPromptCopies: 2 }),
		);
		const adapter = createDeepSeekAdapter(port, searchTestContract());

		await expect(adapter.resumeSubmitted("Prompt A")).resolves.toBeUndefined();
	});

	test("resumes when the preserved page contains the exact prompt plus another visible message", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				initiallySubmitted: true,
				submittedPrompt: "Prompt A",
				submittedPromptTexts: ["Earlier prompt", "Prompt A"],
			}),
		);
		const adapter = createDeepSeekAdapter(port, searchTestContract());

		await expect(adapter.resumeSubmitted("Prompt A")).resolves.toBeUndefined();
	});
});

function searchTestContract(override: Partial<typeof deepSeekSelectorContract> = {}): typeof deepSeekSelectorContract {
	return {
		...deepSeekSelectorContract,
		searchUsed: "[data-search-used]",
		searchNotUsed: "[data-search-not-used]",
		...override,
	};
}
