import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import type { ConsumerDomPort, DomElementRole, DomElementSummary } from "./contracts";
import { qwenSelectorContract } from "./qwen";

const QWEN_READY_FIXTURE = `
	<button>新建对话</button>
	<div role="textbox" contenteditable="true" data-slate-editor="true"></div>
	<button aria-label="发送消息" disabled></button>
	<button aria-label="发送消息"></button>
	<div class="question-text-card">Prompt A</div>
	<div class="chat-answers-card-wrap"><div class="answer-common-card">Current answer</div></div>
`;

describe("Qwen semantic DOM contract", () => {
	test("matches one composer, send control, and labeled new-conversation action", async () => {
		const port = cssFixturePort(QWEN_READY_FIXTURE, "https://qianwen.com/");

		expect(await visibleCount(port, "composer", qwenSelectorContract.composer)).toBe(1);
		expect(await visibleCount(port, "send", qwenSelectorContract.send)).toBe(1);
		const actions = await port.query("new_conversation", qwenSelectorContract.newConversation);
		expect(
			actions.filter((item) => item.visible && item.text === qwenSelectorContract.newConversationLabel),
		).toHaveLength(1);
		expect((await port.query("user_message", qwenSelectorContract.userMessage)).map((item) => item.text)).toEqual([
			"Prompt A",
		]);
		expect((await port.query("answer", qwenSelectorContract.answer)).map((item) => item.text)).toEqual([
			"Current answer",
		]);
	});

	test("keeps provider search terms unavailable until a recorded source block proves them", () => {
		expect(qwenSelectorContract.searchUsed).toBeNull();
		expect(qwenSelectorContract.searchNotUsed).toBeNull();
		expect(qwenSelectorContract.queryItem).toBeNull();
		expect(qwenSelectorContract.searchEvidence).toBeNull();
	});

	test("does not classify generic black action buttons as a login wall", () => {
		expect(qwenSelectorContract.loginWall).not.toContain("button.bg-black-button");
		expect(qwenSelectorContract.loginWall).toContain('input[type="tel"]');
	});
});

function cssFixturePort(fragment: string, url: string): ConsumerDomPort {
	const { document } = parseHTML(`<!doctype html><html><body>${fragment}</body></html>`);
	return {
		currentUrl: () => url,
		now: () => Date.parse("2026-08-21T00:00:00.000Z"),
		query: async (_role, selector) =>
			[...document.querySelectorAll(selector)].map((element) => ({
				text: (element.textContent ?? "").trim(),
				visible: !element.hasAttribute("hidden"),
			})),
		click: async () => undefined,
		fill: async () => undefined,
		readAnswer: async () => {
			throw new Error("Not used by the readiness fixture");
		},
		wait: async () => undefined,
	};
}

async function visibleCount(port: ConsumerDomPort, role: DomElementRole, selector: string): Promise<number> {
	const elements: readonly DomElementSummary[] = await port.query(role, selector);
	return elements.filter((item) => item.visible).length;
}
