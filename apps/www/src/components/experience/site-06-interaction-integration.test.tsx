import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EN_READING_RECORDS, PAGE_FACTS, ZH_READING_RECORDS } from "@/content/experience/canonical-public-facts";
import {
	ChinaApproachPage,
	ChinaCompanyPage,
	ChinaDiagnosticPage,
	ChinaGeoPage,
	ChinaHomePage,
	ChinaPrivacyPage,
	ChinaProductPage,
} from "./china/china-pages";
import {
	GlobalApproachPage,
	GlobalCompanyPage,
	GlobalDiagnosticPage,
	GlobalGeoPage,
	GlobalHomePage,
	GlobalPrivacyPage,
	GlobalProductPage,
} from "./global/global-pages";

const stableIds = [
	"yonaris.category.ai-native-martech",
	"yonaris.purpose.decision-system",
	"yonaris.scope.martech-system",
] as const;

function markup(page: React.ReactNode): string {
	return renderToStaticMarkup(page);
}

function expectUniqueStableIds(source: string): void {
	for (const id of stableIds) {
		const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		expect(source.match(new RegExp(`\\sid="${escaped}"`, "g")) ?? [], id).toHaveLength(1);
	}
}

function textContent(source: string): string {
	return source
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim();
}

function expectSemanticFactArticle(
	source: string,
	fact: { id: string; value: string; source: string; boundary: string },
): void {
	const escapedId = fact.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const article = source.match(new RegExp(`<article(?=[^>]*\\bid="${escapedId}")[^>]*>[\\s\\S]*?<\\/article>`))?.[0];
	expect(article, `${fact.id} must be a visible semantic article`).toBeTruthy();
	expect(article?.match(/<article\b/g) ?? [], `${fact.id} must not nest another article`).toHaveLength(1);
	expect(article?.match(/^<article[^>]*>/)?.[0] ?? "").not.toMatch(/\bhidden(?:=|\s|>)/);
	const visibleText = textContent(article ?? "");
	expect(visibleText).toContain(fact.value);
	expect(visibleText).toContain(fact.source);
	expect(visibleText).toContain(fact.boundary);
}

function readingFact(record: (typeof EN_READING_RECORDS)[number] | (typeof ZH_READING_RECORDS)[number]) {
	return {
		id: record.stableId,
		value: record.fact,
		source: record.evidence,
		boundary: record.boundary,
	};
}

