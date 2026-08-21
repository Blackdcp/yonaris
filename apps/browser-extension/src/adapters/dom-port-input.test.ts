import { parseHTML } from "linkedom";
import { describe, expect, test, vi } from "vitest";
import { createDocumentDomPort } from "./dom-port";

describe("Document DOM input", () => {
	test("uses beforeinput for Slate so the provider state enables sending", async () => {
		const { document, window } = parseHTML(`
			<div data-slate-editor="true" role="textbox" contenteditable="true">
				<p data-slate-node="element"><span data-slate-node="text"><span data-slate-leaf="true"><span data-slate-zero-width="n">﻿</span></span></span></p>
			</div>
		`);
		const composer = document.querySelector('[data-slate-editor="true"]');
		if (!(composer instanceof window.HTMLElement)) throw new Error("Slate composer fixture is missing");
		Object.defineProperty(composer, "isContentEditable", { value: true });
		const execCommand = vi.fn((_command: string, _showUi: boolean, value: string) => {
			composer.textContent = value;
			return true;
		});
		Object.defineProperty(document, "execCommand", { value: execCommand });
		let beforeInputCount = 0;
		composer.addEventListener("beforeinput", (event) => {
			beforeInputCount += 1;
			event.preventDefault();
			composer.textContent = (event as InputEvent).data;
		});
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
		vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
		vi.stubGlobal("InputEvent", window.InputEvent);
		vi.stubGlobal("Event", window.Event);

		const port = createDocumentDomPort(document, { href: "https://www.qianwen.com/" } as Location);
		await port.fill("composer", '[data-slate-editor="true"]', 0, "Prompt A");

		expect(beforeInputCount).toBe(1);
		expect(execCommand).not.toHaveBeenCalled();
		expect(composer.textContent).toBe("Prompt A");
	});

	test("uses the browser editing command so controlled contenteditable composers receive real input", async () => {
		const { document, window } = parseHTML('<div class="ql-editor" contenteditable="true"><p>old value</p></div>');
		const composer = document.querySelector(".ql-editor");
		if (!(composer instanceof window.HTMLElement)) throw new Error("composer fixture is missing");
		Object.defineProperty(composer, "isContentEditable", { value: true });
		const execCommand = vi.fn((_command: string, _showUi: boolean, value: string) => {
			composer.textContent = value;
			return true;
		});
		Object.defineProperty(document, "execCommand", { value: execCommand });
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
		vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
		vi.stubGlobal("InputEvent", window.InputEvent);
		vi.stubGlobal("Event", window.Event);

		const port = createDocumentDomPort(document, { href: "https://yuanbao.tencent.com/chat/test" } as Location);
		await port.fill("composer", ".ql-editor", 0, "Prompt A");

		expect(execCommand).toHaveBeenCalledWith("insertText", false, "Prompt A");
		expect(composer.textContent).toBe("Prompt A");
	});

	test("falls back to browser editing when a controlled editor cancels synthetic beforeinput", async () => {
		const { document, window } = parseHTML(
			'<div data-slate-editor="true" role="textbox" contenteditable="true"></div>',
		);
		const composer = document.querySelector('[data-slate-editor="true"]');
		if (!(composer instanceof window.HTMLElement)) throw new Error("Slate composer fixture is missing");
		Object.defineProperty(composer, "isContentEditable", { value: true });
		composer.addEventListener("beforeinput", (event) => event.preventDefault());
		const execCommand = vi.fn((_command: string, _showUi: boolean, value: string) => {
			composer.textContent = value;
			return true;
		});
		Object.defineProperty(document, "execCommand", { value: execCommand });
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
		vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
		vi.stubGlobal("InputEvent", window.InputEvent);
		vi.stubGlobal("Event", window.Event);

		const port = createDocumentDomPort(document, { href: "https://www.qianwen.com/" } as Location);

		await expect(port.fill("composer", '[data-slate-editor="true"]', 0, "Prompt A")).resolves.toBeUndefined();
		expect(execCommand).toHaveBeenCalledWith("insertText", false, "Prompt A");
		expect(composer.textContent).toBe("Prompt A");
	});

	test("waits for controlled editor reconciliation without dispatching a duplicate manual input", async () => {
		const { document, window } = parseHTML(
			'<div class="chat-input-editor" role="textbox" contenteditable="true"><p>old value</p></div>',
		);
		const composer = document.querySelector(".chat-input-editor");
		if (!(composer instanceof window.HTMLElement)) throw new Error("composer fixture is missing");
		Object.defineProperty(composer, "isContentEditable", { value: true });
		composer.addEventListener("beforeinput", (event) => event.preventDefault());
		composer.addEventListener("input", (event) => {
			const data = (event as InputEvent).data;
			if (data) setTimeout(() => (composer.textContent += data), 20);
		});
		const execCommand = vi.fn((_command: string, _showUi: boolean, value: string) => {
			setTimeout(() => (composer.textContent = value), 20);
			return true;
		});
		Object.defineProperty(document, "execCommand", { value: execCommand });
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
		vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
		vi.stubGlobal("InputEvent", window.InputEvent);
		vi.stubGlobal("Event", window.Event);

		const port = createDocumentDomPort(document, { href: "https://www.kimi.com/" } as Location);
		await port.fill("composer", ".chat-input-editor", 0, "Prompt A");
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(execCommand).toHaveBeenCalledWith("insertText", false, "Prompt A");
		expect(composer.textContent).toBe("Prompt A");
	});

	test("keeps a normally scrolled user message available for submitted-prompt identity checks", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="scroll-container"><div class="user-message">Prompt A</div></div>
		</body></html>`);
		Object.defineProperty(document, "scrollingElement", { value: document.documentElement, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
		Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
		Object.defineProperty(window.Element.prototype, "getBoundingClientRect", {
			configurable: true,
			value(this: Element) {
				if (this.getAttribute("class") === "user-message") {
					return { left: 100, right: 500, top: -120, bottom: -80, width: 400, height: 40 } as DOMRect;
				}
				return { left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 } as DOMRect;
			},
		});
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("SVGElement", window.SVGElement);
		vi.stubGlobal(
			"getComputedStyle",
			(element: Element) =>
				new Proxy(
					{
						display: "block",
						visibility: "visible",
						contentVisibility: "visible",
						opacity: "1",
						position: "static",
						transform: "none",
						translate: "none",
						scale: "none",
						overflowX: element.getAttribute("class") === "scroll-container" ? "hidden" : "visible",
						overflowY: element.getAttribute("class") === "scroll-container" ? "auto" : "visible",
						contain: element.getAttribute("class") === "scroll-container" ? "strict" : "none",
						direction: "ltr",
						clipPath: "none",
						clip: "auto",
						filter: "none",
						webkitMaskImage: "none",
						maskImage: "none",
						backfaceVisibility: "visible",
					},
					{ get: (target, property) => Reflect.get(target, property) ?? "" },
				) as unknown as CSSStyleDeclaration,
		);

		const port = createDocumentDomPort(document, { href: "https://chat.deepseek.com/a/chat/s/test" } as Location);

		expect(await port.query("user_message", ".user-message")).toEqual([{ text: "Prompt A", visible: true }]);
		expect(await port.query("answer", ".user-message")).toEqual([{ text: "", visible: false }]);
	});

	test("does not treat a prompt inside a zero-sized clipping ancestor as rendered", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="zero-container"><div class="user-message">Prompt A</div></div>
		</body></html>`);
		Object.defineProperty(document, "scrollingElement", { value: document.documentElement, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
		Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });
		Object.defineProperty(window.Element.prototype, "getBoundingClientRect", {
			configurable: true,
			value(this: Element) {
				if (this.getAttribute("class") === "zero-container") {
					return { left: 0, right: 400, top: 0, bottom: 0, width: 400, height: 0 } as DOMRect;
				}
				if (this.getAttribute("class") === "user-message") {
					return { left: 10, right: 390, top: 10, bottom: 50, width: 380, height: 40 } as DOMRect;
				}
				return { left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 } as DOMRect;
			},
		});
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("SVGElement", window.SVGElement);
		vi.stubGlobal(
			"getComputedStyle",
			(element: Element) =>
				new Proxy(
					{
						display: "block",
						visibility: "visible",
						contentVisibility: "visible",
						opacity: "1",
						position: "static",
						transform: "none",
						translate: "none",
						scale: "none",
						overflowX: element.getAttribute("class") === "zero-container" ? "hidden" : "visible",
						overflowY: element.getAttribute("class") === "zero-container" ? "hidden" : "visible",
						contain: "none",
						direction: "ltr",
						clipPath: "none",
						clip: "auto",
						filter: "none",
						webkitMaskImage: "none",
						maskImage: "none",
						backfaceVisibility: "visible",
					},
					{ get: (target, property) => Reflect.get(target, property) ?? "" },
				) as unknown as CSSStyleDeclaration,
		);

		const port = createDocumentDomPort(document, { href: "https://chat.deepseek.com/a/chat/s/test" } as Location);

		expect(await port.query("user_message", ".user-message")).toEqual([{ text: "Prompt A", visible: false }]);
	});
});
