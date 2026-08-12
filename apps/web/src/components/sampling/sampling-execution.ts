import type { SamplingExecutionMode } from "./types";

export function minimumEvidenceArtifactsForExecutionMode(executionMode: SamplingExecutionMode): number {
	return executionMode === "browser_runner" ? 2 : 1;
}
