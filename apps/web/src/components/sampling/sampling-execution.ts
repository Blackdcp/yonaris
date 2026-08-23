import {
	browserExtensionCaptureRoute,
	isBrowserExtensionCaptureRoute,
	isBrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";
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
	if (!isBrowserExtensionSurface(target.surfaceTargetKey)) {
		throw new Error(`Browser extension batch target ${target.surfaceTargetKey} is not available`);
	}
	return browserExtensionCaptureRoute(target.surfaceTargetKey);
}

export function targetsForSamplingExecution(
	executionMode: SamplingExecutionMode,
	targets: readonly SamplingTargetOption[],
): SamplingTargetOption[] {
	return executionMode === "browser_runner"
		? targets.filter((target) => isBrowserExtensionSurface(target.surfaceTargetKey))
		: [...targets];
}
