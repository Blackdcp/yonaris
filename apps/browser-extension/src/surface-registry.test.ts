import { describe, expect, it } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./adapters/test-fixture";
import { BROWSER_EXTENSION_SURFACES } from "./contracts";
import { extensionSurfaceDefinition } from "./surface-registry";

describe("extension surface registry", () => {
	it("defines an approved launch URL and manifest match for all six surfaces", () => {
		for (const surface of BROWSER_EXTENSION_SURFACES) {
			const definition = extensionSurfaceDefinition(surface);
			expect(definition.surface).toBe(surface);
			expect(definition.approvedUrl(new URL(definition.launchUrl))).toBe(true);
			expect(definition.contentScriptMatches.length).toBeGreaterThan(0);
			expect(definition.contract.surface).toBe(surface);
			expect(definition.createAdapter(new FixtureDomPort(createAdapterFixture())).surface).toBe(surface);
		}
	});

	it("uses the current Wenxin origin rather than the retired redirect origin", () => {
		const definition = extensionSurfaceDefinition("wenxin.consumer_web");
		expect(definition.launchUrl).toBe("https://wenxin.baidu.com/");
		expect(definition.approvedUrl(new URL("https://wenxin.baidu.com/"))).toBe(true);
		expect(definition.approvedUrl(new URL("https://yiyan.baidu.com/"))).toBe(false);
	});

	it("fails closed for credentials, insecure URLs, sibling domains, and unknown surfaces", () => {
		for (const surface of BROWSER_EXTENSION_SURFACES) {
			const definition = extensionSurfaceDefinition(surface);
			const launch = new URL(definition.launchUrl);
			expect(definition.approvedUrl(new URL(`http://${launch.host}${launch.pathname}`))).toBe(false);
			expect(definition.approvedUrl(new URL(`https://user:secret@${launch.host}${launch.pathname}`))).toBe(false);
			expect(definition.approvedUrl(new URL(`https://${launch.hostname}.evil.example/`))).toBe(false);
		}
		expect(() => extensionSurfaceDefinition("unknown.consumer_web" as never)).toThrow(/not supported/i);
	});
});
