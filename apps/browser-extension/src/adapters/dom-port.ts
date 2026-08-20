import type {
	AnswerDomSnapshot,
	AnswerReadRequest,
	CompletionDomState,
	CompletionReadRequest,
	ConsumerDomPort,
	DomElementRole,
	DomElementSummary,
	EvidenceViewportRect,
	SearchEvidenceContract,
} from "./contracts";
import {
	extractStructuredSearchEvidence,
	inspectAnswerCompletionState,
	type StructuredSearchEvidence,
} from "./search-evidence";

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
const SNAPSHOT_LINE_BREAK_ELEMENTS = new Set([
	"ADDRESS",
	"ARTICLE",
	"ASIDE",
	"BLOCKQUOTE",
	"CAPTION",
	"DD",
	"DETAILS",
	"DIALOG",
	"DIV",
	"DL",
	"DT",
	"FIELDSET",
	"FIGCAPTION",
	"FIGURE",
	"FOOTER",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HEADER",
	"HGROUP",
	"LI",
	"MAIN",
	"MENU",
	"NAV",
	"OL",
	"PRE",
	"SECTION",
	"SUMMARY",
	"TABLE",
	"UL",
]);
const SNAPSHOT_TABLE_CELLS = new Set(["TD", "TH"]);
const CLIPPING_OVERFLOW_VALUES = new Set(["auto", "clip", "hidden", "overlay", "scroll"]);
const ZERO_ALPHA_PRESERVING_FILTER_FUNCTIONS = new Set([
	"blur",
	"brightness",
	"contrast",
	"drop-shadow",
	"grayscale",
	"hue-rotate",
	"invert",
	"opacity",
	"saturate",
	"sepia",
]);
const SUPPORTED_GRADIENT_FUNCTIONS = new Set([
	"linear-gradient",
	"radial-gradient",
	"conic-gradient",
	"repeating-linear-gradient",
	"repeating-radial-gradient",
	"repeating-conic-gradient",
]);
const RADIAL_EXTENT_KEYWORDS = new Set(["closest-side", "closest-corner", "farthest-side", "farthest-corner"]);
const RECTANGULAR_GRADIENT_COLOR_SPACES = new Set([
	"srgb",
	"srgb-linear",
	"display-p3",
	"a98-rgb",
	"prophoto-rgb",
	"rec2020",
	"lab",
	"oklab",
	"xyz",
	"xyz-d50",
	"xyz-d65",
]);
const POLAR_GRADIENT_COLOR_SPACES = new Set(["hsl", "hwb", "lch", "oklch"]);
const GRADIENT_HUE_INTERPOLATION_METHODS = new Set(["shorter", "longer", "increasing", "decreasing"]);
const FUNCTIONAL_COLOR_SPACES = new Set([
	"srgb",
	"srgb-linear",
	"display-p3",
	"a98-rgb",
	"prophoto-rgb",
	"rec2020",
	"xyz",
	"xyz-d50",
	"xyz-d65",
]);
const COLOR_PROBE_CACHE_LIMIT = 256;
type ComputedColorResult = { recognized: boolean; transparent: boolean };
type ColorProbeState = { context: CanvasRenderingContext2D; cache: Map<string, ComputedColorResult> };
const COLOR_PROBES = new WeakMap<Document, ColorProbeState>();

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
	if (isExplicitlyHiddenSnapshotElement(root)) throw new Error("Answer HTML root is hidden");
	removeNonRenderedSnapshotNodes(root);
	for (const element of [...root.querySelectorAll("*")]) {
		if (isExplicitlyHiddenSnapshotElement(element)) element.remove();
	}
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

	async query(role: DomElementRole, selector: string): Promise<readonly DomElementSummary[]> {
		return this.#select(selector).map((element) => {
			const visible = isDomElementVisible(element);
			return {
				text: role === "answer" ? (visible ? snapshotVisibleAnswer(element).text : "") : visibleText(element),
				visible,
			};
		});
	}

	async readCompletionState(request: CompletionReadRequest): Promise<CompletionDomState> {
		const answer = this.#select(request.answerSelector).filter(isDomElementVisible).at(-1);
		if (!answer) return "missing";
		return inspectAnswerCompletionState(
			answer,
			request.completionSelector,
			request.companionSelector,
			isDomElementVisible,
		);
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
		const structuredSearch = await readStructuredSearchEvidence(answer, request.searchEvidence);
		const answerSnapshot = snapshotVisibleAnswer(answer);
		return {
			text: answerSnapshot.text,
			html: sanitizeAnswerHtml(answerSnapshot.html),
			evidenceViewportRect: readEvidenceViewportRect(this.#document, answer, request),
			searchUsedCount: structuredSearch.searchUsedCount || scopedVisibleCount(answer, request.searchUsedSelector),
			searchNotUsedCount: scopedVisibleCount(answer, request.searchNotUsedSelector),
			webQueries: request.searchEvidence
				? structuredSearch.webQueries
				: request.queryItemSelector
					? this.#selectWithin(answer, request.queryItemSelector).filter(isDomElementVisible).map(visibleText)
					: [],
			citations: [
				...structuredSearch.citations,
				...(!request.searchEvidence && request.citationLinkSelector
					? this.#selectWithin(answer, request.citationLinkSelector)
							.filter(
								(element): element is HTMLAnchorElement =>
									element instanceof HTMLAnchorElement && isDomElementVisible(element),
							)
							.map((anchor) => ({
								url: anchor.href,
								title: anchor.getAttribute("title")?.trim() || visibleText(anchor) || new URL(anchor.href).hostname,
							}))
					: []),
			],
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

function readEvidenceViewportRect(
	document: Document,
	answer: Element,
	request: AnswerReadRequest,
): EvidenceViewportRect | null {
	if (!request.evidenceViewport) return null;
	const prompts = [...document.querySelectorAll(request.evidenceViewport.promptSelector)].filter(isDomElementVisible);
	if (prompts.length !== 1) throw new Error("Current prompt is missing or ambiguous for visual evidence");
	const elements = [prompts[0] as Element, answer];
	const { completionSelector, companionSelector } = request.evidenceViewport;
	if (Boolean(completionSelector) !== Boolean(companionSelector)) {
		throw new Error("Visual evidence completion selectors are incomplete");
	}
	if (completionSelector && companionSelector) {
		if (inspectAnswerCompletionState(answer, completionSelector, companionSelector, isDomElementVisible) !== "bound") {
			throw new Error("Current completion controls are not bound for visual evidence");
		}
		const actionGroup = answer.nextElementSibling;
		if (!actionGroup) throw new Error("Current completion action group disappeared");
		elements.push(actionGroup);
	}
	const rects = elements.map((element) => element.getBoundingClientRect());
	for (const rect of rects) {
		if (
			![rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite) ||
			rect.width <= 0 ||
			rect.height <= 0 ||
			rect.right <= rect.left ||
			rect.bottom <= rect.top
		) {
			throw new Error("Current evidence region has invalid geometry");
		}
	}
	const viewport = viewportSize(answer);
	if (viewport.width === null || viewport.height === null) {
		throw new Error("Current evidence viewport has invalid geometry");
	}
	const answerRect = rects[1];
	if (!answerRect || !hasPositiveViewportIntersection(answerRect, viewport)) {
		throw new Error("Current answer is outside the visible viewport");
	}
	const actionGroupRect = rects[2];
	if (actionGroupRect && !hasPositiveViewportIntersection(actionGroupRect, viewport)) {
		throw new Error("Current completion action group is outside the visible viewport");
	}
	const left = Math.min(...rects.map((rect) => rect.left));
	const top = Math.min(...rects.map((rect) => rect.top));
	const right = Math.max(...rects.map((rect) => rect.right));
	const bottom = Math.max(...rects.map((rect) => rect.bottom));
	const devicePixelRatio = document.defaultView?.devicePixelRatio;
	if (!Number.isFinite(devicePixelRatio) || !devicePixelRatio || devicePixelRatio <= 0) {
		throw new Error("Current evidence device pixel ratio is invalid");
	}
	return { x: left, y: top, width: right - left, height: bottom - top, devicePixelRatio };
}

function scopedVisibleCount(root: Element, selector: string | null): number {
	if (!selector) return 0;
	try {
		return [...root.querySelectorAll(selector)].filter(isDomElementVisible).length;
	} catch {
		throw new Error("Approved scoped selector is no longer valid CSS");
	}
}

export function isDomElementVisible(element: Element): boolean {
	if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) return false;
	if (!isComposedElementRendered(element)) return false;
	if (getComputedStyle(element).display === "contents") return hasRenderedDisplayContents(element);
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0 && hasPositiveEffectiveIntersection(rect, element.parentElement);
}

export function isSearchEvidenceElementVisible(element: Element): boolean {
	return withTemporarilyRevealedSearchElement(element, () => isDomElementVisible(element));
}

function isComposedElementRendered(element: Element): boolean {
	let current: Element | null = element;
	while (current) {
		if (
			current.hasAttribute("hidden") ||
			current.hasAttribute("inert") ||
			current.getAttribute("aria-hidden")?.trim().toLocaleLowerCase("en-US") === "true"
		) {
			return false;
		}
		const style = getComputedStyle(current);
		if (
			style.display === "none" ||
			style.visibility === "hidden" ||
			style.visibility === "collapse" ||
			style.contentVisibility === "hidden" ||
			Number.parseFloat(style.opacity || "1") <= 0
		) {
			return false;
		}
		if (style.display !== "contents") {
			if (!passesNativeVisibilityCheck(current)) return false;
			if (isFullyClippedByComputedStyle(current, style)) return false;
			if (isActivelyDisplacedOutsideViewport(current, style)) return false;
		}
		current = current.parentElement;
	}
	return true;
}

function passesNativeVisibilityCheck(element: Element): boolean {
	const checkVisibility = (
		element as Element & {
			checkVisibility?: (options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
		}
	).checkVisibility;
	if (typeof checkVisibility !== "function") return true;
	try {
		return checkVisibility.call(element, { checkOpacity: true, checkVisibilityCSS: true }) !== false;
	} catch {
		return true;
	}
}

type RectEdges = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

type ViewportSize = {
	width: number | null;
	height: number | null;
};

type Displacement = {
	x: number | null;
	y: number | null;
};

function isActivelyDisplacedOutsideViewport(element: Element, style: CSSStyleDeclaration): boolean {
	const rect = element.getBoundingClientRect();
	const viewport = viewportSize(element);
	if (!isRectOutsideViewport(rect, viewport)) return false;
	if (style.position === "fixed") return true;
	const displacement = cssDisplacement(element, style, rect);
	if ((displacement.x === null || displacement.x === 0) && (displacement.y === null || displacement.y === 0))
		return false;
	return (
		isAxisActivelyDisplacedOutsideViewport(rect.left, rect.right, viewport.width, displacement.x) ||
		isAxisActivelyDisplacedOutsideViewport(rect.top, rect.bottom, viewport.height, displacement.y)
	);
}

function isAxisActivelyDisplacedOutsideViewport(
	start: number,
	end: number,
	viewportExtent: number | null,
	displacement: number | null,
): boolean {
	if (displacement === null || displacement === 0 || !isRangeOutsideViewport(start, end, viewportExtent)) return false;
	return !isRangeOutsideViewport(start - displacement, end - displacement, viewportExtent);
}

function cssDisplacement(element: Element, style: CSSStyleDeclaration, rect: DOMRect): Displacement {
	const positioned = positionedDisplacement(element, style, rect);
	const transform = transformDisplacement(style.transform, rect);
	const translate = translateDisplacement(style.translate, rect);
	return {
		x: sumKnownDisplacement(positioned.x, transform?.x ?? null, translate?.x ?? null),
		y: sumKnownDisplacement(positioned.y, transform?.y ?? null, translate?.y ?? null),
	};
}

function sumKnownDisplacement(...components: Array<number | null>): number | null {
	const known = components.filter((component): component is number => component !== null);
	return known.length > 0 ? known.reduce((sum, component) => sum + component, 0) : null;
}

function positionedDisplacement(element: Element, style: CSSStyleDeclaration, rect: DOMRect): Displacement {
	if (style.position === "relative") return relativeDisplacement(element, style, rect);
	if (style.position === "absolute") return absoluteInsetDisplacement(element, rect);
	return { x: 0, y: 0 };
}

function relativeDisplacement(element: Element, style: CSSStyleDeclaration, rect: DOMRect): Displacement {
	const parentRect = element.parentElement?.getBoundingClientRect();
	const horizontalReference = positiveFinite(parentRect?.width) ?? positiveFinite(rect.width);
	const verticalReference = positiveFinite(parentRect?.height) ?? positiveFinite(rect.height);
	const x = relativeAxis(style.left, style.right, horizontalReference, style.direction !== "rtl");
	const y = relativeAxis(style.top, style.bottom, verticalReference, true);
	return { x, y };
}

function absoluteInsetDisplacement(element: Element, _rect: DOMRect): Displacement {
	const containingBlock = absoluteContainingBlock(element);
	if (!containingBlock) return { x: null, y: null };
	const containingRect = containingBlock.getBoundingClientRect();
	const containingStyle = getComputedStyle(containingBlock);
	const horizontalReference = positiveFinite(containingRect.width);
	const verticalReference = positiveFinite(containingRect.height);
	const direction = containingStyle.direction?.trim().toLocaleLowerCase("en-US");
	const x =
		direction === "ltr" || direction === "rtl"
			? absoluteInsetAxis(
					typedAbsoluteValue(element, "left"),
					typedAbsoluteValue(element, "right"),
					typedAbsoluteValue(element, "width"),
					horizontalReference,
					direction === "ltr",
				)
			: null;
	const y = absoluteInsetAxis(
		typedAbsoluteValue(element, "top"),
		typedAbsoluteValue(element, "bottom"),
		typedAbsoluteValue(element, "height"),
		verticalReference,
		true,
	);
	return { x, y };
}

function absoluteContainingBlock(element: Element): Element | null {
	const offsetParent = (element as Element & { offsetParent?: Element | null }).offsetParent;
	if (!offsetParent || offsetParent.nodeType !== 1) return null;
	const display = getComputedStyle(offsetParent).display?.trim().toLocaleLowerCase("en-US");
	return display === "inline" || display === "contents" ? null : offsetParent;
}

function typedAbsoluteValue(
	element: Element,
	property: "left" | "right" | "top" | "bottom" | "width" | "height",
): string | null {
	const computedStyleMap = (
		element as Element & {
			computedStyleMap?: () => { get(property: string): { toString(): string } | null | undefined };
		}
	).computedStyleMap;
	if (typeof computedStyleMap !== "function") return null;
	try {
		return computedStyleMap.call(element).get(property)?.toString().trim().toLocaleLowerCase("en-US") || null;
	} catch {
		return null;
	}
}

function absoluteInsetAxis(
	leadingValue: string | null | undefined,
	trailingValue: string | null | undefined,
	sizeValue: string | null | undefined,
	reference: number | null,
	preferLeading: boolean,
): number | null {
	const leading = parsePositionOffset(leadingValue, reference);
	const trailing = parsePositionOffset(trailingValue, reference);
	if (!leading || !trailing) return null;
	if (leading.specified && trailing.specified) {
		if (parseFixedAbsoluteSize(sizeValue, reference) === null) return null;
		return preferLeading ? leading.value : -trailing.value;
	}
	if (leading.specified) return leading.value;
	if (trailing.specified) return -trailing.value;
	return 0;
}

function parseFixedAbsoluteSize(value: string | null | undefined, reference: number | null): number | null {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "auto") return null;
	const parsed = parseTranslationLength(normalized, reference);
	return parsed !== null && parsed >= 0 ? parsed : null;
}

function relativeAxis(
	leadingValue: string | null | undefined,
	trailingValue: string | null | undefined,
	reference: number | null,
	preferLeading: boolean,
): number | null {
	const leading = parsePositionOffset(leadingValue, reference);
	const trailing = parsePositionOffset(trailingValue, reference);
	if (!leading || !trailing) return null;
	if (leading.specified && trailing.specified) return preferLeading ? leading.value : -trailing.value;
	if (leading.specified) return leading.value;
	if (trailing.specified) return -trailing.value;
	return 0;
}

function parsePositionOffset(
	value: string | null | undefined,
	reference: number | null,
): { specified: boolean; value: number } | null {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "auto") return { specified: false, value: 0 };
	const parsed = parseTranslationLength(normalized, reference);
	return parsed === null ? null : { specified: true, value: parsed };
}

function transformDisplacement(value: string | null | undefined, rect: DOMRect): Displacement | null {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "none") return { x: 0, y: 0 };
	const matrix3d = normalized.match(/^matrix3d\(([^)]+)\)$/u);
	if (matrix3d) {
		const values = numericArguments(matrix3d[1]);
		return values?.length === 16 ? { x: values[12] ?? 0, y: values[13] ?? 0 } : null;
	}
	const matrix = normalized.match(/^matrix\(([^)]+)\)$/u);
	if (matrix) {
		const values = numericArguments(matrix[1]);
		return values?.length === 6 ? { x: values[4] ?? 0, y: values[5] ?? 0 } : null;
	}
	const translate = normalized.match(/^translate(?:3d)?\(([^)]+)\)$/u);
	if (translate) return displacementFromArguments(translate[1], rect);
	const translateX = normalized.match(/^translatex\(([^)]+)\)$/u);
	if (translateX) {
		const x = parseTranslationLength(translateX[1] ?? "", positiveFinite(rect.width));
		return x === null ? null : { x, y: 0 };
	}
	const translateY = normalized.match(/^translatey\(([^)]+)\)$/u);
	if (translateY) {
		const y = parseTranslationLength(translateY[1] ?? "", positiveFinite(rect.height));
		return y === null ? null : { x: 0, y };
	}
	if (/^translatez\([^)]+\)$/u.test(normalized)) return { x: 0, y: 0 };
	return null;
}

