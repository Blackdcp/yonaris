import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { zhipuSelectorContract } from "./zhipu";

describe("Zhipu semantic DOM contract", () => {
	test("matches the live ChatGLM composer, send control, new dialogue, prompt, answer, and generation marker", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="new-session"><span>新对话</span></div>
			<div id="search-input-box">
				<textarea class="scroll-display-none"></textarea>
				<div class="enter is-main-chat"><img class="enter_icon"></div>
				<div class="enter is-main-chat searching"></div>
			</div>
			<div id="row-question-p-0" class="question-txt"><span>Prompt A</span></div>
			<div id="row-answer-0" class="answer">
				<div class="answer-content-wrap"><div class="markdown-body"><p>Current answer</p></div></div>
			</div>
		</body></html>`);

		expect(document.querySelectorAll(zhipuSelectorContract.composer)).toHaveLength(1);
		expect(document.querySelectorAll(zhipuSelectorContract.send)).toHaveLength(1);
		expect(document.querySelectorAll(zhipuSelectorContract.newConversation)).toHaveLength(1);
		expect(
			[...document.querySelectorAll(zhipuSelectorContract.userMessage)].map((element) => element.textContent),
		).toEqual(["Prompt A"]);
		expect([...document.querySelectorAll(zhipuSelectorContract.answer)].map((element) => element.textContent)).toEqual([
			"Current answer",
		]);
		expect(document.querySelectorAll(zhipuSelectorContract.generating)).toHaveLength(1);
	});

	test("detects the exact guest login marker and does not invent provider search terms", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="sidebar-avatar guest-avatar"></div>
		</body></html>`);

		expect(document.querySelectorAll(zhipuSelectorContract.loginWall)).toHaveLength(1);
		expect(zhipuSelectorContract.searchUsed).toBeNull();
		expect(zhipuSelectorContract.queryItem).toBeNull();
		expect(zhipuSelectorContract.searchEvidence).toBeNull();
	});
});
