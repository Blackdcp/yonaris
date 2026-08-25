import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(sourceRoot, relative), "utf8");

describe("zero-to-one stylesheet boundary", () => {
	it("loads only the new regional experience styles", () => {
		const stylesheet = read("styles.css");
		const expected = [
			'@import "tailwindcss";',
			'@import "tw-animate-css";',
			'@import "./styles/experience/base.css";',
			'@import "./styles/experience/global.css";',
			'@import "./styles/experience/china.css";',
			'@import "./styles/experience/agent.css";',
		];
		const positions = expected.map((item) => stylesheet.indexOf(item));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		for (const retired of ["site-core", "styles/pages", "global-en/core", "zh-cn/core", "global-agent/core"]) {
			expect(stylesheet).not.toContain(retired);
		}
	});

	it("keeps the brand palette and rejects retired visible selectors", () => {
		const output = ["base.css", "global.css", "china.css", "agent.css"]
			.map((file) => read(`styles/experience/${file}`))
			.join("\n");
		for (const value of ["#0b1220", "#f6f4f1", "#ff6a00"]) expect(output.toLowerCase()).toContain(value);
		expect(output).not.toMatch(/global-en__|zh-site__|global-cinematic|zh-decision|editorial-stage|decision-canvas/);
	});
});