function translateDisplacement(value: string | null | undefined, rect: DOMRect): Displacement | null {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "none") return { x: 0, y: 0 };
	return displacementFromArguments(normalized, rect);
}

function displacementFromArguments(value: string, rect: DOMRect): Displacement | null {
	const values = cssArguments(value);
	if (values.length < 1 || values.length > 3) return null;
	const x = parseTranslationLength(values[0] ?? "", positiveFinite(rect.width));
	const y = parseTranslationLength(values[1] ?? "0", positiveFinite(rect.height));
	return x === null || y === null ? null : { x, y };
}

function parseTranslationLength(value: string, reference: number | null): number | null {
	const normalized = value.trim().toLocaleLowerCase("en-US");
	if (/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:[a-z%]+)?$/u.test(normalized)) return 0;
	const pixels = normalized.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:px)?$/u);
	if (pixels) return finiteNumber(pixels[1]);
	const percentage = normalized.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/u);
	if (!percentage || reference === null) return null;
	const numeric = finiteNumber(percentage[1]);
	if (numeric === null) return null;
	return (numeric / 100) * reference;
}

function numericArguments(value: string): number[] | null {
	const result = cssArguments(value).map(finiteNumber);
	return result.some((entry) => entry === null) ? null : (result as number[]);
}

function cssArguments(value: string): string[] {
	return value
		.trim()
		.split(/\s*,\s*|\s+/u)
		.filter(Boolean);
}

