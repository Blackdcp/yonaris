import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createYuanbaoAdapter, yuanbaoSearchEvidenceAdapter, yuanbaoSelectorContract } from "./yuanbao";

describe("Yuanbao browser-extension adapter", () => {
	test("keeps Yuanbao as the measured surface even when Yuanbao offers a DeepSeek model", () => {
		const adapter = createYuanbaoAdapter(
			new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://yuanbao.tencent.com/chat/new-session",
					conversationUrl: "https://yuanbao.tencent.com/chat/new-session",
					newConversationLabels: ["新建对话"],
				}),
			),
		);
		expect(yuanbaoSelectorContract.version).toBe("yuanbao-web-20260822-localpc-v7");
		expect(adapter.surface).toBe("yuanbao.consumer_web");
	});

	test("waits for the enabled send action until after the prompt is filled", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/new-session",
				conversationUrl: "https://yuanbao.tencent.com/chat/yuanbao-session",
				newConversationLabels: ["新建对话"],
				sendMatchesBeforeFill: 0,
				sendMatches: 1,
			}),
		);

		await expect(port.completeOneTask(createYuanbaoAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/new-session",
				conversationUrl: "https://yuanbao.tencent.com/chat/yuanbao-session",
				newConversationLabels: ["新建对话"],
				answer: {
					text: "元宝回答",
					html: "<article>元宝回答</article>",
					citations: [{ url: "https://source.example/yuanbao", title: "元宝来源" }],
				},
			}),
		);
		const adapter = createYuanbaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "元宝回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/yuanbao", title: "元宝来源" }],
			adapterVersion: "yuanbao-web-20260822-localpc-v7",
		});
	});

	test("uses only visible answer-scoped Yuanbao reference lists as search evidence", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="hyc-common-markdown__ref-list">Global navigation reference</div>
			<div class="agent-chat__speech-card__text" id="accepted-answer">
				<p>Current answer</p>
				<div class="hyc-common-markdown__ref-list"></div>
				<div class="hyc-common-markdown__ref-list"></div>
				<div class="hyc-common-markdown__ref-list" hidden></div>
				<a href="https://source.example/yuanbao">元宝来源</a>
			</div>
		</body></html>`);

		await expect(
			yuanbaoSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toEqual({
			webSearchObserved: true,
			queryAvailability: "unavailable",
			webQueries: [],
			citations: [{ url: "https://source.example/yuanbao", title: "元宝来源" }],
			diagnostics: {
				extractorVersion: "yuanbao-search-evidence-20260822-v1",
				evidenceSource: "dom",
				searchBlockCount: 2,
				queryCandidateCount: 0,
				citationCandidateCount: 1,
			},
		});
	});

	test("does not mistake Yuanbao global navigation search chrome for answer evidence", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="yb-common-nav__tool" aria-label="搜索">搜索</div>
			<div class="agent-chat__speech-card__text" id="accepted-answer">Current answer</div>
		</body></html>`);

		await expect(
			yuanbaoSearchEvidenceAdapter.read({
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

	test("accepts Yuanbao's live two-segment conversation URL after the first message", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa",
				conversationUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0Pmcq1IcTRo",
				newConversationLabels: ["新建对话"],
			}),
		);

		await expect(port.completeOneTask(createYuanbaoAdapter(port), "Prompt A")).resolves.toBeUndefined();
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
