import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { yuanbaoSelectorContract } from "./yuanbao";

describe("Yuanbao semantic DOM contract", () => {
	test("matches the current official composer, send control, and icon-only new-dialogue action", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="yb-common-nav__trigger" data-desc="new-chat"><span class="icon-yb-ic_newchat_20"></span></div>
			<div class="ql-editor ql-blank" contenteditable="true"></div>
			<a id="yuanbao-send-btn" aria-label="发送"></a>
		</body></html>`);

		expect(document.querySelectorAll(yuanbaoSelectorContract.composer)).toHaveLength(1);
		expect(document.querySelectorAll(yuanbaoSelectorContract.send)).toHaveLength(1);
		const actions = [...document.querySelectorAll(yuanbaoSelectorContract.newConversation)];
		expect(actions).toHaveLength(1);
		expect(yuanbaoSelectorContract.newConversationLabel).toBeNull();
	});

	test("does not invent provider search terms without a recorded source block", () => {
		expect(yuanbaoSelectorContract.searchUsed).toBeNull();
		expect(yuanbaoSelectorContract.queryItem).toBeNull();
		expect(yuanbaoSelectorContract.searchEvidence).toBeNull();
	});
});
