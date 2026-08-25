import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOBAL_ENGLISH_SECTION_IDS } from "@/editions/registry";
import { ApproachPage } from "./approach-page";
import { CompanyPage } from "./company-page";
import { DiagnosticPage } from "./diagnostic-page";
import { GeoPage } from "./geo-page";
import { HomePage } from "./home-page";
import { PrivacyPage } from "./privacy-page";
import { ProductPage } from "./product-page";
import { ResearchPage } from "./research-page";

const pages = {
	home: HomePage,
	product: ProductPage,
	approach: ApproachPage,
	research: ResearchPage,
	geo: GeoPage,
	company: CompanyPage,
	diagnostic: DiagnosticPage,
	privacy: PrivacyPage,
} as const;

describe("global English pages", () => {
	for (const [key, Page] of Object.entries(pages) as [keyof typeof pages, () => React.ReactNode][]) {
		it(`${key} is a complete graphical edition page`, () => {
			const markup = renderToStaticMarkup(<Page />);
			expect(markup.match(/<main/g) ?? []).toHaveLength(1);
			expect(markup.match(/<h1/g) ?? []).toHaveLength(1);
			expect(markup).toContain('data-edition="global-en"');
			expect(markup).toContain("data-graphic");
			const positions = GLOBAL_ENGLISH_SECTION_IDS[key].map((id) => markup.indexOf(`id="${id}"`));
			expect(positions.every((position) => position >= 0)).toBe(true);
			expect(positions).toEqual([...positions].sort((a, b) => a - b));
			expect(markup).not.toMatch(/for (CMOs|marketers|founders|sales teams)/i);
		});
	}

	it("labels demonstrations and exposes only the approved live global lead fields", () => {
		const home = renderToStaticMarkup(<HomePage />);
		const diagnostic = renderToStaticMarkup(<DiagnosticPage />);
		expect(home).toContain("Interface demonstration — no customer or live observation data.");
		expect(diagnostic).toContain('name="name"');
		expect(diagnostic).toContain('name="email"');
		expect(diagnostic).toContain('name="company"');
		expect(diagnostic).not.toContain('name="phone"');
		expect(diagnostic).not.toContain('name="website"');
		expect(diagnostic).not.toContain("mailto:");
	});

	it("composes the homepage around the interactive product story", () => {
		const markup = renderToStaticMarkup(<HomePage />);
		const sectionIds = [
			"hero",
			"operating-loop",
			"market-shift",
			"buyer-questions",
			"product-preview",
			"evidence-boundary",
			"human-agent-parity",
			"request-close",
		] as const;
		const positions = sectionIds.map((id) => markup.indexOf(`id="${id}"`));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(markup).toContain('data-graphic="answer-studio"');
		expect(markup).toContain('data-visual-system="global-cinematic"');
		expect(markup).toContain('data-stage="global-hero"');
		expect(markup).toContain('data-stage="operating-system"');
		expect(markup).toContain('data-layout="editorial-stage"');
		expect(markup).toContain('data-tone="ink"');
		expect(markup).not.toContain('class="global-en__section-head"');
		expect(markup).not.toContain("global-en__section-number");
		expect(markup).toContain("Know what it says—and what to change.");
		expect(markup).not.toContain('data-graphic="output-stack"');
	});

	it("gives every global route a distinct visual protagonist", () => {
		const protagonists = {
			home: "answer-orbit",
			product: "operating-system",
			approach: "evidence-path",
			research: "evidence-ledger",
			geo: "answer-constellation",
			company: "responsibility-field",
			diagnostic: "diagnostic-brief",
			privacy: "privacy-route",
		} as const;
		for (const [key, protagonist] of Object.entries(protagonists) as [keyof typeof pages, string][]) {
			const Page = pages[key];
			const markup = renderToStaticMarkup(<Page />);
			expect(markup).toContain(`data-protagonist="${protagonist}"`);
		}
	});

	it("turns the product page into one inspectable operating system", () => {
		const markup = renderToStaticMarkup(<ProductPage />);
		const sectionIds = [
			"scope-rings-hero",
			"evidence-workbench",
			"operating-loop",
			"responsibility-lanes",
			"request-close",
		] as const;
		const positions = sectionIds.map((id) => markup.indexOf(`id="${id}"`));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(markup).toContain('data-graphic="product-workbench"');
		expect(markup).toContain("Scope");
		expect(markup).toContain("Answers");
		expect(markup).toContain("Evidence");
		expect(markup).toContain("Experiments");
	});

	it("explains the approach as a reviewable evidence journey", () => {
		const markup = renderToStaticMarkup(<ApproachPage />);
		const sectionIds = [
			"premise-hero",
			"evidence-journey",
			"review-artifacts",
			"repeat-observation-boundary",
			"request-close",
		] as const;
		const positions = sectionIds.map((id) => markup.indexOf(`id="${id}"`));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(markup).toContain('data-graphic="evidence-journey"');
	});

	it("makes evidence definitions and answer relationships explorable", () => {
		const research = renderToStaticMarkup(<ResearchPage />);
		const geo = renderToStaticMarkup(<GeoPage />);
		expect(research).toContain('data-graphic="evidence-explorer"');
		expect(geo).toContain('data-graphic="answer-relationship-map"');
		expect(research).not.toMatch(/\b\d+(?:\.\d+)?%\b/);
		expect(geo).toContain("Global service capability is configured, not universal.");
	});

	it("never renders a broken in-page call to action", () => {
		for (const Page of Object.values(pages)) {
			const markup = renderToStaticMarkup(<Page />);
			for (const match of markup.matchAll(/href="#([^"]+)"/g)) expect(markup).toContain(`id="${match[1]}"`);
		}
	});
});
