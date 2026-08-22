import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createQwenAdapter, qwenSearchEvidenceAdapter, qwenSelectorContract } from "./qwen";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Qwen browser-extension adapter", () => {
	test("declares the registered Qwen surface and adapter version", () => {
		expect(qwenSelectorContract).toMatchObject({
			version: "qwen-web-20260822-localpc-v10",
			surface: "qwen.consumer_web",
			launchUrl: "https://www.qianwen.com/",
		});
	});

	test("waits for the enabled send action until after the prompt is filled", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.qianwen.com/",
				conversationUrl: "https://www.qianwen.com/chat/qwen-session",
				newConversationLabels: ["新建对话"],
				sendMatchesBeforeFill: 0,
				sendMatches: 1,
			}),
		);

		await expect(port.completeOneTask(createQwenAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("accepts both official Qwen canonical host variants", async () => {
		for (const pageUrl of ["https://qianwen.com/", "https://www.qianwen.com/"]) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl,
					conversationUrl: pageUrl,
					newConversationLabels: ["新建对话"],
				}),
			);
			await expect(createQwenAdapter(port).preflight()).resolves.toBeUndefined();
		}
	});

	test("collects a structured answer, direct citation, and bounded screenshot region", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://qianwen.com/",
				conversationUrl: "https://qianwen.com/chat/qwen-session",
				newConversationLabels: ["新建对话"],
				answer: {
					text: "千问回答",
					html: "<article>千问回答</article>",
					citations: [{ url: "https://source.example/qwen", title: "千问来源" }],
				},
			}),
		);
		const adapter = createQwenAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "千问回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/qwen", title: "千问来源" }],
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			adapterVersion: "qwen-web-20260822-localpc-v10",
		});
	});

	test("binds the visible Qwen source indicator to the unique latest turn", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="chat-round"><div class="reference-wrap-iEjeb3"><div class="search-content-iMifAk">Old sources</div></div></div>
			<div class="chat-round last-message-item" id="latest-turn">
				<div class="chat-answers-card-wrap">
					<div class="answer-common-card" id="accepted-answer">
						<p>Current answer</p><a href="https://source.example/qwen">千问来源</a>
					</div>
					<div class="reference-wrap-iEjeb3"><div class="search-content-iMifAk">参考来源</div></div>
				</div>
			</div>
			<div id="source-panel" hidden><div data-log-click-name="source" data-log-exposure-name="source" data-click-extra='{"url":"https://panel.example/qwen","title":"Panel source"}'>Panel source</div></div>
		</body></html>`);
		const indicator = requiredElement(document, "#latest-turn .search-content-iMifAk");
		const panel = requiredElement(document, "#source-panel");
		indicator.addEventListener("click", () => panel.toggleAttribute("hidden"));

		await expect(
			qwenSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
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
				{ url: "https://source.example/qwen", title: "千问来源" },
				{ url: "https://panel.example/qwen", title: "Panel source" },
			],
			diagnostics: {
				extractorVersion: "qwen-search-evidence-20260822-v3",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 2,
			},
		});
	});

	test("opens the current source panel, extracts structured source metadata, and restores the page", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="chat-round last-message-item" id="latest-turn">
				<div class="chat-answers-card-wrap">
					<div class="answer-common-card" id="accepted-answer">
						<p>Current answer</p><a href="https://direct.example/qwen">Direct source</a>
					</div>
					<div class="reference-wrap-iEjeb3"><div class="search-content-iMifAk" id="source-trigger">参考来源</div></div>
				</div>
			</div>
			<div id="source-panel" hidden>
				<div class="source-item-mqZd08" data-log-click-name="source" data-log-exposure-name="source" data-click-extra='{"url":"https://source.example/one","ref_url":"https://source.example/one","title":"Source one"}'>Source one</div>
				<div class="source-item-mqZd08" data-log-click-name="source" data-log-exposure-name="source" data-click-extra='{"url":"https://second.example/two","ref_url":"https://second.example/two","title":"Source two"}'>Source two</div>
			</div>
		</body></html>`);
		const panel = requiredElement(document, "#source-panel");
		let clickCount = 0;
		requiredElement(document, "#source-trigger").addEventListener("click", () => {
			clickCount += 1;
			panel.toggleAttribute("hidden");
		});

		await expect(
			qwenSearchEvidenceAdapter.read({
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
				{ url: "https://direct.example/qwen", title: "Direct source" },
				{ url: "https://source.example/one", title: "Source one" },
				{ url: "https://second.example/two", title: "Source two" },
			],
			diagnostics: { citationCandidateCount: 3 },
		});
		expect(clickCount).toBe(2);
		expect(panel.hasAttribute("hidden")).toBe(true);
	});

	test("rejects malformed source metadata without leaving the Qwen panel open", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="chat-round last-message-item"><div class="chat-answers-card-wrap">
				<div class="answer-common-card" id="accepted-answer">Current answer</div>
				<div class="reference-wrap-iEjeb3"><div class="search-content-iMifAk" id="source-trigger">参考来源</div></div>
			</div></div>
			<div id="source-panel" hidden><div data-log-click-name="source" data-log-exposure-name="source" data-click-extra='{"url":"https://user:secret@source.example/one","title":"Unsafe"}'>Unsafe</div></div>
		</body></html>`);
		const panel = requiredElement(document, "#source-panel");
		let clickCount = 0;
		requiredElement(document, "#source-trigger").addEventListener("click", () => {
			clickCount += 1;
			panel.toggleAttribute("hidden");
		});

		await expect(
			qwenSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
				wait: async () => undefined,
			}),
		).rejects.toThrow(/structured citation URL is invalid/i);
		expect(clickCount).toBe(2);
		expect(panel.hasAttribute("hidden")).toBe(true);
	});

	test("keeps Qwen search state unknown when only an older turn has a source indicator", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="chat-round"><div class="reference-wrap-iEjeb3"><div class="search-content-iMifAk">Old sources</div></div></div>
			<div class="chat-round last-message-item"><div class="chat-answers-card-wrap"><div class="answer-common-card" id="accepted-answer">Current answer</div></div></div>
		</body></html>`);

		await expect(
			qwenSearchEvidenceAdapter.read({
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

	test("fails before submission when login, CAPTCHA, or account restriction is visible", async () => {
		for (const [code, override] of [
			["signed_out", { signedOut: true }],
			["captcha", { captcha: true }],
			["account_restricted", { accountRestricted: true }],
		] as const) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://qianwen.com/",
					conversationUrl: "https://qianwen.com/chat/qwen-session",
					newConversationLabels: ["新建对话"],
					...override,
				}),
			);
			await expect(createQwenAdapter(port).preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
			expect(port.submitCount).toBe(0);
		}
	});

	test("does not discard a submitted Qwen answer because its transient risk iframe is still mounted", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.qianwen.com/",
				conversationUrl: "https://www.qianwen.com/chat/qwen-session",
				newConversationLabels: ["新建对话"],
				captchaDurationAfterSubmitMs: 750,
			}),
		);
		const adapter = createQwenAdapter(port);

		await expect(port.completeOneTask(adapter, "Prompt A")).resolves.toBeUndefined();
		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
		expect(port.submitCount).toBe(1);
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
