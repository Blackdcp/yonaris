import { describe, expect, it } from "vitest";
import { assertSamplingBrowserRunnerProtocol } from "./sampling-browser-runner-protocol";

const dedicatedNativeAuto = {
	surfaceTargetKey: "doubao.consumer_web",
	captureRouteKey: "browser_runner.doubao",
	sessionRequirement: "dedicated_sampling_profile",
	searchRequirement: "platform_default",
};

const anonymousNativeAuto = {
	...dedicatedNativeAuto,
	sessionRequirement: "anonymous_clean",
};

describe("sampling Browser Runner protocol", () => {
	it("accepts both supported clean-session protocols with platform-default Doubao", () => {
		expect(() => assertSamplingBrowserRunnerProtocol("browser_runner", [dedicatedNativeAuto])).not.toThrow();
		expect(() => assertSamplingBrowserRunnerProtocol("browser_runner", [anonymousNativeAuto])).not.toThrow();
		for (const target of [
			{ ...dedicatedNativeAuto, sessionRequirement: "new_account_clean" },
			{ ...dedicatedNativeAuto, searchRequirement: "forbidden" },
			{ ...dedicatedNativeAuto, surfaceTargetKey: "deepseek.consumer_web" },
		]) {
			expect(() => assertSamplingBrowserRunnerProtocol("browser_runner", [target])).toThrow(
				/supported clean session.*platform default/i,
			);
		}
	});

	it("rejects the runner-only route in a manual batch", () => {
		expect(() => assertSamplingBrowserRunnerProtocol("manual", [dedicatedNativeAuto])).toThrow(
			/browser_runner\.doubao route requires Browser Runner execution mode/,
		);
	});
});
