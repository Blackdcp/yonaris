import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(sourceRoot, relative), "utf8");

function ruleFor(source: string, selector: string): string {
	for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = (match[1] ?? "")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.split(",")
			.map((item) => item.trim());
		if (selectors.includes(selector)) return match[2] ?? "";
	}
	return "";
}

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

	it("applies mobile floors to the concrete Global component selectors that render small text", () => {
		const global = read("styles/experience/global.css");
		const mobile = global.slice(global.lastIndexOf("@media (max-width: 640px)"), global.lastIndexOf("@media (prefers-reduced-motion"));
		const functionalSelectors = [
			".sf-shell .sf-answer-field__topline",
			".sf-shell .sf-answer-field__scope span",
			".sf-shell .sf-answer-field__answer dt",
			".sf-shell .sf-answer-evidence header > span",
			".sf-shell .sf-product-lens__record dt",
			".sf-shell .sf-change-path__detail dt",
			".sf-shell .sf-market-atlas__question dt",
			".sf-shell .sf-constellation__detail small",
		];
		const bodySelectors = [
			".sf-shell .sf-answer-field__answer dd",
			".sf-shell .sf-answer-evidence li p",
			".sf-shell .sf-product-lens__record dd",
			".sf-shell .sf-change-path__detail p",
			".sf-shell .sf-change-path__detail dd",
			".sf-shell .sf-market-atlas__question dd",
			".sf-shell .sf-constellation__detail p",
			".sf-shell .sf-contact-signal li small",
		];

		for (const selector of functionalSelectors) {
			expect(ruleFor(mobile, selector), `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
		}
		for (const selector of bodySelectors) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the body floor`).toContain("font-size: var(--text-body-mobile)");
			expect(declarations, `${selector} needs the body line-height`).toContain("line-height: 1.4");
		}
		expect(mobile).not.toContain(":where(p:not(.sf-lead), dd)");
	});

	it("keeps the light Company record explicitly dark and makes every footer anchor a 44px box", () => {
		const global = read("styles/experience/global.css");
		const panel = ruleFor(global, ".sf-constellation__detail");
		const label = ruleFor(global, ".sf-constellation__detail span");
		const body = ruleFor(global, ".sf-constellation__detail p");
		const limit = ruleFor(global, ".sf-constellation__detail small");
		const footerAnchor = ruleFor(global, ".sf-footer a[href]");

		expect(panel).toContain("color: var(--sf-ink)");
		expect(label).toContain("color: #713207");
		expect(body).toContain("color: #28313d");
		expect(limit).toContain("color: #3d4652");
		expect(footerAnchor).toContain("display: inline-flex");
		expect(footerAnchor).toContain("min-width: var(--target-mobile)");
		expect(footerAnchor).toContain("min-height: var(--target-mobile)");
	});

	it("removes legacy Global selectors once their replacement artefacts own the experience", () => {
		const global = read("styles/experience/global.css");
		for (const retired of [
			"sf-answer-signal",
			"sf-home-movement",
			"sf-product-lens__signal-card",
			"sf-product-lens__meter",
			"sf-product-lens__answer-stack",
			"sf-product-question",
			"sf-product-decisions",
			"sf-approach-principle",
			"sf-geo-differences",
			"sf-company-capabilities",
		]) {
			expect(global, `${retired} must not survive as orphan CSS`).not.toContain(`.${retired}`);
		}
		expect(global).not.toContain('[aria-pressed="true"]');
	});

	it("does not use continuous decorative keyframes", () => {
		const output = ["base.css", "global.css", "china.css", "agent.css"]
			.map((file) => read(`styles/experience/${file}`))
			.join("\n");
		expect(output).not.toMatch(/animation(?:-iteration-count)?\s*:[^;{}]*\binfinite\b/i);
	});
});
