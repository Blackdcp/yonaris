import { describe, expect, it } from "vitest";
import { captureRouteForExecution, minimumEvidenceArtifactsForExecutionMode } from "./sampling-execution";

describe("sampling execution evidence contract", () => {
	it("requires both a screenshot and page snapshot for Browser Runner", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner")).toBe(2);
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner", ["browser_runner.doubao"])).toBe(2);
	});

	it("uses the one-snapshot extension contract for a new Doubao Browser Runner batch", () => {
		expect(
			captureRouteForExecution("browser_runner", {
				surfaceTargetKey: "doubao.consumer_web",
				captureRouteKey: "browser_runner.doubao",
			}),
		).toBe("browser_extension.doubao");
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner", ["browser_extension.doubao"])).toBe(1);
	});

	it("preserves the single-artifact minimum for manual workbench batches", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("manual")).toBe(1);
	});
});
