import { describe, expect, it } from "vitest";
import { getOpportunityScopesForBrand, toAdminOpportunityBrands } from "./opportunities-admin-scopes";

describe("toAdminOpportunityBrands", () => {
	it("keeps only enabled scored Programs and omits observation scopes", () => {
		expect(
			toAdminOpportunityBrands([
				{
					id: "ppio",
					name: "PPIO",
					scopes: [
						{
							id: "china",
							name: "China Market",
							market: "CN",
							locale: "zh-CN",
							enabled: true,
							samplingEvaluationRole: "scored",
							promptCount: 8,
						},
						{
							id: "diagnostic",
							name: "Browser Extension Diagnostic",
							market: "US",
							locale: "en-US",
							enabled: true,
							samplingEvaluationRole: "observation",
							promptCount: 1,
						},
						{
							id: "legacy",
							name: "Legacy",
							market: "US",
							locale: "en-US",
							enabled: true,
							samplingEvaluationRole: null,
							promptCount: 0,
						},
						{
							id: "retired",
							name: "Retired",
							market: "US",
							locale: "en-US",
							enabled: false,
							samplingEvaluationRole: "scored",
							promptCount: 4,
						},
					],
				},
				{
					id: "empty",
					name: "Empty",
					scopes: [
						{
							id: "off",
							name: "Off",
							market: "US",
							locale: "en-US",
							enabled: false,
							samplingEvaluationRole: "scored",
							promptCount: 3,
						},
					],
				},
			]),
		).toEqual([
			{
				id: "ppio",
				name: "PPIO",
				scopes: [{ id: "china", name: "China Market", market: "CN", locale: "zh-CN", promptCount: 8 }],
			},
		]);
	});
});

describe("getOpportunityScopesForBrand", () => {
	it("returns no Programs until a brand is selected", () => {
		const brands = [
			{
				id: "ppio",
				name: "PPIO",
				scopes: [{ id: "china", name: "China Market", market: "CN", locale: "zh-CN", promptCount: 8 }],
			},
		];

		expect(getOpportunityScopesForBrand(brands, "")).toEqual([]);
		expect(getOpportunityScopesForBrand(brands, "ppio")).toEqual(brands[0]?.scopes);
	});
});
