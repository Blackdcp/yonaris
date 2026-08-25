import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Chinese Human visual boundary", () => {
	it("uses a decision-led regional composition instead of the global split shell", () => {
		const css = readFileSync(new URL("./core.css", import.meta.url), "utf8");
		expect(css).toContain(".zh-site");
		expect(css).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
		expect(css).toContain("position: sticky");
		expect(css).toContain("prefers-reduced-motion: reduce");
		expect(css).toContain("--zh-signal: var(--yonaris-signal)");
		expect(css).not.toContain("minmax(0, 0.88fr) minmax(34rem, 1.12fr)");
		expect(css).not.toMatch(/gradient\s*\(/i);
	});
});
