import { describe, expect, it } from "vitest";
import { findPublishedEditionPage, GLOBAL_ENGLISH_SECTION_IDS, getEdition } from "./registry";

const expectedPaths = ["/", "/product", "/approach", "/research", "/geo", "/company", "/diagnostic", "/privacy"];
const expectedZhPaths = ["/zh", "/zh/product", "/zh/approach", "/zh/research", "/zh/geo", "/zh/company", "/zh/diagnostic", "/zh/privacy"];

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
			"operating-loop",
			"market-shift",
			"buyer-questions",
			"product-preview",
			"evidence-boundary",
			"human-agent-parity",
			"request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.product).toEqual([
			"scope-rings-hero",
			"evidence-workbench",
			"operating-loop",
			"responsibility-lanes",
			"request-close",
		]);
		expect(GLOBAL_ENGLISH_SECTION_IDS.approach).toEqual([
			"premise-hero",
			"evidence-journey",
			"review-artifacts",
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

describe("Chinese regional edition registry", () => {
	it("owns the complete released Chinese Human route set", () => {
		const edition = getEdition("zh-cn");
		expect(edition.pages.map((page) => page.pathname)).toEqual(expectedZhPaths);
		for (const pathname of expectedZhPaths) expect(findPublishedEditionPage(pathname)?.editionId).toBe("zh-cn");
		expect(edition.primaryNavigation.map((ref) => ref.split(":")[1])).toEqual(["product", "approach", "research", "company"]);
		expect(edition.diagnosticPolicy).toBe("regional-v2");
	});
});
