import { parseHTML } from "linkedom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { BrowserExtensionSurface } from "../contracts";

type AdapterResponse = {
	ok: boolean;
	value?: {
		status?: string;
		surface?: BrowserExtensionSurface;
		pageUrlShape?: string;
		answerCount?: number;
		candidates?: Array<{ textSha256?: string }>;
	};
	error?: { code?: string; stage?: string; message?: string };
};

type MessageListener = (
	message: unknown,
	sender: unknown,
	sendResponse: (response: AdapterResponse) => void,
) => boolean | undefined;

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("Doubao content entry search-evidence inspection", () => {
	test.each([
		["another conversation", "https://www.doubao.com/chat/456"],
		["a non-conversation page", "https://www.doubao.com/"],
	] as const)("rejects SPA navigation to %s during preflight", async (_label, navigatedUrl) => {
		const harness = await installContentEntryHarness(navigatedUrl);

		const response = await harness.inspectSearchEvidence();

		expect(response).toMatchObject({ ok: false, error: { code: "page_drift", stage: "pre_submit" } });
		expect(harness.click).not.toHaveBeenCalled();
		expect(harness.document.body.innerHTML).toBe(harness.originalBodyHtml);
	});

	test("qualifies read-only evidence when the exact conversation URL remains stable", async () => {
		const harness = await installContentEntryHarness(null);

		const response = await harness.inspectSearchEvidence();

		expect(response).toMatchObject({
			ok: true,
			value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 },
		});
		expect(harness.click).not.toHaveBeenCalled();
		expect(harness.document.body.innerHTML).toBe(harness.originalBodyHtml);
	});
});

describe("domestic content entry redacted candidate inspection", () => {
	test.each([
		[
			"doubao.consumer_web",
			"https://www.doubao.com/chat/123",
			'<div data-message-id="assistant-current" class="relative grid w-full"><button>Search sources</button></div>',
		],
		[
			"deepseek.consumer_web",
			"https://chat.deepseek.com/a/chat/s/thread_123",
			'<div class="ds-assistant-message-main-content"><button>Search sources</button></div>',
		],
		[
			"qwen.consumer_web",
			"https://www.qianwen.com/chat/thread_123",
			'<div class="chat-answers-card-wrap"><div class="answer-common-card"><button>Search sources</button></div></div>',
		],
		[
			"kimi.consumer_web",
			"https://www.kimi.com/chat/thread_123",
			'<div class="chat-content-item-assistant"><div class="segment-content-box"><button>Search sources</button></div></div>',
		],
		[
			"wenxin.consumer_web",
			"https://wenxin.baidu.com/search/123456?enter_type=chat_url",
			'<div class="conversation-flow-answer-container"><div class="ai-entry"><button>Search sources</button></div></div>',
		],
		[
			"yuanbao.consumer_web",
			"https://yuanbao.tencent.com/chat/thread_123",
			'<div class="agent-chat__bubble--ai"><div class="agent-chat__speech-card__text"><button>Search sources</button></div></div>',
		],
		[
			"zhipu.consumer_web",
			"https://chatglm.cn/main/alltoolsdetail?t=1&lang=zh&cid=abcdef0123456789abcdef01",
			'<div id="row-answer-1" class="answer"><div class="answer-content-wrap"><button>Search sources</button></div></div>',
		],
	] as const)("returns a redacted report for %s", async (surface, pageUrl, answerHtml) => {
		const harness = await installCandidateProbeHarness(surface, pageUrl, answerHtml);

		const response = await harness.inspectSearchCandidates();

		expect(response).toMatchObject({ ok: true, value: { surface, answerCount: 1 } });
		expect(response.value?.candidates?.some((candidate) => /^[a-f0-9]{64}$/.test(candidate.textSha256 ?? ""))).toBe(
			true,
		);
		expect(JSON.stringify(response)).not.toContain("PRIVATE ANSWER");
		expect(harness.preflight).toHaveBeenCalledOnce();
		expect(harness.document.body.innerHTML).toBe(harness.originalBodyHtml);
	});

	test("rejects a non-conversation URL before probing", async () => {
		const harness = await installCandidateProbeHarness(
			"deepseek.consumer_web",
			"https://chat.deepseek.com/",
			'<div class="ds-assistant-message-main-content"><button>Search sources</button></div>',
		);

		const response = await harness.inspectSearchCandidates();

		expect(response).toMatchObject({ ok: false, error: { code: "page_drift", stage: "pre_submit" } });
		expect(harness.preflight).not.toHaveBeenCalled();
	});
});

