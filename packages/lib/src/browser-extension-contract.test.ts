import { describe, expect, it } from "vitest";
import {
	assertExtensionEvidenceProtocol,
	browserExtensionCaptureRoute,
	isApprovedBrowserExtensionAdapterVersion,
	isBrowserExtensionAdapterVersionBindingSatisfied,
	isCurrentBrowserExtensionAdapterVersionBindingSatisfied,
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

	it("keeps production on Doubao v7 while the v8 qualification artifact remains fail-closed", () => {
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v7")).toBe(
			true,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260819-localpc-v8")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("deepseek.consumer_web", "deepseek-web-20260814-uat1")).toBe(false);
		expect(isApprovedBrowserExtensionAdapterVersion("doubao.consumer_web", "doubao-web-20260818-localpc-v5")).toBe(
			false,
		);
		expect(isApprovedBrowserExtensionAdapterVersion("deepseek.consumer_web", "deepseek-web-stale")).toBe(false);
	});

	it("preserves the legacy v7 omission window until the separate v8 activation", () => {
		expect(isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", undefined)).toBe(true);
		expect(
			isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", "doubao-web-20260818-localpc-v7"),
		).toBe(true);
		expect(
			isCurrentBrowserExtensionAdapterVersionBindingSatisfied("doubao.consumer_web", "doubao-web-20260819-localpc-v8"),
		).toBe(false);
		expect(isCurrentBrowserExtensionAdapterVersionBindingSatisfied("deepseek.consumer_web", undefined)).toBe(false);
	});

	it("requires an explicit exact request as soon as the simulated approval advances to Doubao v8", () => {
		const approval = {
			surface: "doubao.consumer_web" as const,
			approvedAdapterVersion: "doubao-web-20260819-localpc-v8",
		};

		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: undefined,
			}),
		).toBe(false);
		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: "doubao-web-20260818-localpc-v7",
			}),
		).toBe(false);
		expect(
			isBrowserExtensionAdapterVersionBindingSatisfied({
				...approval,
				requestedAdapterVersion: "doubao-web-20260819-localpc-v8",
			}),
		).toBe(true);
	});

	it("accepts one HTML page snapshot as the complete extension evidence contract", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.deepseek",
				adapterVersion: "deepseek-web-20260814-uat1",
				minimumArtifacts: 1,
				kinds: ["page_snapshot"],
			}),
		).not.toThrow();
	});

	it("requires one bounded JPEG screenshot for the structured Doubao v8 protocol", () => {
		expect(() =>
			assertExtensionEvidenceProtocol({
				captureRouteKey: "browser_extension.doubao",
				adapterVersion: "doubao-web-20260819-localpc-v8",
				minimumArtifacts: 1,
				kinds: ["screenshot"],
				mediaTypes: ["image/jpeg"],
				byteSizes: [512_000],
			}),
		).not.toThrow();

		for (const input of [
			{ kinds: ["page_snapshot"], mediaTypes: ["text/html"], byteSizes: [512_000] },
			{ kinds: ["screenshot"], mediaTypes: ["image/png"], byteSizes: [512_000] },
			{ kinds: ["screenshot"], mediaTypes: ["image/jpeg"], byteSizes: [2 * 1024 * 1024 + 1] },
		]) {
			expect(() =>
				assertExtensionEvidenceProtocol({
					captureRouteKey: "browser_extension.doubao",
					adapterVersion: "doubao-web-20260819-localpc-v8",
					minimumArtifacts: 1,
					...input,
				}),
			).toThrow(/exactly one bounded JPEG screenshot/i);
		}
	});

	it("rejects screenshots and missing HTML snapshots for extension routes", () => {
		for (const input of [
			{
				captureRouteKey: "browser_extension.doubao",
				adapterVersion: "doubao-web-20260818-localpc-v7",
				minimumArtifacts: 2,
				kinds: ["page_snapshot", "screenshot"],
			},
			{
				captureRouteKey: "browser_extension.deepseek",
				adapterVersion: "deepseek-web-20260814-uat1",
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
