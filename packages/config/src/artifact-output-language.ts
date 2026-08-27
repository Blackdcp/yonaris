export function isArtifactZhCnWriteEnabled(value: string | undefined = process.env.ARTIFACT_ZH_CN_ENABLED): boolean {
	return value === "true";
}

export function parseArtifactZhCnDeploymentFlag(value: string | undefined): boolean {
	if (value === undefined) return false;
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error('ARTIFACT_ZH_CN_ENABLED must be exactly "true" or "false"');
}
