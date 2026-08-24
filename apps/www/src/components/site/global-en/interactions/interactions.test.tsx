import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type AnswerStudioModule = typeof import("./answer-studio");
type ProductWorkbenchModule = typeof import("./product-workbench");
type EvidenceJourneyModule = typeof import("./evidence-journey");

const answerStudioModule = (await import("./answer-studio").catch(() => undefined)) as AnswerStudioModule | undefined;
const productWorkbenchModule = (await import("./product-workbench").catch(() => undefined)) as ProductWorkbenchModule | undefined;
const evidenceJourneyModule = (await import("./evidence-journey").catch(() => undefined)) as EvidenceJourneyModule | undefined;

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

	it("renders a four-step evidence journey without scroll hijacking", () => {
		expect(evidenceJourneyModule, "the Evidence Journey component must exist").toBeDefined();
		if (!evidenceJourneyModule) return;

		const markup = renderToStaticMarkup(<evidenceJourneyModule.EvidenceJourney initialStep="define" />);
		expect(markup).toContain('data-graphic="evidence-journey"');
		expect(markup.match(/role="tab"/g) ?? []).toHaveLength(4);
		expect(markup).toContain('data-step="define"');
		expect(markup).toContain("What decision must this observation support?");
		expect(markup).not.toContain("wheel");
		expect(markup).not.toContain("scrollIntoView");
	});

	it("renders four keyboard-addressable product modules in one shared workbench", () => {
		expect(productWorkbenchModule, "the Product Workbench component must exist").toBeDefined();
		if (!productWorkbenchModule) return;

		const markup = renderToStaticMarkup(<productWorkbenchModule.ProductWorkbench initialModule="scope" />);
		expect(markup).toContain('data-graphic="product-workbench"');
		expect(markup).toContain('aria-label="Choose a product module"');
		expect(markup.match(/role="tab"/g) ?? []).toHaveLength(4);
		expect(markup).toContain('data-module="scope"');
		expect(markup).toContain("What must stay fixed for an observation to be comparable?");
		expect(markup).toContain("Interface demonstration — no customer or live observation data.");
	});
});
