import { parseHTML } from "linkedom";
import { describe, expect, test, vi } from "vitest";
import { createDocumentDomPort } from "./dom-port";

describe("Document DOM input", () => {
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
});
