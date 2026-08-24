import { describe, expect, it } from "vitest";
import { GLOBAL_ENGLISH_CONTENT } from "./index";

describe("global English content contracts", () => {
	it("frames the journey around uncertainty and truthful evidence", () => {
		expect(GLOBAL_ENGLISH_CONTENT.home.headline).toBe("AI is already answering questions about your brand.");
		expect(GLOBAL_ENGLISH_CONTENT.home.bridge).toBe("Know what it says—and what to change.");
		expect(GLOBAL_ENGLISH_CONTENT.home.primaryAction).toBe("Request a diagnostic");
		expect(GLOBAL_ENGLISH_CONTENT.home.secondaryAction).toBe("Explore the product");
		expect(GLOBAL_ENGLISH_CONTENT.home.problem).toMatch(/uncertainty/i);
		expect(GLOBAL_ENGLISH_CONTENT.product.boundary).toMatch(/not self-service/i);
		expect(GLOBAL_ENGLISH_CONTENT.research.boundary).toMatch(/not universal/i);
		expect(JSON.stringify(GLOBAL_ENGLISH_CONTENT)).not.toMatch(/for (CMOs|marketers|founders|sales teams)/i);
	});
});
