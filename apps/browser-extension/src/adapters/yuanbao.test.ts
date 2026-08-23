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
		expect(yuanbaoSelectorContract.version).toBe("yuanbao-web-20260822-localpc-v11");
		expect(yuanbaoSearchEvidenceAdapter).toMatchObject({
			version: "yuanbao-search-evidence-20260822-v4",
			settleTimeoutMs: 60_000,
		});
		expect(adapter.surface).toBe("yuanbao.consumer_web");
	});

	test("waits for the enabled send action until after the prompt is filled", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/new-session",
				conversationUrl: "https://yuanbao.tencent.com/chat/workspace/yuanbao-session",
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
				conversationUrl: "https://yuanbao.tencent.com/chat/workspace/yuanbao-session",
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
			adapterVersion: "yuanbao-web-20260822-localpc-v11",
		});
	});

	test("uses only visible answer-scoped Yuanbao reference lists as search evidence", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="hyc-common-markdown__ref-list">Global navigation reference</div>
			<div class="agent-chat__speech-card__text" id="accepted-answer">
				<p>Current answer</p>
				<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="1"></span></div>
				<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="2"></span></div>
				<div class="hyc-common-markdown__ref-list" hidden></div>
				<a href="https://source.example/yuanbao">元宝来源</a>
			</div>
		</body></html>`);
		installYuanbaoSourcePopup(
			document,
			window,
			new Map([
				[1, { url: "https://source-one.example/a", title: "来源一" }],
				[2, { url: "https://source-two.example/b", title: "来源二" }],
			]),
		);

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
			citations: [
				{ url: "https://source.example/yuanbao", title: "元宝来源" },
				{ url: "https://source-one.example/a", title: "来源一" },
				{ url: "https://source-two.example/b", title: "来源二" },
			],
			diagnostics: {
				extractorVersion: "yuanbao-search-evidence-20260822-v4",
				evidenceSource: "dom",
				searchBlockCount: 2,
				queryCandidateCount: 0,
				citationCandidateCount: 3,
			},
		});
	});

	test("reads live Yuanbao reference markers beside the answer text inside the same AI bubble", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="99"></span></div>
			<div class="agent-chat__bubble--ai" id="accepted-bubble">
				<div class="agent-chat__speech-card__text" id="accepted-answer"><p>Current answer</p></div>
				<div class="hyc-common-markdown__ref-list hyc-common-markdown__ref-list--merged">
					<span class="hyc-common-markdown__ref-list__trigger" data-idx-list="3,7"></span>
				</div>
			</div>
		</body></html>`);
		installYuanbaoSourcePopup(
			document,
			window,
			new Map([
				[3, { url: "https://source-three.example/a", title: "来源三" }],
				[7, { url: "https://source-seven.example/b", title: "来源七" }],
			]),
		);

		await expect(
			yuanbaoSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).resolves.toMatchObject({
			webSearchObserved: true,
			queryAvailability: "unavailable",
			citations: [
				{ url: "https://source-three.example/a", title: "来源三" },
				{ url: "https://source-seven.example/b", title: "来源七" },
			],
			diagnostics: { searchBlockCount: 1, citationCandidateCount: 2 },
		});
	});

	test("cycles every provider source referenced by Yuanbao and restores the closed disclosure", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="agent-chat__speech-card__text" id="accepted-answer">
				<p>Current answer</p>
				<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="1,2,5"></span></div>
				<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="2,5,10"></span></div>
			</div>
		</body></html>`);
		installYuanbaoSourcePopup(
			document,
			window,
			new Map([
				[1, { url: "https://source-one.example/a", title: "来源一" }],
				[2, { url: "https://source-two.example/b", title: "来源二" }],
				[5, { url: "https://source-five.example/c", title: "来源五" }],
				[10, { url: "https://source-ten.example/d", title: "来源十" }],
			]),
		);

		await expect(
			yuanbaoSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).resolves.toMatchObject({
			webSearchObserved: true,
			queryAvailability: "unavailable",
			citations: [
				{ url: "https://source-one.example/a", title: "来源一" },
				{ url: "https://source-two.example/b", title: "来源二" },
				{ url: "https://source-five.example/c", title: "来源五" },
				{ url: "https://source-ten.example/d", title: "来源十" },
			],
			diagnostics: {
				extractorVersion: "yuanbao-search-evidence-20260822-v4",
				searchBlockCount: 2,
				citationCandidateCount: 4,
			},
		});
		expect(document.querySelector(".hyc-common-markdown__ref-list__popup")).toBeNull();
	});

	test("rejects an incomplete Yuanbao source carousel instead of uploading partial citations", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="agent-chat__speech-card__text" id="accepted-answer">
				<div class="hyc-common-markdown__ref-list"><span class="hyc-common-markdown__ref-list__trigger" data-idx-list="1,2"></span></div>
			</div>
		</body></html>`);
		installYuanbaoSourcePopup(
			document,
			window,
			new Map([[1, { url: "https://source-one.example/a", title: "来源一" }]]),
		);

		await expect(
			yuanbaoSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).rejects.toThrow("did not advance to the expected source");
		expect(document.querySelector(".hyc-common-markdown__ref-list__popup")).toBeNull();
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

	test("does not confirm Yuanbao's workspace URL before the prompt-specific conversation URL appears", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa",
				conversationUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0Pmcq1IcTRo",
				conversationUrlDelayMs: 3_000,
				generatingDurationMs: 4_000,
				newConversationLabels: ["新建对话"],
			}),
		);
		const adapter = createYuanbaoAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
			pageUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0Pmcq1IcTRo",
		});
	});

	test("waits for Yuanbao to replace the previous prompt-specific URL before confirming submission", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0PreviousThread",
				conversationUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0CurrentThread",
				conversationUrlDelayMs: 500,
				generatingDurationMs: 2_000,
				newConversationLabels: ["新建对话"],
			}),
		);
		const adapter = createYuanbaoAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Current answer",
			pageUrl: "https://yuanbao.tencent.com/chat/naQivTmsDa/0CurrentThread",
		});
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}

