import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { OpportunitiesGenerationControl, opportunityGenerationMessage } from "./opportunities-generation-control";

describe("OpportunitiesGenerationControl", () => {
	it("makes generation an explicit admin action for a brand and scope", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<OpportunitiesGenerationControl onGenerate={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain("Generate opportunities report");
		expect(markup).toContain("Brand");
		expect(markup).toContain("Program");
		expect(markup).toContain("<select");
		expect(markup).not.toContain("Measurement scope ID");
		expect(markup).not.toContain("Brand ID");
	});

	it("renders Chinese provider-tool controls while preserving brand, Program, market, and locale values", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<OpportunitiesGenerationControl
					onGenerate={vi.fn()}
					brands={[
						{
							id: "brand-provider-raw",
							name: "StepFun 原名",
							scopes: [
								{
									id: "scope-provider-raw",
									name: "China scored 原始",
									market: "CN",
									locale: "zh-CN",
									promptCount: 38,
								},
							],
						},
					]}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("生成优化机会报表");
		expect(markup).toContain("品牌");
		expect(markup).toContain("项目");
		expect(markup).toContain("选择品牌");
		expect(markup).toContain("选择项目");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain('value="brand-provider-raw"');
		expect(markup).not.toContain("Generate opportunities report");
	});
});

describe("opportunityGenerationMessage", () => {
	it("does not claim generation succeeded when the POST returns insufficient data", () => {
		expect(
			opportunityGenerationMessage({
				report: null,
				reason: "insufficient-data",
				generatedFor: null,
				lastEvaluatedAt: null,
			}),
		).toBe("No report was generated: this Program needs more tracking data.");
	});

	it("maps stable generation outcomes to Chinese without changing the response reason", () => {
		const result = {
			report: null,
			reason: "insufficient-data" as const,
			generatedFor: null,
			lastEvaluatedAt: null,
		};

		expect(opportunityGenerationMessage(result, "zh-CN")).toBe("未生成报表：此项目需要更多追踪数据。");
		expect(result.reason).toBe("insufficient-data");
	});
});