function finiteNumber(value: string | undefined): number | null {
	if (!value) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function positiveFinite(value: number | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function viewportSize(element: Element): ViewportSize {
	const view = element.ownerDocument.defaultView;
	return {
		width: view ? positiveFinite(view.innerWidth) : null,
		height: view ? positiveFinite(view.innerHeight) : null,
	};
}

function isRectOutsideViewport(rect: RectEdges, viewport: ViewportSize): boolean {
	return (
		isRangeOutsideViewport(rect.left, rect.right, viewport.width) ||
		isRangeOutsideViewport(rect.top, rect.bottom, viewport.height)
	);
}

function hasPositiveViewportIntersection(rect: RectEdges, viewport: ViewportSize): boolean {
	return (
		viewport.width !== null &&
		viewport.height !== null &&
		Math.max(0, rect.left) < Math.min(viewport.width, rect.right) &&
		Math.max(0, rect.top) < Math.min(viewport.height, rect.bottom)
	);
}

function isRangeOutsideViewport(start: number, end: number, viewportExtent: number | null): boolean {
	return (
		(Number.isFinite(end) && end <= 0) || (viewportExtent !== null && Number.isFinite(start) && start >= viewportExtent)
	);
}

function hasPositiveEffectiveIntersection(rect: RectEdges, clippingAncestor: Element | null): boolean {
	let left = rect.left;
	let right = rect.right;
	let top = rect.top;
	let bottom = rect.bottom;
	if (!(right > left) || !(bottom > top)) return false;

	let current = clippingAncestor;
	while (current) {
		if (!isRootPageScrollingElement(current)) {
			const style = getComputedStyle(current);
			const establishesClippingBox = establishesOverflowClippingBox(style);
			const clipsPaint = establishesClippingBox && clipsByPaintContainment(style.contain);
			const clipsX = clipsPaint || (establishesClippingBox && clipsOverflowAxis(style.overflowX));
			const clipsY = clipsPaint || (establishesClippingBox && clipsOverflowAxis(style.overflowY));
			if (clipsX || clipsY) {
				const clip = current.getBoundingClientRect();
				if (clipsX) {
					left = Math.max(left, clip.left);
					right = Math.min(right, clip.right);
				}
				if (clipsY) {
					top = Math.max(top, clip.top);
					bottom = Math.min(bottom, clip.bottom);
				}
				if (!(right > left) || !(bottom > top)) return false;
			}
		}
		current = current.parentElement;
	}
	return true;
}

function clipsOverflowAxis(value: string | null | undefined): boolean {
	return CLIPPING_OVERFLOW_VALUES.has(value?.trim().toLocaleLowerCase("en-US") ?? "");
}

function clipsByPaintContainment(value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	return normalized === "strict" || normalized === "content" || normalized.split(/\s+/u).includes("paint");
}

function establishesOverflowClippingBox(style: CSSStyleDeclaration): boolean {
	const display = style.display.trim().toLocaleLowerCase("en-US");
	return display !== "inline" && display !== "contents";
}

function isRootPageScrollingElement(element: Element): boolean {
	const document = element.ownerDocument;
	return element === document.documentElement || element === document.body || element === document.scrollingElement;
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

function snapshotVisibleAnswer(answer: Element): { text: string; html: string } {
	if (!isComposedElementRendered(answer)) throw new Error("Answer HTML root is hidden");
	const clone = answer.cloneNode(true) as Element;
	pruneHiddenSnapshotDescendants(answer, clone);
	return { text: renderedSnapshotText(clone), html: clone.outerHTML };
}

export function readVisibleDomText(element: Element): string {
	return snapshotVisibleAnswer(element).text;
}

export function readVisibleSearchEvidenceText(element: Element): string {
	return withTemporarilyRevealedSearchElement(element, () => readVisibleDomText(element));
}

export async function readStructuredSearchEvidence(
	answer: Element,
	contract: SearchEvidenceContract | null,
): Promise<StructuredSearchEvidence> {
	if (!contract) return extractStructuredSearchEvidence(answer, null);
	let containers: Element[];
	try {
		containers = [...answer.querySelectorAll(contract.container)].filter(isSearchEvidenceElementVisible);
	} catch {
		throw new Error("Approved search evidence selector is no longer valid CSS");
	}
	if (containers.length !== 1) {
		return extractStructuredSearchEvidence(
			answer,
			contract,
			isSearchEvidenceElementVisible,
			readVisibleSearchEvidenceText,
		);
	}
	const container = containers[0];
	if (!container) throw new Error("Current search evidence container disappeared");

	return withTemporarilyRevealedSearchElementAsync(container, async () => {
		const wasCollapsed = container.querySelectorAll(contract.queryItem).length === 0;
		let disclosure: HTMLElement | null = null;
		if (wasCollapsed) {
			const disclosures = [...container.querySelectorAll(contract.disclosure)].filter(isDomElementVisible);
			if (disclosures.length !== 1 || !(disclosures[0] instanceof HTMLElement)) {
				throw new Error("Current search evidence disclosure is missing or ambiguous");
			}
			disclosure = disclosures[0];
			disclosure.click();
		}

		try {
			if (!wasCollapsed) {
				return extractStructuredSearchEvidence(
					answer,
					contract,
					isSearchEvidenceElementVisible,
					readVisibleSearchEvidenceText,
				);
			}
			return await waitForMountedStructuredSearchEvidence(answer, contract);
		} finally {
			if (wasCollapsed) disclosure?.click();
		}
	});
}

async function waitForMountedStructuredSearchEvidence(
	answer: Element,
	contract: SearchEvidenceContract,
): Promise<StructuredSearchEvidence> {
	const deadline = Date.now() + 1_500;
	let lastError: unknown = new Error("Current search evidence did not mount after disclosure");
	do {
		try {
			return extractStructuredSearchEvidence(
				answer,
				contract,
				isSearchEvidenceElementVisible,
				readVisibleSearchEvidenceText,
			);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	} while (Date.now() < deadline);
	throw lastError;
}

function withTemporarilyRevealedSearchElement<T>(element: Element, read: () => T): T {
	const restore = revealSearchElement(element);
	try {
		return read();
	} finally {
		restore();
	}
}

async function withTemporarilyRevealedSearchElementAsync<T>(element: Element, read: () => Promise<T>): Promise<T> {
	const restore = revealSearchElement(element);
	try {
		return await read();
	} finally {
		restore();
	}
}

function revealSearchElement(element: Element): () => void {
	type ScrollPosition = {
		element: Element & { scrollLeft?: number; scrollTop?: number };
		left: number | null;
		top: number | null;
	};
	const positions: ScrollPosition[] = [];
	let ancestor = element.parentElement;
	while (ancestor) {
		const scrollable = ancestor as Element & { scrollLeft?: unknown; scrollTop?: unknown };
		if (typeof scrollable.scrollLeft === "number" || typeof scrollable.scrollTop === "number") {
			positions.push({
				element: scrollable as ScrollPosition["element"],
				left: typeof scrollable.scrollLeft === "number" ? scrollable.scrollLeft : null,
				top: typeof scrollable.scrollTop === "number" ? scrollable.scrollTop : null,
			});
		}
		ancestor = ancestor.parentElement;
	}

	if (typeof element.scrollIntoView === "function") {
		element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" as ScrollBehavior });
	}
	for (const position of positions) {
		if (!isRootPageScrollingElement(position.element)) continue;
		if (position.left !== null) position.element.scrollLeft = position.left;
		if (position.top !== null) position.element.scrollTop = position.top;
	}
	return () => {
		for (const position of positions) {
			if (position.left !== null) position.element.scrollLeft = position.left;
			if (position.top !== null) position.element.scrollTop = position.top;
		}
	};
}

function pruneHiddenSnapshotDescendants(sourceRoot: Element, cloneRoot: Element): void {
	pruneSnapshotChildren(sourceRoot, cloneRoot);
}

function pruneSnapshotSubtree(source: Element, clone: Element): boolean {
	if (!isComposedElementRendered(source)) return false;
	const style = getComputedStyle(source);
	const rect = source.getBoundingClientRect();
	if (rect.width > 0 && rect.height > 0 && !hasPositiveEffectiveIntersection(rect, source.parentElement)) return false;
	if (isZeroSizedClippingContainer(rect, style)) return false;

	const { hasRenderedElementDescendant, hasRenderedDirectText } = pruneSnapshotChildren(source, clone);

	return (
		(rect.width > 0 && rect.height > 0) ||
		source.tagName.toUpperCase() === "BR" ||
		style.display === "contents" ||
		hasRenderedElementDescendant ||
		hasRenderedDirectText
	);
}

function pruneSnapshotChildren(
	source: Element,
	clone: Element,
): { hasRenderedElementDescendant: boolean; hasRenderedDirectText: boolean } {
	const sourceChildren = [...source.childNodes];
	const cloneChildren = [...clone.childNodes];
	if (sourceChildren.length !== cloneChildren.length) throw new Error("Answer snapshot clone structure mismatch");
	let hasRenderedElementDescendant = false;
	let hasRenderedDirectText = false;
	for (const [index, sourceChild] of sourceChildren.entries()) {
		const cloneChild = cloneChildren[index];
		if (!cloneChild) throw new Error("Answer snapshot clone structure mismatch");
		if (sourceChild.nodeType === 1) {
			if (pruneSnapshotSubtree(sourceChild as Element, cloneChild as Element)) hasRenderedElementDescendant = true;
			else cloneChild.remove();
		} else if (sourceChild.nodeType === 3) {
			if (hasRenderedTextRange(sourceChild as Text)) {
				hasRenderedDirectText ||= /\S/u.test(sourceChild.textContent ?? "");
			} else {
				cloneChild.remove();
			}
		} else {
			cloneChild.remove();
		}
	}
	return { hasRenderedElementDescendant, hasRenderedDirectText };
}

function removeNonRenderedSnapshotNodes(root: Element): void {
	for (const child of [...root.childNodes]) {
		if (child.nodeType === 1) removeNonRenderedSnapshotNodes(child as Element);
		else if (child.nodeType !== 3) child.remove();
	}
}

function hasRenderedTextRange(text: Text): boolean {
	const document = text.ownerDocument;
	if (!document || !hasPotentiallyVisibleTextPaint(text)) return false;
	try {
		const range = document.createRange();
		range.selectNodeContents(text);
		const rects = range.getClientRects();
		for (let index = 0; index < rects.length; index += 1) {
			const rect = rects[index];
			if (
				rect &&
				rect.width > 0 &&
				rect.height > 0 &&
				!isTextRangeActivelyDisplacedFromViewport(text, rect) &&
				hasPositiveEffectiveIntersection(rect, text.parentElement)
			) {
				return true;
			}
		}
	} catch {
		return false;
	}
	return false;
}

function isTextRangeActivelyDisplacedFromViewport(text: Text, rect: RectEdges): boolean {
	const parent = text.parentElement;
	if (!parent) return false;
	const style = getComputedStyle(parent);
	const writingMode = style.writingMode?.trim().toLocaleLowerCase("en-US") || "horizontal-tb";
	const direction = style.direction?.trim().toLocaleLowerCase("en-US");
	if (direction !== "ltr" && direction !== "rtl") return false;
	const parentRect = parent.getBoundingClientRect();
	const vertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";
	if (!vertical && writingMode !== "horizontal-tb") return false;
	const reference = positiveFinite(vertical ? parentRect.height : parentRect.width);
	const indent = parseTranslationLength(style.textIndent ?? "", reference);
	if (indent === null || indent === 0) return false;
	const displacement = direction === "rtl" ? -indent : indent;
	const viewport = viewportSize(parent);
	return vertical
		? isAxisActivelyDisplacedOutsideViewport(rect.top, rect.bottom, viewport.height, displacement)
		: isAxisActivelyDisplacedOutsideViewport(rect.left, rect.right, viewport.width, displacement);
}

function hasRenderedDisplayContents(element: Element): boolean {
	for (const child of [...element.childNodes]) {
		if (child.nodeType === 3 && /\S/u.test(child.textContent ?? "") && hasRenderedTextRange(child as Text)) return true;
		if (child.nodeType === 1 && isDomElementVisible(child as Element)) return true;
	}
	return false;
}

function hasPotentiallyVisibleTextPaint(text: Text): boolean {
	const parent = text.parentElement;
	if (!parent) return false;
	const document = text.ownerDocument;
	const style = getComputedStyle(parent);
	const fillColor = style.webkitTextFillColor || style.color;
	if (!isFullyTransparentColor(document, fillColor)) return true;
	const textShadow = style.textShadow?.trim().toLocaleLowerCase("en-US") ?? "";
	if (textShadow && textShadow !== "none" && !isFullyTransparentTextShadow(document, textShadow)) return true;
	const strokeWidth = parseTranslationLength(style.webkitTextStrokeWidth ?? "", null);
	if (strokeWidth === null) return true;
	if (strokeWidth > 0 && !isFullyTransparentColor(document, style.webkitTextStrokeColor)) return true;
	return hasPotentiallyVisibleTextBackground(document, style);
}

function hasPotentiallyVisibleTextBackground(document: Document, style: CSSStyleDeclaration): boolean {
	const clips = computedBackgroundClipLayers(style);
	if (clips.length === 0) return false;
	const image = style.backgroundImage?.trim().toLocaleLowerCase("en-US") || "none";
	const images = splitTopLevelCommas(image);
	if (!images) return clips.includes("text");
	for (let index = 0; index < images.length; index += 1) {
		const layer = images[index] ?? "";
		if (repeatedCssListValue(clips, index) !== "text" || layer === "none") continue;
		if (!isFullyTransparentGradient(document, layer)) return true;
	}
	const colorClip = repeatedCssListValue(clips, Math.max(0, images.length - 1));
	return colorClip === "text" && !isFullyTransparentColor(document, style.backgroundColor);
}

function computedBackgroundClipLayers(style: CSSStyleDeclaration): string[] {
	const standard = cssListValues(style.backgroundClip);
	const webkit = cssListValues(style.webkitBackgroundClip);
	if (standard.includes("text")) return standard;
	if (webkit.includes("text")) return webkit;
	return standard.length > 0 ? standard : webkit;
}

function cssListValues(value: string | null | undefined): string[] {
	return (splitTopLevelCommas(value?.trim().toLocaleLowerCase("en-US") ?? "") ?? []).filter(Boolean);
}

function repeatedCssListValue(values: string[], index: number): string | null {
	return values.length > 0 ? (values[index % values.length] ?? null) : null;
}

function isFullyTransparentColor(document: Document, value: string | null | undefined): boolean {
	const result = computedColorResult(document, value);
	return result.recognized && result.transparent;
}

function computedColorResult(document: Document, value: string | null | undefined): ComputedColorResult {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized) return { recognized: false, transparent: false };
	return canvasComputedColorResult(document, normalized) ?? strictComputedColorResult(normalized);
}

function canvasComputedColorResult(document: Document, value: string): ComputedColorResult | null {
	const state = colorProbeState(document);
	if (!state) return null;
	const cached = state.cache.get(value);
	if (cached) return cached;
	try {
		const { context } = state;
		context.fillStyle = "#010203";
		const firstSentinel = context.fillStyle;
		context.fillStyle = value;
		if (context.fillStyle === firstSentinel) {
			return null;
		}
		let recognized = true;
		context.fillStyle = "#040506";
		const secondSentinel = context.fillStyle;
		context.fillStyle = value;
		recognized = context.fillStyle !== secondSentinel;
		if (!recognized) {
			return null;
		}
		let result: ComputedColorResult;
		try {
			context.clearRect(0, 0, 1, 1);
			context.fillRect(0, 0, 1, 1);
			result = { recognized: true, transparent: context.getImageData(0, 0, 1, 1).data[3] === 0 };
		} catch {
			return null;
		}
		if (state.cache.size < COLOR_PROBE_CACHE_LIMIT) state.cache.set(value, result);
		return result;
	} catch {
		return null;
	}
}

function colorProbeState(document: Document): ColorProbeState | null {
	const existing = COLOR_PROBES.get(document);
	if (existing) return existing;
	try {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const getContext = (canvas as HTMLCanvasElement).getContext;
		if (typeof getContext !== "function") return null;
		const context = getContext.call(canvas, "2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
		if (!context || typeof context.getImageData !== "function") return null;
		const state = { context, cache: new Map<string, ComputedColorResult>() };
		COLOR_PROBES.set(document, state);
		return state;
	} catch {
		return null;
	}
}

function strictComputedColorResult(value: string): ComputedColorResult {
	if (value === "transparent") return { recognized: true, transparent: true };
	const legacy = value.match(/^(rgba?)\(([^()]*)\)$/u);
	if (legacy) {
		const components = cssArguments(legacy[2] ?? "");
		const expectedLength = legacy[1] === "rgba" ? 4 : 3;
		if (components.length !== expectedLength || components.some((component) => finiteScaleFactor(component) === null))
			return { recognized: false, transparent: false };
		return {
			recognized: true,
			transparent: expectedLength === 4 && finiteScaleFactor(components[3] ?? "") === 0,
		};
	}
	const modern = value.match(/^(oklab|oklch|lab|lch)\((.*)\)$/u);
	if (modern) return strictModernColorResult(modern[1] ?? "", modern[2] ?? "");
	const color = value.match(/^color\((.*)\)$/u);
	if (color) return strictColorFunctionResult(color[1] ?? "");
	return { recognized: false, transparent: false };
}

function strictModernColorResult(name: string, body: string): ComputedColorResult {
	const tokens = splitTopLevelWhitespace(body);
	if (!tokens || (tokens.length !== 3 && tokens.length !== 5)) return { recognized: false, transparent: false };
	const channels = tokens.slice(0, 3);
	const polar = name === "lch" || name === "oklch";
	if (
		!channels.every(
			(channel, index) =>
				channel === "none" ||
				finiteScaleFactor(channel) !== null ||
				(polar && index === 2 && isFiniteGradientAngle(channel)),
		)
	)
		return { recognized: false, transparent: false };
	if (tokens.length === 3) return { recognized: true, transparent: false };
	const alpha = tokens[3] === "/" ? finiteScaleFactor(tokens[4] ?? "") : null;
	return alpha === null ? { recognized: false, transparent: false } : { recognized: true, transparent: alpha === 0 };
}

function strictColorFunctionResult(body: string): ComputedColorResult {
	const tokens = splitTopLevelWhitespace(body);
	if (!tokens || (tokens.length !== 4 && tokens.length !== 6) || !FUNCTIONAL_COLOR_SPACES.has(tokens[0] ?? ""))
		return { recognized: false, transparent: false };
	if (!tokens.slice(1, 4).every((channel) => channel === "none" || finiteScaleFactor(channel) !== null))
		return { recognized: false, transparent: false };
	if (tokens.length === 4) return { recognized: true, transparent: false };
	const alpha = tokens[4] === "/" ? finiteScaleFactor(tokens[5] ?? "") : null;
	return alpha === null ? { recognized: false, transparent: false } : { recognized: true, transparent: alpha === 0 };
}

function isFullyTransparentTextShadow(document: Document, value: string): boolean {
	const layers = splitTopLevelCommas(value);
	return Boolean(
		layers?.length &&
			layers.every((layer) => {
				const tokens = splitTopLevelWhitespace(layer);
				if (!tokens) return false;
				const colors = tokens.filter((token) => isRecognizedComputedColor(document, token));
				const lengths = tokens.filter((token) => !isRecognizedComputedColor(document, token));
				return (
					colors.length === 1 &&
					isFullyTransparentColor(document, colors[0]) &&
					lengths.length >= 2 &&
					lengths.length <= 3 &&
					lengths.every((length) => parseTranslationLength(length, null) !== null)
				);
			}),
	);
}

function isRecognizedComputedColor(document: Document, value: string): boolean {
	return computedColorResult(document, value).recognized;
}

function isZeroSizedClippingContainer(rect: DOMRect, style: CSSStyleDeclaration): boolean {
	if (!establishesOverflowClippingBox(style)) return false;
	return (
		(!(rect.width > 0) && CLIPPING_OVERFLOW_VALUES.has(style.overflowX.trim().toLocaleLowerCase("en-US"))) ||
		(!(rect.height > 0) && CLIPPING_OVERFLOW_VALUES.has(style.overflowY.trim().toLocaleLowerCase("en-US")))
	);
}

function isFullyClippedByComputedStyle(element: Element, style: CSSStyleDeclaration): boolean {
	const rect = element.getBoundingClientRect();
	return (
		isCollapsedByTransform(rect, style.transform) ||
		isCollapsedByIndividualScale(rect, style.scale) ||
		isFullyClippedByInsetPath(rect, style.clipPath) ||
		isFullyClippedByCirclePath(style.clipPath) ||
		isFullyClippedByEllipsePath(rect, style.clipPath) ||
		isFullyClippedByPolygonPath(rect, style.clipPath) ||
		isFullyClippedByMoveOnlyPath(style.clipPath) ||
		isFullyClippedByLegacyRect(style.position, style.clip) ||
		isHiddenByThreeDimensionalBackface(style.backfaceVisibility, style.transform) ||
		isFullyTransparentFilter(style.filter) ||
		isFullyTransparentMask(element.ownerDocument, style.maskImage, style.webkitMaskImage)
	);
}

function isFullyClippedByMoveOnlyPath(value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const path = normalized.match(/^path\(\s*(?:(?:evenodd|nonzero)\s*,\s*)?(["'])([\s\S]*)\1\s*\)$/u);
	const pathData = path?.[2];
	if (!pathData || !/[+-]?(?:\d|\.\d)/u.test(pathData)) return false;
	const drawingCommands = [...pathData.matchAll(/[a-df-z]/gu)].map((match) => match[0]);
	return drawingCommands.includes("m") && drawingCommands.every((command) => command === "m" || command === "z");
}

function isHiddenByThreeDimensionalBackface(
	backfaceVisibility: string | null | undefined,
	transform: string | null | undefined,
): boolean {
	if (backfaceVisibility?.trim().toLocaleLowerCase("en-US") !== "hidden") return false;
	const matrix = transform
		?.trim()
		.toLocaleLowerCase("en-US")
		.match(/^matrix3d\(([^)]+)\)$/u);
	if (!matrix) return false;
	const values = numericArguments(matrix[1] ?? "");
	if (values?.length !== 16) return false;
	const approximately = (value: number, expected: number): boolean => Math.abs(value - expected) <= 1e-6;
	if (
		!approximately(values[3] ?? Number.NaN, 0) ||
		!approximately(values[7] ?? Number.NaN, 0) ||
		!approximately(values[11] ?? Number.NaN, 0) ||
		!approximately(values[15] ?? Number.NaN, 1)
	) {
		return false;
	}
	const first = [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0] as const;
	const second = [values[4] ?? 0, values[5] ?? 0, values[6] ?? 0] as const;
	const third = [values[8] ?? 0, values[9] ?? 0, values[10] ?? 0] as const;
	const dot = (left: readonly number[], right: readonly number[]): number =>
		(left[0] ?? 0) * (right[0] ?? 0) + (left[1] ?? 0) * (right[1] ?? 0) + (left[2] ?? 0) * (right[2] ?? 0);
	if (
		!approximately(dot(first, first), 1) ||
		!approximately(dot(second, second), 1) ||
		!approximately(dot(third, third), 1) ||
		!approximately(dot(first, second), 0) ||
		!approximately(dot(first, third), 0) ||
		!approximately(dot(second, third), 0)
	) {
		return false;
	}
	const determinant =
		(first[0] ?? 0) * ((second[1] ?? 0) * (third[2] ?? 0) - (second[2] ?? 0) * (third[1] ?? 0)) -
		(first[1] ?? 0) * ((second[0] ?? 0) * (third[2] ?? 0) - (second[2] ?? 0) * (third[0] ?? 0)) +
		(first[2] ?? 0) * ((second[0] ?? 0) * (third[1] ?? 0) - (second[1] ?? 0) * (third[0] ?? 0));
	return approximately(determinant, 1) && (third[2] ?? 0) < 0;
}

function isFullyClippedByInsetPath(rect: DOMRect, value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const inset = normalized.match(/^inset\((.*)\)$/u);
	if (!inset) return false;
	const values = cssArguments((inset[1] ?? "").split(/\s+round\s+/u, 1)[0] ?? "");
	const offsets = expandInsetOffsets(values);
	if (!offsets) return false;
	const height = positiveFinite(rect.height);
	const width = positiveFinite(rect.width);
	const top = parseTranslationLength(offsets.top, height);
	const right = parseTranslationLength(offsets.right, width);
	const bottom = parseTranslationLength(offsets.bottom, height);
	const left = parseTranslationLength(offsets.left, width);
	if (top === null || right === null || bottom === null || left === null) return false;
	return (height !== null && top + bottom >= height) || (width !== null && left + right >= width);
}

function expandInsetOffsets(values: string[]): { top: string; right: string; bottom: string; left: string } | null {
	const [first, second = first, third = first, fourth = second] = values;
	if (!first || values.length > 4) return null;
	if (values.length === 3) return { top: first, right: second, bottom: third, left: second };
	return { top: first, right: second, bottom: third, left: fourth };
}

function isFullyClippedByCirclePath(value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const circle = normalized.match(/^circle\((.*)\)$/u);
	if (!circle) return false;
	const radius = (circle[1] ?? "").split(/\s+at\s+/u, 1)[0]?.trim() ?? "";
	return cssArguments(radius).length === 1 && parseTranslationLength(radius, 1) === 0;
}

function isFullyClippedByEllipsePath(rect: DOMRect, value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const ellipse = normalized.match(/^ellipse\((.*)\)$/u);
	if (!ellipse) return false;
	const radii = cssArguments((ellipse[1] ?? "").split(/\s+at\s+/u, 1)[0] ?? "");
	if (radii.length !== 2) return false;
	const horizontal = parseTranslationLength(radii[0] ?? "", positiveFinite(rect.width));
	const vertical = parseTranslationLength(radii[1] ?? "", positiveFinite(rect.height));
	return horizontal !== null && vertical !== null && (horizontal === 0 || vertical === 0);
}

function isFullyClippedByPolygonPath(rect: DOMRect, value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const polygon = normalized.match(/^polygon\((.*)\)$/u);
	if (!polygon) return false;
	const parts = (polygon[1] ?? "").split(/\s*,\s*/u);
	if (parts[0] === "evenodd" || parts[0] === "nonzero") parts.shift();
	if (parts.length < 3) return false;
	const width = positiveFinite(rect.width);
	const height = positiveFinite(rect.height);
	const points = parts.map((part) => {
		const coordinates = cssArguments(part);
		if (coordinates.length !== 2) return null;
		const x = parseTranslationLength(coordinates[0] ?? "", width);
		const y = parseTranslationLength(coordinates[1] ?? "", height);
		return x === null || y === null ? null : { x, y };
	});
	if (points.some((point) => point === null)) return false;
	const concrete = points as Array<{ x: number; y: number }>;
	const origin = concrete[0];
	if (!origin) return false;
	const direction = concrete.find((point) => point.x !== origin.x || point.y !== origin.y);
	if (!direction) return true;
	return concrete.every(
		(point) => (direction.x - origin.x) * (point.y - origin.y) - (direction.y - origin.y) * (point.x - origin.x) === 0,
	);
}

function isFullyTransparentFilter(value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const functions = parseTopLevelCssFunctions(normalized);
	return Boolean(
		functions?.length &&
			functions.every(({ name }) => ZERO_ALPHA_PRESERVING_FILTER_FUNCTIONS.has(name)) &&
			functions.some(({ name, argument }) => name === "opacity" && finiteScaleFactor(argument) === 0),
	);
}

function isFullyTransparentMask(document: Document, ...values: Array<string | null | undefined>): boolean {
	return values.some((value) => isFullyTransparentGradientLayers(document, value));
}

function isFullyTransparentGradientLayers(document: Document, value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const layers = splitTopLevelCommas(normalized);
	return Boolean(layers?.length && layers.every((layer) => isFullyTransparentGradient(document, layer)));
}

function isFullyTransparentGradient(document: Document, value: string): boolean {
	const gradient = value.match(/^([a-z-]+)\((.*)\)$/u);
	const functionName = gradient?.[1];
	if (!functionName || !SUPPORTED_GRADIENT_FUNCTIONS.has(functionName)) return false;
	const kind = gradientKind(functionName);
	if (!kind) return false;
	const components = splitTopLevelCommas(gradient[2] ?? "");
	if (!components?.length) return false;
	let stopStart = 0;
	if (!isFullyTransparentComputedColorStop(document, components[0] ?? "", kind)) {
		if (!isRecognizedGradientGeometry(components[0] ?? "", kind)) return false;
		stopStart = 1;
	}
	return isFullyTransparentGradientStopSequence(document, components.slice(stopStart), kind);
}

type GradientKind = "linear" | "radial" | "conic";

function gradientKind(functionName: string): GradientKind | null {
	const base = functionName.replace(/^repeating-/u, "").replace(/-gradient$/u, "");
	return base === "linear" || base === "radial" || base === "conic" ? base : null;
}

function isRecognizedGradientGeometry(value: string, kind: GradientKind): boolean {
	const prelude = splitGradientInterpolationPrelude(value);
	if (!prelude) return false;
	if (!prelude.geometry) return prelude.hasInterpolation;
	if (kind === "linear") return isRecognizedLinearGradientGeometry(prelude.geometry);
	if (kind === "radial") return isRecognizedRadialGradientGeometry(prelude.geometry);
	return isRecognizedConicGradientGeometry(prelude.geometry);
}

function splitGradientInterpolationPrelude(value: string): { geometry: string; hasInterpolation: boolean } | null {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens?.length) return null;
	const interpolationIndexes = tokens.flatMap((token, index) => (token === "in" ? [index] : []));
	if (interpolationIndexes.length === 0) return { geometry: tokens.join(" "), hasInterpolation: false };
	if (interpolationIndexes.length !== 1) return null;
	const interpolationIndex = interpolationIndexes[0];
	if (interpolationIndex === undefined) return null;
	const interpolation = tokens.slice(interpolationIndex + 1);
	if (!isRecognizedGradientInterpolation(interpolation)) return null;
	return { geometry: tokens.slice(0, interpolationIndex).join(" "), hasInterpolation: true };
}

function isRecognizedGradientInterpolation(tokens: string[]): boolean {
	const colorSpace = tokens[0];
	if (!colorSpace) return false;
	if (RECTANGULAR_GRADIENT_COLOR_SPACES.has(colorSpace)) return tokens.length === 1;
	if (!POLAR_GRADIENT_COLOR_SPACES.has(colorSpace)) return false;
	if (tokens.length === 1) return true;
	return tokens.length === 3 && GRADIENT_HUE_INTERPOLATION_METHODS.has(tokens[1] ?? "") && tokens[2] === "hue";
}

function isRecognizedLinearGradientGeometry(value: string): boolean {
	if (isFiniteGradientAngle(value)) return true;
	const tokens = splitTopLevelWhitespace(value);
	if (tokens?.[0] !== "to" || tokens.length < 2 || tokens.length > 3) return false;
	const directions = tokens.slice(1);
	if (!directions.every((token) => ["left", "right", "top", "bottom"].includes(token))) return false;
	if (directions.length === 1) return true;
	return (
		directions.some((token) => token === "left" || token === "right") &&
		directions.some((token) => token === "top" || token === "bottom")
	);
}

function isRecognizedRadialGradientGeometry(value: string): boolean {
	const parts = value.split(/\s+at\s+/u);
	if (parts.length > 2) return false;
	const size = (parts[0] ?? "").trim();
	const position = parts[1]?.trim();
	if (!size && !position) return false;
	return (!size || isRecognizedRadialGradientSize(size)) && (!position || isRecognizedGradientPosition(position));
}

function isRecognizedRadialGradientSize(value: string): boolean {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens?.length) return false;
	const shapes = tokens.filter((token) => token === "circle" || token === "ellipse");
	const extents = tokens.filter((token) => RADIAL_EXTENT_KEYWORDS.has(token));
	if (shapes.length + extents.length === tokens.length) {
		return shapes.length <= 1 && extents.length <= 1;
	}
	const shape = shapes[0];
	const radii = tokens.filter((token) => token !== "circle" && token !== "ellipse");
	if (shapes.length > 1 || radii.some((token) => !isNonnegativeGradientLength(token, true))) return false;
	if (shape === "circle") return radii.length === 1 && !radii[0]?.endsWith("%");
	if (shape === "ellipse") return radii.length === 2;
	return radii.length === 1 ? !radii[0]?.endsWith("%") : radii.length === 2;
}

function isRecognizedConicGradientGeometry(value: string): boolean {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens?.length) return false;
	let index = 0;
	let recognized = false;
	if (tokens[index] === "from") {
		if (!isFiniteGradientAngle(tokens[index + 1] ?? "")) return false;
		index += 2;
		recognized = true;
	}
	if (tokens[index] === "at") {
		const position = tokens.slice(index + 1).join(" ");
		if (!position || !isRecognizedGradientPosition(position)) return false;
		index = tokens.length;
		recognized = true;
	}
	return recognized && index === tokens.length;
}

function isRecognizedGradientPosition(value: string): boolean {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens?.length) return false;
	if (tokens.length === 1)
		return isPositionKeyword(tokens[0] ?? "") || isFiniteGradientLengthPercentage(tokens[0] ?? "");
	if (tokens.length === 2) {
		const [first = "", second = ""] = tokens;
		return (
			(isHorizontalPosition(first) && isVerticalPosition(second)) ||
			(isVerticalKeyword(first) && isHorizontalKeyword(second))
		);
	}
	if (tokens.length !== 4) return false;
	const [firstEdge = "", firstOffset = "", secondEdge = "", secondOffset = ""] = tokens;
	return (
		isFiniteGradientLengthPercentage(firstOffset) &&
		isFiniteGradientLengthPercentage(secondOffset) &&
		((isHorizontalEdge(firstEdge) && isVerticalEdge(secondEdge)) ||
			(isVerticalEdge(firstEdge) && isHorizontalEdge(secondEdge)))
	);
}

function isHorizontalPosition(value: string): boolean {
	return isHorizontalKeyword(value) || isFiniteGradientLengthPercentage(value);
}

function isVerticalPosition(value: string): boolean {
	return isVerticalKeyword(value) || isFiniteGradientLengthPercentage(value);
}

function isPositionKeyword(value: string): boolean {
	return isHorizontalKeyword(value) || isVerticalKeyword(value);
}

function isHorizontalKeyword(value: string): boolean {
	return value === "left" || value === "right" || value === "center";
}

function isVerticalKeyword(value: string): boolean {
	return value === "top" || value === "bottom" || value === "center";
}

function isHorizontalEdge(value: string): boolean {
	return value === "left" || value === "right";
}

function isVerticalEdge(value: string): boolean {
	return value === "top" || value === "bottom";
}

function isNonnegativeGradientLength(value: string, allowPercentage: boolean): boolean {
	const parsed = parseStrictGradientLength(value, allowPercentage);
	return parsed !== null && parsed >= 0;
}

function isFiniteGradientLengthPercentage(value: string): boolean {
	return parseStrictGradientLength(value, true) !== null;
}

function parseStrictGradientLength(value: string, allowPercentage: boolean): number | null {
	const normalized = value.trim().toLocaleLowerCase("en-US");
	if (/^[+-]?(?:0+(?:\.0*)?|\.0+)(?:px|%)?$/u.test(normalized)) return 0;
	const units = allowPercentage ? "(?:px|%)" : "px";
	const match = normalized.match(new RegExp(`^([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))${units}$`, "u"));
	return match ? finiteNumber(match[1]) : null;
}

function isFiniteGradientAngle(value: string): boolean {
	const normalized = value.trim().toLocaleLowerCase("en-US");
	if (/^[+-]?(?:0+(?:\.0*)?|\.0+)$/u.test(normalized)) return true;
	const match = normalized.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:deg|grad|rad|turn)$/u);
	return Boolean(match && finiteNumber(match[1]) !== null);
}

function parseTopLevelCssFunctions(value: string): Array<{ name: string; argument: string }> | null {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens) return null;
	const result: Array<{ name: string; argument: string }> = [];
	for (const token of tokens) {
		const match = token.match(/^([a-z][a-z0-9-]*)\((.*)\)$/u);
		if (!match?.[1]) return null;
		result.push({ name: match[1], argument: (match[2] ?? "").trim() });
	}
	return result;
}

