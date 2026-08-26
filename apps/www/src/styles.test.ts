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
		const mobile = global.slice(
			global.lastIndexOf("@media (max-width: 48rem)"),
			global.lastIndexOf("@media (prefers-reduced-motion"),
		);
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
			".sf-shell .lead-form header p",
			".sf-shell .lead-confirmation p",
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
		for (const selector of [".sf-shell a[href]", ".sf-shell button", ".sf-shell summary"]) {
			expect(ruleFor(mobile, selector), `${selector} needs the tablet functional floor`).toContain(
				"font-size: max(var(--text-functional-mobile), 1em)",
			);
		}
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

	it("keeps the detached Global evidence rail headings legible on its dark surface", () => {
		const global = read("styles/experience/global.css");
		for (const selector of [".sf-answer-evidence h2", ".sf-answer-evidence li strong"]) {
			expect(ruleFor(global, selector), `${selector} needs an explicit light foreground`).toContain(
				"color: var(--sf-paper)",
			);
		}
	});

	it("keeps the Global market language label dark enough on its light panel", () => {
		const global = read("styles/experience/global.css");
		expect(ruleFor(global, ".sf-market-atlas__question span")).toContain("color: #713207");
	});

	it("keeps every desktop Approach tab inside a rectangular paint-safe path", () => {
		const global = read("styles/experience/global.css");
		expect(global).not.toMatch(/\.sf-change-path\s*\{[^}]*overflow:\s*clip;[^}]*\}/s);
		expect(global).toMatch(
			/\.sf-change-path__stages \.sf-change-path__stage:nth-child\(1\)\s*\{[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);[^}]*\}/s,
		);
	});

	it("keeps Global mode and locale text at the mobile functional floor", () => {
		const global = read("styles/experience/global.css");
		const mobile = global.slice(
			global.lastIndexOf("@media (max-width: 48rem)"),
			global.lastIndexOf("@media (prefers-reduced-motion"),
		);
		for (const selector of [".sf-shell .mode-link a", ".sf-shell .locale-switch"]) {
			expect(ruleFor(mobile, selector), `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
		}
	});

	it("keeps Global market-diagram labels at the mobile functional floor", () => {
		const global = read("styles/experience/global.css");
		const mobile = global.slice(
			global.lastIndexOf("@media (max-width: 48rem)"),
			global.lastIndexOf("@media (prefers-reduced-motion"),
		);
		for (const selector of [
			".sf-shell .sf-market-atlas__choices button span",
			".sf-shell .sf-market-atlas__question > span",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
			expect(declarations, `${selector} needs a legible line-height`).toContain("line-height: 1.4");
		}
	});

	it("keeps every visible Global micro-label above the mobile functional floor", () => {
		const global = read("styles/experience/global.css");
		const mobile = global.slice(
			global.lastIndexOf("@media (max-width: 48rem)"),
			global.lastIndexOf("@media (prefers-reduced-motion"),
		);
		for (const selector of [
			".sf-shell .sf-situation-rail > article > span",
			".sf-shell .sf-home-contact__statement > span",
			".sf-shell .lead-form > header > span",
			".sf-shell .sf-footer__links > div > span",
			".sf-shell .sf-home-world__node",
			".sf-shell .sf-market-atlas__node",
			".sf-shell .sf-geo-bridge__origin > span",
			".sf-shell .sf-geo-bridge__markets > div > span",
			".sf-shell .sf-constellation__detail > span",
			".sf-shell .sf-home-opening__shift span",
			".sf-shell .sf-answer-field__questions button span",
			".sf-shell .sf-answer-field__answer span",
			".sf-shell .sf-product-lens__rail button span",
			".sf-shell .sf-product-lens__screen > header span",
			".sf-shell .sf-product-lens__narrative > span",
			".sf-shell .sf-change-path__stages button span",
			".sf-shell .sf-change-path__detail span",
			".sf-shell .sf-contact-signal li span",
			".sf-shell .sf-contact-form-section__aside > span",
			".sf-shell .sf-contact-shortcut > span",
			".sf-shell .sf-data-route li span",
			".sf-shell .sf-privacy-details article > span",
			".sf-shell .sf-privacy-contact span",
			".sf-shell .lead-confirmation > span",
			".sf-shell .lead-form [data-lead-field] > label > span",
			".sf-shell .sf-answer-evidence li > span",
			".sf-shell .sf-product-record-boundary span",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
			expect(declarations, `${selector} needs a legible line-height`).toContain("line-height: 1.4");
		}

		for (const selector of [
			".sf-shell .sf-home-opening__shift strong",
			".sf-shell .sf-change-path__stages button strong",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the body floor`).toContain("font-size: var(--text-body-mobile)");
			expect(declarations, `${selector} needs the body line-height`).toContain("line-height: 1.4");
		}
	});

	it("keeps Agent controls and machine-document metadata readable at mobile widths", () => {
		const agent = read("styles/experience/agent.css");
		const mobile = agent.slice(
			agent.lastIndexOf("@media (max-width: 880px)"),
			agent.lastIndexOf("@media (prefers-reduced-motion"),
		);
		for (const selector of [
			".agent-experience__masthead .mode-link a",
			".agent-experience .locale-switch",
			".agent-experience .agent-experience__facts li a",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs a 44px target`).toContain("min-width: var(--target-mobile)");
			expect(declarations, `${selector} needs a 44px target`).toContain("min-height: var(--target-mobile)");
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
		}

		for (const selector of [
			".agent-experience .agent-experience__metadata dd",
			".agent-experience .agent-experience__metadata a",
			".agent-experience .agent-experience__facts li p",
			".agent-experience .agent-experience__limitations li",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the body floor`).toContain("font-size: var(--text-body-mobile)");
			expect(declarations, `${selector} needs the body line-height`).toContain("line-height: 1.4");
		}

		const metadataLabel = ruleFor(mobile, ".agent-experience .agent-experience__metadata dt");
		expect(metadataLabel).toContain("font-size: var(--text-functional-mobile)");

		const publicFactsLabel = ruleFor(mobile, ".agent-experience .agent-experience__intro > p:first-of-type");
		expect(publicFactsLabel).toContain("font-size: var(--text-functional-mobile)");
		expect(publicFactsLabel).toContain("line-height: 1.4");

		for (const selector of [
			".agent-experience .agent-experience__rail nav a em",
			".agent-experience .agent-experience__facts header em",
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

		const metadataLink = ruleFor(mobile, ".agent-experience .agent-experience__metadata a");
		expect(metadataLink).toContain("display: inline-flex");
		expect(metadataLink).toContain("min-width: var(--target-mobile)");
		expect(metadataLink).toContain("min-height: var(--target-mobile)");

		const topicRailLink = ruleFor(mobile, ".agent-experience .agent-experience__rail nav a");
		expect(topicRailLink).toContain("min-width: 9rem");
		expect(topicRailLink).toContain("flex: 0 0 9rem");
	});

	it("keeps Agent desktop micro-labels readable and Chinese headings stable at tablet width", () => {
		const agent = read("styles/experience/agent.css");
		for (const selector of [
			".agent-experience__identity",
			".agent-experience .mode-link a",
			".agent-experience .locale-switch",
			".agent-experience__rail > p",
			".agent-experience__rail nav a em",
			".agent-experience__intro > p:first-of-type",
			".agent-experience__metadata dt",
			".agent-experience__facts header em",
			".agent-experience__facts li a",
		]) {
			expect(ruleFor(agent, selector), `${selector} needs the desktop supplementary floor`).toContain(
				"font-size: 0.75rem",
			);
		}
		expect(agent).toMatch(
			/@media \(max-width: 1100px\)[\s\S]*?\.agent-experience\[data-agent-locale="zh"\] \.agent-experience__intro h1[^{]*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*break-word;/,
		);
		expect(agent).toMatch(
			/@media \(max-width: 880px\)[\s\S]*?\.agent-experience__rail-hint\s*\{[^}]*display:\s*flex;[^}]*position:\s*sticky;/,
		);
	});

	it("makes the China lead disclosure link a real mobile target", () => {
		const china = read("styles/experience/china.css");
		const mobileStart = china.indexOf("@media (max-width: 800px)");
		const narrowStart = china.indexOf("@media (max-width: 520px)", mobileStart);
		const mobile = china.slice(mobileStart, narrowStart);
		const disclosure = ruleFor(mobile, ".china-command .lead-disclosure a");
		expect(disclosure).toContain("display: inline-flex");
		expect(disclosure).toContain("min-width: var(--target-mobile)");
		expect(disclosure).toContain("min-height: var(--target-mobile)");
	});

	it("keeps the China home decision-path label and readout above their mobile floors", () => {
		const china = read("styles/experience/china.css");
		const mobileStart = china.indexOf("@media (max-width: 800px)");
		const narrowStart = china.indexOf("@media (max-width: 520px)", mobileStart);
		const mobile = china.slice(mobileStart, narrowStart);
		const label = ruleFor(mobile, ".china-command .china-home-hero__shift span");
		const readout = ruleFor(mobile, ".china-command .china-home-hero__shift strong");
		expect(label).toContain("font-size: var(--text-functional-mobile)");
		expect(label).toContain("line-height: 1.4");
		expect(readout).toContain("font-size: var(--text-body-mobile)");
		expect(readout).toContain("line-height: 1.4");
	});

	it("keeps China section micro-labels above the mobile functional floor", () => {
		const china = read("styles/experience/china.css");
		const mobileStart = china.indexOf("@media (max-width: 800px)");
		const narrowStart = china.indexOf("@media (max-width: 520px)", mobileStart);
		const mobile = china.slice(mobileStart, narrowStart);
		for (const selector of [
			".china-command .china-answer-flow__question > span",
			".china-command .china-home-global__copy > span",
			".china-command .china-home-lead > div > span",
			".china-command .lead-form > header > span",
			".china-command .china-product-workspace > header > span",
			".china-command .china-product-outputs__title > span",
			".china-command .china-product-outputs__stack > article > span",
			".china-command .china-product-close > span",
			".china-command .china-approach-router > header > span",
			".china-command .china-approach-close > div > span",
			".china-command .china-geo-bridge > header > span",
			".china-command .china-geo-close > div > span",
			".china-command .china-company-belief > header > span",
			".china-command .china-company-close > span",
			".china-command .china-diagnostic-form > div > span",
			".china-command .china-privacy-close > div > span",
			".china-command .china-company-network__center > p",
			".china-command .china-approach-promise span",
			".china-command .china-geo-contrast span",
			".china-command .china-company-belief article > span",
			".china-command .china-company-regions span",
			".china-command .china-privacy-details span",
		]) {
			const declarations = ruleFor(mobile, selector);
			expect(declarations, `${selector} needs the functional floor`).toContain(
				"font-size: var(--text-functional-mobile)",
			);
			expect(declarations, `${selector} needs a legible line-height`).toContain("line-height: 1.4");
		}

		const answerQuestion = ruleFor(mobile, ".china-command .china-answer-flow__question > div > p");
		expect(answerQuestion).toContain("font-size: max(var(--text-body-mobile), 14px)");
		expect(answerQuestion).toContain("line-height: 1.4");
	});

	it("keeps the China Approach index numerals above the tablet functional floor", () => {
		const china = read("styles/experience/china.css");
		const declarations = ruleFor(china, ".china-command .china-approach-intro__index > span");
		expect(declarations).toContain("font-size: var(--text-functional-mobile)");
		expect(declarations).toContain("line-height: 1.4");
	});

	it("keeps the Agent Human-return control dark on Signal Orange", () => {
		const agent = read("styles/experience/agent.css");
		expect(ruleFor(agent, ".agent-experience .agent-experience__human-return")).toContain("color: var(--agent-ink)");
	});

	it("keeps trust labels and delivery fallback links legible on their actual surfaces", () => {
		const global = read("styles/experience/global.css");
		const china = read("styles/experience/china.css");
		expect(ruleFor(global, ".sf-public-record > header > span")).toContain("color: var(--sf-orange-soft)");
		expect(ruleFor(global, ".sf-delivery-note a")).toContain("color: #8a3e0b");
		expect(ruleFor(china, ".china-delivery-note a")).toContain("color: var(--china-accent-on-light)");
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

	it("locks the Site 06 visual limits and motion fallback", () => {
		const css = read("styles/experience/site-06.css");
		expect(css).toContain("--site-navy: #071724");
		expect(css).toContain("--site-orange: #ef5a1a");
		expect(css).toContain("font-size: clamp(38px, 4vw, 48px)");
		expect(css).toContain("@media (prefers-reduced-motion: reduce)");
		expect(css).not.toMatch(/animation(?:-iteration-count)?\s*:[^;{}]*\binfinite\b/i);
	});
});
