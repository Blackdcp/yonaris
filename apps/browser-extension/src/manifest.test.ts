import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Manifest V3 permissions", () => {
	it("grants only the approved Portal, Doubao, and DeepSeek origins", () => {
		const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")) as {
			manifest_version: number;
			host_permissions: string[];
			content_security_policy: { extension_pages: string };
		};

		expect(manifest.manifest_version).toBe(3);
		expect(manifest.host_permissions).toEqual([
			"https://portal.yonaris.com/*",
			"https://*.doubao.com/*",
			"https://chat.deepseek.com/*",
		]);
		expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
		expect(manifest.content_security_policy.extension_pages).not.toMatch(/unsafe-eval|https?:/);
	});
});