describe("Site 06 interaction integration", () => {
	it("places the English scenes in the prescribed home, product, and company surfaces", () => {
		const home = markup(<GlobalHomePage />);
		const product = markup(<GlobalProductPage />);
		const company = markup(<GlobalCompanyPage />);

		const heroEnd = home.indexOf('class="site-06-section site-06-home-dossier"');
		const workbenchStart = home.indexOf('class="site-06-home-workbench"');
		const workbenchEnd = home.indexOf('data-scene-object="cinematic-field"', workbenchStart);
		const bridgeStart = home.indexOf('class="site-06-section site-06-home-bridge"');
		expect(home.slice(0, heroEnd)).toContain('data-scene-object="decision-trace"');
		expect(home.slice(workbenchStart, workbenchEnd)).toContain('data-scene-object="product-proof"');
		expect(home.slice(bridgeStart)).toContain('data-scene-object="canonical-record-transform"');
		expect(home).not.toContain('data-scene-object="fixed-claim-reader"');
		expect(home).not.toContain('data-scene-object="answer-workbench"');

		expect(product).toContain('id="yonaris.platform.inspectable-evidence"');
		expect(product).toContain('data-scene-object="product-proof"');
		expect(product).not.toContain('data-scene-object="trace-workbench"');

		expect(company).toContain('data-page-composition="canonical-record-field"');
		expect(company).toContain('data-scene-object="canonical-record-transform"');
		expect(company).not.toContain('data-scene-object="dual-reading-stage"');
		expect(company).toContain("<h1>The same company should remain clear to people and agents.</h1>");
		expectUniqueStableIds(home);
		expectUniqueStableIds(company);
	});

	it("keeps every replaced English and Chinese route anchor on an exact non-nested semantic fact article", () => {
		const enHome = markup(<GlobalHomePage />);
		const zhHome = markup(<ChinaHomePage />);
		const enProduct = markup(<GlobalProductPage />);
		for (const record of EN_READING_RECORDS.filter(({ id }) => id === "purpose" || id === "scope")) {
			expectSemanticFactArticle(enHome, readingFact(record));
		}
		for (const record of ZH_READING_RECORDS.filter(({ id }) => id === "purpose" || id === "scope")) {
			expectSemanticFactArticle(zhHome, readingFact(record));
		}
		expectSemanticFactArticle(enProduct, PAGE_FACTS.en.product);
	});

	it("places the Chinese scenes in the anxiety-first home and attaches product proof to the six-node system", () => {
		const home = markup(<ChinaHomePage />);
		const product = markup(<ChinaProductPage />);
		const company = markup(<ChinaCompanyPage />);

		const heroEnd = home.indexOf('class="site-06-zh-anxiety-field"');
		const sourceStart = home.indexOf('class="site-06-section site-06-zh-source-trace"');
		const practiceStart = home.indexOf('class="site-06-cinematic site-06-zh-practice-cinematic"');
		const truthStart = home.indexOf('class="site-06-section site-06-zh-public-truth"');
		expect(home.slice(0, heroEnd)).toContain('data-scene-object="decision-trace"');
		expect(home.slice(sourceStart, practiceStart)).toContain('data-scene-object="product-proof"');
		expect(home.slice(truthStart)).toContain('data-scene-object="canonical-record-transform"');
		expect(home).not.toContain('data-scene-object="fact-disclosure"');
		expect(home.slice(practiceStart)).toContain('src="/brand/site-06/working-session-original.jpg"');

		const preview = product.indexOf('data-scene-object="relationship-preview"');
		const system = product.indexOf('data-scene-object="system-field"');
		const output = product.indexOf('data-system-output="product-proof"');
		const proof = product.indexOf('data-scene-object="product-proof"');
		expect(preview).toBeGreaterThan(-1);
		expect(system).toBeGreaterThan(preview);
		expect(output).toBeGreaterThan(system);
		expect(proof).toBeGreaterThan(output);
		expect(product.match(/data-system-node=/g) ?? []).toHaveLength(6);
		expect(product).toContain('id="yonaris.platform.inspectable-evidence"');

		expect(company).toContain('data-page-composition="canonical-record-field-zh"');
		expect(company).toContain('data-scene-object="canonical-record-transform"');
		expect(company).not.toContain('data-scene-object="dual-reading-stage"');
		expect(company).not.toContain('class="site-06-zh-company-record"');
		expect(company).toContain("<h1>同一家公司，应该让人和 Agent 都读得清楚。</h1>");
		expectUniqueStableIds(home);
		expectUniqueStableIds(company);
	});

	it("keeps protected approach, across-market, and privacy routes free of the new scenes", () => {
		const protectedMarkup = [
			<GlobalApproachPage key="en-approach" />,
			<GlobalGeoPage key="en-geo" />,
			<GlobalPrivacyPage key="en-privacy" />,
			<ChinaApproachPage key="zh-approach" />,
			<ChinaGeoPage key="zh-geo" />,
			<ChinaPrivacyPage key="zh-privacy" />,
		].map(markup);

		for (const source of protectedMarkup) {
			expect(source).not.toMatch(/data-scene-object="(?:decision-trace|product-proof|canonical-record-transform)"/);
		}
	});

	it("keeps exactly three visible fields, exact payload names, and consultation-only expectations", () => {
		const en = markup(<GlobalDiagnosticPage />);
		const zh = markup(<ChinaDiagnosticPage />);
		const enPrivacy = markup(<GlobalDiagnosticPage requestType="privacy" />);
		const zhPrivacy = markup(<ChinaDiagnosticPage requestType="privacy" />);

		for (const source of [en, zh, enPrivacy, zhPrivacy]) {
			expect(source.match(/data-lead-field=/g) ?? []).toHaveLength(3);
			expect(source).toContain('id="yonaris.contact.three-fields"');
		}
		for (const name of ["name", "email", "company"]) expect(en).toContain(`name="${name}"`);
		expect(en).not.toContain('name="phone"');
		for (const name of ["name", "phone", "company"]) expect(zh).toContain(`name="${name}"`);
		expect(zh).not.toContain('name="email"');

		expect(en).toContain("frame one market question");
		expect(en).toContain("observed and evidenced");
		expect(en).toContain("one useful next action");
		expect(zh).toContain("最怕 AI 答错的客户问题");
		expect(zh).toContain("能否被观测");
		expect(zh).toContain("一个有用的下一步");
		for (const source of [enPrivacy, zhPrivacy]) {
			expect(source).not.toContain("frame one market question");
			expect(source).not.toContain("最怕 AI 答错的客户问题");
		}
		expect(en).toContain('src="/brand/site-06/working-session-original.jpg"');
	});
});
