import { MAX_COMPETITORS } from "@workspace/lib/constants";
import { describe, expect, it } from "vitest";
import { MAX_BRAND_DOMAINS, MAX_COMPETITOR_DOMAINS, MAX_RESOURCE_ALIASES } from "@/lib/brand-settings";
import { updateBrandInputSchema, updateCompetitorsInputSchema } from "./brands";

describe("customer brand resource limits", () => {
	it("bounds brand domain and alias arrays", () => {
		expect(() =>
			updateBrandInputSchema.parse({
				brandId: "stepfun",
				additionalDomains: Array.from({ length: MAX_BRAND_DOMAINS + 1 }, (_, i) => `domain-${i}.cn`),
			}),
		).toThrow();
		expect(() =>
			updateBrandInputSchema.parse({
				brandId: "stepfun",
				aliases: Array.from({ length: MAX_RESOURCE_ALIASES + 1 }, (_, i) => `Alias ${i}`),
			}),
		).toThrow();
	});

	it("bounds competitor count and per-competitor resources", () => {
		const competitor = { name: "Competitor", domains: ["competitor.cn"], aliases: [] };
		expect(() =>
			updateCompetitorsInputSchema.parse({
				brandId: "stepfun",
				competitors: Array.from({ length: MAX_COMPETITORS + 1 }, () => competitor),
			}),
		).toThrow();
		expect(() =>
			updateCompetitorsInputSchema.parse({
				brandId: "stepfun",
				competitors: [
					{
						...competitor,
						domains: Array.from({ length: MAX_COMPETITOR_DOMAINS + 1 }, (_, i) => `domain-${i}.cn`),
					},
				],
			}),
		).toThrow();
	});
});
