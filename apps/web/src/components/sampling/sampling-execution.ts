import { isBrowserExtensionCaptureRoute } from "@workspace/lib/browser-extension-contract";
import type { SamplingExecutionMode, SamplingTargetOption } from "./types";

export function minimumEvidenceArtifactsForExecutionMode(
	executionMode: SamplingExecutionMode,
	captureRouteKeys: readonly string[] = [],
): number {
	if (executionMode !== "browser_runner") return 1;
	return captureRouteKeys.length > 0 && captureRouteKeys.every(isBrowserExtensionCaptureRoute) ? 1 : 2;
}

export function captureRouteForExecution(
	executionMode: SamplingExecutionMode,
	target: Pick<SamplingTargetOption, "surfaceTargetKey" | "captureRouteKey">,
): SamplingTargetOption["captureRouteKey"] {
	if (executionMode !== "browser_runner") return target.captureRouteKey;
	if (target.surfaceTargetKey !== "doubao.consumer_web") {
		throw new Error(`Browser extension batch target ${target.surfaceTargetKey} is not available`);
	}
	return "browser_extension.doubao";
}
