import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { probeSearchEvidenceCandidates } from "./evidence-probe";

const SECRET_PROMPT = "PRIVATE PROMPT: compare confidential GPU pricing";
const SECRET_EMAIL = "owner@example.test";
const SECRET_TOKEN = "Bearer top-secret-token";

beforeEach(() => {
	vi.stubGlobal("getComputedStyle", (element: Element) => ({
		display: element.hasAttribute("hidden") ? "none" : "block",
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
		overflow: "visible",
		overflowX: "visible",
		overflowY: "visible",
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("search evidence probe", () => {
	test("returns bounded structural candidates without raw DOM or page text", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<aside class="account-sidebar"><a href="https://account.example.test/profile/${SECRET_EMAIL}">${SECRET_EMAIL}</a></aside>
			<div class="answer"><p>Old answer</p></div>
			<div class="answer current-answer" data-message-id="answer-123" data-secret="${SECRET_TOKEN}">
				<p>${SECRET_PROMPT}</p>
				<button class="search-toggle stable-control" role="button" aria-label="Search sources">Search sources</button>
				<div class="hidden-source-card" hidden>Reference ${SECRET_TOKEN}</div>
				<a class="citation-card" data-citation-id="private-id" href="https://source.example/report/private-path?token=${SECRET_TOKEN}">Citation source</a>
			</div>
			<div class="answer-actions"><button aria-label="Copy answer">Copy</button></div>
		</body></html>`);
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("SVGElement", window.SVGElement);
		window.HTMLElement.prototype.getBoundingClientRect = () =>
			({ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }) as DOMRect;
		const originalHtml = document.body.innerHTML;

		const report = await probeSearchEvidenceCandidates(document as unknown as Document, {
			surface: "deepseek.consumer_web",
			answerSelector: ".answer",
			candidateTextPattern: "search|source|citation|reference",
			maximumCandidates: 20,
			pageUrl: `https://chat.deepseek.com/a/chat/s/${SECRET_TOKEN}?account=${SECRET_EMAIL}&mode=search`,
		});
		const serialized = JSON.stringify(report);

		expect(report.answerCount).toBe(2);
		expect(report.candidates.some((candidate) => candidate.relation === "inside_latest_answer")).toBe(true);
		expect(report.candidates.some((candidate) => candidate.relation === "adjacent_to_latest_answer")).toBe(true);
		expect(report.candidates.some((candidate) => candidate.visible === false)).toBe(true);
		expect(report.candidates.some((candidate) => candidate.hrefHostname === "source.example")).toBe(true);
		expect(report.candidates.every((candidate) => /^[a-f0-9]{64}$/.test(candidate.textSha256))).toBe(true);
		expect(serialized).not.toContain(SECRET_PROMPT);
		expect(serialized).not.toContain(SECRET_EMAIL);
		expect(serialized).not.toContain(SECRET_TOKEN);
		expect(serialized).not.toContain("account.example");
		expect(serialized).not.toContain("private-path");
		expect(serialized).not.toContain("private-id");
		expect(serialized).not.toContain("data-secret=");
		expect(report.pageUrlShape).toBe(
			"https://chat.deepseek.com/:segment/:segment/:segment/:segment?account&mode",
		);
		expect(document.body.innerHTML).toBe(originalHtml);
	});

	test("caps deterministic document-order output", async () => {
		const { document, window } = parseHTML(`<!doctype html><html><body>
			<div class="answer">
				<button>Search one</button><button>Search two</button><button>Search three</button>
			</div>
		</body></html>`);
		vi.stubGlobal("HTMLElement", window.HTMLElement);
		vi.stubGlobal("SVGElement", window.SVGElement);
		window.HTMLElement.prototype.getBoundingClientRect = () =>
			({ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }) as DOMRect;

		const report = await probeSearchEvidenceCandidates(document as unknown as Document, {
			surface: "qwen.consumer_web",
			answerSelector: ".answer",
			candidateTextPattern: "search",
			maximumCandidates: 2,
			pageUrl: "https://www.qianwen.com/chat/123",
		});

		expect(report.candidates).toHaveLength(2);
		expect(report.truncated).toBe(true);
	});
});
