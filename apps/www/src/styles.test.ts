import { readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
	return readFileSync(join(sourceRoot, relativePath), "utf8");
}

function filesUnder(relativePath: string, extensions: readonly string[]): string[] {
	const root = join(sourceRoot, relativePath);
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
		.map((entry) => join(entry.parentPath, entry.name));
}

describe("site stylesheet boundaries", () => {
	it("keeps styles.css as the ordered Tailwind, Fumadocs, and focused stylesheet manifest", () => {
		const stylesheet = read("styles.css");
		const expectedImports = [
			'@import "tailwindcss";',
			'@import "tw-animate-css";',
			'@import "fumadocs-ui/css/neutral.css";',
			'@import "fumadocs-ui/css/preset.css";',
			'@import "fumadocs-openapi/css/preset.css";',
			'@import "./styles/site-core.css";',
			'@import "./styles/pages/home.css";',
			'@import "./styles/pages/product.css";',
			'@import "./styles/pages/approach.css";',
			'@import "./styles/pages/research.css";',
			'@import "./styles/pages/company.css";',
			'@import "./styles/pages/geo.css";',
			'@import "./styles/pages/diagnostic.css";',
		];

		const positions = expectedImports.map((statement) => stylesheet.indexOf(statement));
		expect(positions[0]).toBeGreaterThanOrEqual(0);
		for (let index = 1; index < positions.length; index += 1) {
			expect(positions[index]).toBeGreaterThan(positions[index - 1]);
		}
		expect(stylesheet).not.toContain(":root {");
		expect(stylesheet).not.toContain("@layer base");
		expect(stylesheet).not.toContain(".prose ");
		expect(read("styles/site-core.css")).toMatch(/:root\s*{/);
		expect(read("styles/site-core.css")).toContain("@layer base");
		expect(read("styles/site-core.css")).toContain(".prose code::before");
	});

	it("isolates every homepage composition selector in pages/home.css", () => {
		const home = read("styles/pages/home.css");
		const otherStyles = [
			"styles.css",
			"styles/site-core.css",
			...filesUnder("styles/pages", [".css"]).filter((path) => !path.endsWith("home.css")),
		]
			.map((path) => (isAbsolute(path) ? readFileSync(path, "utf8") : read(path)))
			.join("\n");

		for (const selector of [
			".home-page",
			".home-product-stage",
			".home-diagnostic-preview",
			".home-domain-form",
			".home-hero-copy",
			".home-stage--product",
			".home-stage--approach",
			".home-stage--research",
			".home-stage--diagnostic",
		]) {
			expect(home).toContain(selector);
			expect(otherStyles).not.toContain(selector);
		}
		for (const retiredSelector of [
			".marketing-product-stage",
			".marketing-product-preview",
			".marketing-domain-form",
			".marketing-hero-copy",
		]) {
			expect(home).not.toContain(retiredSelector);
		}
	});

	it("uses only approved palette tokens and no gradients across first-party site styles and marketing consumers", () => {
		const paletteDefinition = join(sourceRoot, "styles/site-core.css");
		const legacySignalField = join(sourceRoot, "components/marketing/signal-field.tsx");
		const approvedPaletteColors = new Set(
			[...readFileSync(paletteDefinition, "utf8").matchAll(/--yonaris-[\w-]+:\s*(#[\da-f]{6})/gi)].map((match) =>
				match[1].toLowerCase(),
			),
		);
		const files = [
			...filesUnder("styles", [".css"]),
			...filesUnder("components/marketing", [".ts", ".tsx"]),
			...filesUnder("components/site/pages", [".ts", ".tsx"]),
			join(sourceRoot, "styles.css"),
		];

		for (const file of files) {
			const source = readFileSync(file, "utf8");
			expect(source, file).not.toMatch(/--yonaris-(?:surface|signal-strong)/);
			expect(source, file).not.toMatch(/(?:linear|radial|conic)-gradient/i);
			if (file === legacySignalField) {
				for (const [color] of source.matchAll(/#[\da-f]{6}\b/gi)) {
					expect(approvedPaletteColors, `${file}: ${color}`).toContain(color.toLowerCase());
				}
			} else if (file !== paletteDefinition) {
				expect(source, file).not.toMatch(/#[\da-f]{3,8}\b/i);
				expect(source, file).not.toMatch(/(?:rgb|hsl|oklab|oklch|lab|lch)a?\(/i);
			}
		}
	});

	it("defines the binding palette without retaining stale aliases", () => {
		const core = read("styles/site-core.css");

		for (const token of ["ink", "paper", "slate", "stone", "mist", "signal", "blue-gray"]) {
			expect(core).toContain(`--yonaris-${token}:`);
		}
		expect(core).not.toContain("--yonaris-surface:");
		expect(core).not.toContain("--yonaris-signal-strong:");
	});
});
