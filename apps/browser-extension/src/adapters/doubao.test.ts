import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import doubaoContract from "../selector-contracts/doubao-web-v1.json";
import { sanitizeAnswerHtml } from "./dom-port";
import { createDoubaoAdapter } from "./doubao";
import { type AdapterFixture, createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Doubao browser-extension adapter", () => {
	test("selects the assistant message without selecting the user message", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="my-0 w-full mx-auto"><div data-message-id="user-1" class="flex-row flex w-full justify-end">Prompt</div></div>
			<div class="my-0 w-full mx-auto"><div data-message-id="assistant-1" class="relative grid w-full">Answer</div></div>
		</body></html>`);

		const matches = document.querySelectorAll(doubaoContract.answer);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.getAttribute("data-message-id")).toBe("assistant-1");
	});

	test("binds the read-aloud completion and copy companion to the adjacent answer action group", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="user-1" class="flex-row flex w-full justify-end">Prompt</div>
			<div data-message-id="assistant-1" class="relative grid w-full">Answer</div>
			<div class="answer-actions"><button aria-label="朗读"></button><button aria-label="复制"></button></div>
		</body></html>`);

		const answer = document.querySelector(doubaoContract.answer);
		const actionGroup = answer?.nextElementSibling;
		expect(actionGroup?.querySelectorAll(doubaoContract.completion)).toHaveLength(1);
		expect(actionGroup?.querySelectorAll(doubaoContract.completionCompanion)).toHaveLength(1);
	});

	test("uses the exact New conversation action instead of New work task", async () => {
		const port = new FixtureDomPort(doubaoFixture({ newConversationLabels: ["新工作任务", "新对话"] }));
		const adapter = createDoubaoAdapter(port);

		await adapter.openNewConversation();

		expect(port.clickedText).toBe("新对话");
	});

	test("waits until New conversation is actually blank", async () => {
		const port = new FixtureDomPort(doubaoFixture({ blankConversationDelayMs: 1_500 }));
		const adapter = createDoubaoAdapter(port);

		await expect(adapter.openNewConversation()).resolves.toBeUndefined();
		expect(port.elapsedMs).toBeGreaterThanOrEqual(1_500);
	});

	test("fails closed when the New conversation action is ambiguous", async () => {
		const adapter = createDoubaoAdapter(
			new FixtureDomPort(doubaoFixture({ newConversationLabels: ["新对话", "新对话"] })),
		);
		await expect(adapter.openNewConversation()).rejects.toMatchObject({
			code: "page_drift",
			stage: "pre_submit",
		});
	});

	test("never submits the same prompt twice in one adapter session", async () => {
		const port = new FixtureDomPort(doubaoFixture());
		const adapter = createDoubaoAdapter(port);
		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");
		await adapter.submitOnce("Prompt A");

		await expect(adapter.submitOnce("Prompt A")).rejects.toMatchObject({
			code: "post_submit_unknown",
			stage: "post_submit",
		});
		expect(port.submitCount).toBe(1);
	});

	test("supports a send action that appears only after the prompt is filled", async () => {
		const port = new FixtureDomPort(doubaoFixture({ sendMatchesBeforeFill: 0, sendMatches: 1 }));
		const adapter = createDoubaoAdapter(port);

		await adapter.openNewConversation();
		await adapter.prepare("Prompt A");
		await adapter.submitOnce("Prompt A");

		expect(port.submitCount).toBe(1);
	});

	test("requires exactly one new answer container", async () => {
		const port = new FixtureDomPort(doubaoFixture({ newAnswerCount: 2 }));
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");
		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({ code: "page_drift" });
	});

	test("waits through transient duplicate answer containers before capturing one answer", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				newAnswerCountTimeline: [2, 2, 1],
				answer: { text: "Current answer", html: "<div>Current answer</div>" },
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
		});
		expect(port.elapsedMs).toBeGreaterThanOrEqual(8_000);
	});

	test("captures a stable new answer when generation finishes before collection starts", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				generatingDurationMs: 0,
				completionReadyDelayMs: 0,
				answer: { text: "Fast answer", html: "<div>Fast answer</div>" },
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Fast answer",
		});
		expect(port.elapsedMs).toBeGreaterThanOrEqual(8_000);
	});

	test("does not accept an unrelated footer completion as the current answer completion", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				generatingDurationMs: 0,
				completionReadyDelayMs: 0,
				completionState: "unbound",
				answer: { text: "Stable partial answer", html: "<div>Stable partial answer</div>" },
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({ code: "page_drift" });
	});

	test("does not capture a paused partial answer without an explicit completion signal", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				generatingDurationMs: 0,
				completionReadyDelayMs: 10_000,
				answer: { text: "Complete answer", html: "<div>Complete answer</div>" },
				answerTimeline: [
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Partial answer",
					"Complete answer",
				],
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Complete answer" });
		expect(port.elapsedMs).toBeGreaterThanOrEqual(18_000);
	});

	test("does not treat a brief generation indicator as the explicit completion signal", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				generatingDurationMs: 250,
				completionReadyDelayMs: 20_000,
				answer: { text: "Complete answer", html: "<div>Complete answer</div>" },
				answerTimeline: [...Array.from({ length: 20 }, () => "Partial answer"), "Complete answer"],
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Complete answer" });
		expect(port.elapsedMs).toBeGreaterThanOrEqual(28_000);
	});

	test("records unknown search instead of inventing false", async () => {
		const port = new FixtureDomPort(doubaoFixture({ searchUsedCount: 0, searchNotUsedCount: 0 }));
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");
		expect((await adapter.collectCurrentAnswer()).webSearchObserved).toBeNull();
	});

	test("keeps an exact Prompt echo as query-exposure evidence for server-side fan-out classification", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				searchUsedCount: 1,
				answer: {
					text: "Current answer",
					html: "<div>Current answer</div>",
					queries: ["Prompt A", "AI inference pricing", "AI inference pricing"],
				},
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			webSearchObserved: true,
			webQueries: ["Prompt A", "AI inference pricing"],
		});
	});

	test("normalizes a long citation title to the Portal contract without splitting a surrogate pair", async () => {
		const title = `${"a".repeat(999)}😀tail`;
		const port = new FixtureDomPort(
			doubaoFixture({
				searchUsedCount: 1,
				answer: {
					text: "Current answer",
					html: "<div>Current answer</div>",
					queries: ["different query"],
					citations: [{ url: "https://source.example/report", title }],
				},
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		const answer = await adapter.collectCurrentAnswer();
		expect(answer.citations[0]?.title).toHaveLength(999);
		expect(answer.citations[0]?.title).toBe("a".repeat(999));
	});

	test("classifies invalid collected evidence as post-submit page drift", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				searchUsedCount: 1,
				answer: {
					text: "Current answer",
					html: "<div>Current answer</div>",
					queries: ["valid query"],
					citations: [{ url: "https://user:secret@source.example/report", title: "Unsafe" }],
				},
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({
			code: "page_drift",
			stage: "post_submit",
		});
	});

	test("waits for the durable conversation URL instead of failing immediately after submit", async () => {
		const port = new FixtureDomPort(doubaoFixture({ conversationUrlDelayMs: 1_000 }));
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
			pageUrl: "https://www.doubao.com/chat/123456",
		});
	});

	test("refuses to collect an answer after the tab navigates to another conversation", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				conversationUrlTimeline: ["https://www.doubao.com/chat/123456", "https://www.doubao.com/chat/999999"],
				answer: { text: "Other conversation secret", html: "<div>Other conversation secret</div>" },
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({
			code: "page_drift",
			stage: "post_submit",
		});
	});

	test("classifies a malformed post-submit page URL as page drift", async () => {
		const port = new FixtureDomPort(
			doubaoFixture({
				conversationUrlTimeline: ["https://www.doubao.com/chat/123456", "not-a-url"],
			}),
		);
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).rejects.toMatchObject({
			code: "page_drift",
			stage: "post_submit",
		});
	});

	test("recovers an already completed answer without submitting the prompt again", async () => {
		const port = new FixtureDomPort(doubaoFixture({ initiallySubmitted: true, submittedPrompt: "Prompt A" }));
		const adapter = createDoubaoAdapter(port);

		await adapter.resumeSubmitted("Prompt A");
		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
		expect(port.submitCount).toBe(0);
	});

	test("refuses to recover a preserved conversation for a different prompt", async () => {
		const port = new FixtureDomPort(doubaoFixture({ initiallySubmitted: true, submittedPrompt: "Prompt B" }));
		const adapter = createDoubaoAdapter(port);

		await expect(adapter.resumeSubmitted("Prompt A")).rejects.toMatchObject({
			code: "post_submit_unknown",
			stage: "post_submit",
		});
		expect(port.submitCount).toBe(0);
	});

	test.each([
		["signed_out", { signedOut: true }],
		["captcha", { captcha: true }],
		["rate_limited", { rateLimited: true }],
	] as const)("classifies %s without entering a prompt", async (code, override) => {
		const adapter = createDoubaoAdapter(new FixtureDomPort(doubaoFixture(override)));
		await expect(adapter.preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
	});

	test("sanitizes the current answer container and removes active or unrelated content", () => {
		const { document } = parseHTML("<html></html>");
		const parser = parserFor(document);
		const html = sanitizeAnswerHtml(
			'<article class="answer" onclick="steal()" style="background:url(https://tracker.invalid)"><p>Current answer</p><script>alert(1)</script><form><input value="secret"></form><iframe src="https://private.invalid"></iframe><img src="https://tracker.invalid/pixel"><svg><use href="https://tracker.invalid/icon"></use></svg><a href="https://example.com/source" onmouseover="steal()">Source</a></article>',
			parser,
		);

		expect(html).toContain("Current answer");
		expect(html).toContain('href="https://example.com/source"');
		expect(html).not.toMatch(/script|form|iframe|input|onclick|onmouseover|style=|src=|<svg/i);
	});

	test("removes hidden descendants before stripping the attributes that hid them", () => {
		const { document } = parseHTML("<html></html>");
		const parser = parserFor(document);
		const html = sanitizeAnswerHtml(
			'<article><p>Visible answer</p><div hidden>hidden private text</div><div aria-hidden="true">stale answer</div><div style="opacity: 0">invisible overlay</div></article>',
			parser,
		);

		expect(html).toContain("Visible answer");
		expect(html).not.toMatch(/hidden private text|stale answer|invisible overlay/i);
	});

	test("rejects an oversized answer snapshot", () => {
		const { document } = parseHTML("<html></html>");
		const parser = parserFor(document);
		expect(() => sanitizeAnswerHtml(`<div>${"a".repeat(1_500_000)}</div>`, parser)).toThrow(/too large/i);
	});
});

function doubaoFixture(override: Partial<AdapterFixture> & { newConversationMatches?: number } = {}): AdapterFixture {
	return createAdapterFixture({
		pageUrl: "https://www.doubao.com/chat/",
		conversationUrl: "https://www.doubao.com/chat/123456",
		newConversationLabels: ["新对话"],
		...override,
	});
}

function parserFor(document: Document): (html: string) => Document {
	const defaultView = document.defaultView;
	if (!defaultView) throw new Error("Fixture document has no default view");
	return (html) => new defaultView.DOMParser().parseFromString(html, "text/html");
}
