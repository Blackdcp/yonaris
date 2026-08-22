import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Product Stage palette", () => {
	it("uses only the approved Product Stage color tokens", () => {
		const stylesheet = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
		const start = stylesheet.indexOf(".marketing-header--home");
		const end = stylesheet.indexOf(".marketing-hero-copy > *", start);

		expect(start).toBeGreaterThanOrEqual(0);
		expect(end).toBeGreaterThan(start);
		const productStageStyles = stylesheet.slice(start, end);
		expect(productStageStyles).not.toMatch(/--yonaris-(?:surface|blue-gray)/);
	});
});
