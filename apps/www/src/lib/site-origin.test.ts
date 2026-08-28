import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalUrl, SITE_URL, siteHref } from "./site-origin";

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = `${directory}/${entry.name}`;
		if (entry.isDirectory()) return sourceFiles(path);
		if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
		return [path];
	});
}

describe("site origin contract", () => {
	it("keeps every public canonical absolute when no build-time override is supplied", () => {
		expect(SITE_URL).toMatch(/^https?:\/\//u);
		expect(siteHref("/product")).toBe("https://yonaris.com/product");
		expect(canonicalUrl("/")).toBe("https://yonaris.com/");
	});

	it("keeps site-origin as the sole configured origin reader", () => {
		const src = fileURLToPath(new URL("../", import.meta.url));
		const readers = sourceFiles(src)
			.filter((path) => readFileSync(path, "utf8").includes("import.meta.env.VITE_SITE_URL"))
			.map((path) => path);

		expect(readers).toEqual([expect.stringMatching(/lib[\\/]site-origin\.ts$/)]);
	});
});
