import assert from "node:assert/strict";
import test from "node:test";
import {
	ANSWER_CONTAINER_HTML_MAX_BYTES,
	assertExactlyOneNewAnswer,
	validateAnswerContainerSnapshot,
} from "./answer-container-snapshot.js";

test("accepts answer-container outerHTML only when its text matches the accepted answer", () => {
	assert.equal(
		validateAnswerContainerSnapshot({
			answerText: "StepFun 是一个大模型平台。",
			containerText: "  StepFun\n是一个大模型平台。 ",
			answerHtml: '<div data-testid="answer"><strong>StepFun</strong> 是一个大模型平台。</div>',
		}),
		'<div data-testid="answer"><strong>StepFun</strong> 是一个大模型平台。</div>',
	);
	assert.throws(
		() =>
			validateAnswerContainerSnapshot({
				answerText: "当前回答",
				containerText: "旧回答",
				answerHtml: "<div>旧回答</div>",
			}),
		/does not match/i,
	);
});

test("rejects full-page HTML and oversized answer containers", () => {
	assert.throws(
		() =>
			validateAnswerContainerSnapshot({
				answerText: "回答",
				containerText: "回答",
				answerHtml: "<!doctype html><html><body>回答</body></html>",
			}),
		/full-page/i,
	);
	assert.throws(
		() =>
			validateAnswerContainerSnapshot({
				answerText: "回答",
				containerText: "回答",
				answerHtml: `<div>${"x".repeat(ANSWER_CONTAINER_HTML_MAX_BYTES)}</div>`,
			}),
		/exceeds/i,
	);
});

test("requires exactly one new answer after a single prompt submission", () => {
	assert.doesNotThrow(() => assertExactlyOneNewAnswer(3, 4));
	assert.throws(() => assertExactlyOneNewAnswer(3, 3), /exactly one/i);
	assert.throws(() => assertExactlyOneNewAnswer(3, 5), /exactly one/i);
});
