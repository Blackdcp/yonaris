import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("browser extension popup styles", () => {
	it("keeps hidden pairing states out of the rendered popup", () => {
		const css = readFileSync(resolve(process.cwd(), "src/popup.css"), "utf8");

		expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s);
	});
});