function splitTopLevelWhitespace(value: string): string[] | null {
	const result: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '"' || character === "'") return null;
		if (character === "(") depth += 1;
		else if (character === ")") {
			depth -= 1;
			if (depth < 0) return null;
		} else if (/\s/u.test(character ?? "") && depth === 0) {
			const token = value.slice(start, index).trim();
			if (token) result.push(token);
			start = index + 1;
		}
	}
	if (depth !== 0) return null;
	const token = value.slice(start).trim();
	if (token) result.push(token);
	return result.length > 0 ? result : null;
}

function splitTopLevelCommas(value: string): string[] | null {
	const result: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === "(") depth += 1;
		else if (character === ")") {
			depth -= 1;
			if (depth < 0) return null;
		} else if (character === "," && depth === 0) {
			result.push(value.slice(start, index).trim());
			start = index + 1;
		}
	}
	if (depth !== 0) return null;
	result.push(value.slice(start).trim());
	return result.every(Boolean) ? result : null;
}

function isFullyTransparentGradientStopSequence(document: Document, components: string[], kind: GradientKind): boolean {
	if (components.length < 2) return false;
	let colorStopCount = 0;
	for (let index = 0; index < components.length; index += 1) {
		const component = components[index] ?? "";
		if (isFullyTransparentComputedColorStop(document, component, kind)) {
			colorStopCount += 1;
			continue;
		}
		if (
			index === 0 ||
			index === components.length - 1 ||
			!isRecognizedGradientColorHint(component, kind) ||
			!isFullyTransparentComputedColorStop(document, components[index - 1] ?? "", kind) ||
			!isFullyTransparentComputedColorStop(document, components[index + 1] ?? "", kind)
		) {
			return false;
		}
	}
	return colorStopCount >= 2;
}

