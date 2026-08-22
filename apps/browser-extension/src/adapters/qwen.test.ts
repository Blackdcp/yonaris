import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createQwenAdapter, qwenSearchEvidenceAdapter, qwenSelectorContract } from "./qwen";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Qwen browser-extension adapter", () => {
	test("declares the registered Qwen surface and adapter version", () => {
		expect(qwenSelectorContract).toMatchObject({
			version: "qwen-web-20260822-localpc-v7",
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
			adapterVersion: "qwen-web-20260822-localpc-v7",
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
		</body></html>`);

		await expect(
			qwenSearchEvidenceAdapter.read({
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
			citations: [{ url: "https://source.example/qwen", title: "千问来源" }],
			diagnostics: {
				extractorVersion: "qwen-search-evidence-20260822-v1",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 1,
			},
		});
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
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
