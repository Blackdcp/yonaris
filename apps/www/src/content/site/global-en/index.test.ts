import { describe, expect, it } from "vitest";
import { GLOBAL_ENGLISH_CONTENT } from "./index";

describe("global English content contracts", () => {
	it("frames the journey around uncertainty and truthful evidence", () => {
		expect(GLOBAL_ENGLISH_CONTENT.home.headline).toBe("Know how AI represents your brand—and what to do next.");
		expect(GLOBAL_ENGLISH_CONTENT.home.problem).toMatch(/uncertainty/i);
		expect(GLOBAL_ENGLISH_CONTENT.product.boundary).toMatch(/not self-service/i);
		expect(GLOBAL_ENGLISH_CONTENT.research.boundary).toMatch(/not universal/i);
		expect(GLOBAL_ENGLISH_CONTENT.diagnostic.enabled).toBe(false);
		expect(JSON.stringify(GLOBAL_ENGLISH_CONTENT)).not.toMatch(/CMO|marketing role|sales role/i);
	});
});
