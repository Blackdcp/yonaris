import { describe, expect, it } from "vitest";
import {
	assertExtensionEvidenceProtocol,
	browserExtensionCaptureRoute,
	isApprovedBrowserExtensionAdapterVersion,
	parseBrowserExtensionSurface,
} from "./browser-extension-contract";

describe("browser extension contract", () => {
	it.each([
		["doubao.consumer_web", "browser_extension.doubao"],
		["deepseek.consumer_web", "browser_extension.deepseek"],
	] as const)("maps %s to its exact capture route %s", (surface, route) => {
		expect(parseBrowserExtensionSurface(surface)).toBe(surface);
		expect(browserExtensionCaptureRoute(surface)).toBe(route);
	});

	it("rejects surfaces that the first extension release cannot execute", () => {
		expect(() => parseBrowserExtensionSurface("kimi.consumer_web")).toThrow(/not supported/i);
	});

	it("allows only exact field-proven adapter versions and keeps pending DeepSeek fail-closed", () => {
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v7")).toBe(
			true,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v6")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("deepseek.consumer_web", "deepseek-web-20260814-uat1")).toBe(false);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v5")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("deepseek.consumer_web", "deepseek-web-stale")).toBe(false);
	});

	it("accepts one HTML page snapshot as the complete extension evidence contract", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.deepseek",
				minimumArtifacts: 1,
				kinds: ["page_snapshot"],
			}),
		).not.toThrow();
	});

	it("rejects screenshots and missing HTML snapshots for extension routes", () => {
		for (const input of [
			{
				captureRouteKey: "browser_extension.doubao",
				minimumArtifacts: 2,
				kinds: ["page_snapshot", "screenshot"],
			},
			{
				captureRouteKey: "browser_extension.deepseek",
				minimumArtifacts: 1,
				kinds: ["screenshot"],
			},
		]) {
			expect(() => assertExtensionEvidenceProtocol(input)).toThrow(/exactly one page snapshot/i);
		}
	});

	it("does not reinterpret the legacy runner evidence protocol", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_runner.doubao",
				minimumArtifacts: 2,
				kinds: ["screenshot", "page_snapshot"],
			}),
		).not.toThrow();
	});
});
