import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type PageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type Page = () => React.ReactNode;
type GlobalModule = { GLOBAL_PAGES?: Record<PageKey, Page> };

const subject = (await import("./global-pages").catch(() => undefined)) as GlobalModule | undefined;
const keys: PageKey[] = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];

function markupFor(page: PageKey): string {
	expect(subject?.GLOBAL_PAGES, "Global Human pages must exist").toBeDefined();
	if (!subject?.GLOBAL_PAGES) return "";
	return renderToStaticMarkup(subject.GLOBAL_PAGES[page]());
}

function text(page: PageKey): string {
	return markupFor(page)
		.replace(/<[^>]+>/g, " ")
		.replace(/&(?:amp|quot|#x27|lt|gt);/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

describe("Site 06 English experience", () => {
	it("publishes the approved English narrative on every primary page", () => {
		expect(text("home")).toContain("See what buyers are being told before the first conversation.");
		expect(text("product")).toContain("See what shaped the shortlist.");
		expect(text("approach")).toContain("Proof should be something your team can review.");
		expect(text("company")).toContain("The same company should remain clear to people and agents.");
		expect(text("diagnostic")).toContain("Tell us who to contact. We’ll begin with the buying decision.");
	});

	it("keeps rejected template patterns out of the English site", () => {
		const output = keys.map(markupFor).join("\n");
		expect(output).not.toMatch(/[↗→]/);
		expect(output).not.toMatch(/>0[1-9]</);
		expect(output).not.toContain("Explore global markets");
	});

	it("keeps one accessible page shell and the same-topic locale switch on every route", () => {
		const chinaPaths: Record<PageKey, string> = {
			home: "/zh",
			product: "/zh/product",
			approach: "/zh/approach",
			geo: "/zh/geo",
			company: "/zh/company",
			diagnostic: "/zh/diagnostic",
			privacy: "/zh/privacy",
		};

		for (const key of keys) {
			const markup = markupFor(key);
			expect(markup.match(/<main/g) ?? []).toHaveLength(1);
			expect(markup.match(/<h1/g) ?? []).toHaveLength(1);
			expect(markup).toContain('class="site-06-skip-link"');
			expect(markup).toContain('href="#site-06-main"');
			expect(markup).toContain(`<main id="site-06-main" tabindex="-1" data-page="${key}">`);
			expect(markup).toContain(`href="${chinaPaths[key]}"`);
			expect(markup.match(/<img src="\/brand\/logos\/yonaris-wordmark-/g) ?? []).toHaveLength(2);
			expect(markup).toContain('data-generation="site-06"');
			expect(markup).toContain(key === "diagnostic" ? 'id="contact-form"' : 'href="/diagnostic"');
		}
	});

	it("uses the approved navigation labels without foregrounding supporting routes", () => {
		const home = markupFor("home");
		const primary = home.match(/<nav class="site-06-primary-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
		expect(primary).toContain('href="/product">Platform</a>');
		expect(primary).toContain('href="/approach">Evidence</a>');
		expect(primary).toContain('href="/company">Human + Agent</a>');
		expect(primary).toContain('href="/diagnostic">Contact</a>');
		expect(primary).not.toContain('href="/geo"');
		expect(primary).not.toContain('href="/privacy"');
	});

	it("renders the approved Site 06 interactions as meaningful records", () => {
		const home = markupFor("home");
		const product = markupFor("product");
		const approach = markupFor("approach");
		const company = markupFor("company");

		expect(home).toContain('aria-label="Read public facts"');
		expect(home).toContain("Illustrative buying question and answer evidence");
		expect(home).toContain('aria-label="Inspect an observed answer"');
		expect(home).toContain("Illustrative method record · not a customer result");
		expect(product).toContain('aria-label="Inspect an observed answer"');
		expect(product.match(/data-evidence-state=/g) ?? []).toHaveLength(3);
		expect(approach).toContain('aria-label="Illustrative method record · not a customer result"');
		expect(approach.match(/data-review-state=/g) ?? []).toHaveLength(2);
		expect(company).toContain('aria-label="Read public facts"');
		expect(company.match(/data-stable-id=/g) ?? []).toHaveLength(3);
		expect(company).toContain("yonaris.category.ai-native-martech");
		expect(company).toContain("yonaris.purpose.answer-evidence");
		expect(company).toContain("yonaris.scope.martech-system");
	});

	it("labels every illustrative record truthfully", () => {
		const output = ["home", "product", "approach"].map((key) => markupFor(key as PageKey)).join("\n");
		expect(output).toContain("De-identified buying question");
		expect(output).toContain("Illustrative structure");
		expect(output).toContain("Illustrative method record · not a customer result");
		expect(output).not.toMatch(/real customer result|client result/i);
	});

	it("uses the approved photography with visible credits", () => {
		const home = markupFor("home");
		const product = markupFor("product");
		const approach = markupFor("approach");
		const diagnostic = markupFor("diagnostic");

		for (const markup of [home, product]) {
			expect(markup).toContain('src="/brand/site-06/conference-room.jpg"');
			expect(markup).toContain("Photo: Nastuh Abootalebi / Unsplash");
		}
		expect(approach).toContain('src="/brand/site-06/business-walk.jpg"');
		expect(approach).toContain("Photo: Mikhail Nilov / Pexels");
		expect(diagnostic).toContain('src="/brand/site-06/glass-venue.jpg"');
		expect(diagnostic).toContain("Photo: Zerrin Velizade / Pexels");
	});

	it("keeps the sales handoff to exactly three visible lead fields", () => {
		const markup = markupFor("diagnostic");
		expect(markup.match(/data-lead-field=/g) ?? []).toHaveLength(3);
		expect(markup).toContain('name="name"');
		expect(markup).toContain('name="email"');
		expect(markup).toContain('name="company"');
		expect(markup).not.toContain('name="phone"');
	});
});
