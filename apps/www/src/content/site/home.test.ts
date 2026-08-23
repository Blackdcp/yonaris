import { describe, expect, it } from "vitest";
import { getApproachContent } from "./approach";
import { getDiagnosticContent } from "./diagnostic";
import { getGlobalContent, getHomeComposition } from "./global";
import { getProductContent } from "./product";
import { getResearchContent } from "./research";

const expectedStageOrder = ["product", "approach", "research", "diagnostic"];

describe("home content", () => {
	it("keeps the approved bilingual Product Stage hero", () => {
		expect(getGlobalContent("en").hero).toEqual({
			headline: "See how AI is shaping your market.",
			explanation:
				"Yonaris reveals how AI describes and compares your brand, which sources shape the answer, and where the market narrative can move.",
			websiteLabel: "Website",
			websitePlaceholder: "https://example.com",
			submitLabel: "Get a Free Diagnostic",
		});
		expect(getGlobalContent("zh").hero).toEqual({
			headline: "看清 AI 如何塑造你的市场",
			explanation: "Yonaris 揭示 AI 如何描述与比较你的品牌、哪些信息源正在影响答案，以及市场叙事还能向哪里生长",
			websiteLabel: "官网",
			websitePlaceholder: "https://example.com",
			submitLabel: "获取免费诊断",
		});
	});

	it("opens with the approved category and vision as ordinary identity copy", () => {
		expect(getGlobalContent("en")).toMatchObject({
			category: "AI-native MarTech",
			vision: "MarTech, rebuilt. For humans and agents.",
		});
		expect(getGlobalContent("zh")).toMatchObject({
			category: "AI 原生营销科技",
			vision: "重构 MarTech，同时面向人，也面向智能体。",
		});
	});

	it("owns every illustrative diagnostic-window string in the global module", () => {
		const english = getGlobalContent("en");
		const chinese = getGlobalContent("zh");

		expect(english.preview).toMatchObject({
			label: "Illustrative diagnostic",
			ariaLabel: "Illustrative market perception diagnostic",
			question: "What is Yonaris—and what category does it belong to?",
		});
		expect(chinese.preview).toMatchObject({
			label: "示例诊断",
			ariaLabel: "市场认知示例诊断",
			question: "Yonaris 是什么——它属于哪个品类？",
		});
		expect(english.preview.answers).toHaveLength(3);
		expect(chinese.preview.answers).toHaveLength(3);
		expect(english.preview.readout).toHaveLength(3);
		expect(chinese.preview.readout).toHaveLength(3);
		expect(english.preview.claimIds).toEqual(["home-illustrative-diagnostic"]);
		expect(chinese.preview.claimIds).toEqual(english.preview.claimIds);
	});

	it("marks the diagnostic window as illustrative with an explicit evidence boundary", () => {
		for (const locale of ["en", "zh"] as const) {
			const content = getGlobalContent(locale);
			const claim = content.claims.find(({ id }) => id === "home-illustrative-diagnostic");

			expect(claim).toMatchObject({ status: "illustrative", limitation: expect.any(String) });
		}

		expect(getGlobalContent("en").claims.find(({ id }) => id === "home-illustrative-diagnostic")?.limitation).toBe(
			"The window is an explanatory composition, not live telemetry, customer evidence, or a completed diagnostic.",
		);
		expect(getGlobalContent("zh").claims.find(({ id }) => id === "home-illustrative-diagnostic")?.limitation).toContain(
			"不是实时遥测、客户证据，也不是已经完成的诊断结果",
		);
	});

	it("defines one Product to Approach to Research to Diagnostic home sequence", () => {
		for (const locale of ["en", "zh"] as const) {
			expect(getGlobalContent(locale).home.stageOrder).toEqual(expectedStageOrder);
		}
	});

	it("consumes each destination preview by identity instead of copying its facts", () => {
		for (const locale of ["en", "zh"] as const) {
			const composition = getHomeComposition(locale);

			expect(composition.product).toBe(getProductContent(locale).homePreview);
			expect(composition.approach).toBe(getApproachContent(locale).homePreview);
			expect(composition.research).toBe(getResearchContent(locale).homePreview);
			expect(composition.diagnostic).toBe(getDiagnosticContent(locale).homeOffer);
		}
	});

	it("does not restore retired foundations, outcomes, or invented product modules", () => {
		const serialized = JSON.stringify([getGlobalContent("en"), getGlobalContent("zh")]);
		for (const prohibited of [
			"Four forms of intelligence",
			"四类情报",
			"Product Truth Graph",
			"Commercial Feedback",
			"0% → 93.3%",
		]) {
			expect(serialized).not.toContain(prohibited);
		}
	});
});
