import type { EvidenceViewportRect } from "./contracts";

const CAPTURE_OVERLAP_CSS_PX = 64;
const MAX_CAPTURE_SEGMENTS = 18;

export type EvidenceCaptureRequest = {
	promptSelector: string;
	promptText: string;
	answerSelector: string;
	completionSelector?: string | null;
};

export type EvidenceCaptureFrame = {
	sessionId: string;
	index: number;
	expectedSegmentCount: number;
	overlapTopCssPx: number;
	rect: EvidenceViewportRect;
	done: boolean;
};

export type EvidenceCaptureTarget = {
	originalScrollTop: number;
	regionTop: number;
	regionBottom: number;
	viewportHeight: number;
	setScrollTop(value: number): void;
	readFrameRect(): EvidenceViewportRect;
	maskOverlays(rect: EvidenceViewportRect): void;
	restoreMasks(): void;
};

type CaptureSession = {
	id: string;
	target: EvidenceCaptureTarget;
	offsets: number[];
	expectedSegmentCount: number;
	index: number;
};

export class EvidenceCaptureSessionManager {
	readonly #resolveTarget: (request: EvidenceCaptureRequest) => EvidenceCaptureTarget;
	readonly #waitForPaint: () => Promise<void>;
	readonly #randomSessionId: () => string;
	#session: CaptureSession | null = null;

	constructor(options: {
		resolveTarget: (request: EvidenceCaptureRequest) => EvidenceCaptureTarget;
		waitForPaint?: () => Promise<void>;
		randomSessionId?: () => string;
	}) {
		this.#resolveTarget = options.resolveTarget;
		this.#waitForPaint = options.waitForPaint ?? waitForBrowserPaint;
		this.#randomSessionId = options.randomSessionId ?? (() => crypto.randomUUID());
	}

	async begin(request: EvidenceCaptureRequest): Promise<EvidenceCaptureFrame> {
		await this.#restoreActiveSession();
		const target = this.#resolveTarget(request);
		const plan = planEvidenceCaptureOffsets(target);
		if (plan.offsets.length < 1) throw new Error("Visual evidence capture plan is empty");
		this.#session = {
			id: this.#randomSessionId(),
			target,
			offsets: plan.offsets,
			expectedSegmentCount: plan.expectedSegmentCount,
			index: 0,
		};
		return this.#renderCurrentFrame();
	}

	async advance(sessionId: string): Promise<EvidenceCaptureFrame> {
		const session = this.#requireSession(sessionId);
		if (session.index >= session.offsets.length - 1) throw new Error("Visual evidence capture is already complete");
		session.index += 1;
		return this.#renderCurrentFrame();
	}

	async end(sessionId: string): Promise<void> {
		this.#requireSession(sessionId);
		await this.#restoreActiveSession();
	}

	async #renderCurrentFrame(): Promise<EvidenceCaptureFrame> {
		const session = this.#session;
		if (!session) throw new Error("Visual evidence capture session is missing");
		session.target.setScrollTop(session.offsets[session.index] as number);
		await this.#waitForPaint();
		const rect = session.target.readFrameRect();
		session.target.maskOverlays(rect);
		return {
			sessionId: session.id,
			index: session.index,
			expectedSegmentCount: session.expectedSegmentCount,
			overlapTopCssPx: session.index === 0 ? 0 : CAPTURE_OVERLAP_CSS_PX,
			rect,
			done: session.index === session.offsets.length - 1,
		};
	}

	#requireSession(sessionId: string): CaptureSession {
		if (!this.#session || this.#session.id !== sessionId) throw new Error("Visual evidence capture session is invalid");
		return this.#session;
	}

	async #restoreActiveSession(): Promise<void> {
		const session = this.#session;
		this.#session = null;
		if (!session) return;
		try {
			session.target.restoreMasks();
		} finally {
			session.target.setScrollTop(session.target.originalScrollTop);
		}
	}
}

export function createDocumentEvidenceCaptureSessionManager(
	document: Document,
	options: {
		waitForPaint?: () => Promise<void>;
		randomSessionId?: () => string;
	} = {},
): EvidenceCaptureSessionManager {
	return new EvidenceCaptureSessionManager({
		resolveTarget: (request) => resolveDocumentTarget(document, request),
		...options,
	});
}

export function planEvidenceCaptureOffsets(input: {
	regionTop: number;
	regionBottom: number;
	viewportHeight: number;
}): { offsets: number[]; expectedSegmentCount: number } {
	if (
		![input.regionTop, input.regionBottom, input.viewportHeight].every(Number.isFinite) ||
		input.regionBottom <= input.regionTop ||
		input.viewportHeight <= CAPTURE_OVERLAP_CSS_PX
	) {
		throw new Error("Visual evidence capture geometry is invalid");
	}
	const lastOffset = Math.max(input.regionTop, input.regionBottom - input.viewportHeight);
	const step = input.viewportHeight - CAPTURE_OVERLAP_CSS_PX;
	const allOffsets = [input.regionTop];
	while ((allOffsets.at(-1) as number) + input.viewportHeight < input.regionBottom) {
		const next = Math.min((allOffsets.at(-1) as number) + step, lastOffset);
		if (next <= (allOffsets.at(-1) as number)) break;
		allOffsets.push(next);
	}
	return {
		expectedSegmentCount: allOffsets.length,
		offsets: allOffsets.slice(0, MAX_CAPTURE_SEGMENTS),
	};
}

