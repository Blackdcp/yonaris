import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import type { ConsumerDomPort, DomElementRole, DomElementSummary } from "./contracts";
import { qwenSelectorContract } from "./qwen";

const QWEN_READY_FIXTURE = `
	<button>新建对话</button>
	<div role="textbox" contenteditable="true" data-slate-editor="true"></div>
	<button aria-label="发送消息"></button>
`;

describe("Qwen semantic DOM contract", () => {
	test("matches one composer, send control, and labeled new-conversation action", async () => {
		const port = cssFixturePort(QWEN_READY_FIXTURE, "https://www.qianwen.com/");

		expect(await visibleCount(port, "composer", qwenSelectorContract.composer)).toBe(1);
		expect(await visibleCount(port, "send", qwenSelectorContract.send)).toBe(1);
		const actions = await port.query("new_conversation", qwenSelectorContract.newConversation);
		expect(
			actions.filter((item) => item.visible && item.text === qwenSelectorContract.newConversationLabel),
		).toHaveLength(1);
	});

	test("keeps provider search terms unavailable until a recorded source block proves them", () => {
		expect(qwenSelectorContract.searchUsed).toBeNull();
		expect(qwenSelectorContract.searchNotUsed).toBeNull();
		expect(qwenSelectorContract.queryItem).toBeNull();
		expect(qwenSelectorContract.searchEvidence).toBeNull();
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
