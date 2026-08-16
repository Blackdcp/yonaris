import {
	browserExtensionCaptureRoute,
	isBrowserExtensionCaptureRoute,
	isBrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";

type SamplingExecutionMode = "manual" | "browser_runner";

type SamplingProtocolTarget = {
	surfaceTargetKey: string;
	captureRouteKey: string;
	sessionRequirement: string;
	searchRequirement: string;
};

export function assertSamplingBrowserRunnerProtocol(
	executionMode: SamplingExecutionMode,
	targets: readonly SamplingProtocolTarget[],
): void {
	if (executionMode === "browser_runner") {
		const target = targets[0];
		const isLegacyDoubao =
			targets.length === 1 &&
			target?.surfaceTargetKey === "doubao.consumer_web" &&
			target.captureRouteKey === "browser_runner.doubao";
		if (
			isLegacyDoubao &&
			target?.sessionRequirement === "dedicated_sampling_profile" &&
			target.searchRequirement === "platform_default"
		) {
			return;
		}

		const extensionSurfaces = new Set<string>();
		const extensionProtocol =
			targets.length >= 1 &&
			targets.length <= 2 &&
			targets.every((candidate) => {
				if (
					!isBrowserExtensionSurface(candidate.surfaceTargetKey) ||
					!isBrowserExtensionCaptureRoute(candidate.captureRouteKey) ||
					candidate.captureRouteKey !== browserExtensionCaptureRoute(candidate.surfaceTargetKey) ||
					candidate.sessionRequirement !== "dedicated_sampling_profile" ||
					candidate.searchRequirement !== "platform_default" ||
					extensionSurfaces.has(candidate.surfaceTargetKey)
				) {
					return false;
				}
				extensionSurfaces.add(candidate.surfaceTargetKey);
				return true;
			});
		if (extensionProtocol) return;
		throw new Error(
			"Browser Runner batches require exact Doubao/DeepSeek routes with a dedicated sampling profile and platform default search",
		);
	}
	if (targets.some(({ captureRouteKey }) => isBrowserExtensionCaptureRoute(captureRouteKey))) {
		throw new Error("Browser extension routes require Browser Runner execution mode");
	}
	if (targets.some(({ captureRouteKey }) => captureRouteKey === "browser_runner.doubao")) {
		throw new Error("The browser_runner.doubao route requires Browser Runner execution mode");
	}
}
