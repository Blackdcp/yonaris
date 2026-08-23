import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import type { ConsumerDomPort, DomElementRole, DomElementSummary } from "./contracts";
import { kimiSelectorContract } from "./kimi";

const KIMI_READY_FIXTURE = `
	<aside hidden><div class="action-label">新建会话</div></aside>
	<div class="layout-header"><div class="header-center"><div class="chat-header"><div class="left-actions"><a href="/"><div class="icon-button primary"><svg name="AddConversation"></svg></div></a></div></div></div></div>
	<div class="chat-input-editor" role="textbox" contenteditable="true"></div>
	<div class="send-button-container disabled"></div>
	<div class="send-button-container"></div>
	<div class="chat-content-item chat-content-item-user"><div class="segment segment-user"><div class="segment-content-box"><div class="user-content">Prompt A</div></div><div>编辑 复制 分享</div></div></div>
	<div class="chat-content-item chat-content-item-assistant"><div class="segment segment-assistant"><div class="segment-content-box">Current answer</div><div>复制</div></div></div>
`;

describe("Kimi semantic DOM contract", () => {
	test("matches the visible header new-chat control instead of the collapsed sidebar label", async () => {
		const port = cssFixturePort(KIMI_READY_FIXTURE, "https://www.kimi.com/");

		expect(await visibleCount(port, "composer", kimiSelectorContract.composer)).toBe(1);
		expect(await visibleCount(port, "send", kimiSelectorContract.send)).toBe(1);
		const actions = await port.query("new_conversation", kimiSelectorContract.newConversation);
		expect(kimiSelectorContract.newConversationLabel).toBeNull();
		expect(actions.filter((item) => item.visible)).toHaveLength(1);
		expect((await port.query("user_message", kimiSelectorContract.userMessage)).map((item) => item.text)).toEqual([
			"Prompt A",
		]);
		expect((await port.query("answer", kimiSelectorContract.answer)).map((item) => item.text)).toEqual([
			"Current answer",
		]);
	});

	test("keeps provider search terms unavailable until a recorded source block proves them", () => {
		expect(kimiSelectorContract.searchUsed).toBeNull();
		expect(kimiSelectorContract.searchNotUsed).toBeNull();
		expect(kimiSelectorContract.queryItem).toBeNull();
		expect(kimiSelectorContract.searchEvidence).toBeNull();
	});

	test("keeps a search-only assistant segment generating until visible final markdown arrives", async () => {
		const searchOnly = cssFixturePort(
			`<div class="chat-content-item-assistant">
				<div class="segment-content-box">
					<div class="toolcall-container toolcall-web_search">思考已完成 搜索网页 46 个结果</div>
				</div>
			</div>`,
			"https://www.kimi.com/chat/kimi-session",
		);
		const completed = cssFixturePort(
			`<div class="chat-content-item-assistant">
				<div class="segment-content-box">
					<div class="toolcall-container toolcall-web_search">思考已完成 搜索网页 46 个结果</div>
					<div class="markdown-container"><div class="markdown">完整正文</div></div>
				</div>
			</div>`,
			"https://www.kimi.com/chat/kimi-session",
		);

		expect(await visibleCount(searchOnly, "generating", kimiSelectorContract.generating)).toBe(1);
		expect(await visibleCount(completed, "generating", kimiSelectorContract.generating)).toBe(0);
	});

	test("accepts a search-free plain-text assistant answer as complete", async () => {
		const plainText = cssFixturePort(
			`<div class="chat-content-item-assistant">
				<div class="segment-content-box">普通文本回答</div>
			</div>`,
			"https://www.kimi.com/chat/kimi-session",
		);

		expect(await visibleCount(plainText, "generating", kimiSelectorContract.generating)).toBe(0);
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
