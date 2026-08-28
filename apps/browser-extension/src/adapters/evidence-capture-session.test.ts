import { parseHTML } from "linkedom";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
	createDocumentEvidenceCaptureSessionManager,
	EvidenceCaptureSessionManager,
	planEvidenceCaptureOffsets,
	type EvidenceCaptureTarget,
} from "./evidence-capture-session";

afterEach(() => vi.unstubAllGlobals());

describe("planEvidenceCaptureOffsets", () => {
	test("covers a long answer with 64 CSS pixel overlaps and an exact final frame", () => {
		expect(planEvidenceCaptureOffsets({ regionTop: 100, regionBottom: 1_500, viewportHeight: 500 })).toEqual({
			expectedSegmentCount: 4,
			offsets: [100, 536, 972, 1_000],
		});
	});

	test("caps captured frames without pretending an oversized answer is complete", () => {
		const plan = planEvidenceCaptureOffsets({ regionTop: 0, regionBottom: 20_000, viewportHeight: 500 });

		expect(plan.offsets).toHaveLength(18);
		expect(plan.expectedSegmentCount).toBeGreaterThan(18);
		expect(plan.offsets.at(-1)).not.toBe(19_500);
	});
});

describe("EvidenceCaptureSessionManager", () => {
	test("scrolls every planned frame and restores scroll and masks when ended", async () => {
		const events: string[] = [];
		const target = fakeTarget(events);
		const manager = new EvidenceCaptureSessionManager({
			resolveTarget: () => target,
			waitForPaint: async () => {
				events.push("paint");
			},
			randomSessionId: () => "session-1",
		});

		const first = await manager.begin({ promptSelector: ".prompt", promptText: "Prompt", answerSelector: ".answer" });
		const second = await manager.advance(first.sessionId);
		await manager.end(first.sessionId);

		expect(first).toMatchObject({ sessionId: "session-1", index: 0, expectedSegmentCount: 2 });
		expect(second).toMatchObject({ sessionId: "session-1", index: 1, expectedSegmentCount: 2, done: true });
		expect(events).toEqual([
			"scroll:100",
			"paint",
			"mask:100",
			"scroll:300",
			"paint",
			"mask:300",
			"restore-masks",
			"scroll:37",
		]);
	});

	test("restores the previous session before replacing it", async () => {
		const firstEvents: string[] = [];
		const secondEvents: string[] = [];
		const targets = [fakeTarget(firstEvents), fakeTarget(secondEvents)];
		const manager = new EvidenceCaptureSessionManager({
			resolveTarget: () => targets.shift() as EvidenceCaptureTarget,
			waitForPaint: async () => undefined,
			randomSessionId: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("session-2"),
		});

		await manager.begin({ promptSelector: ".prompt", promptText: "Prompt", answerSelector: ".answer" });
		await manager.begin({ promptSelector: ".prompt", promptText: "Prompt", answerSelector: ".answer" });

		expect(firstEvents.slice(-2)).toEqual(["restore-masks", "scroll:37"]);
	});

	test("uses the narrowest common scroll container and restores hidden overlays", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div id="outer"><div id="conversation">
				<div class="prompt">Prompt</div><div class="answer">Answer</div>
			</div></div><div id="overlay" style="visibility:visible">Account</div>
		</body></html>`);
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("SVGElement", window.SVGElement);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		const conversation = document.querySelector("#conversation") as HTMLElement;
		const outer = document.querySelector("#outer") as HTMLElement;
		const prompt = document.querySelector(".prompt") as HTMLElement;
		const answer = document.querySelector(".answer") as HTMLElement;
		const overlay = document.querySelector("#overlay") as HTMLElement;
		Object.defineProperties(conversation, {
			scrollHeight: { value: 900 },
			clientHeight: { value: 500 },
			scrollTop: { value: 25, writable: true },
		});
		Object.defineProperties(outer, { scrollHeight: { value: 1_200 }, clientHeight: { value: 700 } });
		conversation.getBoundingClientRect = () => rect(100, 0, 800, 500);
		outer.getBoundingClientRect = () => rect(0, 0, 1_000, 700);
		prompt.getBoundingClientRect = () => rect(120, 100 - conversation.scrollTop, 760, 80);
		answer.getBoundingClientRect = () => rect(120, 180 - conversation.scrollTop, 760, 620);
		overlay.getBoundingClientRect = () => rect(110, 0, 780, 50);
		vi.stubGlobal("getComputedStyle", (element: Element) => ({
			display: "block",
			visibility: "visible",
			opacity: "1",
			overflowY: element === conversation || element === outer ? "auto" : "visible",
			position: element === overlay ? "fixed" : "static",
		}));
		Object.defineProperty(document.defaultView, "devicePixelRatio", { value: 2, configurable: true });
		Object.defineProperty(document.defaultView, "innerWidth", { value: 1_000, configurable: true });

		const manager = createDocumentEvidenceCaptureSessionManager(document as unknown as Document, {
			randomSessionId: () => "session-dom",
			waitForPaint: async () => undefined,
		});
		const frame = await manager.begin({
			promptSelector: ".prompt",
			promptText: "Prompt",
			answerSelector: ".answer",
		});

		expect(conversation.scrollTop).toBe(100);
		expect(frame.rect).toEqual({ x: 120, y: 0, width: 760, height: 500, devicePixelRatio: 2 });
		expect(overlay.style.visibility).toBe("hidden");
		await manager.end(frame.sessionId);
		expect(conversation.scrollTop).toBe(25);
		expect(overlay.style.visibility).toBe("visible");
	});
});

function fakeTarget(events: string[]): EvidenceCaptureTarget {
	let scrollTop = 37;
	return {
		originalScrollTop: scrollTop,
		regionTop: 100,
		regionBottom: 800,
		viewportHeight: 500,
		setScrollTop(value) {
			scrollTop = value;
			events.push(`scroll:${value}`);
		},
		readFrameRect() {
			return { x: 200, y: 0, width: 800, height: 500, devicePixelRatio: 1 };
		},
		maskOverlays() {
			events.push(`mask:${scrollTop}`);
		},
		restoreMasks() {
			events.push("restore-masks");
		},
	};
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
	return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect;
}
