import { describe, expect, it } from "vitest";
import {
	MARKETING_ROUTES,
	buildDiagnosticMailto,
	getLocalizedPath,
	getMarketingContent,
	getMarketingDetailPage,
	getMarketingNavigation,
	getMarketingPageMeta,
	renderAgentDocument,
	validateDiagnosticInput,
} from "./marketing-content";

describe("marketing content", () => {
	it("keeps the approved thesis and primary conversion in both languages", () => {
		expect(getMarketingContent("en").hero.title).toEqual(["MarTech, rebuilt.", "For humans and agents."]);
		expect(getMarketingContent("en").category).toBe("AI-native MarTech");
		expect(getMarketingContent("zh").cta.primary).toBe("获取免费诊断");
		expect(getMarketingContent("zh").hero.title).toEqual(["重构 MarTech", "同时面向人，也面向智能体"]);
	});

	it("provides localized page metadata with reciprocal canonical paths", () => {
		expect(getMarketingPageMeta("en", "home")).toEqual({
			title: "MarTech, rebuilt. For humans and agents. | Yonaris",
			description:
				"Yonaris helps brands understand and improve how they are discovered, interpreted, compared, and chosen in an AI-mediated market.",
			canonicalPath: "/",
			alternatePath: "/zh",
		});
		expect(getMarketingPageMeta("zh", "home").canonicalPath).toBe("/zh");
	});

	it("gives every human page an English and Chinese route", () => {
		expect(MARKETING_ROUTES).toHaveLength(6);
		expect(MARKETING_ROUTES.every((route) => route.en && route.zh)).toBe(true);
		expect(getLocalizedPath("/methodology", "zh")).toBe("/zh/methodology");
		expect(getLocalizedPath("/zh/results", "en")).toBe("/results");
	});

	it("builds a localized navigation model with one conversion target", () => {
		expect(getMarketingNavigation("en")).toMatchObject({
		home: "/",
		language: { label: "中文", path: "/zh" },
		diagnostic: { label: "Get a Free Diagnostic", path: "/diagnostic" },
	});
		expect(getMarketingNavigation("zh")).toMatchObject({
			home: "/zh",
			language: { label: "EN", path: "/" },
			diagnostic: { label: "获取免费诊断", path: "/zh/diagnostic" },
		});
	});

	it("describes the operating system without presenting foundations as products", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getMarketingContent(locale);
			expect(content.capabilities).toHaveLength(4);
			expect(content.foundations).toHaveLength(4);
			expect(content.method.steps).toHaveLength(5);
			expect(content.evidence.scope).toEqual([6, 30, 24, 8, 768]);
			expect(content.geo.title).toBeTruthy();
		}
	});

	it("keeps every detail page useful and bilingual", () => {
		for (const page of ["platform", "methodology", "results", "geo"] as const) {
			const english = getMarketingDetailPage("en", page);
			const chinese = getMarketingDetailPage("zh", page);
			expect(english.summary).toBeTruthy();
			expect(chinese.summary).toBeTruthy();
			expect(english.sections.length).toBeGreaterThanOrEqual(3);
			expect(chinese.sections).toHaveLength(english.sections.length);
		}
	});

	it("renders agent facts from the same current-scope content", () => {
		const company = renderAgentDocument("company");
		expect(company).toContain("AI-native MarTech");
		expect(company).toContain("Canonical human URL: https://yonaris.com/");
		expect(company).toContain("Current scope");
		expect(company).toContain("Last updated: 2026-08-21");
		expect(company).not.toContain("four products");
	});

	it("builds an encoded diagnostic email without pretending to submit it", () => {
		const mailto = buildDiagnosticMailto(
			{
				brand: "Acme & Co",
				website: "https://acme.example",
				market: "Enterprise software",
				competitors: "Northwind, Contoso",
				question: "Which platform should a global team choose?",
				name: "Ava Chen",
				email: "ava@acme.example",
			},
			"en",
		);

		expect(mailto).toMatch(/^mailto:black\.dcp%40outlook\.com\?/);
		expect(mailto).toContain("Acme%20%26%20Co");
		expect(mailto).toContain("Which%20platform%20should%20a%20global%20team%20choose%3F");
	});

	it("blocks incomplete or malformed diagnostic requests before opening email", () => {
		expect(
			validateDiagnosticInput({
				brand: " ",
				website: "acme",
				market: "",
				competitors: "",
				question: "",
				name: "",
				email: "not-an-email",
			}),
		).toEqual(["brand", "website", "question", "name", "email"]);
		expect(
			validateDiagnosticInput({
				brand: "Acme",
				website: "https://acme.example",
				market: "",
				competitors: "",
				question: "Which option fits us?",
				name: "Ava",
				email: "ava@acme.example",
			}),
		).toEqual([]);
	});
});
