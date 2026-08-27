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

	it("keeps Human and Agent mode controls editorial, 44px, and visible outside the mobile menu", () => {
		const agent = read("styles/experience/agent.css");
		const site = read("styles/experience/site-06.css");
		const agentMode = ruleFor(agent, ".agent-experience .mode-link");
		const agentModeLink = ruleFor(agent, ".agent-experience .mode-link a");
		const humanMode = ruleFor(site, ".site-06-mode");
		const humanModeLink = ruleFor(site, ".site-06-mode a");
		expect(agentMode).not.toContain("border-radius: 999px");
		expect(agentMode).toMatch(/border-radius:\s*(?:0|2px)/);
		expect(agentModeLink).toContain("min-height: 44px");
		expect(humanMode).not.toContain("border-radius: 999px");
		expect(humanModeLink).toContain("min-height: 44px");
		const mobile = site.slice(site.indexOf("@media (max-width: 1050px)"), site.indexOf("@media (max-width: 900px)"));
		expect(ruleFor(mobile, ".site-06-header__mobile-mode")).toContain("display: block");
	});

	it("reserves a legible Human wordmark beside mobile mode and menu controls at 360 and 390", () => {
		const site = read("styles/experience/site-06.css");
		const tablet = site.slice(site.indexOf("@media (max-width: 1050px)"), site.indexOf("@media (max-width: 900px)"));
		const mobile = site.slice(
			site.indexOf("@media (max-width: 720px)"),
			site.indexOf("@media (prefers-reduced-motion"),
		);
		const acceptanceCases = [
			{ locale: "en", width: 360 },
			{ locale: "en", width: 390 },
			{ locale: "zh", width: 360 },
			{ locale: "zh", width: 390 },
		] as const;

		for (const { locale, width } of acceptanceCases) {
			const tabletHeader = ruleFor(tablet, ".site-06-header__inner");
			expect(tabletHeader, `${locale} ${width}px must reserve explicit brand, mode, locale, and menu tracks`).toContain(
				"grid-template-columns: minmax(120px, 1fr) auto auto auto",
			);
			expect(tabletHeader, `${locale} ${width}px must use deliberate control spacing`).toContain("gap: 12px");
			expect(mobile, `${locale} ${width}px must tighten spacing without hiding controls`).toMatch(
				/\.site-06-header__inner\s*\{[^}]*gap:\s*8px;/su,
			);
			expect(mobile, `${locale} ${width}px must move the mode rail to its own full-width row`).toMatch(
				/grid-template-areas:\s*"brand locale menu"\s*"mode mode mode";/su,
			);
			expect(ruleFor(mobile, ".site-06-brand"), `${locale} ${width}px needs a legible wordmark floor`).toContain(
				"min-width: 120px",
			);
		}
	});

	it("keeps every compact Agent inner masthead and metadata band short enough to reveal the directory", () => {
		const agent = read("styles/experience/agent.css");
		const mobile = agent.slice(
			agent.lastIndexOf("@media (max-width: 880px)"),
			agent.lastIndexOf("@media (prefers-reduced-motion"),
		);
		const intro = ruleFor(mobile, ".agent-experience__route-intro");
		const introCopy = ruleFor(mobile, ".agent-experience__route-intro .agent-experience__intro-copy");
		const metadata = ruleFor(mobile, ".agent-experience__record-meta");

		expect(intro).toContain("min-height: 0");
		expect(intro).toContain("padding: 1rem 1.2rem");
		expect(introCopy).toContain("max-width: 100%");
		expect(metadata).toContain("padding: 0.7rem 1.2rem");
		expect(ruleFor(mobile, ".agent-experience__route-intro .agent-experience__human-return")).toContain(
			"margin-top: 0.7rem",
		);
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
		expect(ruleFor(css, ".site-06-cinematic > picture")).toContain("position: absolute");
		expect(ruleFor(css, ".site-06-cinematic > picture")).toContain("inset: 0");
		expect(ruleFor(css, ".site-06-editorial-photo > picture")).toContain("height: 100%");
		expect(css).toContain("@keyframes site-06-photo-breathe");
		expect(ruleFor(reducedMotion, ".site-06-cinematic__media")).toContain("animation: none");
		expect(ruleFor(reducedMotion, ".site-06-cinematic__media")).toContain("transform: none");
	});

	it("styles the three product interactions as editorial scene primitives", () => {
		const css = read("styles/experience/site-06.css");
		const trace = ruleFor(css, ".site-06-decision-trace");
		expect(trace).toContain("position: relative");
		expect(trace).toContain("display: grid");
		expect(trace).toContain("--site-06-trace-control-rail-offset: clamp(52px, 4vw, 60px)");
		expect(trace).not.toMatch(/background:|box-shadow:|border-radius:/);
		expect(ruleFor(css, ".site-06-decision-trace__question")).toContain("pointer-events: none");
		expect(ruleFor(css, ".site-06-decision-trace__rings")).toContain("aspect-ratio: 1");
		const traceButton = ruleFor(css, ".site-06-decision-trace__ring button");
		expect(traceButton).toContain("min-height: 44px");
		expect(traceButton).toContain("min-width: 44px");
		expect(traceButton).toContain("padding: 8px 6px");
		expect(traceButton).toContain("background: transparent");
		expect(traceButton).toContain("border-radius: 0");
		expect(traceButton).toContain("transform: translate(42%, calc(-50% + var(--site-06-trace-control-rail-offset)))");

		const proof = ruleFor(css, ".site-06-product-proof-scene");
		expect(proof).toContain("border-radius: 0");
		expect(proof).toContain("overflow: visible");
		expect(proof).not.toContain("overflow: clip");
		expect(proof).not.toContain("box-shadow");
		expect(proof).not.toContain("grid-template-columns: repeat(4");
		expect(ruleFor(css, ".site-06-product-proof-scene__ledger")).toContain("background: var(--site-paper)");
		const proofTab = ruleFor(css, ".site-06-product-proof-scene__tabs button");
		expect(proofTab).toContain("min-height: 44px");
		expect(proofTab).toContain("background: transparent");
		expect(proofTab).toContain("border-radius: 0");

		const canonical = ruleFor(css, ".site-06-canonical-record-transform");
		expect(canonical).toContain("border-top: 1px solid");
		expect(canonical).not.toMatch(/box-shadow:|grid-template-columns:\s*repeat\(2/);
		const canonicalButton = ruleFor(css, ".site-06-canonical-record-transform button");
		expect(canonicalButton).toContain("min-height: 44px");
		expect(canonicalButton).toContain("background: transparent");
		expect(canonicalButton).toContain("border-radius: 0");
		expect(ruleFor(css, '.site-06-canonical-record-transform input[type="range"]')).toContain("min-height: 44px");
	});

	it("keeps canonical microcopy readable and static rules neutral on warm paper", () => {
		const css = read("styles/experience/site-06.css");
		const proofContext = ruleFor(css, ".site-06-product-proof-context small");
		expect(proofContext).toContain("color: color-mix(in srgb, currentColor 68%, transparent)");
		expect(proofContext).not.toContain("currentColor 60%");
		for (const selector of [
			'.site-06-canonical-record-transform > p[role="status"]',
			".site-06-canonical-record-transform dt",
		]) {
			expect(ruleFor(css, selector), `${selector} needs the high-contrast functional color`).toContain(
				"color: color-mix(in srgb, currentColor 82%, transparent)",
			);
		}
		const representation = ruleFor(css, ".site-06-canonical-record-transform nav a");
		expect(representation).toContain("border-bottom: 1px solid var(--site-amber)");
		expect(representation).not.toContain("var(--site-orange)");
		const formSummary = ruleFor(css, ".site-06-contact-form .lead-form header > p");
		expect(formSummary).toContain("border-left: 2px solid var(--site-amber)");
		expect(formSummary).not.toContain("var(--site-orange)");
	});

	it("overrides the generic confirmation with a square dark localized contact scene", () => {
		const css = read("styles/experience/site-06.css");
		const confirmation = ruleFor(css, ".site-06-contact-form .lead-confirmation");
		expect(confirmation).toContain("border-radius: 0");
		expect(confirmation).toContain("background: var(--site-navy-secondary)");
		expect(confirmation).toContain("color: var(--site-white)");
		expect(ruleFor(css, ".site-06-contact-form .lead-confirmation > span")).toContain("color: var(--site-amber)");
		expect(ruleFor(css, ".site-06-contact-form .lead-confirmation p")).toContain("color: rgb(255 255 255 / 78%)");
	});

	it("linearizes the product interactions at mobile widths without page overflow", () => {
		const css = read("styles/experience/site-06.css");
		const mobile = css.slice(
			css.indexOf("@media (max-width: 720px)"),
			css.indexOf("@media (prefers-reduced-motion: reduce)"),
		);
		expect(ruleFor(css, ".site-06")).toContain("overflow-x: clip");
		for (const selector of [
			".site-06-decision-trace",
			".site-06-decision-trace__rings",
			".site-06-product-proof-scene__tabs",
			".site-06-product-proof-scene__ledger section dl",
			".site-06-canonical-record-transform > fieldset",
		]) {
			expect(ruleFor(mobile, selector), `${selector} must linearize at 360px`).toContain(
				"grid-template-columns: minmax(0, 1fr)",
			);
		}
	});

	it("cancels scene travel and line drawing when reduced motion is requested", () => {
		const css = read("styles/experience/site-06.css");
		const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
		for (const selector of [
			".site-06-decision-trace__ring",
			".site-06-product-proof-scene svg path",
			".site-06-canonical-record-transform",
		]) {
			const declarations = ruleFor(reduced, selector);
			expect(declarations, `${selector} must cancel travel`).toContain("animation: none");
			expect(declarations, `${selector} must cancel translation`).toContain("transform: none");
		}
	});

	it("drifts non-text Agent geometry and completely cancels motion when requested", () => {
		const agent = read("styles/experience/agent.css");
		const site = read("styles/experience/site-06.css");
		const agentReduced = agent.slice(agent.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
		const siteReduced = site.slice(site.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
		expect(agent).toContain("@keyframes agent-orbit-drift");
		expect(ruleFor(agent, '.agent-experience .site-06-orbit__rings [data-orbit-ring="outer"]')).toContain(
			"animation: agent-orbit-drift",
		);
		expect(agentReduced).toContain("animation: none !important");
		expect(agentReduced).toContain("transition: none !important");
		expect(siteReduced).toContain("animation: none !important");
		expect(siteReduced).toContain("transition: none !important");
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
		expect(contactSubmit).toContain("background: var(--site-orange)");
		expect(contactSubmit).toContain("color: var(--site-navy)");
		for (const selector of [
			".site-06-action",
			".site-06-decision-trace__ring button",
			".site-06-product-proof-scene__tabs button",
			".site-06-canonical-record-transform button",
		]) {
			expect(ruleFor(css, selector), `${selector} must remain editorial`).toContain("background: transparent");
		}
		expect(ruleFor(css, ".site-06-skip-link")).not.toContain("background: var(--site-orange)");
	});
});
