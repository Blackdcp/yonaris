import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { yuanbaoSelectorContract } from "./yuanbao";

describe("Yuanbao semantic DOM contract", () => {
	test("matches the current official composer, send control, and labeled new-dialogue action", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<button data-testid="new-chat">新建对话</button>
			<div class="ql-editor ql-blank" contenteditable="true"></div>
			<a id="yuanbao-send-btn" aria-label="发送"></a>
		</body></html>`);

		expect(document.querySelectorAll(yuanbaoSelectorContract.composer)).toHaveLength(1);
		expect(document.querySelectorAll(yuanbaoSelectorContract.send)).toHaveLength(1);
		const actions = [...document.querySelectorAll(yuanbaoSelectorContract.newConversation)];
		expect(actions.filter((element) => element.textContent?.trim() === "新建对话")).toHaveLength(1);
	});

	test("does not invent provider search terms without a recorded source block", () => {
		expect(yuanbaoSelectorContract.searchUsed).toBeNull();
		expect(yuanbaoSelectorContract.queryItem).toBeNull();
		expect(yuanbaoSelectorContract.searchEvidence).toBeNull();
	});
});
