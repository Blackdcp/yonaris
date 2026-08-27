import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CinematicField } from "./cinematic-field";
import { ComparisonStage, type ComparisonStageRecord } from "./comparison-stage";
import { DualReadingStage } from "./dual-reading-stage";
import { EvidenceSheet } from "./evidence-sheet";

const literalComparisonFixture = {
	heading: "Keep the question fixed. Let the evidence change.",
	question: "Which company can support this decision?",
	initialId: "baseline",
	records: [
		{
			id: "baseline",
			label: "Baseline",
			answer: "Relevant, but the operating boundary is unclear.",
			evidence: "Broad product language without a source for the boundary.",
			judgment: "Not yet defensible as a preferred comparison.",
			nextAction: "Publish the operating condition and supporting fact.",
		},
		{
			id: "retest",
			label: "Retest",
			answer: "Relevant, with a reviewable operating boundary.",
			evidence: "The public record names the condition, scope, and review date.",
			judgment: "Defensible under the recorded comparison conditions.",
			nextAction: "Retest while keeping the question and conditions visible.",
		},
	] satisfies readonly ComparisonStageRecord[],
} as const;

describe("Site 06 visual objects", () => {
	it("renders a cinematic field as layered media rather than a card", () => {
		const html = renderToStaticMarkup(
			<CinematicField
				image={{ src: "/brand/site-06/conference-room.jpg", alt: "Conference room" }}
				credit="Nastuh Abootalebi / Unsplash"
			>
				<h1>Decision headline</h1>
				<EvidenceSheet label="Observed answer">Evidence body</EvidenceSheet>
			</CinematicField>,
		);
		expect(html).toContain('data-scene-object="cinematic-field"');
		expect(html).toContain('data-scene-object="evidence-sheet"');
		expect(html).toContain('alt="Conference room"');
		expect(html).toContain("Decision headline");
		expect(html).toContain("Nastuh Abootalebi / Unsplash");
		expect(html).not.toContain("site-06-hero__media");
	});

	it("renders an evidence sheet as a labelled semantic record", () => {
		const html = renderToStaticMarkup(
			<EvidenceSheet label="Observed answer" annotation="Primary source · reviewed 26 Aug 2026">
				<p>The answer remains tied to evidence.</p>
			</EvidenceSheet>,
		);
		expect(html).toContain('data-scene-object="evidence-sheet"');
		expect(html).toContain('aria-label="Observed answer"');
		expect(html).toContain("The answer remains tied to evidence.");
		expect(html).toContain("Primary source · reviewed 26 Aug 2026");
	});

	it("keeps one question fixed across a comparison", () => {
		const html = renderToStaticMarkup(<ComparisonStage {...literalComparisonFixture} />);
		expect(html.match(/Which company can support this decision\?/g)).toHaveLength(1);
		expect(html).toContain('data-scene-object="comparison-stage"');
		expect(html).toContain('role="tablist"');
		expect(html).toContain("Baseline");
		expect(html).toContain("Retest");
		expect(html).toContain("Evidence");
		expect(html).toContain("Judgment");
		expect(html).toContain("Next action");
	});

	it("presents human and agent readings from the same public record", () => {
		const html = renderToStaticMarkup(
			<DualReadingStage
				locale="en"
				heading="One public fact. Two useful readings."
				initialId="category"
				records={[
					{
						id: "category",
						prompt: "What kind of company is Yonaris?",
						human: "AI-native MarTech infrastructure.",
						meaning: "The category stays broader than one search tactic.",
						fact: "Yonaris is AI-native MarTech infrastructure.",
						evidence: "Yonaris public company description.",
						boundary: "This does not claim every planned capability is available.",
						stableId: "yonaris.category.ai-native-martech",
					},
				]}
			/>,
		);
		expect(html).toContain('data-scene-object="dual-reading-stage"');
		expect(html).toContain("<h2>One public fact. Two useful readings.</h2>");
		expect(html).toContain('id="yonaris.category.ai-native-martech"');
		expect(html).toContain("Human reading");
		expect(html).toContain("Agent reading");
		for (const label of ["Fact", "Evidence", "Boundary", "Stable ID"]) expect(html).toContain(label);
	});

	it("connects every record selector to an existing record tabpanel", () => {
		const html = renderToStaticMarkup(
			<DualReadingStage
				locale="en"
				heading="One public fact. Two useful readings."
				initialId="category"
				records={[
					{
						id: "category",
						prompt: "What kind of company is Yonaris?",
						human: "AI-native MarTech infrastructure.",
						meaning: "The category stays broader than one search tactic.",
						fact: "Yonaris is AI-native MarTech infrastructure.",
						evidence: "Yonaris public company description.",
						boundary: "This does not claim every planned capability is available.",
						stableId: "yonaris.category.ai-native-martech",
					},
					{
						id: "scope",
						prompt: "Is Yonaris limited to AI-search visibility?",
						human: "No. AI answers are one observable entry point.",
						meaning: "The scope remains a wider MarTech system.",
						fact: "Yonaris connects questions, facts, evidence, and next action.",
						evidence: "Yonaris public scope statement.",
						boundary: "Capabilities are stated only when available.",
						stableId: "yonaris.scope.martech-system",
					},
				]}
			/>,
		);
		const selectorGroup = html.match(/<div class="site-06-dual-stage__records"[\s\S]*?<\/div>/)?.[0] ?? "";
		const controlledIds = [...selectorGroup.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);

		expect(controlledIds).toHaveLength(2);
		for (const id of controlledIds) {
			expect(html).toContain(`id="${id}" role="tabpanel"`);
		}
	});

	it("can own a page hierarchy without changing the shared h2 default", () => {
		const pageStage = renderToStaticMarkup(
			<DualReadingStage
				locale="en"
				eyebrow="Human + Agent"
				headingLevel="h1"
				heading="The same company should remain clear to people and agents."
				description="One canonical public record, two reading hierarchies."
				initialId="category"
				records={[
					{
						id: "category",
						prompt: "Category",
						human: "AI-native MarTech infrastructure.",
						meaning: "The category stays broader than one search tactic.",
						fact: "Yonaris is AI-native MarTech infrastructure.",
						evidence: "Yonaris public company description.",
						boundary: "This does not claim every planned capability is available.",
						stableId: "yonaris.category.ai-native-martech",
					},
				]}
			/>,
		);
		expect(pageStage.match(/<h1/g) ?? []).toHaveLength(1);
		expect(pageStage).toContain("Human + Agent");
		expect(pageStage).toContain('aria-label="Choose a public fact"');
		expect(pageStage).toContain('aria-label="Choose a reading"');
	});
});
