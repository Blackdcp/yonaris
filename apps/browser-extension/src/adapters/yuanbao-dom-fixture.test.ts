import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { yuanbaoSelectorContract } from "./yuanbao";

describe("Yuanbao semantic DOM contract", () => {
	test("matches the current official composer, send control, and icon-only new-dialogue action", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="yb-common-nav__trigger" data-desc="new-chat"><span class="icon-yb-ic_newchat_20"></span></div>
			<div class="ql-editor ql-blank" contenteditable="true"></div>
			<a id="yuanbao-send-btn" class="style__send-btn--disabled___mhfdQ" aria-label="发送"></a>
			<a id="yuanbao-send-btn" aria-label="发送"></a>
			<div class="agent-chat__bubble agent-chat__bubble--human"><div class="hyc-content-text">Prompt A</div><div>复制</div></div>
			<div class="agent-chat__bubble agent-chat__bubble--ai agent-chat__conv--ai--multiple">
				<div class="agent-chat__bubble__content">
					<div class="agent-chat__conv--ai__speech_show">
						<div class="agent-chat__speech-text--box agent-chat__speech-text--box-left">
							<div class="agent-chat__speech-text">
								<div class="hyc-component-text">
									<div class="hyc-content-md hyc-content-md-done">Current answer</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div>复制</div>
			</div>
		</body></html>`);

		expect(document.querySelectorAll(yuanbaoSelectorContract.composer)).toHaveLength(1);
		expect(document.querySelectorAll(yuanbaoSelectorContract.send)).toHaveLength(1);
		const actions = [...document.querySelectorAll(yuanbaoSelectorContract.newConversation)];
		expect(actions).toHaveLength(1);
		expect(yuanbaoSelectorContract.newConversationLabel).toBeNull();
		expect(
			[...document.querySelectorAll(yuanbaoSelectorContract.userMessage)].map((element) => element.textContent),
		).toEqual(["Prompt A"]);
		expect(
			[...document.querySelectorAll(yuanbaoSelectorContract.answer)].map((element) => element.textContent),
		).toEqual(["Current answer"]);
	});

	test("does not invent provider search terms without a recorded source block", () => {
		expect(yuanbaoSelectorContract.searchUsed).toBeNull();
		expect(yuanbaoSelectorContract.queryItem).toBeNull();
		expect(yuanbaoSelectorContract.searchEvidence).toBeNull();
	});
});
