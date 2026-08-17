import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { sanitizeAnswerHtml } from "./dom-port";
import { createDoubaoAdapter } from "./doubao";
import { type AdapterFixture, createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Doubao browser-extension adapter", () => {
	test("uses the exact New conversation action instead of New work task", async () => {
		const port = new FixtureDomPort(doubaoFixture({ newConversationLabels: ["新工作任务", "新对话"] }));
		const adapter = createDoubaoAdapter(port);

		await adapter.openNewConversation();

		expect(port.clickedText).toBe("新对话");
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

	test("records unknown search instead of inventing false", async () => {
		const port = new FixtureDomPort(doubaoFixture({ searchUsedCount: 0, searchNotUsedCount: 0 }));
		const adapter = createDoubaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");
		expect((await adapter.collectCurrentAnswer()).webSearchObserved).toBeNull();
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
