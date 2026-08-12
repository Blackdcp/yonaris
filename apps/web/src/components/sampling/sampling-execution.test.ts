import { describe, expect, it } from "vitest";
import { minimumEvidenceArtifactsForExecutionMode } from "./sampling-execution";

describe("sampling execution evidence contract", () => {
	it("requires both a screenshot and page snapshot for Browser Runner", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner")).toBe(2);
	});

	it("preserves the single-artifact minimum for manual workbench batches", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("manual")).toBe(1);
	});
});
