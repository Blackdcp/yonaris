import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { wenxinSelectorContract } from "./wenxin";

describe("Wenxin semantic DOM contract", () => {
	test("matches the current official composer, send control, and new-dialogue action", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="new-dialog-container-button"><span>开启新对话</span></div>
			<textarea id="chat-textarea" class="ci-textarea" data-ai-placeholder></textarea>
			<span class="ci-submit-button"></span>
			<div class="conversation-flow-question-container"><span class="cs-question-pure-text">Prompt A</span><div>复制</div></div>
			<div class="conversation-flow-answer-container"><div class="ai-entry">Current answer</div><div>复制</div></div>
		</body></html>`);

		expect(document.querySelectorAll(wenxinSelectorContract.composer)).toHaveLength(1);
		expect(document.querySelectorAll(wenxinSelectorContract.send)).toHaveLength(1);
		const actions = [...document.querySelectorAll(wenxinSelectorContract.newConversation)];
		expect(actions.filter((element) => element.textContent?.trim() === "开启新对话")).toHaveLength(1);
		expect(
			[...document.querySelectorAll(wenxinSelectorContract.userMessage)].map((element) => element.textContent),
		).toEqual(["Prompt A"]);
		expect([...document.querySelectorAll(wenxinSelectorContract.answer)].map((element) => element.textContent)).toEqual(
			["Current answer"],
		);
	});

	test("does not invent provider search terms without a recorded source block", () => {
		expect(wenxinSelectorContract.searchUsed).toBeNull();
		expect(wenxinSelectorContract.queryItem).toBeNull();
		expect(wenxinSelectorContract.searchEvidence).toBeNull();
	});
});
