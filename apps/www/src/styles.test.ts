import { existsSync, readFileSync } from "node:fs";
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
		const expected = [
			'@import "tailwindcss";',
			'@import "tw-animate-css";',
			'@import "./styles/experience/base.css";',
			'@import "./styles/experience/site-06.css";',
		];
		const positions = expected.map((item) => stylesheet.indexOf(item));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		for (const retired of ["site-core", "styles/pages", "global-en/core", "zh-cn/core", "global-agent/core"]) {
			expect(stylesheet).not.toContain(retired);
		}
		for (const regional of ["global.css", "china.css", "agent.css"]) expect(stylesheet).not.toContain(regional);
		expect(read("components/experience/global/global-pages.tsx")).not.toContain("global.css");
		expect(read("components/experience/china/china-pages.tsx")).not.toContain("china.css");
		expect(existsSync(join(sourceRoot, "styles/experience/china.css"))).toBe(false);
		expect(read("components/experience/agent/agent-pages.tsx")).toContain('import "@/styles/experience/agent.css";');
	});

	it("keeps the brand palette and rejects retired visible selectors", () => {
		const output = ["base.css", "site-06.css", "agent.css"].map((file) => read(`styles/experience/${file}`)).join("\n");
		for (const value of ["#0b1220", "#f6f4f1", "#ff6a00"]) expect(output.toLowerCase()).toContain(value);
		for (const value of ["#071724", "#f2ede3", "#ef5a1a"]) expect(output.toLowerCase()).toContain(value);
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

	it("keeps Agent controls and machine-document metadata readable at mobile widths", () => {
		const agent = read("styles/experience/agent.css");
		const mobile = agent.slice(
			agent.lastIndexOf("@media (max-width: 880px)"),
			agent.lastIndexOf("@media (prefers-reduced-motion"),
		);
		for (const selector of [
			".agent-experience .mode-link a",
			".agent-experience .locale-switch",
			".agent-experience__topics a",
			".agent-experience__facts article > a",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs a 44px target`).toContain("min-width: var(--target-mobile)");
			expect(declarations, `${selector} needs a 44px target`).toContain("min-height: var(--target-mobile)");
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
		}

		for (const selector of [
			".agent-experience__transport dd",
			".agent-experience__record-meta dd",
			".agent-experience__facts article h3",
			".agent-experience__facts dd",
			".agent-experience__limitations li",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the body floor`).toContain("font-size: var(--text-body-mobile)");
			expect(declarations, `${selector} needs the body line-height`).toContain("line-height: 1.4");
		}

		for (const selector of [
			".agent-experience__transport dt",
			".agent-experience__record-meta dt",
			".agent-experience__facts dt",
			".agent-experience__kicker",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
			expect(declarations, `${selector} needs a legible line-height`).toContain("line-height: 1.4");
		}

		const brand = ruleFor(mobile, ".agent-experience__brand");
		expect(brand).toContain("display: inline-flex");
		expect(brand).toContain("min-height: var(--target-mobile)");

		const transportLink = ruleFor(mobile, ".agent-experience__transport a");
		expect(transportLink).toContain("display: inline-flex");
		expect(transportLink).toContain("min-width: var(--target-mobile)");
		expect(transportLink).toContain("min-height: var(--target-mobile)");
	});

	it("keeps Agent desktop micro-labels readable and Chinese headings stable at tablet width", () => {
		const agent = read("styles/experience/agent.css");
		for (const selector of [
			".agent-experience__identity",
			".agent-experience .mode-link a",
			".agent-experience .locale-switch",
			".agent-experience__kicker",
			".agent-experience__transport dt",
			".agent-experience__record-meta dt",
			".agent-experience__facts dt",
			".agent-experience__fact-index code",
		]) {
			expect(ruleFor(agent, selector), `${selector} needs the desktop supplementary floor`).toContain(
				"font-size: 0.75rem",
			);
		}
		expect(agent).toMatch(
			/@media \(max-width: 1100px\)[\s\S]*?\.agent-experience\[data-agent-locale="zh"\] \.agent-experience__intro h1[^{]*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*break-word;/,
		);
		expect(ruleFor(agent, ".agent-experience__topics")).toContain("overflow-x: auto");
	});

	it("styles the Chinese anxiety and system interactions inside Site 06", () => {
		const site = read("styles/experience/site-06.css");
		expect(ruleFor(site, ".site-06-anxiety")).toContain("box-shadow: var(--site-shadow)");
		expect(ruleFor(site, ".site-06-system")).toContain("display: grid");
		expect(ruleFor(site, ".site-06-system__records")).toContain("min-width: 0");
		const mobile = site.slice(site.indexOf("@media (max-width: 720px)"));
		const disclosure = ruleFor(mobile, ".site-06 .lead-disclosure a");
		expect(disclosure).toContain("display: inline-flex");
		expect(disclosure).toContain("min-width: var(--target-mobile)");
		expect(disclosure).toContain("min-height: var(--target-mobile)");
	});

	it("keeps the Agent Human-return control editorial instead of a filled orange button", () => {
		const agent = read("styles/experience/agent.css");
		const action = ruleFor(agent, ".agent-experience__human-return");
		expect(action).toContain("border-bottom: 2px solid var(--site-orange)");
		expect(action).not.toContain("background: var(--site-orange)");
	});

	it("removes the retired English stylesheet after Site 06 takes ownership", () => {
		expect(existsSync(join(sourceRoot, "styles/experience/global.css"))).toBe(false);
		expect(read("components/experience/global/global-pages.tsx")).not.toContain("global.css");
	});

	it("locks the Site 06 visual limits and motion fallback", () => {
		const css = read("styles/experience/site-06.css");
		const reducedMotion = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
		expect(css).toContain("--site-navy: #071724");
		expect(css).toContain("--site-orange: #ef5a1a");
		expect(css).toContain("font-size: clamp(38px, 4vw, 48px)");
		expect(css).toContain("@media (prefers-reduced-motion: reduce)");
		expect(reducedMotion).toMatch(/\.site-06-hero__media:hover img\s*\{[^}]*transform:\s*none;/s);
	});

	it("keeps cinematic depth and cancels photo breathing for reduced motion", () => {
		const css = read("styles/experience/site-06.css");
		const reducedMotion = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
		for (const selector of [
			".site-06-cinematic",
			".site-06-evidence-sheet",
			".site-06-comparison-stage",
			".site-06-dual-stage",
		]) {
			expect(ruleFor(css, selector), `${selector} must remain a scene primitive`).not.toBe("");
		}
		expect(ruleFor(css, ".site-06-cinematic::before")).toMatch(/linear-gradient/);
		expect(ruleFor(css, ".site-06-cinematic__media")).toContain(
			"animation: site-06-photo-breathe 24s ease-in-out infinite alternate",
		);
		expect(css).toContain("@keyframes site-06-photo-breathe");
		expect(ruleFor(reducedMotion, ".site-06-cinematic__media")).toContain("animation: none");
		expect(ruleFor(reducedMotion, ".site-06-cinematic__media")).toContain("transform: none");
	});

	it("styles Site 06 actions, photo credits, section leads, and the shared contact form", () => {
		const css = read("styles/experience/site-06.css");
		const action = ruleFor(css, ".site-06-action");
		expect(action).toContain("min-height: 44px");
		expect(action).toContain("background: transparent");
		expect(action).toContain("border-bottom: 2px solid var(--site-orange)");
		expect(action).not.toContain("background: var(--site-orange)");
		expect(ruleFor(css, ".site-06-hero__media figcaption")).toContain("position: absolute");
		expect(ruleFor(css, ".site-06-section__intro")).toContain("display: grid");
		expect(ruleFor(css, ".site-06 .lead-form")).toContain("display: grid");
		expect(ruleFor(css, ".site-06 .lead-form input")).toContain("min-height: 48px");
		expect(ruleFor(css, ".site-06 .lead-form button")).toContain("background: var(--site-orange)");
	});

	it("resets the English Contact submit from the inherited capsule", () => {
		const css = read("styles/experience/site-06.css");
		const contactSubmit = ruleFor(css, ".site-06-contact-form .lead-form button");
		expect(contactSubmit).toContain("border-radius: 0");
		expect(contactSubmit).toContain("border-bottom: 3px solid var(--site-orange)");
		expect(contactSubmit).toContain("background: transparent");
	});
});
