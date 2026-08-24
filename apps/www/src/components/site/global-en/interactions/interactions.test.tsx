import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type AnswerStudioModule = typeof import("./answer-studio");

const answerStudioModule = (await import("./answer-studio").catch(() => undefined)) as AnswerStudioModule | undefined;

describe("global English interactive figures", () => {
	it("renders a complete accessible Answer Studio initial state", () => {
		expect(answerStudioModule, "the Answer Studio component must exist").toBeDefined();
		if (!answerStudioModule) return;

		const markup = renderToStaticMarkup(<answerStudioModule.AnswerStudio initialQuestion="recommended" />);
		expect(markup).toContain('data-graphic="answer-studio"');
		expect(markup).toContain('role="tablist"');
		expect(markup.match(/role="tab"/g) ?? []).toHaveLength(5);
		expect(markup).toContain('aria-selected="true"');
		expect(markup).toContain('role="tabpanel"');
		expect(markup).toContain('data-question="recommended"');
		expect(markup).toContain("Interface demonstration — no customer or live observation data.");
	});
});
