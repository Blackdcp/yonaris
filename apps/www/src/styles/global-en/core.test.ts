import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global English style boundary", () => {
	it("stays responsive, reduced-motion safe, gradient free, and edition rooted", () => {
		const css = readFileSync(new URL("./core.css", import.meta.url), "utf8");
		expect(css).toContain(".global-en");
		expect(css).toContain("@media (max-width:");
		expect(css).toContain("prefers-reduced-motion: reduce");
		expect(css).not.toMatch(/gradient\s*\(/i);
		const selectorLines = css
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.endsWith("{") && !line.startsWith("@"));
		for (const selectorGroup of selectorLines) {
			for (const selector of selectorGroup.replace(/\{$/, "").split(",")) {
				expect(selector.trim()).toMatch(/^(\.global-en|\[data-edition="global-en"\])/);
			}
		}
	});
});