function isRecognizedGradientColorHint(value: string, kind: GradientKind): boolean {
	if (kind !== "conic") return isFiniteGradientLengthPercentage(value);
	return isFiniteGradientAngle(value) || isFiniteGradientPercentage(value);
}

function isFiniteGradientPercentage(value: string): boolean {
	const match = value
		.trim()
		.toLocaleLowerCase("en-US")
		.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/u);
	return Boolean(match && finiteNumber(match[1]) !== null);
}

function isFullyTransparentComputedColorStop(document: Document, value: string, kind: GradientKind): boolean {
	const tokens = splitTopLevelWhitespace(value);
	if (!tokens?.length || !isFullyTransparentColor(document, tokens[0])) return false;
	const positions = tokens.slice(1);
	if (positions.length > 2) return false;
	return positions.every((position) =>
		kind === "conic"
			? isFiniteGradientAngle(position) || isFiniteGradientPercentage(position)
			: parseTranslationLength(position, 1) !== null,
	);
}

function isFullyClippedByLegacyRect(position: string | null | undefined, value: string | null | undefined): boolean {
	const normalizedPosition = position?.trim().toLocaleLowerCase("en-US") ?? "";
	if (normalizedPosition !== "absolute" && normalizedPosition !== "fixed") return false;
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	const clip = normalized.match(/^rect\(([^)]+)\)$/u);
	if (!clip) return false;
	const values = cssArguments(clip[1] ?? "").map((entry) => parseTranslationLength(entry, null));
	if (values.length !== 4 || values.some((entry) => entry === null)) return false;
	const [top, right, bottom, left] = values as number[];
	return (right ?? 0) <= (left ?? 0) || (bottom ?? 0) <= (top ?? 0);
}

