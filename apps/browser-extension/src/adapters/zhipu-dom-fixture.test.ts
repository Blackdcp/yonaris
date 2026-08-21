import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { zhipuSelectorContract } from "./zhipu";

describe("Zhipu semantic DOM contract", () => {
	test("matches the live ChatGLM composer, send control, new dialogue, prompt, answer, and generation marker", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="new-session"><span>新对话</span></div>
			<div id="search-input-box">
				<textarea class="scroll-display-none"></textarea>
				<div class="enter is-main-chat"><div class="enter-icon-container"><img class="enter_icon"></div></div>
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

	test("targets the live inner send control that owns the click handler", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div id="search-input-box">
				<div class="enter is-main-chat"><div class="enter-icon-container"><img class="enter_icon"></div></div>
			</div>
		</body></html>`);
		const liveSendControl = document.querySelector<HTMLElement>(".enter-icon-container");
		let submitted = 0;
		liveSendControl?.addEventListener("click", () => {
			submitted += 1;
		});

		const matchedSendControl = document.querySelector<HTMLElement>(zhipuSelectorContract.send);
		matchedSendControl?.click();

		expect(matchedSendControl).toBe(liveSendControl);
		expect(submitted).toBe(1);
	});

	test("keeps exactly one send control discoverable while the empty composer has no inner click target", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div id="search-input-box">
				<textarea class="scroll-display-none"></textarea>
				<div class="enter is-main-chat"></div>
			</div>
		</body></html>`);
		const outerSendControl = document.querySelector<HTMLElement>(".enter.is-main-chat");

		const matchedSendControls = document.querySelectorAll<HTMLElement>(zhipuSelectorContract.send);

		expect(matchedSendControls).toHaveLength(1);
		expect(matchedSendControls[0]).toBe(outerSendControl);
	});

	test("treats one answer row with split Markdown and Mermaid blocks as one answer", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div id="row-answer-0" class="answer">
				<div class="answer-content-wrap">
					<div class="markdown-body"><p>Answer before chart</p></div>
					<div class="markdown-body md-code" style="display:none"><pre>hidden Mermaid source</pre></div>
					<div class="markdown-body"><p>Answer after chart</p></div>
				</div>
			</div>
		</body></html>`);

		const answers = document.querySelectorAll(zhipuSelectorContract.answer);

		expect(answers).toHaveLength(1);
		expect(answers[0]?.classList.contains("answer-content-wrap")).toBe(true);
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
