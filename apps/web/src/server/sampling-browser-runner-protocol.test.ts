import { BROWSER_EXTENSION_SURFACE_DEFINITIONS } from "@workspace/lib/browser-extension-surfaces";
import { describe, expect, it } from "vitest";
import { assertSamplingBrowserRunnerProtocol } from "./sampling-browser-runner-protocol";

const dedicatedNativeAuto = {
	surfaceTargetKey: "doubao.consumer_web",
	captureRouteKey: "browser_runner.doubao",
	sessionRequirement: "dedicated_sampling_profile",
	searchRequirement: "platform_default",
};

describe("sampling Browser Runner protocol", () => {
	it("accepts only the honest dedicated-account and platform-default Doubao contract", () => {
		expect(() => assertSamplingBrowserRunnerProtocol("browser_runner", [dedicatedNativeAuto])).not.toThrow();
		for (const target of [
			{ ...dedicatedNativeAuto, sessionRequirement: "anonymous_clean" },
			{ ...dedicatedNativeAuto, sessionRequirement: "new_account_clean" },
			{ ...dedicatedNativeAuto, searchRequirement: "forbidden" },
			{ ...dedicatedNativeAuto, surfaceTargetKey: "deepseek.consumer_web" },
		]) {
			expect(() => assertSamplingBrowserRunnerProtocol("browser_runner", [target])).toThrow(
				/dedicated sampling profile.*platform default/i,
			);
		}
	});

	it("accepts one extension batch containing every approved local surface", () => {
		expect(() =>
			assertSamplingBrowserRunnerProtocol(
				"browser_runner",
				BROWSER_EXTENSION_SURFACE_DEFINITIONS.map((definition) => ({
					...dedicatedNativeAuto,
					surfaceTargetKey: definition.key,
					captureRouteKey: definition.captureRoute,
				})),
			),
		).not.toThrow();
	});

	it("rejects the runner-only route in a manual batch", () => {
		expect(() => assertSamplingBrowserRunnerProtocol("manual", [dedicatedNativeAuto])).toThrow(
			/browser_runner\.doubao route requires Browser Runner execution mode/,
		);
	});

	it("rejects extension routes in a manual batch", () => {
		expect(() =>
			assertSamplingBrowserRunnerProtocol("manual", [
				{ ...dedicatedNativeAuto, captureRouteKey: "browser_extension.doubao" },
			]),
		).toThrow(/browser extension routes require Browser Runner execution mode/i);
	});
});