function isCollapsedByIndividualScale(rect: DOMRect, value: string | null | undefined): boolean {
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "none") return false;
	const values = cssArguments(normalized).map(finiteScaleFactor);
	if (values.length < 1 || values.length > 3 || values.some((entry) => entry === null)) return false;
	const x = values[0];
	const y = values[1] ?? x;
	return (x === 0 && !(rect.width > 0)) || (y === 0 && !(rect.height > 0));
}

function finiteScaleFactor(value: string): number | null {
	const percentage = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))%$/u);
	if (!percentage) return finiteNumber(value);
	const numeric = finiteNumber(percentage[1]);
	return numeric === null ? null : numeric / 100;
}

function isCollapsedByTransform(rect: DOMRect, value: string | null | undefined): boolean {
	if (rect.width > 0 && rect.height > 0) return false;
	const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
	if (!normalized || normalized === "none") return false;
	const matrix = normalized.match(/^matrix\(([^)]+)\)$/u);
	if (matrix) {
		const values = numericArguments(matrix[1]);
		return (
			values?.length === 6 &&
			Math.abs((values[0] ?? 0) * (values[3] ?? 0) - (values[1] ?? 0) * (values[2] ?? 0)) <= 1e-12
		);
	}
	const matrix3d = normalized.match(/^matrix3d\(([^)]+)\)$/u);
	if (matrix3d) {
		const values = numericArguments(matrix3d[1]);
		return (
			values?.length === 16 &&
			Math.abs((values[0] ?? 0) * (values[5] ?? 0) - (values[1] ?? 0) * (values[4] ?? 0)) <= 1e-12
		);
	}
	const scale = normalized.match(/^scale\(([^)]+)\)$/u);
	if (scale) {
		const values = numericArguments(scale[1]);
		return Boolean(values && values.length >= 1 && ((values[0] ?? 0) === 0 || (values[1] ?? values[0] ?? 0) === 0));
	}
	const scaleAxis = normalized.match(/^scale([xy])\(([^)]+)\)$/u);
	if (scaleAxis) return finiteNumber(scaleAxis[2]) === 0;
	const scale3d = normalized.match(/^scale3d\(([^)]+)\)$/u);
	if (scale3d) {
		const values = numericArguments(scale3d[1]);
		return Boolean(values?.length === 3 && ((values[0] ?? 0) === 0 || (values[1] ?? 0) === 0));
	}
	return false;
}