async function installCandidateProbeHarness(
	surface: BrowserExtensionSurface,
	pageUrl: string,
	answerHtml: string,
): Promise<{
	document: Document;
	originalBodyHtml: string;
	preflight: ReturnType<typeof vi.fn>;
	inspectSearchCandidates: () => Promise<AdapterResponse>;
}> {
	const { document, window } = parseHTML(`<!doctype html><html><body>${answerHtml}<p>PRIVATE ANSWER</p></body></html>`);
	const pageLocation = { hostname: new URL(pageUrl).hostname, href: pageUrl };
	let listener: MessageListener | undefined;
	const preflight = vi.fn(async () => undefined);
	const actualRegistry = await vi.importActual<typeof import("../surface-registry")>("../surface-registry");
	vi.doMock("../surface-registry", () => ({
		...actualRegistry,
		extensionSurfaceForUrl(url: URL) {
			const definition = actualRegistry.extensionSurfaceForUrl(url);
			expect(definition.surface).toBe(surface);
			return {
				...definition,
				createAdapter: () => ({
					surface,
					launchUrl: definition.launchUrl,
					adapterVersion: definition.adapterVersion,
					preflight,
					openNewConversation: vi.fn(),
					prepare: vi.fn(),
					submitOnce: vi.fn(),
					confirmSubmitted: vi.fn(),
					resumeSubmitted: vi.fn(),
					collectCurrentAnswer: vi.fn(),
				}),
			};
		},
	}));

	installDomGlobals(document, window, pageLocation, (value) => {
		listener = value;
	});
	await import("./content-entry");
	if (!listener) throw new Error("Content-entry message listener was not registered");
	const originalBodyHtml = document.body.innerHTML;
	return {
		document: document as unknown as Document,
		originalBodyHtml,
		preflight,
		inspectSearchCandidates: () =>
			new Promise<AdapterResponse>((resolve, reject) => {
				const keepAlive = listener?.({ kind: "yonaris_adapter", action: "inspect_search_candidates" }, {}, resolve);
				if (keepAlive !== true) reject(new Error("Content-entry listener did not keep the response channel alive"));
			}),
	};
}

function installDomGlobals(
	document: Document,
	window: ReturnType<typeof parseHTML>["window"],
	pageLocation: { hostname: string; href: string },
	setListener: (listener: MessageListener) => void,
): void {
	vi.stubGlobal("document", document);
	vi.stubGlobal("location", pageLocation);
	vi.stubGlobal("DOMParser", window.DOMParser);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("SVGElement", window.SVGElement);
	vi.stubGlobal("crypto", {
		subtle: { digest: async () => new Uint8Array(32).buffer },
	});
	vi.stubGlobal("chrome", {
		runtime: { onMessage: { addListener: setListener } },
	});
	vi.stubGlobal("getComputedStyle", () => ({
		display: "block",
		visibility: "visible",
		contentVisibility: "visible",
		opacity: "1",
		position: "static",
		left: "auto",
		right: "auto",
		top: "auto",
		bottom: "auto",
		direction: "ltr",
		transform: "none",
		scale: "none",
		translate: "none",
		clipPath: "none",
		clip: "auto",
		filter: "none",
		maskImage: "none",
		webkitMaskImage: "none",
		color: "rgb(0, 0, 0)",
		webkitTextFillColor: "rgb(0, 0, 0)",
		textShadow: "none",
		webkitTextStrokeColor: "rgb(0, 0, 0)",
		webkitTextStrokeWidth: "0px",
		backgroundClip: "border-box",
		webkitBackgroundClip: "border-box",
		backgroundImage: "none",
		backgroundColor: "rgba(0, 0, 0, 0)",
		overflow: "visible",
		overflowX: "visible",
		overflowY: "visible",
	}));
	window.HTMLElement.prototype.getBoundingClientRect = () =>
		({ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }) as DOMRect;
}

