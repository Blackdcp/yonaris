import { describe, expect, it } from "vitest";
import { findPublishedEditionPage, GLOBAL_ENGLISH_SECTION_IDS, getEdition } from "./registry";

const expectedPaths = ["/", "/product", "/approach", "/research", "/geo", "/company", "/diagnostic", "/privacy"];

describe("global English edition registry", () => {
	it("owns the complete global English route set as one edition", () => {
		const edition = getEdition("global-en");
		expect(edition.pages.map((page) => page.pathname)).toEqual(expectedPaths);
		for (const pathname of expectedPaths) expect(findPublishedEditionPage(pathname)?.editionId).toBe("global-en");
		expect(edition.primaryNavigation.map((ref) => ref.split(":")[1])).toEqual([
			"product",
			"approach",
			"research",
			"company",
		]);
	});

	it("freezes each page-specific section spine", () => {
		expect(GLOBAL_ENGLISH_SECTION_IDS.home).toEqual([
			"hero",
			"what-changed",
			"visible-outputs",
			"evidence-path",
			"delivery-model",
			"evidence-preview",
			"request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.product).toEqual([
			"scope-rings-hero",
			"evidence-workbench",
			"responsibility-lanes",
			"scope-matrix",
			"request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.approach).toEqual([
			"premise-hero",
			"four-step-path",
			"step-artifacts",
			"repeat-observation-boundary",
			"request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.research).toEqual([
			"ledger-hero",
			"metric-anatomy",
			"cohort-comparison",
			"answer-annotation",
			"limits-and-request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.geo).toHaveLength(6);
		expect(GLOBAL_ENGLISH_SECTION_IDS.company).toHaveLength(5);
		expect(GLOBAL_ENGLISH_SECTION_IDS.diagnostic).toHaveLength(4);
		expect(GLOBAL_ENGLISH_SECTION_IDS.privacy).toHaveLength(3);
	});
});
