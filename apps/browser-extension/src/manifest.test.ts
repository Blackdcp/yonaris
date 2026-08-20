import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EXTENSION_VERSION } from "./contracts";

describe("Manifest V3 permissions", () => {
	it("keeps the release version aligned across the package, manifest, and runtime heartbeat", () => {
		const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")) as {
			version: string;
		};
		const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
			version: string;
		};

		expect(manifest.version).toBe("0.3.0");
		expect(packageJson.version).toBe(manifest.version);
		expect(EXTENSION_VERSION).toBe(manifest.version);
	});

	it("grants only the approved Portal and six domestic consumer origins", () => {
		const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")) as {
			manifest_version: number;
			permissions: string[];
			host_permissions: string[];
			content_scripts: Array<{ matches: string[]; js: string[]; run_at: string }>;
			content_security_policy: { extension_pages: string };
		};

		expect(manifest.manifest_version).toBe(3);
		expect(manifest.permissions).toEqual(["storage", "alarms", "tabs", "scripting", "notifications"]);
		expect(manifest.host_permissions).toEqual([
			"https://portal.yonaris.com/*",
			"https://*.doubao.com/*",
			"https://chat.deepseek.com/*",
			"https://www.qianwen.com/*",
			"https://www.kimi.com/*",
			"https://yiyan.baidu.com/*",
			"https://yuanbao.tencent.com/*",
		]);
		expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
		expect(manifest.content_scripts).toEqual([
			{
				matches: [
					"https://doubao.com/chat/*",
					"https://www.doubao.com/chat/*",
					"https://chat.deepseek.com/*",
					"https://www.qianwen.com/*",
					"https://www.kimi.com/*",
					"https://yiyan.baidu.com/*",
					"https://yuanbao.tencent.com/*",
				],
				js: ["content-entry.js"],
				run_at: "document_idle",
			},
		]);
		expect(manifest.content_security_policy.extension_pages).not.toMatch(/unsafe-eval|https?:/);
	});
});
