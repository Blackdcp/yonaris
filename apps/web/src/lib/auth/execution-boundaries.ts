import type { MissingEnvVar } from "@workspace/config/env";

export function isManualOnlyScope(automaticTargetKeys: string[] | null): boolean {
	return Array.isArray(automaticTargetKeys) && automaticTargetKeys.length === 0;
}

export function canInitiatePlatformExecution(platformAdmin: boolean): boolean {
	return platformAdmin;
}

export function canGenerateOpportunities(platformAdmin: boolean): boolean {
	return platformAdmin;
}

export function canAccessPlatformReports(input: {
	reportGenerationEnabled: boolean;
	platformAdmin: boolean;
	explicitReportOperator: boolean;
}): boolean {
	return input.reportGenerationEnabled && (input.platformAdmin || input.explicitReportOperator);
}

export function redactMissingEnvironmentDetails(input: {
	missing: MissingEnvVar[];
	isValid: boolean;
	platformAdmin: boolean;
}): MissingEnvVar[] {
	if (input.platformAdmin) return input.missing;
	if (input.isValid) return [];
	return [
		{
			id: "deployment-configuration",
			label: "Deployment configuration",
			description: "Contact the platform administrator to complete service configuration.",
		},
	];
}
