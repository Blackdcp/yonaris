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
		if (
			targets.length !== 1 ||
			target?.surfaceTargetKey !== "doubao.consumer_web" ||
			target.captureRouteKey !== "browser_runner.doubao" ||
			target.sessionRequirement !== "dedicated_sampling_profile" ||
			target.searchRequirement !== "platform_default"
		) {
			throw new Error(
				"Browser Runner batches require a dedicated sampling profile with platform default search on Doubao via browser_runner.doubao",
			);
		}
		return;
	}
	if (targets.some(({ captureRouteKey }) => captureRouteKey === "browser_runner.doubao")) {
		throw new Error("The browser_runner.doubao route requires Browser Runner execution mode");
	}
}
