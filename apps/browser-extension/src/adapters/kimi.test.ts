import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import { createKimiAdapter, kimiSearchEvidenceAdapter, kimiSelectorContract } from "./kimi";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Kimi browser-extension adapter", () => {
	test("declares the registered Kimi surface and adapter version", () => {
		expect(kimiSelectorContract).toMatchObject({
			version: "kimi-web-20260823-localpc-v16",
			surface: "kimi.consumer_web",
			launchUrl: "https://www.kimi.com/",
		});
	});

	test("waits for the enabled send action until after the prompt is filled", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
				sendMatchesBeforeFill: 0,
				sendMatches: 1,
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("uses an already blank Kimi launch page without requiring a new-conversation control", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: [],
				sendMatchesBeforeFill: 0,
				sendMatches: 1,
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.clickedText).toBeNull();
		expect(port.submitCount).toBe(1);
	});

	test("collects a structured answer, direct citation, and bounded screenshot region", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
				answer: {
					text: "Kimi 回答",
					html: "<article>Kimi 回答</article>",
					citations: [{ url: "https://source.example/kimi", title: "Kimi 来源" }],
				},
			}),
		);
		const adapter = createKimiAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Kimi 回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/kimi", title: "Kimi 来源" }],
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			adapterVersion: "kimi-web-20260823-localpc-v16",
		});
	});

	test("extracts the visible provider-generated query from the answer-scoped Kimi search tool", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="toolcall-container toolcall-web_search">Unrelated page search</div>
			<div class="segment-content-box" id="accepted-answer">
				<p>Current answer</p>
				<div class="toolcall-container toolcall-web_search"><span class="toolcall-title-container-text">provider generated query</span></div>
				<div class="toolcall-container toolcall-web_search" hidden><span class="toolcall-title-container-text">hidden query</span></div>
				<a class="pua-ref-cite-tag pua-ref-cite-tag--text" data-site-name="Hidden source" href="https://hidden.example/source" hidden>Hidden source</a>
				<a class="pua-ref-cite-tag pua-ref-cite-tag--text" data-site-name="Visible source" href="https://source.example/kimi">Visible source</a>
			</div>
		</body></html>`);
		const acceptedAnswer = requiredElement(document, "#accepted-answer");

		await expect(
			kimiSearchEvidenceAdapter.read({
				acceptedAnswer,
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toEqual({
			webSearchObserved: true,
			queryAvailability: "exposed",
			webQueries: ["provider generated query"],
			citations: [{ url: "https://source.example/kimi", title: "Visible source" }],
			diagnostics: {
				extractorVersion: "kimi-search-evidence-20260822-v3",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 1,
				citationCandidateCount: 2,
			},
		});
	});

	test("uses Kimi's visible citation marker metadata when the anchor has no text node", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="segment-content-box" id="accepted-answer">
				<div class="toolcall-container toolcall-web_search"><span class="toolcall-title-container-text">provider query</span></div>
				<a class="pua-ref-cite-tag pua-ref-cite-tag--text" data-site-name="Visible provider source" href="https://source.example/kimi"></a>
			</div>
		</body></html>`);

		await expect(
			kimiSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: () => true,
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toMatchObject({
			webSearchObserved: true,
			citations: [{ url: "https://source.example/kimi", title: "Visible provider source" }],
		});
	});

	test("does not treat a hidden Kimi search tool or hidden query as evidence", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="segment-content-box" id="accepted-answer">
				<p>Current answer</p>
				<div class="toolcall-container toolcall-web_search" hidden><span class="toolcall-title-container-text">hidden query</span></div>
			</div>
		</body></html>`);

		await expect(
			kimiSearchEvidenceAdapter.read({
				acceptedAnswer: requiredElement(document, "#accepted-answer"),
				document,
				isVisible: (element) => !element.closest("[hidden]"),
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toMatchObject({
			webSearchObserved: null,
			queryAvailability: "unknown",
			webQueries: [],
			diagnostics: { searchBlockCount: 0, queryCandidateCount: 0 },
		});
	});

	test("keeps Kimi search state unknown when the accepted answer has no native search block", async () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<div class="toolcall-container toolcall-web_search">Unrelated page search</div>
			<div class="segment-content-box" id="accepted-answer">Current answer</div>
		</body></html>`);
		const acceptedAnswer = requiredElement(document, "#accepted-answer");

		await expect(
			kimiSearchEvidenceAdapter.read({
				acceptedAnswer,
				document,
				isVisible: () => true,
				readVisibleText: (element) => (element.textContent ?? "").trim(),
				readStructuredEvidence: async () => ({ searchUsedCount: 0, webQueries: [], citations: [] }),
			}),
		).resolves.toMatchObject({
			webSearchObserved: null,
			queryAvailability: "unknown",
			webQueries: [],
			citations: [],
			diagnostics: { searchBlockCount: 0, evidenceSource: "none" },
		});
	});

	test("accepts Kimi's exact new-chat query parameter", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
			}),
		);

		await expect(createKimiAdapter(port).preflight()).resolves.toBeUndefined();
	});

	test("accepts Kimi's apex origin used by Chrome on macOS", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://kimi.com/",
				conversationUrl: "https://kimi.com/chat/kimi-session",
				newConversationLabels: ["鏂板缓浼氳瘽"],
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
	});

	test("accepts Kimi's exact home entry parameter on the durable conversation", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session?chat_enter_method=home",
				newConversationLabels: [],
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("accepts Kimi's shortcut entry parameter on the durable conversation", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=shortcut",
				conversationUrl: "https://www.kimi.com/chat/kimi-session?chat_enter_method=shortcut",
				newConversationLabels: [],
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("classifies Kimi's high-load membership modal as a rate limit", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: [],
				pageText: "提示 和Kimi聊天的人太多啦，订阅会员可进入独立的优先队列 我知道了 去升级",
			}),
		);

		await expect(createKimiAdapter(port).preflight()).rejects.toMatchObject({
			code: "rate_limited",
			stage: "pre_submit",
		});
	});

	test("does not treat Kimi's ordinary membership entry as a rate limit", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: [],
				pageText: "升级套餐 新建会话",
			}),
		);

		await expect(createKimiAdapter(port).preflight()).resolves.toBeUndefined();
	});

	test("keeps the confirmed conversation when Kimi removes its transient new-chat query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				conversationUrlTimeline: [
					"https://www.kimi.com/chat/kimi-session?chat_enter_method=new_chat",
					"https://www.kimi.com/chat/kimi-session",
				],
				newConversationLabels: ["新建会话"],
			}),
		);
		const adapter = createKimiAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("waits for Kimi's provisional conversation id to settle before confirming", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/final-session?chat_enter_method=home",
				conversationUrlTimeline: [
					"https://www.kimi.com/chat/provisional-session?chat_enter_method=home",
					"https://www.kimi.com/chat/final-session?chat_enter_method=home",
				],
				newConversationLabels: [],
			}),
		);
		const adapter = createKimiAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("waits for Kimi to leave the launch route before confirming the durable conversation", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session?chat_enter_method=new_chat",
				conversationUrlDelayMs: 2_000,
				newConversationLabels: ["新建会话"],
			}),
		);
		const adapter = createKimiAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("fails before submission when login, CAPTCHA, or account restriction is visible", async () => {
		for (const [code, override] of [
			["signed_out", { signedOut: true }],
			["captcha", { captcha: true }],
			["account_restricted", { accountRestricted: true }],
		] as const) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://www.kimi.com/",
					conversationUrl: "https://www.kimi.com/chat/kimi-session",
					newConversationLabels: ["新建会话"],
					...override,
				}),
			);
			await expect(createKimiAdapter(port).preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
			expect(port.submitCount).toBe(0);
		}
	});
});

function requiredElement(document: Document, selector: string): Element {
	const element = document.querySelector(selector);
	if (!element) throw new Error(`Fixture element ${selector} is missing`);
	return element;
}
