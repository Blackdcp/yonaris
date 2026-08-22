import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createWenxinAdapter, wenxinSearchEvidenceAdapter, wenxinSelectorContract } from "./wenxin";

describe("Wenxin browser-extension adapter", () => {
	test("uses the current Wenxin origin and registered adapter identity", () => {
		expect(wenxinSelectorContract).toMatchObject({
			version: "wenxin-web-20260822-localpc-v10",
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
			adapterVersion: "wenxin-web-20260822-localpc-v10",
		});
	});

	test("opens the answer-scoped search trace, extracts structured source metadata, and restores the page", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="ai-entry" id="accepted-answer">
				<div class="ai-entry-block ai-thinking-steps" id="thinking-block">
					<div class="root-header" id="thinking-trigger"><i class="cos-icon cos-icon-search"></i>搜索网页来源</div>
					<ol id="reference-list" hidden>
						<li data-long-press-menu="true" data-long-press-menu-buttons="copy" data-long-press-ext-info='{"link":"https://structured.example/wenxin","linkTitle":"Structured source","logInfo":{"longpress_content":"redacted"}}'>Structured source</li>
					</ol>
				</div>
				<div class="ai-entry-block ai-markdown"><div class="marklang">
					<a class="marklang-link" href="https://source.example/wenxin">文心来源</a>
				</div></div>
			</div>
		</body></html>`);
		const acceptedAnswer = requiredElement(document, "#accepted-answer");
		const referenceList = requiredElement(document, "#reference-list");
		let clickCount = 0;
		requiredElement(document, "#thinking-trigger").addEventListener("click", () => {
			clickCount += 1;
			referenceList.toggleAttribute("hidden");
		});

		await expect(
			wenxinSearchEvidenceAdapter.read({
				acceptedAnswer,
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).resolves.toEqual({
			webSearchObserved: true,
			queryAvailability: "unavailable",
			webQueries: [],
			citations: [
				{ url: "https://source.example/wenxin", title: "文心来源" },
				{ url: "https://structured.example/wenxin", title: "Structured source" },
			],
			diagnostics: {
				extractorVersion: "wenxin-search-evidence-20260822-v3",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 2,
			},
		});
		expect(clickCount).toBe(2);
		expect(referenceList.hasAttribute("hidden")).toBe(true);
	});

	test("does not call an unrelated thinking step proof of web search", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="ai-entry" id="accepted-answer">
				<div class="ai-entry-block ai-thinking-steps"><header>分析问题</header></div>
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

	test("rejects malformed Wenxin source metadata and restores the thinking trace", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="ai-entry" id="accepted-answer"><div class="ai-entry-block ai-thinking-steps">
				<div class="root-header" id="thinking-trigger"><i class="cos-icon-search"></i>搜索</div>
				<ol id="reference-list" hidden><li data-long-press-menu="true" data-long-press-menu-buttons="copy" data-long-press-ext-info='{"link":"javascript:alert(1)","linkTitle":"Unsafe"}'>Unsafe</li></ol>
			</div></div>
		</body></html>`);
		const referenceList = requiredElement(document, "#reference-list");
		let clickCount = 0;
		requiredElement(document, "#thinking-trigger").addEventListener("click", () => {
			clickCount += 1;
			referenceList.toggleAttribute("hidden");
		});

		await expect(
			wenxinSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).rejects.toThrow(/structured citation URL is invalid/i);
		expect(clickCount).toBe(2);
		expect(referenceList.hasAttribute("hidden")).toBe(true);
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
