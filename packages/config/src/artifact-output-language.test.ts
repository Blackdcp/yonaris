import { describe, expect, it } from "vitest";
import { isArtifactZhCnWriteEnabled, parseArtifactZhCnDeploymentFlag } from "./artifact-output-language";

describe("isArtifactZhCnWriteEnabled", () => {
	it.each([
		[undefined, false],
		["", false],
		["false", false],
		["TRUE", false],
		["yes", false],
		["true", true],
	] as const)("treats %s as %s", (value, expected) => {
		expect(isArtifactZhCnWriteEnabled(value)).toBe(expected);
	});
});

describe("parseArtifactZhCnDeploymentFlag", () => {
	it.each([
		[undefined, false],
		["false", false],
		["true", true],
	] as const)("accepts %s", (value, expected) => {
		expect(parseArtifactZhCnDeploymentFlag(value)).toBe(expected);
	});

	it.each(["", "TRUE", "yes", "0", "1"])("rejects configured value %s", (value) => {
		expect(() => parseArtifactZhCnDeploymentFlag(value)).toThrow(
			'ARTIFACT_ZH_CN_ENABLED must be exactly "true" or "false"',
		);
	});
});
