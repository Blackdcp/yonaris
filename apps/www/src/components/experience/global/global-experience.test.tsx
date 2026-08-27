import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

type PageKey = "home" | "product" | "approach" | "geo" | "company" | "diagnostic" | "privacy";
type Page = () => React.ReactNode;
type GlobalModule = { GLOBAL_PAGES?: Record<PageKey, Page> };
type ReadingScenesModule = {
	EN_READING_RECORDS?: readonly { id: string; fact: string }[];
};

const subject = (await import("./global-pages").catch(() => undefined)) as GlobalModule | undefined;
const scenes = (await import("./global-scenes").catch(() => undefined)) as ReadingScenesModule | undefined;
const keys: PageKey[] = ["home", "product", "approach", "geo", "company", "diagnostic", "privacy"];
const compositions = {
	home: "cinematic-orbit",
	product: "evidence-workbench",
	approach: "comparison-field",
	company: "dual-reading-field",
	geo: "market-editorial",
	diagnostic: "contact-cinematic",
	privacy: "privacy-editorial",
} as const satisfies Record<PageKey, string>;

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
	for (const [route, composition] of Object.entries(compositions) as [PageKey, string][]) {
		it(`${route} has its own approved composition`, () => {
			expect(markupFor(route)).toContain(`data-page-composition="${composition}"`);
		});
	}

	it("does not route English pages through the old generic hero media", () => {
		const pages = keys.map(markupFor);
		expect(pages.filter((html) => html.includes("site-06-hero__media"))).toHaveLength(0);
	});

	it("publishes the approved English narrative on every primary page", () => {
		expect(text("home")).toContain("See what buyers are being told before the first conversation.");
		expect(text("product")).toContain("See what shaped the shortlist.");
		expect(text("approach")).toContain("Proof should be something your team can review.");
		expect(text("company")).toContain("The same company should remain clear to people and agents.");
		expect(text("diagnostic")).toContain("Tell us who to contact. We’ll begin with the buying decision.");
	});

	it("publishes the canonical category fact without category drift", () => {
		const category = scenes?.EN_READING_RECORDS?.find((record) => record.id === "category");
		expect(category?.fact).toBe(
			"AI-native MarTech infrastructure built for decisions made by people and shaped by agents.",
		);
	});

	it("presents across-market value without internal origin framing", () => {
		const geo = text("geo");
		expect(geo).toContain(
			"Market, language, category wording, alternatives and evidence conditions stay visible around the buying decision.",
		);
		expect(geo).not.toContain("without turning geography into a customer-origin story");
		expect(geo).not.toMatch(/\b(?:customer[- ]origin|origin|destination|inbound|outbound)\b/i);
	});

	it("uses a market-conditions document instead of an orbit motif across markets", () => {
		const geo = markupFor("geo");
		expect(geo).not.toContain("data-orbit-field");
		expect(geo).not.toContain('class="site-06-orbit"');
		expect(text("geo")).toMatch(/market.*language.*category.*alternatives.*evidence/i);
		expect(geo).toContain('aria-label="Market conditions record"');
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

		expect(home).toContain('data-scene-object="fixed-claim-reader"');
		expect(home).toContain('aria-label="Choose a reading"');
		expect(home).toContain("Illustrative buying question and answer evidence");
		expect(home).toContain('data-scene-object="inline-evidence-note"');
		expect(home).toContain("Illustrative method record · not a customer result");
		expect(product).toContain('aria-label="Inspect an observed answer"');
		expect(product.match(/data-evidence-state=/g) ?? []).toHaveLength(3);
		expect(approach).toContain('aria-label="Illustrative method record · not a customer result"');
		expect(approach.match(/data-review-state=/g) ?? []).toHaveLength(2);
		expect(company).toContain('aria-label="Read public facts"');
		expect(company.match(/data-stable-id=/g) ?? []).toHaveLength(3);
		expect(company).toContain("yonaris.category.ai-native-martech");
		expect(company).toContain("yonaris.purpose.decision-system");
		expect(company).toContain("yonaris.scope.martech-system");
	});

	it("keeps Home to one fixed claim and one Human or Agent mode switch", () => {
		const home = markupFor("home");
		const start = home.indexOf('data-scene-object="fixed-claim-reader"');
		const end = home.indexOf('class="site-06-section site-06-home-dossier"');
		const orbitReader = home.slice(start, end);

		expect(start).toBeGreaterThan(-1);
		expect(orbitReader.match(/role="tab"/g) ?? []).toHaveLength(2);
		expect(orbitReader.match(/role="tabpanel"/g) ?? []).toHaveLength(2);
		expect(orbitReader).toContain("Human reading");
		expect(orbitReader).toContain("Agent reading");
		for (const label of ["Fact", "Evidence", "Boundary", "Stable ID"]) expect(orbitReader).toContain(label);
		for (const label of ["Category", "Purpose", "Scope"]) expect(orbitReader).not.toContain(`>${label}<`);
	});

	it("puts Home evidence phrases inside the answer and updates one attached margin note", () => {
		const home = markupFor("home");
		const start = home.indexOf('data-scene-object="inline-evidence-note"');
		const end = home.indexOf('class="site-06-home-workbench"');
		const dossier = home.slice(start, end);
		const answerStart = dossier.indexOf('class="site-06-buyer-dossier__answer"');
		const answerEnd = dossier.indexOf("</div>", answerStart);
		const answer = dossier.slice(answerStart, answerEnd);

		expect(answer.match(/role="tab"/g) ?? []).toHaveLength(3);
		expect(dossier.match(/role="tabpanel"/g) ?? []).toHaveLength(3);
		expect(dossier.match(/class="site-06-buyer-dossier__note"/g) ?? []).toHaveLength(1);
		expect(dossier).not.toMatch(/<dt>(?:Source|Boundary|Buying effect)<\/dt>/);
	});

	it("does not repeat one shared CTA and public-fact dashboard across exact route leads", () => {
		for (const [key, endMarker] of [
			["product", 'aria-label="Answer dossier · Illustrative structure"'],
			["approach", 'class="site-06-same-question-preview"'],
			["diagnostic", 'id="contact-form"'],
			["geo", 'class="site-06-editorial-photo"'],
		] as const) {
			const markup = markupFor(key);
			const lead = markup.slice(markup.indexOf("<main"), markup.indexOf(endMarker));
			expect(lead).not.toContain('class="site-06-action"');
			expect(lead).not.toContain('class="site-06-public-fact__meta"');
		}
		expect(markupFor("home")).toContain('class="site-06-action" href="/diagnostic"');
	});

	it("changes Product source, boundary and buying effect with the selected phrase", () => {
		const product = markupFor("product");
		expect(product).toContain('data-scene-object="trace-workbench"');
		expect(product).toContain('class="site-06-trace-workbench site-06-inspector"');
		const traceWorkbench = product.slice(product.indexOf('data-scene-object="trace-workbench"'));
		expect(traceWorkbench.match(/role="tab"/g) ?? []).toHaveLength(3);
		const answerEnd = traceWorkbench.indexOf("</blockquote>");
		expect(traceWorkbench.slice(0, answerEnd).match(/role="tab"/g) ?? []).toHaveLength(3);
		expect(traceWorkbench.match(/data-evidence-state=/g) ?? []).toHaveLength(3);
		expect(traceWorkbench.match(/<dt>Source<\/dt>/g) ?? []).toHaveLength(3);
		expect(traceWorkbench.match(/<dt>Boundary<\/dt>/g) ?? []).toHaveLength(3);
		expect(traceWorkbench.match(/<dt>Buying effect<\/dt>/g) ?? []).toHaveLength(3);
		expect(product).toContain("Company capability record · public company material");
		expect(product).toContain("Scoped public evidence · first-party owner");
		expect(product).toContain("Public delivery method · stated operating conditions");
	});

	it("holds one question constant across Approach baseline and retest", () => {
		const approach = markupFor("approach");
		expect(approach).toContain('data-scene-object="comparison-stage"');
		expect(approach).toContain('class="site-06-comparison-stage site-06-review"');
		expect(
			approach.match(/Which company can support this decision without adding risk for the buying team\?/g) ?? [],
		).toHaveLength(1);
		expect(approach).toContain("Baseline");
		expect(approach).toContain("Retest");
	});

	it("exposes Company fact and reading controls above the first section boundary", () => {
		const company = markupFor("company");
		const dualReading = company.indexOf('data-scene-object="dual-reading-stage"');
		const firstSectionBoundary = company.indexOf('class="site-06-section');
		expect(dualReading).toBeGreaterThan(-1);
		expect(dualReading).toBeLessThan(firstSectionBoundary);
		expect(company).toContain('class="site-06-dual-stage site-06-reading"');
		for (const label of ["Category", "Purpose", "Scope", "Human reading", "Agent reading"]) {
			expect(company).toContain(label);
		}
		expect(company.match(/<h1/g) ?? []).toHaveLength(1);
		expect(company).not.toContain('class="site-06-company-intro"');
		const stage = company.slice(company.indexOf('data-scene-object="dual-reading-stage"'), firstSectionBoundary);
		expect(stage).toContain("One public record. Two legitimate readers.");
		expect(stage).toContain("<h1");
	});

	it("integrates exactly three visible Diagnostic fields into one cinematic scene", () => {
		const diagnostic = markupFor("diagnostic");
		const cinematicStart = diagnostic.indexOf('data-scene-object="cinematic-field"');
		const formStart = diagnostic.indexOf('id="contact-form"');
		const cinematicEnd = diagnostic.indexOf("</section>", formStart);
		expect(cinematicStart).toBeGreaterThan(-1);
		expect(formStart).toBeGreaterThan(cinematicStart);
		expect(cinematicEnd).toBeGreaterThan(formStart);
		expect(diagnostic.match(/data-lead-field=/g) ?? []).toHaveLength(3);
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
		expect(approach).toContain("Photo: Pavel Danilyuk / Pexels");
		expect(diagnostic).toContain('src="/brand/site-06/glass-venue.jpg"');
		expect(diagnostic).toContain("Photo: Zerrin Velizade / Pexels");
	});

	it("discloses the localized contact-data processor, purpose, retention, and deletion route", () => {
		const privacy = markupFor("privacy");
		expect(privacy).toContain("Resend");
		expect(privacy).toContain("email processor");
		expect(privacy).toContain("understand and respond to your request");
		expect(privacy).toContain("processed and stored in the United States");
		expect(privacy).toContain('href="https://resend.com/docs/dashboard/domains/regions"');
		expect(privacy).toContain('href="https://resend.com/legal/dpa"');
		expect(privacy).toContain("documentation</a> and its <a");
		expect(privacy).toContain("reviewed manually");
		expect(privacy).toContain("same contact and company details");
		expect(privacy).toContain("does not automatically delete");
		expect(privacy).toContain('href="/diagnostic?intent=privacy"');
		expect(privacy).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
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
