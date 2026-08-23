import { BROWSER_EXTENSION_SURFACE_DEFINITIONS } from "@workspace/lib/browser-extension-surfaces";
import { describe, expect, it } from "vitest";
import {
	captureRouteForExecution,
	minimumEvidenceArtifactsForExecutionMode,
	targetsForSamplingExecution,
} from "./sampling-execution";
import type { SamplingTargetOption } from "./types";

const browserTargets: SamplingTargetOption[] = BROWSER_EXTENSION_SURFACE_DEFINITIONS.map((definition) => ({
	surfaceTargetKey: definition.key,
	captureRouteKey: definition.captureRoute,
	model: definition.key,
	label: definition.label,
	launchUrl: definition.launchUrl,
	surfaceKind: "consumer_chat",
	defaultSessionRequirement: "dedicated_sampling_profile",
	defaultSearchRequirement: "platform_default",
}));

describe("sampling execution evidence contract", () => {
	it("requires both a screenshot and page snapshot for Browser Runner", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner")).toBe(2);
		expect(minimumEvidenceArtifactsForExecutionMode("browser_runner", ["browser_runner.doubao"])).toBe(2);
	});

	it("uses the one-snapshot extension contract for every Browser Runner surface", () => {
		for (const target of browserTargets) {
			expect(captureRouteForExecution("browser_runner", target)).toBe(target.captureRouteKey);
		}
		expect(
			minimumEvidenceArtifactsForExecutionMode(
				"browser_runner",
				browserTargets.map((target) => target.captureRouteKey),
			),
		).toBe(1);
	});

	it("offers all and only Browser Runner surfaces in a Browser Runner batch", () => {
		const manualOnly = { ...browserTargets[0], surfaceTargetKey: "chatgpt.consumer_web" as const };
		expect(targetsForSamplingExecution("browser_runner", [...browserTargets, manualOnly])).toEqual(browserTargets);
		expect(targetsForSamplingExecution("manual", [...browserTargets, manualOnly])).toEqual([
			...browserTargets,
			manualOnly,
		]);
	});

	it("preserves the single-artifact minimum for manual workbench batches", () => {
		expect(minimumEvidenceArtifactsForExecutionMode("manual")).toBe(1);
	});
});
