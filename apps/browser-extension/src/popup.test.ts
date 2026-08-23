import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { BROWSER_EXTENSION_SURFACES } from "./contracts";

describe("Browser Runner popup", () => {
	test("renders channel rows and separate qualification and redacted evidence checks", () => {
		const html = readFileSync(resolve(process.cwd(), "src/popup.html"), "utf8");
		const source = readFileSync(resolve(process.cwd(), "src/popup.ts"), "utf8");

		expect(BROWSER_EXTENSION_SURFACES).toHaveLength(7);
		expect(html).toContain('id="channels"');
		expect(html).toContain('id="inspect-surface"');
		expect(html).toContain('id="inspect-search-evidence"');
		expect(html).toContain('id="search-evidence-report"');
		expect(html).toContain('id="copy-search-evidence"');
		expect(html).not.toContain('id="doubao-status"');
		expect(source).toContain("BROWSER_EXTENSION_SURFACES");
		expect(source).toContain('type: "browser-runner:qualify-surface"');
		expect(source).toContain('type: "browser-runner:inspect-active-search-evidence"');
		expect(source).toContain("navigator.clipboard.writeText");
		expect(source).not.toContain("candidate.textSha256");
		expect(source).not.toContain("innerHTML =");
		expect(source).not.toContain('Partial<Record<"doubao.consumer_web" | "deepseek.consumer_web"');
	});
});
