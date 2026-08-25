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

function plainText(markup: string): string {
	return markup
		.replace(/<[^>]+>/g, " ")
		.replace(/&(?:amp|quot|#x27|lt|gt);/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function componentBlocks(markup: string, tag: string, className: string): string[] {
	const pattern = new RegExp(`<${tag}[^>]*class="${className}"[^>]*>([\\s\\S]*?)</${tag}>`, "g");
	return [...markup.matchAll(pattern)].map((match) => match[1] ?? "");
}

function fieldNodesIn(block: string, attributeName: string): { name: string; value: string }[] {
	const pattern = new RegExp(`<div[^>]*${attributeName}="([^"]+)"[^>]*>([\\s\\S]*?)</div>`, "g");
	return [...block.matchAll(pattern)].map((match) => {
		const body = match[2] ?? "";
		const valueMarkup =
			body.match(/<dd[^>]*>([\s\S]*?)<\/dd>/)?.[1] ?? body.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? body;
		return { name: match[1] ?? "", value: plainText(valueMarkup) };
	});
}

function fieldsIn(block: string, attributeName: string): Map<string, string> {
	return new Map(fieldNodesIn(block, attributeName).map((field) => [field.name, field.value]));
}

function matchingElementEnd(markup: string, tag: string, openingIndex: number): number {
	const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, "g");
	tags.lastIndex = openingIndex;
	let depth = 0;
	for (const match of markup.matchAll(tags)) {
		depth += match[0].startsWith(`</${tag}`) ? -1 : 1;
		if (depth === 0) return (match.index ?? -1) + match[0].length;
	}
	return -1;
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
			expect(markup).toContain(key === "diagnostic" ? 'href="#contact-form"' : 'href="/diagnostic"');
			expect(markup).toContain(`data-page="${key}"`);
		}
	});

	it("gives every buyer-question state a distinct, substantive six-part illustrative answer", () => {
		const markup = markupFor("home");
		const expectedFields = ["question", "answer", "presence", "comparison", "citations", "action"] as const;
		const minimumLengths = {
			question: 50,
			answer: 150,
			presence: 55,
			comparison: 70,
			citations: 55,
			action: 55,
		} satisfies Record<(typeof expectedFields)[number], number>;
		const panels = componentBlocks(markup, "article", "sf-answer-field__answer");
		const rawRecords = panels.map((panel) => fieldNodesIn(panel, "data-answer-field"));
		const records = rawRecords.map((fields) => new Map(fields.map((field) => [field.name, field.value])));

		expect(markup.match(/data-situation=/g) ?? []).toHaveLength(5);
		expect(markup.match(/data-answer-question=/g) ?? []).toHaveLength(5);
		expect(panels).toHaveLength(5);
		for (const [index, record] of records.entries()) {
			expect(rawRecords[index]).toHaveLength(6);
			expect([...record.keys()]).toEqual(expectedFields);
			for (const field of expectedFields) {
				expect(record.get(field)?.length ?? 0, `${field} must contain concrete review content`).toBeGreaterThanOrEqual(
					minimumLengths[field] ?? 0,
				);
			}
		}
		for (const field of expectedFields) {
			expect(
				new Set(records.map((record) => record.get(field))).size,
				`${field} must change with the selected state`,
			).toBe(5);
		}
		expect(new Set(records.map((record) => expectedFields.map((field) => record.get(field)).join("|"))).size).toBe(5);
		expect(markup).toContain('aria-selected="true"');
		expect(markup).toContain('data-scene-output="answer-field"');
		expect(markup).toContain("Illustrative buyer question");
		expect(markup).toContain("Complete illustrative answer");
	});

	it("binds an exact five-item evidence rail directly after the closed homepage opening", () => {
		const home = markupFor("home");
		const openingStart = home.indexOf('<section class="sf-home-opening">');
		const openingEnd = matchingElementEnd(home, "section", openingStart);
		const evidenceStart = home.indexOf('<section class="sf-answer-evidence"');
		const rail = home.match(
			/<section class="sf-answer-evidence"[^>]*data-evidence-rail="selected-record"[^>]*aria-labelledby="([^"]+)"[^>]*>([\s\S]*?)<\/section>/,
		);
		const defaultPanel = fieldsIn(
			componentBlocks(home, "article", "sf-answer-field__answer")[0] ?? "",
			"data-answer-field",
		);
		const evidenceItems = [
			...(rail?.[2] ?? "").matchAll(/<li[^>]*data-evidence-item="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g),
		];
		const expectedItems = [
			["question", "Selected buyer question"],
			["answer", "Complete answer"],
			["brand-alternatives", "Brand and alternatives"],
			["citations", "Visible citations"],
			["action", "Next review item"],
		] as const;

		expect(rail, "the opening artefact must be a labelled region").not.toBeNull();
		expect(rail?.[2]).toContain(`<h2 id="${rail?.[1]}">`);
		expect(openingStart).toBeGreaterThan(-1);
		expect(openingEnd).toBe(evidenceStart);
		expect(evidenceItems.map((item) => item[1])).toEqual(expectedItems.map(([id]) => id));
		for (const [index, [id, label]] of expectedItems.entries()) {
			const item = evidenceItems[index];
			expect(item?.[2]).toContain(`<strong>${label}</strong>`);
			expect(plainText(item?.[2] ?? "").length, `${id} evidence must be substantive`).toBeGreaterThanOrEqual(70);
		}
		expect(plainText(evidenceItems[0]?.[2] ?? "")).toContain(defaultPanel.get("question"));
		expect(plainText(evidenceItems[1]?.[2] ?? "")).toContain(defaultPanel.get("answer"));
		expect(plainText(evidenceItems[2]?.[2] ?? "")).toContain(defaultPanel.get("presence"));
		expect(plainText(evidenceItems[2]?.[2] ?? "")).toContain(defaultPanel.get("comparison"));
		expect(plainText(evidenceItems[3]?.[2] ?? "")).toContain(defaultPanel.get("citations"));
		expect(plainText(evidenceItems[4]?.[2] ?? "")).toContain(defaultPanel.get("action"));
		expect(home).toContain('data-evidence-record="shortlist"');
		expect(home.indexOf("data-evidence-rail")).toBeLessThan(home.indexOf("sf-situation-chapter"));
	});

	it("gives evidence headings unique IDs when the homepage review renders more than once", () => {
		expect(subject?.GLOBAL_PAGES, "Global Human pages must exist").toBeDefined();
		if (!subject?.GLOBAL_PAGES) return;
		const Home = subject.GLOBAL_PAGES.home;
		const markup = renderToStaticMarkup(
			<>
				<Home />
				<Home />
			</>,
		);
		const rails = [
			...markup.matchAll(
				/<section class="sf-answer-evidence"[^>]*aria-labelledby="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g,
			),
		];
		const ids = rails.map((rail) => rail[1] ?? "");

		expect(rails).toHaveLength(2);
		expect(new Set(ids).size).toBe(2);
		for (const rail of rails) expect(rail[2]).toContain(`<h2 id="${rail[1]}">`);
	});

	it("shows a controllable four-part product journey", () => {
		const product = markupFor("product");
		const panels = componentBlocks(product, "section", "sf-product-lens__panel");
		const rawRecords = panels.map((panel) => fieldNodesIn(panel, "data-decision-field"));
		const records = rawRecords.map((fields) => new Map(fields.map((field) => [field.name, field.value])));

		expect(product.match(/data-product-step=/g) ?? []).toHaveLength(4);
		expect(product.match(/aria-controls="product-panel-/g) ?? []).toHaveLength(4);
		expect(product).toContain('data-scene-output="product-lens"');
		expect(panels).toHaveLength(4);
		for (const [index, record] of records.entries()) {
			expect(rawRecords[index], `Product panel ${index + 1} must render exactly four field nodes`).toHaveLength(4);
			expect([...record.keys()]).toEqual(["input", "evidence", "decision", "action"]);
			expect([...record.values()].every((value) => value.length >= 35)).toBe(true);
		}
		expect(new Set(records.map((record) => [...record.values()].join("|"))).size).toBe(4);
	});

	it("renders the footer links inside the shared 44px target contract", () => {
		const footer = markupFor("home").match(/<footer class="sf-footer">([\s\S]*?)<\/footer>/)?.[1] ?? "";
		expect(footer.match(/<a /g) ?? []).toHaveLength(10);
		expect(footer).toContain('class="sf-footer__home-link"');
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

	it("routes diagnostic shell calls to action to the explicit form anchor without an occluding fixed bar", () => {
		const markup = markupFor("diagnostic");
		const header = markup.match(/<header class="sf-header">([\s\S]*?)<\/header>/)?.[1] ?? "";

		expect(markup).toContain('<section class="sf-contact-form-section" id="contact-form">');
		expect(header.match(/href="#contact-form"/g) ?? []).toHaveLength(2);
		expect(markup).not.toContain('class="sf-mobile-cta"');
	});

	it("publishes an inspectable managed-review trust record without inventing outcomes", () => {
		const product = markupFor("product");
		const company = markupFor("company");
		const privacy = markupFor("privacy");

		expect(product).toContain('data-public-trust="managed-review"');
		expect(product).toContain("Yonaris runs a hands-on review and keeps the selected evidence in a workspace");
		expect(product).toContain("not a self-serve ranking dashboard");
		expect(product).toContain("complete answer snapshot");
		expect(product).toContain("citations only when the answer exposes them");
		expect(product).toContain("named-alternative comparison");
		expect(product).toContain("prioritized next review");
		expect(product).toContain("recheck record");
		expect(product).toContain(
			"Rechecks are scheduled around the agreed questions, rather than run as continuous monitoring",
		);
		expect(company).toContain('data-public-trust="first-party-records"');
		expect(company).toContain('href="/agent/product.md"');
		expect(company).toContain('href="/agent/company.md"');
		expect(company).toContain('href="/agent/catalog.json"');
		expect(company).toContain("Last reviewed: 2026-08-25");
		expect(company).toContain(
			"do not prove customer outcomes, rankings, coverage beyond the selected scope, or live AI observations",
		);
		expect(company).toContain('href="mailto:black.dcp@outlook.com"');
		expect(company).toContain("Questions about these records or privacy?");
		expect(company).not.toContain("If the form cannot confirm delivery");
		expect(privacy).toContain("The page confirms form delivery only after the delivery service accepts the request");
		expect(privacy).toContain('href="mailto:black.dcp@outlook.com"');
	});

	it("keeps internal design vocabulary out of customer-facing pages", () => {
		const rendered = (["home", "product", "approach", "geo", "company"] as PageKey[])
			.map((page) => markupFor(page))
			.join("\n");
		expect(rendered).not.toMatch(/Answer field|Product lens|Market comparison lens|observed gap|observable parts/i);
		expect(markupFor("product")).toContain("Illustrative buying question");
	});
});
