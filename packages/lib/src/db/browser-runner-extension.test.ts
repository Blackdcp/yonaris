import { describe, expect, it } from "vitest";
import { resolveBrowserRunnerClaimTargets } from "./browser-runner";

describe("Browser Runner extension claim targets", () => {
	it("does not let a DeepSeek-only device claim a Doubao task", () => {
		expect(
			resolveBrowserRunnerClaimTargets({
				principalKind: "browser_extension",
				requestedSurfaceTargetKeys: ["doubao.consumer_web", "deepseek.consumer_web"],
				supportedSurfaces: ["deepseek.consumer_web"],
			}),
		).toEqual([
			{
				surfaceTargetKey: "deepseek.consumer_web",
				captureRouteKey: "browser_extension.deepseek",
			},
		]);
	});

	it("lets a mixed-capability extension claim both surfaces without legacy routes", () => {
		expect(
			resolveBrowserRunnerClaimTargets({
				principalKind: "browser_extension",
				supportedSurfaces: ["doubao.consumer_web", "deepseek.consumer_web"],
			}),
		).toEqual([
			{
				surfaceTargetKey: "doubao.consumer_web",
				captureRouteKey: "browser_extension.doubao",
			},
			{
				surfaceTargetKey: "deepseek.consumer_web",
				captureRouteKey: "browser_extension.deepseek",
			},
		]);
	});

	it("keeps the legacy host isolated to its frozen Doubao route", () => {
		expect(
			resolveBrowserRunnerClaimTargets({
				principalKind: "legacy_host",
				requestedSurfaceTargetKeys: ["doubao.consumer_web", "deepseek.consumer_web"],
			}),
		).toEqual([
			{
				surfaceTargetKey: "doubao.consumer_web",
				captureRouteKey: "browser_runner.doubao",
			},
		]);
	});
});
