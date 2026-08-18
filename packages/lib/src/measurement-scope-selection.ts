export interface ImplicitMeasurementScopeCandidate {
	enabled: boolean;
	isDefault: boolean;
	hasEnabledPrompts: boolean;
	samplingEvaluationRole?: "scored" | "observation" | null;
}

/**
 * Pick the scope used when a request does not explicitly name one.
 *
 * A compatibility/legacy scope may still be the database default after real
 * Programs are provisioned. It must not hide populated scored Programs from
 * the customer or let an observation/diagnostic scope become the implicit
 * analytics view. Callers provide candidates in their stable display order.
 */
export function selectImplicitMeasurementScope<T extends ImplicitMeasurementScopeCandidate>(
	candidates: readonly T[],
): T | undefined {
	const enabled = candidates.filter((candidate) => candidate.enabled);
	const databaseDefault = enabled.find((candidate) => candidate.isDefault);
	const populatedScored = enabled.filter(
		(candidate) => candidate.hasEnabledPrompts && candidate.samplingEvaluationRole === "scored",
	);
	const scoredDefault = populatedScored.find((candidate) => candidate.isDefault);
	if (scoredDefault) return scoredDefault;
	if (populatedScored[0]) return populatedScored[0];
	if (databaseDefault?.hasEnabledPrompts) return databaseDefault;

	return enabled.find((candidate) => candidate.hasEnabledPrompts) ?? databaseDefault ?? enabled[0];
}