function waitForBrowserPaint(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function resolveDocumentTarget(document: Document, request: EvidenceCaptureRequest): EvidenceCaptureTarget {
	const promptCandidates = queryElements(document, request.promptSelector).filter(hasGeometry);
	const normalizedPrompt = normalizeText(request.promptText);
	const prompts = promptCandidates.filter((element) => normalizeText(element.textContent ?? "") === normalizedPrompt);
	const answers = queryElements(document, request.answerSelector).filter(hasGeometry);
	if (prompts.length !== 1 || answers.length < 1) throw new Error("Current answer is ambiguous for visual evidence");
	const prompt = prompts[0] as Element;
	const answer = answers.at(-1) as Element;
	const elements = [prompt, answer];
	if (request.completionSelector) {
		const actionGroup = answer.nextElementSibling;
		if (actionGroup?.matches(request.completionSelector) || actionGroup?.querySelector(request.completionSelector)) {
			elements.push(actionGroup);
		}
	}
	const scrollElement = findNarrowestCommonScrollElement(document, elements);
	const viewport = readScrollViewport(document, scrollElement);
	const rects = elements.map((element) => element.getBoundingClientRect());
	const regionTop = Math.min(...rects.map((rect) => rect.top - viewport.top + viewport.scrollTop));
	const regionBottom = Math.max(...rects.map((rect) => rect.bottom - viewport.top + viewport.scrollTop));
	const regionLeft = Math.max(0, Math.min(...rects.map((rect) => rect.left)));
	const regionRight = Math.min(viewport.width, Math.max(...rects.map((rect) => rect.right)));
	const originalScrollTop = viewport.scrollTop;
	const masked = new Map<HTMLElement | SVGElement, string>();

	return {
		originalScrollTop,
		regionTop,
		regionBottom,
		viewportHeight: viewport.height,
		setScrollTop: viewport.setScrollTop,
		readFrameRect() {
			const current = readScrollViewport(document, scrollElement);
			const visibleContentTop = Math.max(regionTop, current.scrollTop);
			const visibleContentBottom = Math.min(regionBottom, current.scrollTop + current.height);
			if (regionRight <= regionLeft || visibleContentBottom <= visibleContentTop) {
				throw new Error("Current visual evidence frame is outside the viewport");
			}
			const devicePixelRatio = document.defaultView?.devicePixelRatio;
			if (!Number.isFinite(devicePixelRatio) || (devicePixelRatio ?? 0) <= 0) {
				throw new Error("Current visual evidence pixel ratio is invalid");
			}
			return {
				x: regionLeft,
				y: current.top + visibleContentTop - current.scrollTop,
				width: regionRight - regionLeft,
				height: visibleContentBottom - visibleContentTop,
				devicePixelRatio: devicePixelRatio as number,
			};
		},
		maskOverlays(rect) {
			for (const candidate of queryElements(document, "body *")) {
				if (!(candidate instanceof HTMLElement) && !(candidate instanceof SVGElement)) continue;
				if (elements.some((element) => element.contains(candidate) || candidate.contains(element))) continue;
				const position = getComputedStyle(candidate).position;
				if (position !== "fixed" && position !== "sticky") continue;
				if (!intersects(candidate.getBoundingClientRect(), rect)) continue;
				if (!masked.has(candidate)) masked.set(candidate, candidate.style.visibility);
				candidate.style.visibility = "hidden";
			}
		},
		restoreMasks() {
			for (const [element, visibility] of masked) element.style.visibility = visibility;
			masked.clear();
		},
	};
}

function queryElements(document: Document, selector: string): Element[] {
	try {
		return [...document.querySelectorAll(selector)];
	} catch {
		throw new Error("Approved visual evidence selector is invalid");
	}
}

function findNarrowestCommonScrollElement(document: Document, elements: Element[]): Element {
	for (let candidate = elements.at(-1)?.parentElement ?? null; candidate; candidate = candidate.parentElement) {
		if (!elements.every((element) => candidate.contains(element))) continue;
		const overflowY = getComputedStyle(candidate).overflowY;
		if ((overflowY === "auto" || overflowY === "scroll") && candidate.scrollHeight > candidate.clientHeight) {
			return candidate;
		}
	}
	return document.scrollingElement ?? document.documentElement;
}

function readScrollViewport(
	document: Document,
	scrollElement: Element,
): { top: number; width: number; height: number; scrollTop: number; setScrollTop(value: number): void } {
	const documentScroller = scrollElement === document.scrollingElement || scrollElement === document.documentElement;
	const rect = documentScroller
		? { top: 0, left: 0, right: document.defaultView?.innerWidth ?? document.documentElement.clientWidth }
		: scrollElement.getBoundingClientRect();
	const height = documentScroller
		? document.defaultView?.innerHeight ?? document.documentElement.clientHeight
		: scrollElement.clientHeight;
	if (!Number.isFinite(height) || height <= CAPTURE_OVERLAP_CSS_PX || rect.right <= rect.left) {
		throw new Error("Current visual evidence viewport is invalid");
	}
	return {
		top: rect.top,
		width: rect.right,
		height,
		scrollTop: scrollElement.scrollTop,
		setScrollTop(value) {
			scrollElement.scrollTop = value;
		},
	};
}

function hasGeometry(element: Element): boolean {
	const rect = element.getBoundingClientRect();
	return [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, " ").trim();
}

function intersects(rect: DOMRect, evidence: EvidenceViewportRect): boolean {
	return (
		rect.right > evidence.x &&
		rect.left < evidence.x + evidence.width &&
		rect.bottom > evidence.y &&
		rect.top < evidence.y + evidence.height
	);
}
