import { describe, expect, it } from "vitest";
import { buildGoogleModule, getGoogleModuleCitationCount, hasGoogleModuleContent } from "@/lib/google-module";

describe("Google module visibility", () => {
	it("retains a titleless productDocid citation and treats Google-only data as renderable", () => {
		const module = buildGoogleModule(
			[
				{
					prompt_id: "prompt-1",
					url: "https://www.google.com/search?prds=merchant:123,productDocid:9876543210123456789&q=product",
					domain: "google.com",
					title: null,
					count: 1,
				},
			],
			"PPIO",
			[],
			() => "Which inference platform should I choose?",
		);

		expect(module.shopping.products).toHaveLength(1);
		expect(module.shopping.products[0]?.name).toBe("Product 9876543210123456789");
		expect(hasGoogleModuleContent(module)).toBe(true);
		expect(getGoogleModuleCitationCount(module)).toBe(1);
	});
});
