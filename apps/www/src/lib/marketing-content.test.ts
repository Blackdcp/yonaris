import { describe, expect, it } from "vitest";
import {
	MARKETING_ROUTES,
	MARKETING_SITEMAP_PATHS,
	buildDiagnosticMailto,
	getCoreFacts,
	getLocalizedPath,
	getMarketingContent,
	getMarketingDetailPage,
	getMarketingNavigation,
	getMarketingPageMeta,
	getProductContent,
	renderAgentDocument,
	renderAgentIndex,
	renderLlmsFull,
	renderLlmsIndex,
	validateDiagnosticInput,
} from "./marketing-content";

describe("marketing content", () => {
	it("exposes the truthful site-content model while legacy consumers migrate", () => {
		expect(getProductContent("en").meta.title).toBe("Make AI market answers observable.");
		expect(getCoreFacts("company", "en").claims).toContainEqual(
			expect.objectContaining({ id: "company-service-led-stage", status: "managed-delivery" }),
		);
	});

	it("separates the bilingual homepage conversion from the long-term brand thesis", () => {
		expect(getMarketingContent("en").homeHero).toMatchObject({
			headline: "See how AI is shaping your market.",
			explanation:
				"Yonaris reveals how AI describes and compares your brand, which sources shape the answer, and where the market narrative can move.",
		});
		expect(getMarketingContent("zh").homeHero).toMatchObject({
			headline: "看清 AI 如何塑造你的市场",
			explanation: "Yonaris 揭示 AI 如何描述与比较你的品牌、哪些信息源正在影响答案，以及市场叙事还能向哪里生长",
		});
		expect(getMarketingContent("en").brandThesis).toBe("MarTech, rebuilt. For humans and agents.");
		expect(getMarketingContent("zh").brandThesis).toBe("重构 MarTech，同时面向人，也面向智能体");
		expect(getMarketingContent("en").category).toBe("AI-native MarTech");
		expect(getMarketingContent("zh").cta.primary).toBe("获取免费诊断");
	});

	it("does not expose the removed hero copy through localized marketing content", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getMarketingContent(locale);
			expect(content).not.toHaveProperty("hero");
			expect(JSON.stringify(content)).not.toContain("AI-NATIVE MARTECH");
		}
	});

	it("provides localized page metadata with reciprocal canonical paths", () => {
		expect(getMarketingPageMeta("en", "home")).toEqual({
			title: "See how AI is shaping your market. | Yonaris",
			description:
				"Yonaris reveals how AI describes and compares your brand, which sources shape the answer, and where the market narrative can move.",
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

	it("publishes every core human and agent route exactly once", () => {
		expect(MARKETING_SITEMAP_PATHS).toHaveLength(19);
		expect(new Set(MARKETING_SITEMAP_PATHS).size).toBe(MARKETING_SITEMAP_PATHS.length);
		expect(MARKETING_SITEMAP_PATHS).toEqual(expect.arrayContaining(["/", "/zh", "/platform", "/zh/platform", "/agent", "/agent/company", "/llms.txt", "/llms-full.txt"]));
	});

	it("builds a localized homepage navigation model with real conversion and section targets", () => {
		expect(getMarketingNavigation("en")).toMatchObject({
			home: "/",
			items: [
				{ label: "Product", path: "/platform" },
				{ label: "Approach", path: "/methodology" },
				{ label: "Research", path: "/results" },
				{ label: "Company", path: "/#company" },
			],
			language: { label: "中文", path: "/zh" },
			diagnostic: { label: "Get a Free Diagnostic", path: "/diagnostic" },
		});
		expect(getMarketingNavigation("zh")).toMatchObject({
			home: "/zh",
			items: [
				{ label: "产品", path: "/zh/platform" },
				{ label: "方法", path: "/zh/methodology" },
				{ label: "研究", path: "/zh/results" },
				{ label: "公司", path: "/zh#company" },
			],
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

	it("publishes a complete agent index without inherited Elmo positioning", () => {
		const index = renderAgentIndex();
		expect(index).toContain("/agent/company");
		expect(index).toContain("/agent/platform");
		expect(index).toContain("/agent/methodology");
		expect(index).toContain("/agent/results");
		expect(index).not.toContain("self-hosted AI visibility platform");
		expect(renderLlmsIndex()).toContain("For humans and agents");
		expect(renderLlmsFull()).toContain("# Yonaris results evidence");
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
