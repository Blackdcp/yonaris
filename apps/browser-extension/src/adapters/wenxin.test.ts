import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createWenxinAdapter, wenxinSearchEvidenceAdapter, wenxinSelectorContract } from "./wenxin";

describe("Wenxin browser-extension adapter", () => {
	test("uses the current Wenxin origin and registered adapter identity", () => {
		expect(wenxinSelectorContract).toMatchObject({
			version: "wenxin-web-20260822-localpc-v8",
			surface: "wenxin.consumer_web",
			launchUrl: "https://wenxin.baidu.com/",
		});
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
				newConversationLabels: ["开启新对话"],
				answer: {
					text: "文心回答",
					html: "<article>文心回答</article>",
					citations: [{ url: "https://source.example/wenxin", title: "文心来源" }],
				},
			}),
		);
		const adapter = createWenxinAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "文心回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/wenxin", title: "文心来源" }],
			adapterVersion: "wenxin-web-20260822-localpc-v8",
		});
	});

	test("observes a visible answer-scoped source trace and extracts only visible answer citations", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="ai-entry-block ai-thinking-steps"><header class="step-header">搜索网页来源</header></div>
			<div class="ai-entry" id="accepted-answer">
				<div class="ai-entry-block ai-thinking-steps">
					<header class="step-header" hidden>检索参考资料</header>
				</div>
				<div class="ai-entry-block ai-markdown"><div class="marklang">
					<a class="marklang-link" href="https://source.example/wenxin">文心来源</a>
					<a class="marklang-link" href="https://hidden.example/wenxin" hidden>隐藏来源</a>
				</div></div>
			</div>
		</body></html>`);
		const acceptedAnswer = requiredElement(document, "#accepted-answer");

		await expect(
			wenxinSearchEvidenceAdapter.read({
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
			citations: [{ url: "https://source.example/wenxin", title: "文心来源" }],
			diagnostics: {
				extractorVersion: "wenxin-search-evidence-20260822-v1",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 2,
			},
		});
	});

	test("does not call an unrelated thinking step proof of web search", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="ai-entry" id="accepted-answer">
				<div class="ai-entry-block ai-thinking-steps"><header class="step-header">分析问题</header></div>
			</div>
		</body></html>`);

		await expect(
			wenxinSearchEvidenceAdapter.read({
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

	test("accepts Wenxin's durable search conversation URL", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("waits through Wenxin's transient post-submit query until the durable URL is strict", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/",
				conversationUrlTimeline: [
					"https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url&from=send",
					"https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url",
				],
				conversationUrl: "https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);

		await expect(port.completeOneTask(adapter, "Prompt A")).resolves.toBeUndefined();
		expect(port.elapsedMs).toBeGreaterThanOrEqual(1_000);
	});

	test("rejects a Wenxin search conversation URL without the required entry query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/search/7745716473774230402",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);

		await expect(port.completeOneTask(adapter, "Prompt A")).rejects.toMatchObject({ code: "page_drift" });
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