function renderedSnapshotText(root: Element): string {
	const chunks: string[] = [];
	let hasText = false;
	let pendingSeparator: "" | " " | "\t" | "\n" | "\n\n" = "";

	const queueSeparator = (separator: " " | "\t" | "\n" | "\n\n"): void => {
		const ranks = { "": 0, " ": 1, "\t": 2, "\n": 3, "\n\n": 4 } as const;
		if (ranks[separator] > ranks[pendingSeparator]) pendingSeparator = separator;
	};
	const flushSeparator = (): void => {
		if (hasText && pendingSeparator) chunks.push(pendingSeparator);
		pendingSeparator = "";
	};
	const appendText = (value: string, preformatted: boolean): void => {
		if (preformatted) {
			if (!value) return;
			flushSeparator();
			chunks.push(value.replace(/\r\n?/gu, "\n"));
			hasText ||= /\S/u.test(value);
			return;
		}
		const collapsed = value.replace(/[\t\n\f\r ]+/gu, " ");
		if (collapsed.startsWith(" ")) queueSeparator(" ");
		const content = collapsed.trim();
		if (content) {
			flushSeparator();
			chunks.push(content);
			hasText = true;
		}
		if (collapsed.endsWith(" ")) queueSeparator(" ");
	};
	const visit = (element: Element, preformatted: boolean): void => {
		if (element.matches(REMOVE_NODES)) return;
		const tagName = element.tagName.toUpperCase();
		if (tagName === "BR") {
			queueSeparator("\n");
			return;
		}
		const paragraph = tagName === "P";
		const lineBoundary = SNAPSHOT_LINE_BREAK_ELEMENTS.has(tagName);
		if (paragraph) queueSeparator("\n\n");
		else if (lineBoundary || tagName === "TR") queueSeparator("\n");
		const childPreformatted = preformatted || tagName === "PRE";
		for (const child of [...element.childNodes]) {
			if (child.nodeType === 3) appendText(child.textContent ?? "", childPreformatted);
			else if (child.nodeType === 1) visit(child as Element, childPreformatted);
		}
		if (SNAPSHOT_TABLE_CELLS.has(tagName)) queueSeparator("\t");
		else if (paragraph) queueSeparator("\n\n");
		else if (lineBoundary || tagName === "TR") queueSeparator("\n");
	};

	visit(root, false);
	return chunks.join("").trim();
}

function isExplicitlyHiddenSnapshotElement(element: Element): boolean {
	if (
		element.hasAttribute("hidden") ||
		element.hasAttribute("inert") ||
		element.getAttribute("aria-hidden")?.trim().toLocaleLowerCase("en-US") === "true"
	) {
		return true;
	}
	const style = element.getAttribute("style")?.toLocaleLowerCase("en-US") ?? "";
	return (
		/(?:^|;)\s*display\s*:\s*none\s*(?:!important\s*)?(?:;|$)/u.test(style) ||
		/(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\s*(?:!important\s*)?(?:;|$)/u.test(style) ||
		/(?:^|;)\s*opacity\s*:\s*(?:0+(?:\.0*)?|\.0+)\s*(?:!important\s*)?(?:;|$)/u.test(style)
	);
}