function installYuanbaoSourcePopup(
	document: Document,
	window: Window,
	sources: ReadonlyMap<number, { url: string; title: string }>,
): void {
	for (const trigger of document.querySelectorAll<HTMLElement>(
		".hyc-common-markdown__ref-list__trigger[data-idx-list]",
	)) {
		trigger.addEventListener(
			"mouseover",
			() => {
				const indices = [...(trigger.getAttribute("data-idx-list") ?? "").matchAll(/\d+/gu)].map((match) =>
					Number(match[0]),
				);
				let position = 0;
				const popup = document.createElement("div");
				popup.className = "hyc-common-markdown__ref-list__popup";
				const previous = document.createElement("button");
				previous.innerHTML = '<span class="icon-arrow-left"></span>';
				const next = document.createElement("button");
				next.innerHTML = '<span class="icon-arrow-right"></span>';
				const card = document.createElement("div");
				card.className = "hyc-common-markdown__ref_card";
				const title = document.createElement("h4");
				title.className = "hyc-common-markdown__ref_card-title";
				card.append(title);
				popup.append(previous, next, card);
				const render = () => {
					const index = indices[position];
					const source = index === undefined ? undefined : sources.get(index);
					card.setAttribute("data-idx", String(index ?? ""));
					card.setAttribute("data-url", source?.url ?? "");
					title.textContent = source?.title ?? "";
				};
				previous.addEventListener("click", () => {
					position = Math.max(0, position - 1);
					render();
				});
				next.addEventListener("click", () => {
					if (sources.has(indices[position + 1] ?? -1)) position += 1;
					render();
				});
				render();
				document.body.append(popup);
				trigger.addEventListener("mouseout", () => popup.remove(), { once: true });
			},
			{ once: true },
		);
	}
	void window;
}
