import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createZhipuAdapter, zhipuSearchEvidenceAdapter, zhipuSelectorContract } from "./zhipu";

describe("Zhipu browser-extension adapter", () => {
	test("uses the qualified ChatGLM origin and adapter identity", () => {
		expect(zhipuSelectorContract).toMatchObject({
			version: "zhipu-web-20260822-localpc-v5",
			surface: "zhipu.consumer_web",
			launchUrl: "https://chatglm.cn/",
		});
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh&cid=6a886af324c8dfed1eba5c18",
				newConversationLabels: ["新对话"],
				answer: {
					text: "智谱回答",
					html: "<article>智谱回答</article>",
					citations: [{ url: "https://source.example/zhipu", title: "智谱来源" }],
				},
			}),
		);
		const adapter = createZhipuAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "智谱回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/zhipu", title: "智谱来源" }],
			adapterVersion: "zhipu-web-20260822-localpc-v5",
		});
	});

	test("allows a Zhipu deep-search response to finish after the generic three-minute boundary", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				initiallySubmitted: true,
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh&cid=6a886af324c8dfed1eba5c18",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh&cid=6a886af324c8dfed1eba5c18",
				submittedPrompt: "Prompt A",
				generatingDurationMs: 180_500,
			}),
		);
		const adapter = createZhipuAdapter(port);
		await adapter.resumeSubmitted("Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
		expect(port.elapsedMs).toBeGreaterThan(180_000);
	});

	test("binds one collapsed source panel only when it is directly adjacent to the accepted answer", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="advance-thinking"><div class="advance-thinking-area"><div class="tool-result-content"><div class="sources-tab-container">Old sources</div></div></div></div>
			<div>old-turn separator</div>
			<div class="answer-content-wrap" id="accepted-answer">
				<p>Current answer</p>
				<a href="https://source.example/zhipu">智谱来源</a>
				<a href="https://hidden.example/zhipu" hidden>隐藏来源</a>
				<span class="source-aggregated source-item" data-id="source-1" data-group-key="group-1" data-url="https://structured.example/zhipu-one"><span class="source-item-num-name">结构化来源一</span></span>
				<span class="source-aggregated source-item" data-id="source-2" data-group-key="group-2" data-url="https://hidden-structured.example/zhipu" hidden><span class="source-item-num-name">隐藏结构化来源</span></span>
			</div>
			<div class="advance-thinking collapse">
				<div class="advance-thinking-area"><div class="tool-result-content"><div class="sources-tab-container"><span class="source-text">来源列表</span></div></div></div>
			</div>
		</body></html>`);
		const acceptedAnswer = requiredElement(document, "#accepted-answer");

		await expect(
			zhipuSearchEvidenceAdapter.read({
				acceptedAnswer,
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toEqual({
			webSearchObserved: true,
			queryAvailability: "unavailable",
			webQueries: [],
			citations: [
				{ url: "https://source.example/zhipu", title: "智谱来源" },
				{ url: "https://structured.example/zhipu-one", title: "结构化来源一" },
			],
			diagnostics: {
				extractorVersion: "zhipu-search-evidence-20260822-v2",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 4,
			},
		});
	});

	test("rejects unsafe answer-scoped Zhipu source metadata instead of accepting a partial list", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="answer-content-wrap" id="accepted-answer">
				<span class="source-item" data-id="source-1" data-group-key="group-1" data-url="https://user:secret@private.example/zhipu"><span class="source-item-num-name">私密来源</span></span>
			</div>
			<div class="advance-thinking"><div class="advance-thinking-area"><div class="tool-result-content"><div class="sources-tab-container">参考 1 篇资料</div></div></div></div>
		</body></html>`);

		await expect(
			zhipuSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).rejects.toThrow("Structured citation URL is invalid");
	});

	test("ignores an unbound page-wide Zhipu source panel", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="advance-thinking"><div class="advance-thinking-area"><div class="tool-result-content"><div class="sources-tab-container">Unbound sources</div></div></div></div>
			<div>separator</div>
			<div class="answer-content-wrap" id="accepted-answer">Current answer</div>
		</body></html>`);

		await expect(
			zhipuSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: () => true,
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toMatchObject({
			webSearchObserved: null,
			queryAvailability: "unknown",
			diagnostics: { searchBlockCount: 0, evidenceSource: "none" },
		});
	});

	test("rejects a conversation URL without the exact durable cid query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
				newConversationLabels: ["新对话"],
			}),
		);

		await expect(port.completeOneTask(createZhipuAdapter(port), "Prompt A")).rejects.toMatchObject({
			code: "post_submit_unknown",
		});
	});

	test("accepts the live durable conversation URL with timestamp, language, and cid", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?t=1787328959157&lang=zh&cid=6a887d1d17580d282f0824db",
				newConversationLabels: ["新对话"],
			}),
		);

		await expect(port.completeOneTask(createZhipuAdapter(port), "Prompt A")).resolves.toBeUndefined();
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
