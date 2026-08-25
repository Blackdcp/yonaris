import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type PageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type Page = () => React.ReactNode;
type GlobalModule = { GLOBAL_PAGES?: Record<PageKey, Page> };

const subject = (await import("./global-pages").catch(() => undefined)) as GlobalModule | undefined;

function markupFor(page: PageKey): string {
	expect(subject?.GLOBAL_PAGES, "Global Human pages must exist").toBeDefined();
	if (!subject?.GLOBAL_PAGES) return "";
	return renderToStaticMarkup(subject.GLOBAL_PAGES[page]());
}

describe("Global zero-to-one experience", () => {
	it("keeps keyboard navigation and the same-topic China switch available on every page", () => {
		const chinaPaths: Record<PageKey, string> = {
			home: "/zh",
			product: "/zh/product",
			approach: "/zh/approach",
			geo: "/zh/geo",
			company: "/zh/company",
			diagnostic: "/zh/diagnostic",
			privacy: "/zh/privacy",
		};

		for (const [page, path] of Object.entries(chinaPaths) as [PageKey, string][]) {
			const markup = markupFor(page);
			expect(markup).toContain('class="sf-skip-link" href="#main-content"');
			expect(markup).toContain('<main id="main-content" tabindex="-1"');
			expect(markup).toContain(`href="${path}" data-locale-switch="zh"`);
		}
	});

	it("keeps the Yonaris identity and conversion path present on every page", () => {
		for (const key of ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as PageKey[]) {
			const markup = markupFor(key);
			expect(markup.match(/<img src="\/brand\/logos\/yonaris-wordmark-/g) ?? []).toHaveLength(2);
			expect(markup).toContain('href="/diagnostic"');
			expect(markup).toContain(`data-page="${key}"`);
		}
	});

	it("turns five buyer situations into an explorable Answer Field", () => {
		const markup = markupFor("home");
		expect(markup.match(/data-situation=/g) ?? []).toHaveLength(5);
		expect(markup.match(/data-answer-question=/g) ?? []).toHaveLength(5);
		expect(markup.match(/data-answer-field=/g) ?? []).toHaveLength(25);
		expect(markup).toContain('aria-selected="true"');
		expect(markup).toContain('data-scene-output="answer-field"');
		expect(markup).toContain("Illustrative buyer question");
	});

	it("places a concrete five-part review artefact directly after the homepage hero", () => {
		const home = markupFor("home");
		expect(home.match(/data-evidence-item=/g) ?? []).toHaveLength(5);
		expect(home).toContain("Selected buyer question");
		expect(home).toContain("Complete answer");
		expect(home).toContain("Brand and alternatives");
		expect(home).toContain("Visible citations");
		expect(home).toContain("Next review item");
		expect(home.indexOf("data-evidence-rail")).toBeLessThan(home.indexOf("sf-situation-chapter"));
	});

	it("shows a controllable four-part product journey", () => {
		const product = markupFor("product");
		expect(product.match(/data-product-step=/g) ?? []).toHaveLength(4);
		expect(product.match(/aria-controls="product-panel-/g) ?? []).toHaveLength(4);
		expect(product).toContain('data-scene-output="product-lens"');
		expect(product.match(/data-decision-field=/g) ?? []).toHaveLength(16);
		expect(product).toContain('data-decision-field="input"');
		expect(product).toContain('data-decision-field="evidence"');
		expect(product).toContain('data-decision-field="decision"');
		expect(product).toContain('data-decision-field="action"');
	});

	it("gives approach, markets, company, and privacy their own visual protagonists", () => {
		const approach = markupFor("approach");
		const markets = markupFor("geo");
		const company = markupFor("company");
		const privacy = markupFor("privacy");

		expect(approach.match(/data-change-stage=/g) ?? []).toHaveLength(4);
		expect(markets.match(/data-market-choice=/g) ?? []).toHaveLength(3);
		expect(markets.match(/data-market-node=/g) ?? []).toHaveLength(3);
		expect(company.match(/data-constellation-node=/g) ?? []).toHaveLength(4);
		expect(privacy.match(/data-data-step=/g) ?? []).toHaveLength(3);
	});

	it("makes supporting pages inspectable and explicit about buying boundaries", () => {
		const approach = markupFor("approach");
		const markets = markupFor("geo");
		const company = markupFor("company");
		const contact = markupFor("diagnostic");

		expect(approach.match(/data-approach-field="input"/g) ?? []).toHaveLength(4);
		expect(approach.match(/data-approach-field="output"/g) ?? []).toHaveLength(4);
		expect(markets.match(/data-market-field=/g) ?? []).toHaveLength(12);
		expect(markets).toContain('data-market-field="question"');
		expect(markets).toContain('data-market-field="category"');
		expect(markets).toContain('data-market-field="alternatives"');
		expect(markets).toContain('data-market-field="focus"');
		expect(company.match(/data-procurement-boundary=/g) ?? []).toHaveLength(4);
		expect(company).toContain("Scoped questions");
		expect(company).toContain("Full-answer review");
		expect(company).toContain("Explicit market context");
		expect(company).toContain("Repeatable checks");
		expect(contact).toContain("The first conversation determines");
		expect(contact).toContain("No prepared report is required");
	});

	it("adds one non-interactive scroll progress signal to every Global shell", () => {
		for (const key of ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"] as PageKey[]) {
			const markup = markupFor(key);
			expect(markup.match(/data-scroll-progress=/g) ?? []).toHaveLength(1);
			expect(markup).toContain('aria-hidden="true"');
		}
	});

	it("keeps the sales handoff to exactly three visible lead fields", () => {
		const markup = markupFor("diagnostic");
		expect(markup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(markup).toContain('name="name"');
		expect(markup).toContain('name="email"');
		expect(markup).toContain('name="company"');
		expect(markup).not.toContain('name="phone"');
	});

	it("keeps internal design vocabulary out of customer-facing pages", () => {
		const rendered = (["home", "product", "approach", "geo", "company"] as PageKey[])
			.map((page) => markupFor(page))
			.join("\n");
		expect(rendered).not.toMatch(/Answer field|Product lens|Market comparison lens|observed gap|observable parts/i);
		expect(markupFor("product")).toContain("Illustrative buying question");
	});
});
