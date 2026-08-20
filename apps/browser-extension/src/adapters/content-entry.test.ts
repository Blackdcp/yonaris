import { parseHTML } from "linkedom";
import { afterEach, describe, expect, test, vi } from "vitest";

type AdapterResponse = {
	ok: boolean;
	value?: { status?: string };
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
			<button aria-label="朗读">朗读</button>
			<button aria-label="复制">复制</button>
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