async function installContentEntryHarness(navigatedUrl: string | null): Promise<{
	document: Document;
	originalBodyHtml: string;
	click: ReturnType<typeof vi.fn>;
	inspectSearchEvidence: () => Promise<AdapterResponse>;
}> {
	const { document, window } = parseHTML(`<!doctype html><html><body>
		<div id="flow_chat_sidebar"><button class="nav-link-IkIer0">新对话</button></div>
		<div class="tiptap ProseMirror" contenteditable="true" role="textbox"></div>
		<div data-message-id="assistant-current" class="relative grid w-full">
			<p>Visible answer body</p>
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“visible query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<div class="answer-actions">
			<button>复制</button>
			<button aria-label="朗读">朗读</button>
		</div>
	</body></html>`);
	const pageLocation = { hostname: "www.doubao.com", href: "https://www.doubao.com/chat/123" };
	let listener: MessageListener | undefined;
	let navigationQueued = false;
	const click = vi.fn();

	vi.stubGlobal("document", document);
	vi.stubGlobal("location", pageLocation);
	vi.stubGlobal("DOMParser", window.DOMParser);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("SVGElement", window.SVGElement);
	vi.stubGlobal("chrome", {
		runtime: {
			onMessage: {
				addListener(value: MessageListener) {
					listener = value;
				},
			},
		},
	});
	vi.stubGlobal("getComputedStyle", () => ({
		display: "block",
		visibility: "visible",
		contentVisibility: "visible",
		opacity: "1",
		position: "static",
		left: "auto",
		right: "auto",
		top: "auto",
		bottom: "auto",
		direction: "ltr",
		transform: "none",
		scale: "none",
		translate: "none",
		clipPath: "none",
		clip: "auto",
		filter: "none",
		maskImage: "none",
		webkitMaskImage: "none",
		color: "rgb(0, 0, 0)",
		webkitTextFillColor: "rgb(0, 0, 0)",
		textShadow: "none",
		webkitTextStrokeColor: "rgb(0, 0, 0)",
		webkitTextStrokeWidth: "0px",
		backgroundClip: "border-box",
		webkitBackgroundClip: "border-box",
		backgroundImage: "none",
		backgroundColor: "rgba(0, 0, 0, 0)",
		overflow: "visible",
		overflowX: "visible",
		overflowY: "visible",
	}));
	Object.defineProperty(document, "createRange", {
		configurable: true,
		value: () => ({
			selectNodeContents() {},
			getClientRects: () => [{ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }],
		}),
	});
	Object.defineProperty(window.HTMLElement.prototype, "click", { configurable: true, value: click });
	window.HTMLElement.prototype.getBoundingClientRect = function () {
		if (this.matches("#flow_chat_sidebar .nav-link-IkIer0") && navigatedUrl && !navigationQueued) {
			navigationQueued = true;
			queueMicrotask(() => {
				pageLocation.href = navigatedUrl;
			});
		}
		return { width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 } as DOMRect;
	};

	await import("./content-entry");
	if (!listener) throw new Error("Content-entry message listener was not registered");
	const originalBodyHtml = document.body.innerHTML;
	return {
		document: document as unknown as Document,
		originalBodyHtml,
		click,
		inspectSearchEvidence: () =>
			new Promise<AdapterResponse>((resolve, reject) => {
				const keepAlive = listener?.({ kind: "yonaris_adapter", action: "inspect_search_evidence" }, {}, resolve);
				if (keepAlive !== true) reject(new Error("Content-entry listener did not keep the response channel alive"));
			}),
	};
}
