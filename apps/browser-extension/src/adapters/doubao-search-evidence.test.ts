import { parseHTML } from "linkedom";
import { afterEach, describe, expect, test, vi } from "vitest";
import doubaoContract from "../selector-contracts/doubao-web-v1.json";
import { createDocumentDomPort, isDomElementVisible, readVisibleDomText } from "./dom-port";
import { extractStructuredSearchEvidence, inspectLatestStructuredSearchEvidence } from "./search-evidence";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Doubao structured search evidence", () => {
	test("extracts exact queries and visible source cards from the current answer only", () => {
		const { document } = parseHTML(`<!doctype html><html><body>
			<a data-thinking-box-tool-call="true" href="https://sidebar.example/ignore">Sidebar source</a>
			<div data-message-id="assistant-old" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“旧回答查询”</div>
					<a data-thinking-box-tool-call="true" href="https://old.example/ignore">1. Old source</a>
				</div>
			</div>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 2 个关键词，参考 2 篇资料
					<div class="mb-8 text-sm">搜索词：“国产 GPU API”</div>
					<div class="mb-8 text-sm">Search: "AI inference pricing"</div>
					<div>
						<a data-thinking-box-tool-call="true" href="https://source-one.example/report">1. Source One</a>
						<a data-thinking-box-tool-call="true" href="http://source-two.example/article">2、Source Two</a>
					</div>
				</div>
			</div>
		</body></html>`);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		const evidence = extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence);

		expect(evidence).toEqual({
			searchUsedCount: 1,
			webQueries: ["国产 GPU API", "AI inference pricing"],
			citations: [
				{ url: "https://source-one.example/report", title: "Source One" },
				{ url: "http://source-two.example/article", title: "Source Two" },
			],
		});
	});

	test("does not append unrelated answer links when structured search evidence is enabled", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Answer with an unrelated recommendation <a href="https://recommendation.example/">Recommended site</a></p>
				<div class="css-hidden">private stale template text</div>
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">搜索词：“国产 GPU API”</div>
					<div>
						<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Search source</a>
					</div>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: doubaoContract.searchUsed,
			searchNotUsedSelector: doubaoContract.searchNotUsed,
			citationLinkSelector: doubaoContract.citationLink,
			queryItemSelector: doubaoContract.queryItem,
			searchEvidence: doubaoContract.searchEvidence,
		});

		expect(snapshot.citations).toEqual([{ url: "https://source.example/report", title: "Search source" }]);
		expect(snapshot.html).not.toContain("private stale template text");
	});

	test("returns the current prompt, answer, and bound action group union without including the sidebar", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<aside class="sidebar">Private conversation history</aside>
			<div class="content-KTJ1Rj">Current prompt</div>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Current answer</p>
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“GPU 云服务”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
			<div class="answer-actions">
				<button aria-label="朗读">Read</button>
				<button aria-label="复制">Copy</button>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
		const rectangles = new Map<string, DOMRect>([
			[".sidebar", { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 700, width: 200, height: 700 } as DOMRect],
			[
				".content-KTJ1Rj",
				{ x: 240, y: 40, left: 240, top: 40, right: 900, bottom: 80, width: 660, height: 40 } as DOMRect,
			],
			[
				'[data-message-id="assistant-current"]',
				{ x: 240, y: 90, left: 240, top: 90, right: 900, bottom: 500, width: 660, height: 410 } as DOMRect,
			],
			[
				".answer-actions",
				{ x: 240, y: 510, left: 240, top: 510, right: 900, bottom: 550, width: 660, height: 40 } as DOMRect,
			],
		]);
		for (const [selector, rectangle] of rectangles) {
			const element = document.querySelector<HTMLElement>(selector);
			if (!element) throw new Error(`Evidence fixture is missing ${selector}`);
			element.getBoundingClientRect = () => rectangle;
		}
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: doubaoContract.searchUsed,
			searchNotUsedSelector: doubaoContract.searchNotUsed,
			citationLinkSelector: doubaoContract.citationLink,
			queryItemSelector: doubaoContract.queryItem,
			searchEvidence: doubaoContract.searchEvidence,
			evidenceViewport: {
				promptSelector: doubaoContract.userMessage,
				completionSelector: doubaoContract.completion,
				companionSelector: doubaoContract.completionCompanion,
			},
		});

		const evidenceViewportRect = snapshot.evidenceViewportRect;
		if (!evidenceViewportRect) throw new Error("Evidence viewport rectangle is missing");
		expect(evidenceViewportRect).toEqual({
			x: 240,
			y: 40,
			width: 660,
			height: 510,
			devicePixelRatio: 2,
		});
		expect(evidenceViewportRect.x).toBeGreaterThanOrEqual(200);
	});

	test("rejects visual evidence when a long answer pushes the bound action group below the viewport", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="content-KTJ1Rj">Current prompt</div>
			<div data-message-id="assistant-current" class="relative grid w-full">Current long answer</div>
			<div class="answer-actions">
				<button aria-label="朗读">Read</button>
				<button aria-label="复制">Copy</button>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		Object.defineProperties(window, {
			devicePixelRatio: { configurable: true, value: 1 },
			innerHeight: { configurable: true, value: 600 },
			innerWidth: { configurable: true, value: 800 },
		});
		const rectangles = new Map<string, DOMRect>([
			[".content-KTJ1Rj", { left: 0, top: 0, right: 800, bottom: 40, width: 800, height: 40 } as DOMRect],
			[
				'[data-message-id="assistant-current"]',
				{ left: 0, top: 40, right: 800, bottom: 690, width: 800, height: 650 } as DOMRect,
			],
			[".answer-actions", { left: 0, top: 690, right: 800, bottom: 740, width: 800, height: 50 } as DOMRect],
		]);
		for (const [selector, rectangle] of rectangles) {
			const element = document.querySelector<HTMLElement>(selector);
			if (!element) throw new Error(`Long-answer evidence fixture is missing ${selector}`);
			element.getBoundingClientRect = () => rectangle;
		}
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		await expect(
			port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: doubaoContract.searchUsed,
				searchNotUsedSelector: doubaoContract.searchNotUsed,
				citationLinkSelector: doubaoContract.citationLink,
				queryItemSelector: doubaoContract.queryItem,
				searchEvidence: doubaoContract.searchEvidence,
				evidenceViewport: {
					promptSelector: doubaoContract.userMessage,
					completionSelector: doubaoContract.completion,
					companionSelector: doubaoContract.completionCompanion,
				},
			}),
		).rejects.toThrow(/completion action group is outside the visible viewport/i);
	});

	test("rejects visual evidence when only the bound action group remains in the viewport", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="content-KTJ1Rj">Current prompt</div>
			<div data-message-id="assistant-current" class="relative grid w-full">Current answer above viewport</div>
			<div class="answer-actions">
				<button aria-label="朗读">Read</button>
				<button aria-label="复制">Copy</button>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		Object.defineProperties(window, {
			devicePixelRatio: { configurable: true, value: 1 },
			innerHeight: { configurable: true, value: 600 },
			innerWidth: { configurable: true, value: 800 },
		});
		const rectangles = new Map<string, DOMRect>([
			[".content-KTJ1Rj", { left: 0, top: -760, right: 800, bottom: -720, width: 800, height: 40 } as DOMRect],
			[
				'[data-message-id="assistant-current"]',
				{ left: 0, top: -700, right: 800, bottom: -50, width: 800, height: 650 } as DOMRect,
			],
			[".answer-actions", { left: 0, top: 20, right: 800, bottom: 70, width: 800, height: 50 } as DOMRect],
		]);
		for (const [selector, rectangle] of rectangles) {
			const element = document.querySelector<HTMLElement>(selector);
			if (!element) throw new Error(`Scrolled-answer evidence fixture is missing ${selector}`);
			element.getBoundingClientRect = () => rectangle;
		}
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		await expect(
			port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: doubaoContract.searchUsed,
				searchNotUsedSelector: doubaoContract.searchNotUsed,
				citationLinkSelector: doubaoContract.citationLink,
				queryItemSelector: doubaoContract.queryItem,
				searchEvidence: doubaoContract.searchEvidence,
				evidenceViewport: {
					promptSelector: doubaoContract.userMessage,
					completionSelector: doubaoContract.completion,
					companionSelector: doubaoContract.completionCompanion,
				},
			}),
		).rejects.toThrow(/current answer is outside the visible viewport/i);
	});

	test("rejects a hidden citation instead of uploading evidence absent from the page snapshot", () => {
		const { document } = parseHTML(`<div data-message-id="assistant-current">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“visible query”</div>
				<div hidden><a data-thinking-box-tool-call="true" href="https://hidden.example/secret">1. Hidden</a></div>
			</div>
		</div>`);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		expect(() => extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence)).toThrow(
			/extracted citation count/i,
		);
	});

	test("removes text displaced out of its rendered box by a large text indent", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>
				<span class="text-indent-hidden" style="display:block;text-indent:-9999px;width:200px;height:30px">PRIVATE INDENTED TEXT</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Text-indent fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});

		expect(snapshot.text).not.toContain("PRIVATE INDENTED TEXT");
		expect(snapshot.html).not.toContain("PRIVATE INDENTED TEXT");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("keeps wrapped text when at least one text-indent range is visibly rendered", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span class="text-indent-visible-wrap" style="display:block;width:100px;text-indent:200px;overflow:visible">VISIBLE SHIFTED WORDS WRAP HERE</span>
				<span>tail</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});

		expect(snapshot.text).toContain("VISIBLE SHIFTED WORDS WRAP HERE");
		expect(snapshot.html).toContain("VISIBLE SHIFTED WORDS WRAP HERE");
	});

	test("removes vertically written text displaced beyond the viewport by text indent", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>
				<span class="text-indent-vertical-hidden" style="display:block;width:30px;height:200px;writing-mode:vertical-rl;text-indent:-9999px">VERTICAL SECRET</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});

		expect(snapshot.text).not.toContain("VERTICAL SECRET");
		expect(snapshot.html).not.toContain("VERTICAL SECRET");
	});

	test("rejects a citation whose box exists but whose visible title is displaced off-screen", () => {
		const { document, window } = parseHTML(`<div data-message-id="assistant-current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“visible query”</div>
				<a class="text-indent-hidden" style="display:block;text-indent:-9999px;width:200px;height:30px"
					data-thinking-box-tool-call="true" href="https://hidden.example/secret">1. PRIVATE HIDDEN SOURCE</a>
			</div>
		</div>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Hidden citation fixture is incomplete");

		expect(() =>
			extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence, isDomElementVisible, readVisibleDomText),
		).toThrow(/citation.*visible/i);
	});

	test("rejects a citation whose canonical URL exceeds the observation contract", () => {
		const longUrl = `https://source.example/${"a".repeat(10_000)}`;
		const { document, window } = parseHTML(`<div data-message-id="assistant-current" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“visible query”</div>
				<a data-thinking-box-tool-call="true" href="${longUrl}">1. Visible source</a>
			</div>
		</div>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Long citation URL fixture is incomplete");

		expect(() =>
			extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence, isDomElementVisible, readVisibleDomText),
		).toThrow(/citation URL.*length/i);
	});

	test.each([
		["move-only path clip", 'clip-path:path("M 0 0")'],
		["hidden 3D backface", "backface-visibility:hidden;transform:matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)"],
	] as const)("removes answer content with a provably %s", async (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>
				<div class="zero-paint-hidden" style='${style}'>PRIVATE ZERO PAINT TEXT</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const hidden = document.querySelector<HTMLElement>(".zero-paint-hidden");
		if (!answer || !hidden) throw new Error("Zero-paint fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(hidden)).toBe(false);
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).not.toContain("PRIVATE ZERO PAINT TEXT");
		expect(snapshot.html).not.toContain("PRIVATE ZERO PAINT TEXT");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("removes non-rendered comment nodes from the answer snapshot", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p><!--PRIVATE_TOOL_TOKEN=secret-->
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Comment snapshot fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});

		expect(snapshot.text).toBe("Visible answer");
		expect(snapshot.html).not.toContain("PRIVATE_TOOL_TOKEN");
		expect(snapshot.html).not.toContain("<!--");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("does not qualify an accessibility-hidden off-screen answer", () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full" aria-hidden="true"
				style="opacity:0;position:absolute;left:-9999px">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“hidden query”</div>
					<a data-thinking-box-tool-call="true" href="https://hidden.example/source">1. Hidden source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
			),
		).toEqual({ status: "no_answer", answerCount: 0, queryCount: 0, citationCount: 0 });
	});

	test.each([
		["opacity", "opacity:0"],
		["relative left", "position:relative;left:-9999px"],
		["relative right", "position:relative;right:9999px"],
		["relative top", "position:relative;top:-9999px"],
		["relative bottom", "position:relative;bottom:9999px"],
		["transform", "transform:translateX(-9999px)"],
		["translate", "translate:-9999px 0"],
		["relative percentage", "position:relative;left:-100%"],
		["transform percentage", "transform:translateX(-100%)"],
		["translate percentage", "translate:-100% 0"],
	] as const)("removes a hidden answer descendant using %s", async (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>
				<div class="css-displaced" style="${style}">private displaced text</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const displaced = document.querySelector(".css-displaced");
		if (!displaced) throw new Error("Displaced fixture element is missing");
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(displaced)).toBe(false);
		const answerQuery = await port.query("answer", doubaoContract.answer);
		expect(answerQuery[0]?.text).not.toContain("private displaced text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).not.toContain("private displaced text");
		expect(snapshot.html).not.toContain("private displaced text");
		expect(displaced.getAttribute("style")).toBe(style);
		expect(displaced.isConnected).toBe(true);
	});

	test.each([
		[
			"LTR leading horizontal inset with fixed width",
			"direction:ltr;position:relative",
			"absolute-double-inset-left-fixed",
			"position:absolute;left:-9999px;right:0;width:100px;top:0",
		],
		[
			"RTL leading horizontal inset from the containing block with fixed width",
			"direction:rtl;position:relative",
			"absolute-double-inset-right-fixed",
			"direction:ltr;position:absolute;left:0;right:9999px;width:100px;top:0",
		],
		[
			"leading vertical inset with fixed height",
			"direction:ltr;position:relative",
			"absolute-double-inset-top-fixed",
			"position:absolute;top:-9999px;bottom:0;height:20px;left:0",
		],
		[
			"proven horizontal inset despite an ambiguous vertical axis",
			"direction:ltr;position:relative",
			"absolute-axis-independent-left",
			"position:absolute;left:-9999px;top:0;bottom:0;width:100px;height:auto",
		],
	] as const)(
		"removes answer content hidden by an absolute overconstraint using the %s",
		async (_label, containingStyle, rectClass, style) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="${containingStyle}">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<p>Visible answer</p>
						<div class="typed-absolute-inset absolute-overconstraint ${rectClass}" style="${style}">private overconstrained text</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const hidden = document.querySelector<HTMLElement>(".absolute-overconstraint");
			if (!answer || !hidden) throw new Error("Absolute overconstraint fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(hidden)).toBe(false);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).not.toContain(
				"private overconstrained text",
			);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).not.toContain("private overconstrained text");
			expect(snapshot.html).not.toContain("private overconstrained text");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(hidden.getAttribute("style")).toBe(style);
			expect(hidden.isConnected).toBe(true);
		},
	);

	test.each([
		[
			"absolute stretch",
			"typed-absolute-inset known-transform-hidden",
			"position:absolute;left:0;right:0;width:auto;top:0;transform:translateX(-9999px)",
		],
		[
			"unsupported relative inset",
			"known-transform-hidden",
			"position:relative;left:calc(1px);transform:translateX(-9999px)",
		],
	] as const)(
		"removes answer content when a known transform hides content with an otherwise unknown %s position",
		async (_label, targetClass, style) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="position:relative;direction:ltr">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<p>Visible answer</p>
						<div class="known-transform-target ${targetClass}" style="${style}">private known transform text</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const hidden = document.querySelector<HTMLElement>(".known-transform-target");
			if (!answer || !hidden) throw new Error("Known transform fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(hidden)).toBe(false);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).not.toContain(
				"private known transform text",
			);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).not.toContain("private known transform text");
			expect(snapshot.html).not.toContain("private known transform text");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(hidden.getAttribute("style")).toBe(style);
			expect(hidden.isConnected).toBe(true);
		},
	);

	test.each([
		[
			"absolute stretch",
			"typed-absolute-inset benign-known-transform",
			"position:absolute;left:0;right:0;width:auto;top:0;transform:translateX(1000px)",
		],
		[
			"unsupported relative inset",
			"benign-known-transform",
			"position:relative;left:calc(1px);transform:translateX(1000px)",
		],
	] as const)(
		"keeps normally offscreen content when undoing a known transform with an unknown %s position stays offscreen",
		async (_label, targetClass, style) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="position:relative;direction:ltr">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<div class="benign-known-transform-target ${targetClass}" style="${style}">legitimate transformed text</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const control = document.querySelector<HTMLElement>(".benign-known-transform-target");
			if (!answer || !control) throw new Error("Benign known transform fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(control)).toBe(true);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).toContain("legitimate transformed text");
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).toContain("legitimate transformed text");
			expect(snapshot.html).toContain("legitimate transformed text");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(control.getAttribute("style")).toBe(style);
			expect(control.isConnected).toBe(true);
		},
	);

	test.each([
		[
			"absolute stretch container",
			"container",
			"typed-absolute-inset known-transform-hidden",
			"position:absolute;left:0;right:0;width:auto;top:0;transform:translateX(-9999px)",
			"no_search_evidence",
		],
		[
			"unsupported relative query position",
			"query",
			"known-transform-hidden",
			"position:relative;left:calc(1px);transform:translateX(-9999px)",
			"page_drift",
		],
	] as const)(
		"does not qualify search evidence hidden by a known transform with an unknown %s",
		(_label, target, targetClass, style, status) => {
			const containerAttributes = target === "container" ? `class="${targetClass}" style="${style}"` : "";
			const queryAttributes =
				target === "query" ? `class="mb-8 text-sm ${targetClass}" style="${style}"` : 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="position:relative;direction:ltr">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
							搜索 1 个关键词，参考 1 篇资料
							<div ${queryAttributes}>“private transformed query”</div>
							<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
						</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
					null,
					readVisibleDomText,
				),
			).toEqual({ status, answerCount: 1, queryCount: 0, citationCount: 0 });
		},
	);

	test.each([
		[
			"LTR fixed-width double horizontal inset",
			"container",
			"direction:ltr;position:relative",
			"absolute-double-inset-left-fixed",
			"position:absolute;left:-9999px;right:0;width:100px;top:0",
			"no_search_evidence",
		],
		[
			"RTL fixed-width double horizontal inset",
			"query",
			"direction:rtl;position:relative",
			"absolute-double-inset-right-fixed",
			"direction:ltr;position:absolute;left:0;right:9999px;width:100px;top:0",
			"page_drift",
		],
		[
			"fixed-height double vertical inset",
			"container",
			"direction:ltr;position:relative",
			"absolute-double-inset-top-fixed",
			"position:absolute;top:-9999px;bottom:0;height:20px;left:0",
			"no_search_evidence",
		],
		[
			"horizontal inset with an independently ambiguous vertical axis",
			"query",
			"direction:ltr;position:relative",
			"absolute-axis-independent-left",
			"position:absolute;left:-9999px;top:0;bottom:0;width:100px;height:auto",
			"page_drift",
		],
	] as const)(
		"does not qualify search evidence hidden by an absolute overconstraint using a %s",
		(_label, target, containingStyle, targetClass, style, status) => {
			const containerAttributes =
				target === "container" ? `class="typed-absolute-inset ${targetClass}" style="${style}"` : "";
			const queryAttributes =
				target === "query"
					? `class="mb-8 text-sm typed-absolute-inset ${targetClass}" style="${style}"`
					: 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="${containingStyle}">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
							搜索 1 个关键词，参考 1 篇资料
							<div ${queryAttributes}>“private overconstrained query”</div>
							<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
						</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
					null,
					readVisibleDomText,
				),
			).toEqual({ status, answerCount: 1, queryCount: 0, citationCount: 0 });
		},
	);

	test.each([
		[
			"LTR trailing inset loses to left",
			"direction:ltr;position:relative",
			"absolute-losing-inset-x",
			"position:absolute;left:0;right:9999px;width:100px;top:0",
		],
		[
			"RTL left inset loses to right",
			"direction:rtl;position:relative",
			"absolute-losing-inset-x",
			"direction:ltr;position:absolute;left:-9999px;right:0;width:100px;top:0",
		],
		[
			"bottom inset loses to top",
			"direction:ltr;position:relative",
			"absolute-losing-inset-y",
			"position:absolute;top:0;bottom:9999px;height:20px;left:0",
		],
		[
			"horizontal auto-size stretch",
			"direction:ltr;position:relative",
			"absolute-double-inset-left-fixed",
			"position:absolute;left:-9999px;right:0;width:auto;top:0",
		],
		[
			"vertical auto-size stretch",
			"direction:ltr;position:relative",
			"absolute-double-inset-top-fixed",
			"position:absolute;top:-9999px;bottom:0;height:auto;left:0",
		],
		[
			"unsupported computed width",
			"direction:ltr;position:relative",
			"absolute-double-inset-left-fixed",
			"position:absolute;left:-9999px;right:0;width:calc(100px);top:0",
		],
		[
			"inline containing block",
			"direction:ltr;position:relative;display:inline",
			"absolute-double-inset-left-fixed",
			"position:absolute;left:-9999px;right:0;width:100px;top:0",
		],
	] as const)(
		"keeps absolute offscreen answer content when a %s does not prove the winning displacement",
		async (_label, containingStyle, rectClass, style) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div class="absolute-containing-block" style="${containingStyle}">
					<div data-message-id="assistant-current" class="relative grid w-full">
						<div class="typed-absolute-inset absolute-overconstraint-control ${rectClass}" style="${style}">legitimate overconstraint control</div>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const control = document.querySelector<HTMLElement>(".absolute-overconstraint-control");
			if (!answer || !control) throw new Error("Absolute overconstraint control fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(control)).toBe(true);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).toContain(
				"legitimate overconstraint control",
			);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).toContain("legitimate overconstraint control");
			expect(snapshot.html).toContain("legitimate overconstraint control");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(control.getAttribute("style")).toBe(style);
			expect(control.isConnected).toBe(true);
		},
	);

	test.each([
		["mixed-axis pixel offset", "mixed-axis-displaced", "position:relative;left:-9999px"],
		["mixed-axis percentage offset", "mixed-axis-displaced", "position:relative;left:-100%"],
		["partial-view -99% offset", "fractional-x-displaced", "position:relative;left:-99%"],
		["partial-view -50% offset", "fractional-x-displaced", "position:relative;left:-50%"],
		["provable undo-crossing offset", "undo-crossing-displaced", "position:relative;top:-1000px"],
		["fixed offscreen position", "fixed-offscreen", "position:fixed;left:-9999px"],
		["absolute left inset", "typed-absolute-inset absolute-inset-left", "position:absolute;left:-9999px;top:0"],
		["absolute right inset", "typed-absolute-inset absolute-inset-right", "position:absolute;right:9999px;top:0"],
		["absolute top inset", "typed-absolute-inset absolute-inset-top", "position:absolute;top:-9999px;left:0"],
		["absolute bottom inset", "typed-absolute-inset absolute-inset-bottom", "position:absolute;bottom:9999px;left:0"],
	] as const)("removes answer content displaced outside the viewport by a %s", async (_label, rectClass, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>
				<div class="actively-displaced ${rectClass}" style="${style}">private displaced boundary text</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const displaced = document.querySelector<HTMLElement>(".actively-displaced");
		if (!answer || !displaced) throw new Error("Axis displacement fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(displaced)).toBe(false);
		expect((await port.query("answer", doubaoContract.answer))[0]?.text).not.toContain(
			"private displaced boundary text",
		);
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).not.toContain("private displaced boundary text");
		expect(snapshot.html).not.toContain("private displaced boundary text");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(displaced.getAttribute("style")).toBe(style);
		expect(displaced.isConnected).toBe(true);
	});

	test.each([
		["same-axis pixel offset", "same-axis-displaced", "position:relative;top:-9999px"],
		["same-axis percentage offset", "same-axis-displaced", "position:relative;top:-100%"],
		["root-scroll relative offset", "root-scrolled-offset", "position:relative;top:-100px"],
		["virtualized relative offset", "virtualized-relative", "position:relative;top:100px"],
		["virtualized transform", "virtualized-transform", "transform:translateY(1000px)"],
		["absolute content above the viewport", "typed-absolute-inset absolute-root-scrolled", "position:absolute;top:0"],
		[
			"absolute content with double horizontal insets",
			"typed-absolute-inset absolute-double-inset",
			"position:absolute;left:-9999px;right:0",
		],
		[
			"absolute content with auto insets",
			"typed-absolute-inset absolute-auto-inset",
			"position:absolute;left:auto;right:auto",
		],
		[
			"absolute content with a calc inset",
			"typed-absolute-inset absolute-unsupported-inset",
			"position:absolute;left:calc(-9999px)",
		],
		[
			"absolute content with a var inset",
			"typed-absolute-inset absolute-unsupported-inset",
			"position:absolute;left:var(--private-offset)",
		],
	] as const)(
		"keeps offscreen answer content when a %s is not proven to have caused it",
		async (_label, rectClass, style) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div data-message-id="assistant-current" class="relative grid w-full">
					<div class="causally-unproven ${rectClass}" style="${style}">legitimate offscreen answer text</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const offscreen = document.querySelector<HTMLElement>(".causally-unproven");
			if (!answer || !offscreen) throw new Error("Unproven displacement fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(offscreen)).toBe(true);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).toContain(
				"legitimate offscreen answer text",
			);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).toContain("legitimate offscreen answer text");
			expect(snapshot.html).toContain("legitimate offscreen answer text");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(offscreen.getAttribute("style")).toBe(style);
			expect(offscreen.isConnected).toBe(true);
		},
	);

	test.each([
		[
			"left",
			"container",
			"typed-absolute-inset absolute-inset-left",
			"position:absolute;left:-9999px;top:0",
			"no_search_evidence",
		],
		[
			"right",
			"query",
			"typed-absolute-inset absolute-inset-right",
			"position:absolute;right:9999px;top:0",
			"page_drift",
		],
		[
			"top",
			"container",
			"typed-absolute-inset absolute-inset-top",
			"position:absolute;top:-9999px;left:0",
			"no_search_evidence",
		],
		[
			"bottom",
			"query",
			"typed-absolute-inset absolute-inset-bottom",
			"position:absolute;bottom:9999px;left:0",
			"page_drift",
		],
	] as const)(
		"does not qualify search evidence hidden by an absolute %s inset",
		(_axis, target, targetClass, style, status) => {
			const containerAttributes = target === "container" ? `class="${targetClass}" style="${style}"` : "";
			const queryAttributes =
				target === "query" ? `class="mb-8 text-sm ${targetClass}" style="${style}"` : 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
					搜索 1 个关键词，参考 1 篇资料
					<div ${queryAttributes}>“private absolute query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
			installVisibleLinkedomGlobals(window);

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
					null,
					readVisibleDomText,
				),
			).toEqual({ status, answerCount: 1, queryCount: 0, citationCount: 0 });
		},
	);

	test.each([
		[
			"transform:scale(0) subtree containing a line break",
			'<span class="zero-hidden-target zero-scale-hidden" style="transform:scale(0)">private zero-box text<br></span>',
		],
		[
			"individual scale:0 subtree containing a line break",
			'<span class="zero-hidden-target zero-scale-hidden" style="scale:0">private zero-box text<br></span>',
		],
		[
			"individual scale:0 1 subtree containing a line break",
			'<span class="zero-hidden-target zero-scale-hidden" style="scale:0 1">private zero-box text<br></span>',
		],
		[
			"fully collapsed clip-path with a nonzero layout box",
			'<span class="zero-hidden-target" style="clip-path:inset(50%)">private zero-box text</span>',
		],
		[
			"fully collapsed legacy clip with a nonzero layout box",
			'<span class="zero-hidden-target legacy-fully-clipped" style="position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden">private zero-box text</span>',
		],
		[
			"zero-radius circle clip-path with a nonzero layout box",
			'<span class="zero-hidden-target" style="clip-path:circle(0)">private zero-box text</span>',
		],
		[
			"collinear polygon clip-path with a nonzero layout box",
			'<span class="zero-hidden-target" style="clip-path:polygon(0 0,0 0,0 0)">private zero-box text</span>',
		],
		[
			"zero-opacity filter with a nonzero layout box",
			'<span class="zero-hidden-target" style="filter:opacity(0)">private zero-box text</span>',
		],
		[
			"zero-opacity filter after blur with a nonzero layout box",
			'<span class="zero-hidden-target" style="filter:blur(1px) opacity(0)">private zero-box text</span>',
		],
		[
			"zero-opacity filter before blur with a nonzero layout box",
			'<span class="zero-hidden-target" style="filter:opacity(0) blur(1px)">private zero-box text</span>',
		],
		[
			"zero-radius ellipse clip-path with a nonzero layout box",
			'<span class="zero-hidden-target" style="clip-path:ellipse(0 0)">private zero-box text</span>',
		],
		[
			"fully transparent mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent radial mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent conic mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent repeating linear mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)">private zero-box text</span>',
		],
		[
			"fully transparent repeating radial mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)">private zero-box text</span>',
		],
		[
			"fully transparent repeating conic mask with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10deg)">private zero-box text</span>',
		],
		[
			"fully transparent linear mask with a direction prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:linear-gradient(to right,rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent radial mask with a geometry prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:radial-gradient(circle at center,rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent conic mask with a geometry prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:conic-gradient(from 45deg at center,rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent repeating linear mask with a direction prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-linear-gradient(to right,rgba(0,0,0,0),rgba(0,0,0,0) 10px)">private zero-box text</span>',
		],
		[
			"fully transparent repeating radial mask with a geometry prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-radial-gradient(circle at center,rgba(0,0,0,0),rgba(0,0,0,0) 10px)">private zero-box text</span>',
		],
		[
			"fully transparent repeating conic mask with a geometry prelude",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-conic-gradient(from 45deg at center,rgba(0,0,0,0),rgba(0,0,0,0) 10deg)">private zero-box text</span>',
		],
		[
			"fully transparent linear mask with interpolation and multiple color hints",
			'<span class="zero-hidden-target" style="-webkit-mask-image:linear-gradient(to right in oklab,rgba(0,0,0,0),25%,rgba(0,0,0,0),75%,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent radial mask with interpolation and a color hint",
			'<span class="zero-hidden-target" style="-webkit-mask-image:radial-gradient(circle at center in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent conic mask with interpolation and a color hint",
			'<span class="zero-hidden-target" style="-webkit-mask-image:conic-gradient(from 45deg at center in oklab,rgba(0,0,0,0),180deg,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent repeating linear mask with interpolation and a color hint",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent repeating radial mask with interpolation and a color hint",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-radial-gradient(circle at center in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent repeating conic mask with polar interpolation and a color hint",
			'<span class="zero-hidden-target" style="-webkit-mask-image:repeating-conic-gradient(from 45deg in oklch longer hue,rgba(0,0,0,0),50%,rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"fully transparent mask with modern computed colors",
			'<span class="zero-hidden-target" style="-webkit-mask-image:linear-gradient(oklab(0 0 0 / 0),color(display-p3 0 0 0 / 0))">private zero-box text</span>',
		],
		[
			"two fully transparent mask layers with a nonzero layout box",
			'<span class="zero-hidden-target" style="-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))">private zero-box text</span>',
		],
		[
			"content-visibility hidden subtree with a nonzero layout box",
			'<span class="zero-hidden-target" style="content-visibility:hidden">private zero-box text</span>',
		],
		[
			"zero-size clipped leaf",
			'<span class="zero-hidden-target zero-clipped-hidden" style="width:0;height:0;overflow:hidden">private zero-box text</span>',
		],
		[
			"zero-size clipped subtree with a nonzero child",
			'<div class="zero-hidden-target zero-clipped-hidden" style="width:0;height:0;overflow:hidden"><span>private zero-box text</span></div>',
		],
	] as const)("removes a %s from answer text and HTML", async (_label, hiddenHtml) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer</p>${hiddenHtml}
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const hidden = document.querySelector<HTMLElement>(".zero-hidden-target");
		if (!answer || !hidden) throw new Error("Zero-box hidden fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(hidden)).toBe(false);
		expect((await port.query("answer", doubaoContract.answer))[0]?.text).not.toContain("private zero-box text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).not.toContain("private zero-box text");
		expect(snapshot.html).not.toContain("private zero-box text");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(hidden.isConnected).toBe(true);
	});

	test("keeps partially painted clip, filter, mask, and content-visibility forms", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span class="partial-circle" style="clip-path:circle(25%)">visible partial circle</span>
				<span class="nonzero-ellipse" style="clip-path:ellipse(25% 50%)">visible nonzero ellipse</span>
				<span class="visible-polygon" style="clip-path:polygon(0 0,100% 0,100% 100%,0 100%)">visible polygon</span>
				<span class="partial-filter" style="filter:blur(1px) opacity(.5)">visible partial filter</span>
				<span class="partial-mask" style="-webkit-mask-image:linear-gradient(rgb(0,0,0),rgba(0,0,0,0))">visible partial mask</span>
				<span class="partial-radial-mask" style="-webkit-mask-image:radial-gradient(rgb(0,0,0),rgba(0,0,0,0))">visible partial radial mask</span>
				<span style="-webkit-mask-image:conic-gradient(rgb(0,0,0),rgba(0,0,0,0))">visible partial conic mask</span>
				<span style="-webkit-mask-image:linear-gradient(oklab(0 0 0 / .5),color(display-p3 0 0 0 / 0))">visible partial modern mask</span>
				<span style="-webkit-mask-image:repeating-linear-gradient(rgb(0,0,0),rgba(0,0,0,0) 10px)">visible repeating linear mask</span>
				<span style="-webkit-mask-image:repeating-radial-gradient(rgb(0,0,0),rgba(0,0,0,0) 10px)">visible repeating radial mask</span>
				<span style="-webkit-mask-image:repeating-conic-gradient(rgb(0,0,0),rgba(0,0,0,0) 10deg)">visible repeating conic mask</span>
				<span style="-webkit-mask-image:linear-gradient(to right in --private-space,rgba(0,0,0,0),rgba(0,0,0,0))">visible unsupported color space</span>
				<span style="-webkit-mask-image:linear-gradient(to right in oklab longer hue,rgba(0,0,0,0),rgba(0,0,0,0))">visible invalid hue method</span>
				<span style="-webkit-mask-image:linear-gradient(to right in oklab,rgb(0,0,0),50%,rgba(0,0,0,0))">visible opaque hinted gradient</span>
				<span style="-webkit-mask-image:linear-gradient(rgba(0,0,0,0),25%,50%,rgba(0,0,0,0))">visible consecutive hints</span>
				<span style="-webkit-mask-image:conic-gradient(rgba(0,0,0,0),calc(25% + 1deg),rgba(0,0,0,0))">visible unsupported hint</span>
				<span class="mixed-layer-mask" style="-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),linear-gradient(rgb(0,0,0),rgb(0,0,0))">visible mixed layer mask</span>
				<span class="visible-content" style="content-visibility:visible">visible content visibility</span>
				<span class="unsupported-clip" style="clip-path:path('M0 0H1V1Z')">visible unsupported clip</span>
				<span style="backface-visibility:hidden;transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)">visible front face</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Partial paint fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);
		const expected = [
			"visible partial circle",
			"visible nonzero ellipse",
			"visible polygon",
			"visible partial filter",
			"visible partial mask",
			"visible partial radial mask",
			"visible partial conic mask",
			"visible partial modern mask",
			"visible repeating linear mask",
			"visible repeating radial mask",
			"visible repeating conic mask",
			"visible unsupported color space",
			"visible invalid hue method",
			"visible opaque hinted gradient",
			"visible consecutive hints",
			"visible unsupported hint",
			"visible mixed layer mask",
			"visible content visibility",
			"visible unsupported clip",
			"visible front face",
		];

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		for (const value of expected) {
			expect(queryText).toContain(value);
			expect(snapshot.text).toContain(value);
			expect(snapshot.html).toContain(value);
		}
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("removes transparent direct text while preserving visible shadow, stroke, and background-clipped text", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span style="color:rgba(0,0,0,0)">private transparent color text</span>
				<span style="-webkit-text-fill-color:rgba(0,0,0,0)">private transparent fill text</span>
				<span style="color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0)">private transparent shadow text</span>
				<span style="color:oklab(0 0 0 / 0)">private modern transparent color text</span>
				<span style="-webkit-text-fill-color:oklch(0 0 0 / 0)">private modern transparent fill text</span>
				<span style="color:rgba(0,0,0,0);text-shadow:1px 1px lab(0 0 0 / 0)">private modern transparent shadow text</span>
				<span style="color:rgba(0,0,0,0);-webkit-text-stroke:1px lch(0 0 0 / 0)">private modern transparent stroke text</span>
				<span style="color:rgba(0,0,0,0);background-image:linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent linear background text</span>
				<span style="color:rgba(0,0,0,0);background-image:radial-gradient(circle at center in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent radial background text</span>
				<span style="color:rgba(0,0,0,0);background-image:conic-gradient(from 45deg in oklch longer hue,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent conic background text</span>
				<span style="color:rgba(0,0,0,0);background-image:repeating-linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent repeating linear background text</span>
				<span style="color:rgba(0,0,0,0);background-image:repeating-radial-gradient(circle in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent repeating radial background text</span>
				<span style="color:rgba(0,0,0,0);background-image:repeating-conic-gradient(from 45deg in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text">private transparent repeating conic background text</span>
				<span style="color:rgba(0,0,0,0);background-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),radial-gradient(circle,rgba(0,0,0,0),rgba(0,0,0,0));background-clip:text">private transparent multilayer background text</span>
				<span style="color:rgba(0,0,0,0);background-image:linear-gradient(oklab(0 0 0 / 0),color(display-p3 0 0 0 / 0));background-clip:text">private modern transparent background text</span>
				<span style="color:rgba(0,0,0,0);text-shadow:1px 1px rgb(0,0,0)">visible shadow text</span>
				<span style="color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0),2px 2px rgb(0,0,0)">visible mixed shadow text</span>
				<span style="-webkit-text-fill-color:rgba(0,0,0,0);-webkit-text-stroke:1px rgb(0,0,0)">visible stroke text</span>
				<span style="color:rgba(0,0,0,0);background-image:linear-gradient(red,blue);background-clip:text;-webkit-background-clip:text">visible gradient text</span>
				<span style="color:rgba(0,0,0,0);background-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),conic-gradient(rgb(0,0,0),rgba(0,0,0,0));background-clip:text">visible mixed-layer gradient text</span>
				<span style="color:oklab(0 0 0 / .5)">visible partial modern color text</span>
				<span style="color:rgba(0,0,0,0);text-shadow:1px 1px lab(0 0 0 / .5)">visible partial modern shadow text</span>
				<span style="color:rgba(0,0,0,0);-webkit-text-stroke:1px lch(0 0 0 / .5)">visible partial modern stroke text</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Transparent text fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		for (const value of [
			"private transparent color text",
			"private transparent fill text",
			"private transparent shadow text",
			"private modern transparent color text",
			"private modern transparent fill text",
			"private modern transparent shadow text",
			"private modern transparent stroke text",
			"private transparent linear background text",
			"private transparent radial background text",
			"private transparent conic background text",
			"private transparent repeating linear background text",
			"private transparent repeating radial background text",
			"private transparent repeating conic background text",
			"private transparent multilayer background text",
			"private modern transparent background text",
		]) {
			expect(queryText).not.toContain(value);
			expect(snapshot.text).not.toContain(value);
			expect(snapshot.html).not.toContain(value);
		}
		for (const value of [
			"visible shadow text",
			"visible mixed shadow text",
			"visible stroke text",
			"visible gradient text",
			"visible mixed-layer gradient text",
			"visible partial modern color text",
			"visible partial modern shadow text",
			"visible partial modern stroke text",
		]) {
			expect(queryText).toContain(value);
			expect(snapshot.text).toContain(value);
			expect(snapshot.html).toContain(value);
		}
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("pairs background image and clip layers before deciding whether transparent-fill text is painted", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span style="color:transparent;background-image:linear-gradient(transparent,transparent),linear-gradient(black,black);background-clip:text,border-box">private opaque border-box layer</span>
				<span style="color:transparent;background-image:linear-gradient(transparent,transparent),linear-gradient(black,black),linear-gradient(transparent,transparent);background-clip:text,border-box">private repeated transparent text layer</span>
				<span style="color:transparent;background-color:black;background-image:linear-gradient(transparent,transparent),linear-gradient(transparent,transparent);background-clip:text,border-box">private color clipped outside text</span>
				<span style="color:transparent;background-image:linear-gradient(transparent,transparent),linear-gradient(black,black);background-clip:text">visible repeated opaque text layer</span>
				<span style="color:transparent;background-color:black;background-image:linear-gradient(transparent,transparent),linear-gradient(transparent,transparent);background-clip:border-box,text">visible background color clipped to text</span>
				<span style="color:transparent;background-image:linear-gradient(black,black),linear-gradient(transparent,transparent);background-clip:text,border-box">visible opaque text layer</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Background layer fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		for (const value of [
			"private opaque border-box layer",
			"private repeated transparent text layer",
			"private color clipped outside text",
		]) {
			expect(queryText).not.toContain(value);
			expect(snapshot.text).not.toContain(value);
			expect(snapshot.html).not.toContain(value);
		}
		for (const value of [
			"visible repeated opaque text layer",
			"visible background color clipped to text",
			"visible opaque text layer",
		]) {
			expect(queryText).toContain(value);
			expect(snapshot.text).toContain(value);
			expect(snapshot.html).toContain(value);
		}
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test.each([
		["zero font size", "font-size:0"],
		["transparent color", "color:rgba(0,0,0,0)"],
		["modern transparent color", "color:oklab(0 0 0 / 0)"],
		["transparent text fill", "-webkit-text-fill-color:rgba(0,0,0,0)"],
		["modern transparent text fill", "-webkit-text-fill-color:oklch(0 0 0 / 0)"],
		["transparent text shadow", "color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0)"],
		["modern transparent text shadow", "color:transparent;text-shadow:1px 1px lab(0 0 0 / 0)"],
		["modern transparent text stroke", "color:transparent;-webkit-text-stroke:1px color(display-p3 0 0 0 / 0)"],
		[
			"opaque background layer clipped outside text",
			"color:transparent;background-image:linear-gradient(transparent,transparent),linear-gradient(black,black);background-clip:text,border-box",
		],
		[
			"transparent hinted linear background",
			"color:rgba(0,0,0,0);background-image:linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
		[
			"transparent hinted radial background",
			"color:rgba(0,0,0,0);background-image:radial-gradient(circle at center in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
		[
			"transparent hinted conic background",
			"color:rgba(0,0,0,0);background-image:conic-gradient(from 45deg in oklch longer hue,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
		[
			"transparent hinted repeating linear background",
			"color:rgba(0,0,0,0);background-image:repeating-linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
		[
			"transparent hinted repeating radial background",
			"color:rgba(0,0,0,0);background-image:repeating-radial-gradient(circle in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
		[
			"transparent hinted repeating conic background",
			"color:rgba(0,0,0,0);background-image:repeating-conic-gradient(from 45deg in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0));background-clip:text",
		],
	] as const)("rejects structured search extraction from a query painted with %s", async (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm" style="${style}">“private unpainted query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		await expect(
			port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: doubaoContract.searchUsed,
				searchNotUsedSelector: doubaoContract.searchNotUsed,
				citationLinkSelector: doubaoContract.citationLink,
				queryItemSelector: doubaoContract.queryItem,
				searchEvidence: doubaoContract.searchEvidence,
			}),
		).rejects.toThrow(/search evidence/i);
	});

	test.each([
		["visible shadow", "color:rgba(0,0,0,0);text-shadow:1px 1px rgb(0,0,0)"],
		["mixed visible shadow", "color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0),2px 2px rgb(0,0,0)"],
		["visible stroke", "-webkit-text-fill-color:rgba(0,0,0,0);-webkit-text-stroke:1px rgb(0,0,0)"],
		[
			"visible background-clipped gradient",
			"color:rgba(0,0,0,0);background-image:linear-gradient(red,blue);background-clip:text;-webkit-background-clip:text",
		],
	] as const)("extracts a structured query painted by a %s", async (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm" style="${style}">“visible painted query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(
			await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: doubaoContract.searchUsed,
				searchNotUsedSelector: doubaoContract.searchNotUsed,
				citationLinkSelector: doubaoContract.citationLink,
				queryItemSelector: doubaoContract.queryItem,
				searchEvidence: doubaoContract.searchEvidence,
			}),
		).toMatchObject({ webQueries: ["visible painted query"] });
	});

	test("keeps zero-box structure that contributes rendered descendants or line breaks", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Before<br>After</p>
				<div class="zero-visible-wrapper" style="width:0;height:0;overflow:visible">
					<span style="position:absolute;left:20px;top:100px">visible positioned child</span>
				</div>
				<span class="display-contents" style="display:contents">visible display contents</span>
				<span class="benign-individual-scale" style="scale:1">visible individual scale one<br></span>
				<span class="partial-clip-path" style="clip-path:inset(10%)">visible partial clip path</span>
				<span class="partial-legacy-clip" style="position:absolute;clip:rect(0px,100px,20px,0px)">visible partial legacy clip</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const wrapper = document.querySelector<HTMLElement>(".zero-visible-wrapper");
		const contents = document.querySelector<HTMLElement>(".display-contents");
		const benignScale = document.querySelector<HTMLElement>(".benign-individual-scale");
		const partialClipPath = document.querySelector<HTMLElement>(".partial-clip-path");
		const partialLegacyClip = document.querySelector<HTMLElement>(".partial-legacy-clip");
		const lineBreak = document.querySelector<HTMLBRElement>("br");
		if (!answer || !wrapper || !contents || !benignScale || !partialClipPath || !partialLegacyClip || !lineBreak)
			throw new Error("Zero-box structure fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("Before\nAfter");
		expect(queryText).toContain("visible positioned child");
		expect(queryText).toContain("visible display contents");
		expect(queryText).toContain("visible individual scale one");
		expect(queryText).toContain("visible partial clip path");
		expect(queryText).toContain("visible partial legacy clip");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("Before\nAfter");
		expect(snapshot.text).toContain("visible positioned child");
		expect(snapshot.text).toContain("visible display contents");
		expect(snapshot.text).toContain("visible individual scale one");
		expect(snapshot.text).toContain("visible partial clip path");
		expect(snapshot.text).toContain("visible partial legacy clip");
		expect(snapshot.html).toContain("visible positioned child");
		expect(snapshot.html).toContain("visible display contents");
		expect(snapshot.html).toContain("visible individual scale one");
		expect(snapshot.html).toContain("visible partial clip path");
		expect(snapshot.html).toContain("visible partial legacy clip");
		expect(snapshot.html).toContain("<br>");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(wrapper.isConnected).toBe(true);
		expect(contents.isConnected).toBe(true);
		expect(benignScale.isConnected).toBe(true);
		expect(partialClipPath.isConnected).toBe(true);
		expect(partialLegacyClip.isConnected).toBe(true);
		expect(lineBreak.isConnected).toBe(true);
	});

	test("keeps display-contents text and descendants when native visibility reports no principal box", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span class="display-contents native-hidden-contents" style="display:contents">
					visible contents own <strong>visible contents child</strong>
				</span>
				<div hidden>
					<span class="display-contents native-hidden-contents" style="display:contents">private hidden contents</span>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const contents = document.querySelector<HTMLElement>(".native-hidden-contents");
		if (!answer || !contents) throw new Error("Display-contents fixture is incomplete");
		for (const element of document.querySelectorAll<HTMLElement>(".native-hidden-contents")) {
			Object.defineProperty(element, "checkVisibility", { configurable: true, value: () => false });
		}
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(contents)).toBe(true);
		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		for (const value of ["visible contents own", "visible contents child"]) {
			expect(queryText).toContain(value);
			expect(snapshot.text).toContain(value);
			expect(snapshot.html).toContain(value);
		}
		expect(queryText).not.toContain("private hidden contents");
		expect(snapshot.text).not.toContain("private hidden contents");
		expect(snapshot.html).not.toContain("private hidden contents");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test.each([
		["search container", "container", false, "qualified"],
		["query item", "query", false, "qualified"],
		["search container under a hidden ancestor", "container", true, "no_search_evidence"],
	] as const)(
		"qualifies display-contents %s from rendered content",
		(_label, target, hiddenAncestor, expectedStatus) => {
			const wrapperStart = hiddenAncestor ? "<div hidden>" : "";
			const wrapperEnd = hiddenAncestor ? "</div>" : "";
			const containerAttributes =
				target === "container" ? 'class="display-contents native-hidden-contents" style="display:contents"' : "";
			const queryAttributes =
				target === "query"
					? 'class="mb-8 text-sm display-contents native-hidden-contents" style="display:contents"'
					: 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<p>Visible answer body</p>
				${wrapperStart}<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
					搜索 1 个关键词，参考 1 篇资料
					<div ${queryAttributes}>“visible contents query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>${wrapperEnd}
			</div>
		</body></html>`);
			installVisibleLinkedomGlobals(window);
			for (const element of document.querySelectorAll<HTMLElement>(".native-hidden-contents")) {
				Object.defineProperty(element, "checkVisibility", { configurable: true, value: () => false });
			}

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
					null,
					readVisibleDomText,
				),
			).toEqual({
				status: expectedStatus,
				answerCount: 1,
				queryCount: expectedStatus === "qualified" ? 1 : 0,
				citationCount: expectedStatus === "qualified" ? 1 : 0,
			});
		},
	);

	test("keeps direct text with a rendered range inside a zero-box overflow-visible wrapper", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span class="zero-visible-direct-text" style="display:inline-block;width:0;height:0;overflow:visible;white-space:nowrap">visible overflow direct text</span>
				<span class="display-contents range-visible-direct-text" style="display:contents">visible display contents own text</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const zeroBox = document.querySelector<HTMLElement>(".zero-visible-direct-text");
		const contents = document.querySelector<HTMLElement>(".display-contents");
		if (!answer || !zeroBox || !contents) throw new Error("Rendered direct-text fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("visible overflow direct text");
		expect(queryText).toContain("visible display contents own text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("visible overflow direct text");
		expect(snapshot.text).toContain("visible display contents own text");
		expect(snapshot.html).toContain("visible overflow direct text");
		expect(snapshot.html).toContain("visible display contents own text");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(zeroBox.isConnected).toBe(true);
		expect(contents.isConnected).toBe(true);
	});

	test("removes direct text without a rendered range even when a visible child keeps its wrapper", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<span class="zero-range-direct-text" style="font-size:0">private zero-range direct text<span style="font-size:16px">visible child</span></span>
				<span hidden>private explicitly hidden direct text</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const wrapper = document.querySelector<HTMLElement>(".zero-range-direct-text");
		if (!answer || !wrapper) throw new Error("Unrendered direct-text fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("visible child");
		expect(queryText).not.toContain("private zero-range direct text");
		expect(queryText).not.toContain("private explicitly hidden direct text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("visible child");
		expect(snapshot.text).not.toContain("private zero-range direct text");
		expect(snapshot.text).not.toContain("private explicitly hidden direct text");
		expect(snapshot.html).toContain("visible child");
		expect(snapshot.html).not.toContain("private zero-range direct text");
		expect(snapshot.html).not.toContain("private explicitly hidden direct text");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(wrapper.isConnected).toBe(true);
	});

	test("removes answer-root direct text without a rendered range while keeping a visible child", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full root-zero-range-direct-text" style="font-size:0">
				private root zero-range direct text<span style="font-size:16px">visible root child</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Unrendered root direct-text fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("visible root child");
		expect(queryText).not.toContain("private root zero-range direct text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("visible root child");
		expect(snapshot.text).not.toContain("private root zero-range direct text");
		expect(snapshot.html).toContain("visible root child");
		expect(snapshot.html).not.toContain("private root zero-range direct text");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(answer.isConnected).toBe(true);
	});

	test.each([
		["hidden shorthand on the x axis", "overflow:hidden", "overflow-clipped-x-child", "left:200px;width:300px"],
		["clip on the x axis", "overflow-x:clip;overflow-y:visible", "overflow-clipped-x-child", "left:200px;width:300px"],
		["auto on the x axis", "overflow-x:auto;overflow-y:visible", "overflow-clipped-x-child", "left:200px;width:300px"],
		[
			"scroll on the x axis",
			"overflow-x:scroll;overflow-y:visible",
			"overflow-clipped-x-child",
			"left:200px;width:300px",
		],
		[
			"overlay on the x axis",
			"overflow-x:overlay;overflow-y:visible",
			"overflow-clipped-x-child",
			"left:200px;width:300px",
		],
		[
			"hidden on the y axis",
			"overflow-x:visible;overflow-y:hidden",
			"overflow-clipped-y-child",
			"top:200px;height:300px",
		],
	] as const)(
		"removes answer content fully outside a nested overflow ancestor using %s",
		async (_label, overflowStyle, childClass, childStyle) => {
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div data-message-id="assistant-current" class="relative grid w-full">
					<p>Visible answer</p>
					<div class="nested-overflow-clip" style="position:relative;width:100px;height:100px;${overflowStyle}">
						<span class="${childClass}" style="position:absolute;${childStyle}">private overflow-clipped answer text</span>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);
			const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
			const clipped = document.querySelector<HTMLElement>(`.${childClass}`);
			if (!answer || !clipped) throw new Error("Overflow-clipped answer fixture is incomplete");
			const originalHtml = answer.innerHTML;
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

			expect(isDomElementVisible(clipped)).toBe(false);
			expect((await port.query("answer", doubaoContract.answer))[0]?.text).not.toContain(
				"private overflow-clipped answer text",
			);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).not.toContain("private overflow-clipped answer text");
			expect(snapshot.html).not.toContain("private overflow-clipped answer text");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(clipped.isConnected).toBe(true);
		},
	);

	test("removes fully clipped Text Range content but retains partial element and text intersections", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div class="nested-overflow-clip" style="position:relative;width:100px;height:100px;overflow:hidden">
					<span class="range-fully-clipped-x">private fully clipped text range</span>
					<span class="range-partially-clipped-x">visible partial text range</span>
					<span class="partially-clipped-x-child" style="position:absolute;left:80px;width:40px">visible partial element</span>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const partialElement = document.querySelector<HTMLElement>(".partially-clipped-x-child");
		if (!answer || !partialElement) throw new Error("Partial overflow intersection fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(partialElement)).toBe(true);
		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).not.toContain("private fully clipped text range");
		expect(queryText).toContain("visible partial text range");
		expect(queryText).toContain("visible partial element");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).not.toContain("private fully clipped text range");
		expect(snapshot.html).not.toContain("private fully clipped text range");
		expect(snapshot.text).toContain("visible partial text range");
		expect(snapshot.html).toContain("visible partial text range");
		expect(snapshot.text).toContain("visible partial element");
		expect(snapshot.html).toContain("visible partial element");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test("does not treat inline or display-contents elements as overflow clipping boxes", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div><span class="mb-8 text-sm inline-overflow-non-clipping" style="display:inline;overflow:hidden">“visible inline query”</span></div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
				<span class="contents-overflow-non-clipping" style="display:contents;overflow:hidden">visible display contents text</span>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const inline = document.querySelector<HTMLElement>(".inline-overflow-non-clipping");
		const contents = document.querySelector<HTMLElement>(".contents-overflow-non-clipping");
		if (!answer || !inline || !contents) throw new Error("Non-clipping overflow fixture is incomplete");
		for (const element of [inline, contents]) {
			Object.defineProperties(element, {
				clientHeight: { configurable: true, value: 0 },
				clientWidth: { configurable: true, value: 0 },
			});
		}
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(inline)).toBe(true);
		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("visible inline query");
		expect(queryText).toContain("visible display contents text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: doubaoContract.searchUsed,
			searchNotUsedSelector: doubaoContract.searchNotUsed,
			citationLinkSelector: doubaoContract.citationLink,
			queryItemSelector: doubaoContract.queryItem,
			searchEvidence: doubaoContract.searchEvidence,
		});
		expect(snapshot.text).toContain("visible inline query");
		expect(snapshot.html).toContain("visible inline query");
		expect(snapshot.text).toContain("visible display contents text");
		expect(snapshot.html).toContain("visible display contents text");
		expect(snapshot.webQueries).toEqual(["visible inline query"]);
		expect(answer.innerHTML).toBe(originalHtml);
		expect(inline.isConnected).toBe(true);
		expect(contents.isConnected).toBe(true);
	});

	test("uses one viewport coordinate system for transformed overflow clipping", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div class="scaled-overflow-clip-large" style="position:relative;width:100px;height:100px;overflow:hidden;transform:scale(2);transform-origin:0 0">
					<span class="scaled-visible-child" style="position:absolute;left:75px;width:20px">visible scaled child</span>
				</div>
				<div class="scaled-overflow-clip-small" style="position:relative;width:100px;height:100px;overflow:hidden;transform:scale(.5);transform-origin:0 0">
					<span class="scaled-hidden-child" style="position:absolute;left:120px;width:60px">private scaled child</span>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const large = document.querySelector<HTMLElement>(".scaled-overflow-clip-large");
		const small = document.querySelector<HTMLElement>(".scaled-overflow-clip-small");
		const visible = document.querySelector<HTMLElement>(".scaled-visible-child");
		const hidden = document.querySelector<HTMLElement>(".scaled-hidden-child");
		if (!answer || !large || !small || !visible || !hidden) throw new Error("Scaled overflow fixture is incomplete");
		for (const element of [large, small]) {
			Object.defineProperties(element, {
				clientHeight: { configurable: true, value: 100 },
				clientWidth: { configurable: true, value: 100 },
			});
		}
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(visible)).toBe(true);
		expect(isDomElementVisible(hidden)).toBe(false);
		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		expect(queryText).toContain("visible scaled child");
		expect(queryText).not.toContain("private scaled child");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("visible scaled child");
		expect(snapshot.html).toContain("visible scaled child");
		expect(snapshot.text).not.toContain("private scaled child");
		expect(snapshot.html).not.toContain("private scaled child");
		expect(answer.innerHTML).toBe(originalHtml);
		expect(visible.isConnected).toBe(true);
		expect(hidden.isConnected).toBe(true);
	});

	test("clips answer elements and text ranges at paint-containment ancestors", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div class="nested-overflow-clip" style="contain:paint">
					<span class="overflow-clipped-x-child">private paint-contained text</span>
				</div>
				<div class="nested-overflow-clip" style="contain:strict">
					<span class="overflow-clipped-x-child">private strict-contained text</span>
				</div>
				<div class="nested-overflow-clip" style="contain:content">
					<span class="overflow-clipped-x-child">private content-contained text</span>
				</div>
				<div class="nested-overflow-clip" style="contain:paint">
					<span class="partially-clipped-x-child">visible partially paint-contained text</span>
				</div>
				<div class="nested-overflow-clip" style="contain:size">
					<span class="overflow-clipped-x-child">visible size-contained overflow</span>
				</div>
				<div class="nested-overflow-clip" style="contain:layout">
					<span class="overflow-clipped-x-child">visible layout-contained overflow</span>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Paint-containment fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		const queryText = (await port.query("answer", doubaoContract.answer))[0]?.text ?? "";
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		for (const value of [
			"private paint-contained text",
			"private strict-contained text",
			"private content-contained text",
		]) {
			expect(queryText).not.toContain(value);
			expect(snapshot.text).not.toContain(value);
			expect(snapshot.html).not.toContain(value);
		}
		for (const value of [
			"visible partially paint-contained text",
			"visible size-contained overflow",
			"visible layout-contained overflow",
		]) {
			expect(queryText).toContain(value);
			expect(snapshot.text).toContain(value);
			expect(snapshot.html).toContain(value);
		}
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test.each([
		["paint-contained search container", "paint", "container", "overflow-clipped-x-child", "no_search_evidence"],
		["paint-contained query", "paint", "query", "overflow-clipped-x-child", "page_drift"],
		["strict-contained query", "strict", "query", "overflow-clipped-x-child", "page_drift"],
		["content-contained query", "content", "query", "overflow-clipped-x-child", "page_drift"],
		["partially paint-contained query", "paint", "query", "partially-clipped-x-child", "qualified"],
		["size-contained query", "size", "query", "overflow-clipped-x-child", "qualified"],
		["layout-contained query", "layout", "query", "overflow-clipped-x-child", "qualified"],
	] as const)("qualifies geometry for a %s", (_label, containment, target, targetClass, expectedStatus) => {
		const containerAttributes = target === "container" ? `class="${targetClass}"` : "";
		const queryAttributes = target === "query" ? `class="mb-8 text-sm ${targetClass}"` : 'class="mb-8 text-sm"';
		const { document, window } = parseHTML(`<!doctype html><html><body>
				<div data-message-id="assistant-current" class="relative grid w-full">
					<p>Visible answer body</p>
					<div class="nested-overflow-clip" style="contain:${containment}">
						<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
							搜索 1 个关键词，参考 1 篇资料
							<div ${queryAttributes}>“contained query”</div>
							<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
						</div>
					</div>
				</div>
			</body></html>`);
		installVisibleLinkedomGlobals(window);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
				null,
				readVisibleDomText,
			),
		).toEqual({
			status: expectedStatus,
			answerCount: 1,
			queryCount: expectedStatus === "qualified" ? 1 : 0,
			citationCount: expectedStatus === "qualified" ? 1 : 0,
		});
	});

	test("keeps normally scrolled answer content outside root page scrolling boxes", async () => {
		const { document, window } = parseHTML(`<!doctype html><html style="overflow:auto"><body style="overflow:scroll">
			<div data-message-id="assistant-current" class="relative grid w-full page-scrolled-answer">visible normally scrolled answer</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Normally scrolled answer fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(answer)).toBe(true);
		expect((await port.query("answer", doubaoContract.answer))[0]?.text).toContain("visible normally scrolled answer");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("visible normally scrolled answer");
		expect(snapshot.html).toContain("visible normally scrolled answer");
		expect(answer.innerHTML).toBe(originalHtml);
	});

	test.each([
		[
			"fully clipped search container",
			"container",
			"overflow-clipped-x-child",
			"left:200px;width:300px",
			"no_search_evidence",
		],
		["fully clipped query item", "query", "overflow-clipped-x-child", "left:200px;width:300px", "page_drift"],
		[
			"partially clipped search container",
			"container",
			"partially-clipped-x-child",
			"left:80px;width:40px",
			"qualified",
		],
	] as const)(
		"qualifies nested overflow geometry for a %s",
		(_label, target, targetClass, targetStyle, expectedStatus) => {
			const containerWrapperStart =
				target === "container"
					? '<div class="nested-overflow-clip" style="position:relative;width:100px;height:100px;overflow:hidden">'
					: "";
			const containerWrapperEnd = target === "container" ? "</div>" : "";
			const containerAttributes =
				target === "container" ? `class="${targetClass}" style="position:absolute;${targetStyle}"` : "";
			const queryWrapperStart =
				target === "query"
					? '<div class="nested-overflow-clip" style="position:relative;width:100px;height:100px;overflow:hidden">'
					: "";
			const queryWrapperEnd = target === "query" ? "</div>" : "";
			const queryAttributes =
				target === "query"
					? `class="mb-8 text-sm ${targetClass}" style="position:absolute;${targetStyle}"`
					: 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div data-message-id="assistant-current" class="relative grid w-full">
					${containerWrapperStart}<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
						搜索 1 个关键词，参考 1 篇资料
						${queryWrapperStart}<div ${queryAttributes}>“private clipped query”</div>${queryWrapperEnd}
						<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
					</div>${containerWrapperEnd}
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
				),
			).toEqual({
				status: expectedStatus,
				answerCount: 1,
				queryCount: expectedStatus === "qualified" ? 1 : 0,
				citationCount: expectedStatus === "qualified" ? 1 : 0,
			});
		},
	);

	test.each([
		["clip-path container", "container", "", "clip-path:inset(50%)", "no_search_evidence"],
		[
			"legacy clip container",
			"container",
			"legacy-fully-clipped",
			"position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden",
			"no_search_evidence",
		],
		["clip-path query", "query", "", "clip-path:inset(50%)", "page_drift"],
		[
			"legacy clip query",
			"query",
			"legacy-fully-clipped",
			"position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden",
			"page_drift",
		],
		["circle clip container", "container", "", "clip-path:circle(0)", "no_search_evidence"],
		["circle clip query", "query", "", "clip-path:circle(0)", "page_drift"],
		["polygon clip container", "container", "", "clip-path:polygon(0 0,0 0,0 0)", "no_search_evidence"],
		["polygon clip query", "query", "", "clip-path:polygon(0 0,0 0,0 0)", "page_drift"],
		["filter container", "container", "", "filter:opacity(0)", "no_search_evidence"],
		["filter query", "query", "", "filter:opacity(0)", "page_drift"],
		["blur then zero-opacity filter container", "container", "", "filter:blur(1px) opacity(0)", "no_search_evidence"],
		["blur then zero-opacity filter query", "query", "", "filter:blur(1px) opacity(0)", "page_drift"],
		["zero-opacity then blur filter container", "container", "", "filter:opacity(0) blur(1px)", "no_search_evidence"],
		["zero-opacity then blur filter query", "query", "", "filter:opacity(0) blur(1px)", "page_drift"],
		["zero ellipse container", "container", "", "clip-path:ellipse(0 0)", "no_search_evidence"],
		["zero ellipse query", "query", "", "clip-path:ellipse(0 0)", "page_drift"],
		[
			"transparent mask container",
			"container",
			"",
			"-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent mask query",
			"query",
			"",
			"-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent radial mask container",
			"container",
			"",
			"-webkit-mask-image:radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent radial mask query",
			"query",
			"",
			"-webkit-mask-image:radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent conic mask container",
			"container",
			"",
			"-webkit-mask-image:conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent conic mask query",
			"query",
			"",
			"-webkit-mask-image:conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent repeating linear mask container",
			"container",
			"",
			"-webkit-mask-image:repeating-linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)",
			"no_search_evidence",
		],
		[
			"transparent repeating linear mask query",
			"query",
			"",
			"-webkit-mask-image:repeating-linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)",
			"page_drift",
		],
		[
			"transparent repeating radial mask container",
			"container",
			"",
			"-webkit-mask-image:repeating-radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)",
			"no_search_evidence",
		],
		[
			"transparent repeating radial mask query",
			"query",
			"",
			"-webkit-mask-image:repeating-radial-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10px)",
			"page_drift",
		],
		[
			"transparent repeating conic mask container",
			"container",
			"",
			"-webkit-mask-image:repeating-conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10deg)",
			"no_search_evidence",
		],
		[
			"transparent repeating conic mask query",
			"query",
			"",
			"-webkit-mask-image:repeating-conic-gradient(rgba(0,0,0,0),rgba(0,0,0,0) 10deg)",
			"page_drift",
		],
		[
			"transparent linear geometry mask container",
			"container",
			"",
			"-webkit-mask-image:linear-gradient(to right,rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent linear geometry mask query",
			"query",
			"",
			"-webkit-mask-image:linear-gradient(to right,rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent radial geometry mask container",
			"container",
			"",
			"-webkit-mask-image:radial-gradient(circle at center,rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent radial geometry mask query",
			"query",
			"",
			"-webkit-mask-image:radial-gradient(circle at center,rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent conic geometry mask container",
			"container",
			"",
			"-webkit-mask-image:conic-gradient(from 45deg at center,rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent conic geometry mask query",
			"query",
			"",
			"-webkit-mask-image:conic-gradient(from 45deg at center,rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent hinted interpolated linear mask container",
			"container",
			"",
			"-webkit-mask-image:linear-gradient(to right in oklab,rgba(0,0,0,0),25%,rgba(0,0,0,0),75%,rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent hinted interpolated radial mask query",
			"query",
			"",
			"-webkit-mask-image:radial-gradient(circle at center in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent hinted polar conic mask container",
			"container",
			"",
			"-webkit-mask-image:conic-gradient(from 45deg in oklch longer hue,rgba(0,0,0,0),50%,rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent hinted repeating linear mask query",
			"query",
			"",
			"-webkit-mask-image:repeating-linear-gradient(to right in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent hinted repeating radial mask container",
			"container",
			"",
			"-webkit-mask-image:repeating-radial-gradient(circle in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"transparent hinted repeating conic mask query",
			"query",
			"",
			"-webkit-mask-image:repeating-conic-gradient(from 45deg in oklab,rgba(0,0,0,0),50%,rgba(0,0,0,0))",
			"page_drift",
		],
		[
			"transparent modern-color mask container",
			"container",
			"",
			"-webkit-mask-image:linear-gradient(oklab(0 0 0 / 0),color(display-p3 0 0 0 / 0))",
			"no_search_evidence",
		],
		[
			"two transparent mask layers container",
			"container",
			"",
			"-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"no_search_evidence",
		],
		[
			"two transparent mask layers query",
			"query",
			"",
			"-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
			"page_drift",
		],
		["content visibility container", "container", "", "content-visibility:hidden", "no_search_evidence"],
		["content visibility query", "query", "", "content-visibility:hidden", "page_drift"],
	] as const)(
		"does not qualify fully clipped search evidence using a %s",
		(_label, target, targetClass, targetStyle, expectedStatus) => {
			const containerAttributes = target === "container" ? `class="${targetClass}" style="${targetStyle}"` : "";
			const queryAttributes =
				target === "query" ? `class="mb-8 text-sm ${targetClass}" style="${targetStyle}"` : 'class="mb-8 text-sm"';
			const { document, window } = parseHTML(`<!doctype html><html><body>
				<div data-message-id="assistant-current" class="relative grid w-full">
					<div data-plugin-identifier="search_query_result_block" ${containerAttributes}>
						搜索 1 个关键词，参考 1 篇资料
						<div ${queryAttributes}>“private clipped query”</div>
						<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
					</div>
				</div>
			</body></html>`);
			installVisibleLinkedomGlobals(window);

			expect(
				inspectLatestStructuredSearchEvidence(
					document,
					doubaoContract.answer,
					doubaoContract.searchEvidence,
					isDomElementVisible,
				),
			).toEqual({ status: expectedStatus, answerCount: 1, queryCount: 0, citationCount: 0 });
		},
	);

	test.each([
		["partial circle", "clip-path:circle(25%)"],
		["nonzero ellipse", "clip-path:ellipse(25% 50%)"],
		["nondegenerate polygon", "clip-path:polygon(0 0,100% 0,100% 100%,0 100%)"],
		["partial opacity filter", "filter:blur(1px) opacity(.5)"],
		["partial mask", "-webkit-mask-image:linear-gradient(rgb(0,0,0),rgba(0,0,0,0))"],
		["partial radial mask", "-webkit-mask-image:radial-gradient(rgb(0,0,0),rgba(0,0,0,0))"],
		["partial conic mask", "-webkit-mask-image:conic-gradient(rgb(0,0,0),rgba(0,0,0,0))"],
		["partial modern-color mask", "-webkit-mask-image:linear-gradient(oklab(0 0 0 / .5),color(display-p3 0 0 0 / 0))"],
		["partial repeating linear mask", "-webkit-mask-image:repeating-linear-gradient(rgb(0,0,0),rgba(0,0,0,0) 10px)"],
		["partial repeating radial mask", "-webkit-mask-image:repeating-radial-gradient(rgb(0,0,0),rgba(0,0,0,0) 10px)"],
		["partial repeating conic mask", "-webkit-mask-image:repeating-conic-gradient(rgb(0,0,0),rgba(0,0,0,0) 10deg)"],
		[
			"unsupported gradient color space",
			"-webkit-mask-image:linear-gradient(to right in --private-space,rgba(0,0,0,0),rgba(0,0,0,0))",
		],
		[
			"invalid hue method for a rectangular color space",
			"-webkit-mask-image:linear-gradient(to right in oklab longer hue,rgba(0,0,0,0),rgba(0,0,0,0))",
		],
		[
			"opaque stop around a valid color hint",
			"-webkit-mask-image:linear-gradient(to right in oklab,rgb(0,0,0),50%,rgba(0,0,0,0))",
		],
		["consecutive color hints", "-webkit-mask-image:linear-gradient(rgba(0,0,0,0),25%,50%,rgba(0,0,0,0))"],
		[
			"mixed transparent and opaque mask layers",
			"-webkit-mask-image:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0)),linear-gradient(rgb(0,0,0),rgb(0,0,0))",
		],
		["visible content visibility", "content-visibility:visible"],
		["unsupported clip function", "clip-path:path('M0 0H1V1Z')"],
		["front-facing 3D transform", "backface-visibility:hidden;transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)"],
	] as const)("qualifies a visibly painted search container using %s", (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block" style="${style}">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“visible painted query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
			),
		).toEqual({ status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 });
	});

	test.each([
		["zero-font summary", "summary", "font-size:0", "font-size:16px"],
		["transparent-color summary", "summary", "color:rgba(0,0,0,0)", "color:rgb(0,0,0)"],
		[
			"transparent-text-fill summary",
			"summary",
			"-webkit-text-fill-color:rgba(0,0,0,0)",
			"-webkit-text-fill-color:rgb(0,0,0)",
		],
		["zero-font query", "query", "font-size:0", "font-size:16px"],
		["transparent-color query", "query", "color:rgba(0,0,0,0)", "color:rgb(0,0,0)"],
		[
			"transparent-text-fill query",
			"query",
			"-webkit-text-fill-color:rgba(0,0,0,0)",
			"-webkit-text-fill-color:rgb(0,0,0)",
		],
		[
			"transparent-shadow summary",
			"summary",
			"color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0)",
			"color:rgb(0,0,0);text-shadow:none",
		],
		[
			"transparent-shadow query",
			"query",
			"color:rgba(0,0,0,0);text-shadow:1px 1px rgba(0,0,0,0)",
			"color:rgb(0,0,0);text-shadow:none",
		],
	] as const)("does not qualify search evidence with a %s", (_label, target, hiddenStyle, visibleOverride) => {
		const containerStyle = target === "summary" ? hiddenStyle : "";
		const queryStyle = target === "query" ? hiddenStyle : visibleOverride;
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block" style="${containerStyle}">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm" style="${queryStyle}">“private unpainted query”</div>
					<a data-thinking-box-tool-call="true" style="${visibleOverride}" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const inspectWithVisibleText = inspectLatestStructuredSearchEvidence as unknown as (
			document: Document,
			answerSelector: string,
			contract: typeof doubaoContract.searchEvidence,
			isAnswerVisible: typeof isDomElementVisible,
			completionSelector: string | null,
			readVisibleText: typeof readVisibleDomText,
		) => ReturnType<typeof inspectLatestStructuredSearchEvidence>;

		expect(
			inspectWithVisibleText(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
				null,
				readVisibleDomText,
			),
		).toEqual({ status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 });
	});

	test.each([
		["visible shadow", "color:rgba(0,0,0,0);text-shadow:1px 1px rgb(0,0,0)"],
		["visible stroke", "-webkit-text-fill-color:rgba(0,0,0,0);-webkit-text-stroke:1px rgb(0,0,0)"],
		[
			"visible background-clipped gradient",
			"color:rgba(0,0,0,0);background-image:linear-gradient(red,blue);background-clip:text;-webkit-background-clip:text",
		],
	] as const)("qualifies structured query text painted by a %s", (_label, queryStyle) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm" style="${queryStyle}">“visible painted query”</div>
					<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const inspectWithVisibleText = inspectLatestStructuredSearchEvidence as unknown as (
			document: Document,
			answerSelector: string,
			contract: typeof doubaoContract.searchEvidence,
			isAnswerVisible: typeof isDomElementVisible,
			completionSelector: string | null,
			readVisibleText: typeof readVisibleDomText,
		) => ReturnType<typeof inspectLatestStructuredSearchEvidence>;

		expect(
			inspectWithVisibleText(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
				null,
				readVisibleDomText,
			),
		).toEqual({ status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 });
	});

	test("preserves rendered paragraph, list, table, line-break, and preformatted separators after pruning", async () => {
		const { document, window } = parseHTML(
			`<!doctype html><html><body><div data-message-id="assistant-current" class="relative grid w-full"><p>Alpha<span class="css-hidden"> private hidden</span></p><p>Beta<br>Gamma</p><ul><li>One</li><li>Two<span class="css-displaced" style="position:relative;left:-9999px"> private offscreen</span></li></ul><table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table><pre>line 1\n  line 2</pre></div></body></html>`,
		);
		installVisibleLinkedomGlobals(window);
		const answer = document.querySelector<HTMLElement>('[data-message-id="assistant-current"]');
		const hidden = document.querySelector<HTMLElement>(".css-hidden");
		const displaced = document.querySelector<HTMLElement>(".css-displaced");
		if (!answer || !hidden || !displaced) throw new Error("Structured answer fixture is incomplete");
		const originalHtml = answer.innerHTML;
		const innerTextDescriptor = Object.getOwnPropertyDescriptor(window.Element.prototype, "innerText");
		if (!innerTextDescriptor?.get) throw new Error("Fixture innerText getter is unavailable");
		Object.defineProperty(window.Element.prototype, "innerText", {
			...innerTextDescriptor,
			get(this: Element) {
				return this.isConnected ? innerTextDescriptor.get?.call(this) : (this.textContent ?? "");
			},
		});

		try {
			const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);
			const expectedText = "Alpha\n\nBeta\nGamma\n\nOne\nTwo\nA\tB\nC\tD\nline 1\n  line 2";

			expect((await port.query("answer", doubaoContract.answer))[0]?.text).toBe(expectedText);
			const snapshot = await port.readAnswer({
				answerSelector: doubaoContract.answer,
				answerIndex: 0,
				searchUsedSelector: null,
				searchNotUsedSelector: null,
				citationLinkSelector: null,
				queryItemSelector: null,
				searchEvidence: null,
			});
			expect(snapshot.text).toBe(expectedText);
			expect(snapshot.html).not.toContain("private hidden");
			expect(snapshot.html).not.toContain("private offscreen");
			expect(answer.innerHTML).toBe(originalHtml);
			expect(hidden.isConnected).toBe(true);
			expect(displaced.isConnected).toBe(true);
		} finally {
			Object.defineProperty(window.Element.prototype, "innerText", innerTextDescriptor);
		}
	});

	test.each([
		["no CSS displacement", ""],
		["translateZ(0)", "transform:translateZ(0)"],
		["zero translation matrix", "transform:matrix(1,0,0,1,0,0)"],
		["a one-pixel relative offset", "position:relative;top:1px"],
		["a one-pixel translate", "translate:0 1px"],
		["a large inward relative offset", "position:relative;top:9999px"],
	] as const)("keeps normal-flow answer content scrolled outside the viewport with %s", async (_label, style) => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div class="scrolled-above" style="${style}">legitimate scrolled answer text</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);
		const scrolled = document.querySelector(".scrolled-above");
		if (!scrolled) throw new Error("Scrolled fixture element is missing");
		const port = createDocumentDomPort(document, { href: "https://www.doubao.com/chat/123" } as Location);

		expect(isDomElementVisible(scrolled)).toBe(true);
		const answerQuery = await port.query("answer", doubaoContract.answer);
		expect(answerQuery[0]?.text).toContain("legitimate scrolled answer text");
		const snapshot = await port.readAnswer({
			answerSelector: doubaoContract.answer,
			answerIndex: 0,
			searchUsedSelector: null,
			searchNotUsedSelector: null,
			citationLinkSelector: null,
			queryItemSelector: null,
			searchEvidence: null,
		});
		expect(snapshot.text).toContain("legitimate scrolled answer text");
		expect(snapshot.html).toContain("legitimate scrolled answer text");
		expect(scrolled.getAttribute("style")).toBe(style);
		expect(scrolled.isConnected).toBe(true);
	});

	test("keeps a legitimate search block that is above the current viewport", () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div data-message-id="assistant-current" class="relative grid w-full">
				<div class="scrolled-above" data-plugin-identifier="search_query_result_block">
					搜索 1 个关键词，参考 1 篇资料
					<div class="mb-8 text-sm">“visible query”</div>
					<a data-thinking-box-tool-call="true" href="https://visible.example/source">1. Visible source</a>
				</div>
			</div>
		</body></html>`);
		installVisibleLinkedomGlobals(window);

		expect(
			inspectLatestStructuredSearchEvidence(
				document,
				doubaoContract.answer,
				doubaoContract.searchEvidence,
				isDomElementVisible,
			),
		).toEqual({ status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 });
	});

	test("keeps no search evidence unknown instead of inventing false", () => {
		const { document } = parseHTML('<div data-message-id="assistant-current">Answer without search</div>');
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		expect(extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence)).toEqual({
			searchUsedCount: 0,
			webQueries: [],
			citations: [],
		});
	});

	test("keeps a numeric-leading source title when it has no ordinal delimiter", () => {
		const { document } = parseHTML(`<div data-message-id="assistant-current">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“AI outlook”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/outlook">2026 AI Outlook</a>
			</div>
		</div>`);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		expect(extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence).citations[0]?.title).toBe(
			"2026 AI Outlook",
		);
	});

	test("ignores a hidden search template instead of inventing observed search", () => {
		const { document } = parseHTML(`<div data-message-id="assistant-current">Answer
			<div hidden data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 0 篇资料<div class="mb-8 text-sm">“Template query”</div>
			</div>
		</div>`);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		expect(extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence)).toEqual({
			searchUsedCount: 0,
			webQueries: [],
			citations: [],
		});
	});

	test.each([
		[
			"a zero-query placeholder",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 0 个关键词，参考 0 篇资料
			</div></div>`,
		],
		[
			"multiple search blocks",
			`<div data-message-id="assistant-current">
				<div data-plugin-identifier="search_query_result_block">搜索 1 个关键词，参考 0 篇资料<div class="mb-8 text-sm">“A”</div></div>
				<div data-plugin-identifier="search_query_result_block">搜索 1 个关键词，参考 0 篇资料<div class="mb-8 text-sm">“B”</div></div>
			</div>`,
		],
		[
			"query count mismatch",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 2 个关键词，参考 0 篇资料<div class="mb-8 text-sm">“Only one”</div>
			</div></div>`,
		],
		[
			"citation count mismatch",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 2 篇资料<div class="mb-8 text-sm">“One”</div>
				<a data-thinking-box-tool-call="true" href="https://one.example/">One</a>
			</div></div>`,
		],
		[
			"unsafe citation URL",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料<div class="mb-8 text-sm">“One”</div>
				<a data-thinking-box-tool-call="true" href="javascript:alert(1)">Unsafe</a>
			</div></div>`,
		],
		[
			"an oversized query",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 0 篇资料<div class="mb-8 text-sm">“${"q".repeat(2_001)}”</div>
			</div></div>`,
		],
		[
			"a hidden query item",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 0 篇资料<div hidden class="mb-8 text-sm">“hidden query”</div>
			</div></div>`,
		],
		[
			"duplicate normalized queries",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 2 个关键词，参考 0 篇资料
				<div class="mb-8 text-sm">“Same query”</div><div class="mb-8 text-sm">“ same   query ”</div>
			</div></div>`,
		],
		[
			"duplicate citation URLs",
			`<div data-message-id="assistant-current"><div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 2 篇资料<div class="mb-8 text-sm">“One”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">2. Duplicate</a>
			</div></div>`,
		],
	] as const)("fails closed for %s", (_label, html) => {
		const { document } = parseHTML(html);
		const answer = document.querySelector('[data-message-id="assistant-current"]');
		if (!answer) throw new Error("Fixture answer is missing");

		expect(() => extractStructuredSearchEvidence(answer, doubaoContract.searchEvidence)).toThrow(/search evidence/i);
	});
});

function installVisibleLinkedomGlobals(window: ReturnType<typeof parseHTML>["window"]): void {
	vi.stubGlobal("DOMParser", window.DOMParser);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("SVGElement", window.SVGElement);
	let rangeNode: Node | null = null;
	Object.defineProperty(window.document, "createRange", {
		configurable: true,
		value: () => ({
			selectNodeContents(node: Node) {
				rangeNode = node;
			},
			getClientRects() {
				const parent = (rangeNode as Text | null)?.parentElement;
				if (parent?.classList.contains("text-indent-hidden")) {
					return [{ width: 100, height: 20, top: 0, bottom: 20, left: -9_991, right: -9_891 }];
				}
				if (parent?.classList.contains("text-indent-visible-wrap")) {
					return [
						{ width: 56, height: 20, top: 0, bottom: 20, left: 208, right: 264 },
						{ width: 93, height: 20, top: 20, bottom: 40, left: 8, right: 101 },
					];
				}
				if (parent?.classList.contains("text-indent-vertical-hidden")) {
					return [{ width: 20, height: 100, top: -9_931, bottom: -9_831, left: 0, right: 20 }];
				}
				if (parent && inlineStyleValue(parent, "font-size") === "0") return [];
				if (
					parent?.classList.contains("zero-range-direct-text") ||
					parent?.classList.contains("root-zero-range-direct-text")
				)
					return [];
				if (parent?.classList.contains("range-fully-clipped-x")) {
					return [{ width: 300, height: 20, top: 0, bottom: 20, left: 200, right: 500 }];
				}
				if (parent?.classList.contains("range-partially-clipped-x")) {
					return [{ width: 40, height: 20, top: 0, bottom: 20, left: 80, right: 120 }];
				}
				if (parent?.classList.contains("scaled-visible-child")) {
					return [{ width: 40, height: 20, top: 0, bottom: 20, left: 150, right: 190 }];
				}
				if (parent?.classList.contains("scaled-hidden-child")) {
					return [{ width: 30, height: 10, top: 0, bottom: 10, left: 60, right: 90 }];
				}
				if (parent?.classList.contains("page-scrolled-answer")) {
					return [{ width: 100, height: 20, top: -1_000, bottom: -980, left: 0, right: 100 }];
				}
				return [{ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }];
			},
		}),
	});
	Object.defineProperty(window, "innerWidth", { value: 1_280, configurable: true });
	Object.defineProperty(window, "innerHeight", { value: 720, configurable: true });
	Object.defineProperty(window.HTMLElement.prototype, "offsetParent", {
		configurable: true,
		get: function (this: Element) {
			return this.closest(".absolute-containing-block") ?? this.closest('[data-message-id^="assistant-"]');
		},
	});
	Object.defineProperty(window.HTMLElement.prototype, "computedStyleMap", {
		configurable: true,
		value: function (this: Element) {
			return {
				get: (property: string) => ({
					toString: () => inlineStyleValue(this, property) || "auto",
				}),
			};
		},
	});
	vi.stubGlobal("getComputedStyle", (element: Element) => {
		const overflow = inlineStyleValue(element, "overflow") || "visible";
		const color = inlineStyleValue(element, "color") || "rgb(0,0,0)";
		const maskImage =
			inlineStyleValue(element, "mask-image") || inlineStyleValue(element, "-webkit-mask-image") || "none";
		const textStroke = inlineStyleValue(element, "-webkit-text-stroke");
		return {
			display:
				element.hasAttribute("hidden") || element.classList.contains("css-hidden")
					? "none"
					: inlineStyleValue(element, "display") || "block",
			visibility: "visible",
			opacity: element.getAttribute("style")?.includes("opacity:0") ? "0" : "1",
			position: inlineStyleValue(element, "position") || "static",
			direction: inlineStyleValue(element, "direction") || "ltr",
			left: inlineStyleValue(element, "left") || (element.classList.contains("typed-absolute-inset") ? "0px" : "auto"),
			right:
				inlineStyleValue(element, "right") || (element.classList.contains("typed-absolute-inset") ? "100px" : "auto"),
			top: inlineStyleValue(element, "top") || (element.classList.contains("typed-absolute-inset") ? "0px" : "auto"),
			bottom:
				inlineStyleValue(element, "bottom") || (element.classList.contains("typed-absolute-inset") ? "100px" : "auto"),
			transform: computedTransform(element),
			scale: inlineStyleValue(element, "scale") || "none",
			translate: inlineStyleValue(element, "translate") || "none",
			clipPath: inlineStyleValue(element, "clip-path") || "none",
			clip: inlineStyleValue(element, "clip") || "auto",
			contain: inlineStyleValue(element, "contain") || "none",
			contentVisibility: inlineStyleValue(element, "content-visibility") || "visible",
			filter: inlineStyleValue(element, "filter") || "none",
			maskImage,
			webkitMaskImage: maskImage,
			color,
			webkitTextFillColor: inlineStyleValue(element, "-webkit-text-fill-color") || color,
			textShadow: inlineStyleValue(element, "text-shadow") || "none",
			textIndent: inlineStyleValue(element, "text-indent") || "0px",
			writingMode: inlineStyleValue(element, "writing-mode") || "horizontal-tb",
			backfaceVisibility: inlineStyleValue(element, "backface-visibility") || "visible",
			webkitTextStrokeColor:
				inlineStyleValue(element, "-webkit-text-stroke-color") || parseWebkitTextStroke(textStroke).color || color,
			webkitTextStrokeWidth:
				inlineStyleValue(element, "-webkit-text-stroke-width") || parseWebkitTextStroke(textStroke).width || "0px",
			backgroundClip: inlineStyleValue(element, "background-clip") || "border-box",
			webkitBackgroundClip: inlineStyleValue(element, "-webkit-background-clip") || "border-box",
			backgroundImage: inlineStyleValue(element, "background-image") || "none",
			backgroundColor: inlineStyleValue(element, "background-color") || "rgba(0,0,0,0)",
			overflow,
			overflowX: inlineStyleValue(element, "overflow-x") || overflow,
			overflowY: inlineStyleValue(element, "overflow-y") || overflow,
		};
	});
	window.HTMLElement.prototype.getBoundingClientRect = function () {
		if (this.classList.contains("known-transform-hidden")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		if (this.classList.contains("benign-known-transform")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: 2_500, right: 2_600 } as DOMRect;
		}
		if (
			this.classList.contains("absolute-double-inset-left-fixed") ||
			this.classList.contains("absolute-double-inset-right-fixed") ||
			this.classList.contains("absolute-axis-independent-left")
		) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		if (this.classList.contains("absolute-double-inset-top-fixed")) {
			return { width: 100, height: 20, top: -9_999, bottom: -9_979, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("absolute-losing-inset-x")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_500, right: -9_400 } as DOMRect;
		}
		if (this.classList.contains("absolute-losing-inset-y")) {
			return { width: 100, height: 20, top: -9_500, bottom: -9_480, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("nested-overflow-clip")) {
			return { width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("overflow-clipped-x-child")) {
			return { width: 300, height: 20, top: 0, bottom: 20, left: 200, right: 500 } as DOMRect;
		}
		if (this.classList.contains("overflow-clipped-y-child")) {
			return { width: 20, height: 300, top: 200, bottom: 500, left: 0, right: 20 } as DOMRect;
		}
		if (this.classList.contains("partially-clipped-x-child")) {
			return { width: 40, height: 20, top: 0, bottom: 20, left: 80, right: 120 } as DOMRect;
		}
		if (this.classList.contains("scaled-overflow-clip-large")) {
			return { width: 200, height: 200, top: 0, bottom: 200, left: 0, right: 200 } as DOMRect;
		}
		if (this.classList.contains("scaled-overflow-clip-small")) {
			return { width: 50, height: 50, top: 0, bottom: 50, left: 0, right: 50 } as DOMRect;
		}
		if (this.classList.contains("scaled-visible-child")) {
			return { width: 40, height: 20, top: 0, bottom: 20, left: 150, right: 190 } as DOMRect;
		}
		if (this.classList.contains("scaled-hidden-child")) {
			return { width: 30, height: 10, top: 0, bottom: 10, left: 60, right: 90 } as DOMRect;
		}
		if (this.classList.contains("page-scrolled-answer")) {
			return { width: 100, height: 20, top: -1_000, bottom: -980, left: 0, right: 100 } as DOMRect;
		}
		const scaleHidden = this.closest(".zero-scale-hidden");
		if (scaleHidden) {
			const height = inlineStyleValue(scaleHidden, "scale") === "0 1" ? 20 : 0;
			return { width: 0, height, top: 20, bottom: 20 + height, left: 20, right: 20 } as DOMRect;
		}
		if (
			this.classList.contains("zero-clipped-hidden") ||
			this.classList.contains("zero-visible-wrapper") ||
			this.classList.contains("zero-visible-direct-text") ||
			this.classList.contains("zero-range-direct-text") ||
			this.classList.contains("display-contents")
		) {
			return { width: 0, height: 0, top: 20, bottom: 20, left: 20, right: 20 } as DOMRect;
		}
		if (this.classList.contains("legacy-fully-clipped")) {
			return { width: 1, height: 1, top: 20, bottom: 21, left: 20, right: 21 } as DOMRect;
		}
		if (this.tagName === "BR") {
			return { width: 0, height: 20, top: 0, bottom: 20, left: 20, right: 20 } as DOMRect;
		}
		if (this.classList.contains("mixed-axis-displaced")) {
			const left = (this.getAttribute("style") ?? "").includes("-100%") ? -100 : -9_999;
			return { width: 100, height: 20, top: -1_000, bottom: -980, left, right: left + 100 } as DOMRect;
		}
		if (this.classList.contains("same-axis-displaced")) {
			const displacement = (this.getAttribute("style") ?? "").includes("-100%") ? -20 : -9_999;
			return {
				width: 100,
				height: 20,
				top: -1_000 + displacement,
				bottom: -980 + displacement,
				left: 0,
				right: 100,
			} as DOMRect;
		}
		if (this.classList.contains("undo-crossing-displaced")) {
			return { width: 100, height: 20, top: -900, bottom: -880, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("fixed-offscreen")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		if (this.classList.contains("root-scrolled-offset")) {
			return { width: 100, height: 20, top: -1_100, bottom: -1_080, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("virtualized-relative")) {
			return { width: 100, height: 20, top: 1_000, bottom: 1_020, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("virtualized-transform")) {
			return { width: 100, height: 20, top: 1_900, bottom: 1_920, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("absolute-root-scrolled")) {
			return { width: 100, height: 20, top: -1_000, bottom: -980, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("absolute-inset-left") || this.classList.contains("absolute-inset-right")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		if (this.classList.contains("absolute-inset-top") || this.classList.contains("absolute-inset-bottom")) {
			return { width: 100, height: 20, top: -9_999, bottom: -9_979, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("absolute-double-inset") || this.classList.contains("absolute-unsupported-inset")) {
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		if (this.classList.contains("absolute-auto-inset")) {
			return { width: 100, height: 20, top: -1_000, bottom: -980, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("fractional-x-displaced")) {
			const percentage = Number((this.getAttribute("style") ?? "").match(/left:-([0-9]+)%/u)?.[1]);
			return {
				width: 100,
				height: 20,
				top: 0,
				bottom: 20,
				left: -90 - percentage,
				right: 10 - percentage,
			} as DOMRect;
		}
		if (this.classList.contains("scrolled-above")) {
			return { width: 100, height: 20, top: -100, bottom: -80, left: 0, right: 100 } as DOMRect;
		}
		if (this.classList.contains("css-displaced")) {
			const style = this.getAttribute("style") ?? "";
			if (style.includes("opacity:0")) {
				return { width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 } as DOMRect;
			}
			if (style.includes("-100%")) {
				return { width: 100, height: 20, top: 0, bottom: 20, left: -100, right: 0 } as DOMRect;
			}
			if (style.includes("top:") || style.includes("bottom:")) {
				return { width: 100, height: 20, top: -9_999, bottom: -9_979, left: 0, right: 100 } as DOMRect;
			}
			return { width: 100, height: 20, top: 0, bottom: 20, left: -9_999, right: -9_899 } as DOMRect;
		}
		return { width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 } as DOMRect;
	};
}

function inlineStyleValue(element: Element, property: string): string {
	const style = element.getAttribute("style") ?? "";
	return style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "iu"))?.[1]?.trim() ?? "";
}

function parseTopLevelWhitespace(value: string): string[] | null {
	const tokens: string[] = [];
	let tokenStart = 0;
	let depth = 0;
	let inQuotes: string | null = null;
	let escaped = false;

	for (let index = 0; index <= value.length; index += 1) {
		const char = value[index] ?? "";
		if (escaped) {
			escaped = false;
			continue;
		}
		if (char === "\\") {
			escaped = true;
			continue;
		}
		if (inQuotes === '"' || inQuotes === "'") {
			if (char === inQuotes) inQuotes = null;
			continue;
		}
		if (char === '"' || char === "'") {
			inQuotes = char;
			continue;
		}
		if (char === "(") depth += 1;
		else if (char === ")") depth = Math.max(0, depth - 1);
		else if (index === value.length || (/\s/u.test(char) && depth === 0)) {
			const token = value.slice(tokenStart, index).trim();
			if (token) tokens.push(token);
			tokenStart = index + 1;
		}
	}

	return tokens.length ? tokens : null;
}

function parseWebkitTextStroke(textStroke: string): { width: string; color: string } {
	const tokens = parseTopLevelWhitespace(textStroke);
	if (!tokens?.length) return { width: "0px", color: "currentColor" };

	const first = tokens[0] ?? "";
	const rest = tokens.slice(1);
	const hasLength =
		/^[-+]?((\d+(\.\d*)?)|(\.\d+))(px|[a-z%]+)?$/iu.test(first) && !["none", "auto"].includes(first.toLowerCase());
	return hasLength
		? { width: first || "0px", color: rest.length > 0 ? rest.join(" ") : first || "currentColor" }
		: { width: "0px", color: tokens.join(" ") };
}

function computedTransform(element: Element): string {
	const transform = inlineStyleValue(element, "transform");
	return transform === "translateX(-9999px)" ? "matrix(1,0,0,1,-9999,0)" : transform || "none";
}
