import type {
	AnswerDomSnapshot,
	AnswerReadRequest,
	ConsumerDomPort,
	DomElementRole,
	DomElementSummary,
} from "./contracts";

export const ANSWER_HTML_MAX_BYTES = 1024 * 1024;

type HtmlParser = (html: string) => Document;

const REMOVE_NODES =
	"script,style,link,form,input,textarea,button,select,option,iframe,object,embed,canvas,noscript,svg,math,audio,video,source,track";
const SAFE_ATTRIBUTES = new Set([
	"class",
	"colspan",
	"href",
	"open",
	"rel",
	"rowspan",
	"scope",
	"start",
	"title",
	"type",
]);

export function sanitizeAnswerHtml(
	html: string,
	parse: HtmlParser = (value) => new DOMParser().parseFromString(value, "text/html"),
): string {
	if (!html.trim()) throw new Error("Answer HTML is empty");
	const document = parse(`<!doctype html><html><body>${html}</body></html>`);
	const root = document.body.firstElementChild;
	if (!root || document.body.children.length !== 1)
		throw new Error("Answer HTML must contain exactly one root element");
	if (root.matches(REMOVE_NODES)) throw new Error("Answer HTML root is not safe snapshot content");
	for (const node of root.querySelectorAll(REMOVE_NODES)) node.remove();
	for (const element of [root, ...root.querySelectorAll("*")]) {
		for (const attribute of [...element.attributes]) {
			const name = attribute.name.toLowerCase();
			if (
				!SAFE_ATTRIBUTES.has(name) ||
				name.startsWith("on") ||
				name === "style" ||
				(name === "href" && element.tagName.toLowerCase() !== "a")
			) {
				element.removeAttribute(attribute.name);
			}
		}
		if (element.tagName.toLowerCase() === "a") {
			const href = element.getAttribute("href");
			if (!href || !isSafeHttpUrl(href)) element.removeAttribute("href");
			else element.setAttribute("rel", "noopener noreferrer");
		}
	}
	const sanitized = root.outerHTML;
	if (new TextEncoder().encode(sanitized).byteLength > ANSWER_HTML_MAX_BYTES) {
		throw new Error("Answer HTML is too large");
	}
	return sanitized;
}

export function createDocumentDomPort(document: Document, location: Location): ConsumerDomPort {
	return new DocumentDomPort(document, location);
}

class DocumentDomPort implements ConsumerDomPort {
	readonly #document: Document;
	readonly #location: Location;

	constructor(document: Document, location: Location) {
		this.#document = document;
		this.#location = location;
	}

	currentUrl(): string {
		return this.#location.href;
	}

	now(): number {
		return Date.now();
	}

	async query(_role: DomElementRole, selector: string): Promise<readonly DomElementSummary[]> {
		return this.#select(selector).map((element) => ({
			text: visibleText(element),
			visible: isVisible(element),
		}));
	}

	async click(_role: DomElementRole, selector: string, index: number): Promise<void> {
		const element = this.#at(selector, index);
		if (!(element instanceof HTMLElement)) throw new Error("Selected action is not an HTML element");
		element.click();
	}

	async fill(_role: "composer", selector: string, index: number, value: string): Promise<void> {
		const element = this.#at(selector, index);
		if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
			element.focus();
			setNativeValue(element, value);
			element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
			element.dispatchEvent(new Event("change", { bubbles: true }));
			return;
		}
		if (element instanceof HTMLElement && element.isContentEditable) {
			element.focus();
			element.textContent = value;
			element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
			return;
		}
		throw new Error("Selected composer is not editable");
	}

	async readAnswer(request: AnswerReadRequest): Promise<AnswerDomSnapshot> {
		const answer = this.#at(request.answerSelector, request.answerIndex);
		return {
			text: visibleText(answer),
			html: sanitizeAnswerHtml(answer.outerHTML),
			searchUsedCount: scopedVisibleCount(answer, request.searchUsedSelector),
			searchNotUsedCount: scopedVisibleCount(answer, request.searchNotUsedSelector),
			webQueries: request.queryItemSelector
				? this.#selectWithin(answer, request.queryItemSelector).filter(isVisible).map(visibleText)
				: [],
			citations: request.citationLinkSelector
				? this.#selectWithin(answer, request.citationLinkSelector)
						.filter(
							(element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement && isVisible(element),
						)
						.map((anchor) => ({
							url: anchor.href,
							title: anchor.getAttribute("title")?.trim() || visibleText(anchor) || new URL(anchor.href).hostname,
						}))
				: [],
		};
	}

	async wait(milliseconds: number): Promise<void> {
		await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
	}

	#select(selector: string): Element[] {
		try {
			return [...this.#document.querySelectorAll(selector)];
		} catch {
			throw new Error("Approved selector is no longer valid CSS");
		}
	}

	#selectWithin(root: Element, selector: string): Element[] {
		try {
			return [...root.querySelectorAll(selector)];
		} catch {
			throw new Error("Approved scoped selector is no longer valid CSS");
		}
	}

	#at(selector: string, index: number): Element {
		const element = this.#select(selector)[index];
		if (!element) throw new Error("Approved element disappeared");
		return element;
	}
}

function scopedVisibleCount(root: Element, selector: string | null): number {
	if (!selector) return 0;
	try {
		return [...root.querySelectorAll(selector)].filter(isVisible).length;
	} catch {
		throw new Error("Approved scoped selector is no longer valid CSS");
	}
}

function isVisible(element: Element): boolean {
	if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return false;
	const style = getComputedStyle(element);
	const rect = element.getBoundingClientRect();
	return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function visibleText(element: Element): string {
	return (element instanceof HTMLElement ? element.innerText : (element.textContent ?? "")).trim();
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
	if (!setter) throw new Error("Composer value setter is unavailable");
	setter.call(element, value);
}

function isSafeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
	} catch {
		return false;
	}
}
