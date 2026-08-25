import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(sourceRoot, relative), "utf8");

describe("zero-to-one stylesheet boundary", () => {
	it("loads shared styles once and lets each regional route own its stylesheet", () => {
		const stylesheet = read("styles.css");
		const expected = ['@import "tailwindcss";', '@import "tw-animate-css";', '@import "./styles/experience/base.css";'];
		const positions = expected.map((item) => stylesheet.indexOf(item));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		for (const retired of ["site-core", "styles/pages", "global-en/core", "zh-cn/core", "global-agent/core"]) {
			expect(stylesheet).not.toContain(retired);
		}
		for (const regional of ["global.css", "china.css", "agent.css"]) expect(stylesheet).not.toContain(regional);
		expect(read("components/experience/global/global-pages.tsx")).toContain(
			'import "../../../styles/experience/global.css";',
		);
		expect(read("components/experience/china/china-pages.tsx")).toContain(
			'import "../../../styles/experience/china.css";',
		);
		expect(read("components/experience/agent/agent-pages.tsx")).toContain('import "@/styles/experience/agent.css";');
	});

	it("keeps the brand palette and rejects retired visible selectors", () => {
		const output = ["base.css", "global.css", "china.css", "agent.css"]
			.map((file) => read(`styles/experience/${file}`))
			.join("\n");
		for (const value of ["#0b1220", "#f6f4f1", "#ff6a00"]) expect(output.toLowerCase()).toContain(value);
		expect(output).not.toMatch(/global-en__|zh-site__|global-cinematic|zh-decision|editorial-stage|decision-canvas/);
	});

	it("shares bounded motion, mobile type floors, and 44px target tokens", () => {
		const base = read("styles/experience/base.css");
		for (const contract of [
			"--motion-state: 220ms",
			"--motion-route: 260ms",
			"--text-functional-mobile: 0.75rem",
			"--text-body-mobile: 0.875rem",
			"--target-mobile: 44px",
		]) {
			expect(base).toContain(contract);
		}
		expect(base).toContain("@media (max-width: 640px)");
		expect(base).toContain("min-height: var(--target-mobile)");
		expect(base).toContain("line-height: 1.4");
		expect(base).toContain("@media (prefers-reduced-motion: reduce)");
		expect(base).toContain("0.01ms");
	});

	it("does not use continuous decorative keyframes", () => {
		const output = ["base.css", "global.css", "china.css", "agent.css"]
			.map((file) => read(`styles/experience/${file}`))
			.join("\n");
		expect(output).not.toMatch(/@keyframes|animation-iteration-count\s*:\s*infinite/i);
	});
});
