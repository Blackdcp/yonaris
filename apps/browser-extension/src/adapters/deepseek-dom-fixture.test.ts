import { parseHTML } from "linkedom";
import { describe, expect, test } from "vitest";
import type { AnswerReadRequest, ConsumerDomPort, DomElementRole, DomElementSummary } from "./contracts";
import { createDeepSeekAdapter, deepSeekSelectorContract } from "./deepseek";

// A sanitized recorded shape can exercise the reviewed selectors, but it is not
// evidence that the current live DeepSeek page has been qualified.
const UNQUALIFIED_FIXTURE_CONTRACT = deepSeekSelectorContract;

const READY_CONTROLS = `
	<button class="_5a8ac7a a084f19e">新对话</button>
	<textarea class="_27c9245"></textarea>
	<div role="button" class="ds-button--primary ds-button--circle">发送</div>
`;

describe("DeepSeek unqualified DOM fixture skeleton", () => {
	test("collects the current completed answer, visible citation, and answer-bound evidence rectangle", async () => {
		const port = completedAnswerFixturePort(`
			${READY_CONTROLS}
			<div class="d29f3d7d ds-message">Prompt A</div>
			<div class="ds-assistant-message-main-content">
				<p>Current answer</p>
				<a href="https://source.example/report">Source A</a>
			</div>
		`);
		const adapter = createDeepSeekAdapter(port, UNQUALIFIED_FIXTURE_CONTRACT);

		await adapter.resumeSubmitted("Prompt A");
		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: expect.stringContaining("Current answer"),
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/report", title: "Source A" }],
			evidenceViewportRect: { x: 240, y: 80, width: 660, height: 420, devicePixelRatio: 1 },
		});
	});

	test.each([
		["signed_out", `${READY_CONTROLS}<input type="tel" aria-label="登录手机号">`],
		["captcha", `${READY_CONTROLS}<iframe src="https://example.invalid/captcha" title="verification"></iframe>`],
		["account_restricted", `${READY_CONTROLS}<section>由于违反用户使用规范，你的账号已被禁言至某日。</section>`],
	] as const)("classifies %s from actual CSS queries without submitting", async (code, html) => {
		const port = cssFixturePort(html);
		const adapter = createDeepSeekAdapter(port, UNQUALIFIED_FIXTURE_CONTRACT);

		await expect(adapter.preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
		expect(port.submitCount).toBe(0);
	});

	test("fails closed when a real CSS selector resolves ambiguous controls", async () => {
		const port = cssFixturePort(`${READY_CONTROLS}<textarea class="_27c9245"></textarea>`);
		const adapter = createDeepSeekAdapter(port, UNQUALIFIED_FIXTURE_CONTRACT);

		await expect(adapter.preflight()).rejects.toMatchObject({ code: "page_drift", stage: "pre_submit" });
		expect(port.submitCount).toBe(0);
	});

	test("would fail if the adapter stopped using the reviewed CSS selector", async () => {
		const port = cssFixturePort(READY_CONTROLS);
		const adapter = createDeepSeekAdapter(port, {
			...UNQUALIFIED_FIXTURE_CONTRACT,
			composer: "textarea[data-fixture-role='missing']",
		});

		await expect(adapter.preflight()).rejects.toMatchObject({ code: "page_drift" });
	});
});

function cssFixturePort(fragment: string): ConsumerDomPort & { submitCount: number } {
	const { document } = parseHTML(`<!doctype html><html><body>${fragment}</body></html>`);
	let now = Date.parse("2026-08-18T00:00:00.000Z");
	const port: ConsumerDomPort & { submitCount: number } = {
		submitCount: 0,
		currentUrl: () => "https://chat.deepseek.com/",
		now: () => now,
		query: async (_role: DomElementRole, selector: string): Promise<readonly DomElementSummary[]> =>
			[...document.querySelectorAll(selector)].map((element) => ({
				text: (element.textContent ?? "").trim(),
				visible: !element.hasAttribute("hidden"),
			})),
		click: async (role) => {
			if (role === "send") port.submitCount += 1;
		},
		fill: async () => undefined,
		readAnswer: async (_request: AnswerReadRequest) => {
			throw new Error("The pre-submit fixture must not read an answer");
		},
		wait: async (milliseconds) => {
			now += milliseconds;
		},
	};
	return port;
}

function completedAnswerFixturePort(fragment: string): ConsumerDomPort {
	const { document } = parseHTML(`<!doctype html><html><body>${fragment}</body></html>`);
	let now = Date.parse("2026-08-21T00:00:00.000Z");
	let generatingChecks = 0;
	return {
		currentUrl: () => "https://chat.deepseek.com/a/chat/s/test-session",
		now: () => now,
		query: async (role, selector) => {
			if (role === "generating") {
				generatingChecks += 1;
				return generatingChecks === 1 ? [{ text: "", visible: true }] : [];
			}
			return [...document.querySelectorAll(selector)].map((element) => ({
				text: (element.textContent ?? "").trim(),
				visible: !element.hasAttribute("hidden"),
			}));
		},
		click: async () => undefined,
		fill: async () => undefined,
		readAnswer: async (request) => {
			const answer = [...document.querySelectorAll(request.answerSelector)][request.answerIndex];
			if (!answer) throw new Error("Fixture answer is missing");
			const citations = request.citationLinkSelector
				? [...answer.querySelectorAll<HTMLAnchorElement>(request.citationLinkSelector)].map((anchor) => ({
						url: anchor.href,
						title: (anchor.textContent ?? "").trim(),
					}))
				: [];
			return {
				text: (answer.textContent ?? "").trim(),
				html: answer.outerHTML,
				evidenceViewportRect: { x: 240, y: 80, width: 660, height: 420, devicePixelRatio: 1 },
				searchUsedCount: 0,
				searchNotUsedCount: 0,
				webQueries: [],
				citations,
			};
		},
		wait: async (milliseconds) => {
			now += milliseconds;
		},
	};
}
