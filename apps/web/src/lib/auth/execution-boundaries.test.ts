import { describe, expect, it } from "vitest";
import {
	canAccessPlatformReports,
	canGenerateOpportunities,
	canInitiatePlatformExecution,
	isManualOnlyScope,
	redactMissingEnvironmentDetails,
} from "./execution-boundaries";

describe("platform execution boundaries", () => {
	it("treats only an explicit empty target list as a customer-managed manual scope", () => {
		expect(isManualOnlyScope([])).toBe(true);
		expect(isManualOnlyScope(null)).toBe(false);
		expect(isManualOnlyScope(["chatgpt.consumer_web"])).toBe(false);
	});

	it("does not let tenant ownership initiate onboarding or opportunity generation", () => {
		expect(canInitiatePlatformExecution(false)).toBe(false);
		expect(canGenerateOpportunities(false)).toBe(false);
		expect(canInitiatePlatformExecution(true)).toBe(true);
		expect(canGenerateOpportunities(true)).toBe(true);
	});

	it("keeps reports limited to platform admins and explicitly designated report operators", () => {
		expect(
			canAccessPlatformReports({ reportGenerationEnabled: true, platformAdmin: false, explicitReportOperator: false }),
		).toBe(false);
		expect(
			canAccessPlatformReports({ reportGenerationEnabled: true, platformAdmin: true, explicitReportOperator: false }),
		).toBe(true);
		expect(
			canAccessPlatformReports({ reportGenerationEnabled: true, platformAdmin: false, explicitReportOperator: true }),
		).toBe(true);
	});

	it("honors the report-generation feature flag for every platform role", () => {
		expect(
			canAccessPlatformReports({ reportGenerationEnabled: false, platformAdmin: true, explicitReportOperator: false }),
		).toBe(false);
		expect(
			canAccessPlatformReports({ reportGenerationEnabled: false, platformAdmin: false, explicitReportOperator: true }),
		).toBe(false);
	});

	it("redacts provider and environment names for ordinary or unauthenticated callers", () => {
		const missing = [
			{ id: "OPENAI_API_KEY", label: "OpenAI API key" },
			{ id: "PROXY_ACCOUNT", label: "Provider proxy account" },
		];

		expect(redactMissingEnvironmentDetails({ missing, isValid: false, platformAdmin: false })).toEqual([
			expect.objectContaining({ id: "deployment-configuration" }),
		]);
		expect(redactMissingEnvironmentDetails({ missing, isValid: false, platformAdmin: true })).toEqual(missing);
	});
});
