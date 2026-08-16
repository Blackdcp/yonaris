export const OVERSEAS_FORMAL_PROMPT_COUNT = 3;
export const OVERSEAS_FORMAL_ONE_SHOT_SAMPLES = 1;
export const OVERSEAS_FORMAL_MAX_CALLS = 18;

export function countCanonicalReviewedPrompts(actual: readonly string[], expected: readonly string[]): number {
	const expectedCanonical = new Set(expected.map((value) => value.normalize("NFKC")));
	return new Set(actual.map((value) => value.normalize("NFKC")).filter((value) => expectedCanonical.has(value))).size;
}

export interface OverseasFormalTarget {
	model: string;
	webSearch: boolean;
	surfaceTargetKey: string;
	captureRouteKey: string;
}

export interface OverseasFormalReadinessInput {
	brand: {
		name: string;
		enabled: boolean;
		enabledModels: string[] | null;
		delayHours: number;
	};
	sourceScope: {
		key: string;
		enabled: boolean;
		automaticTargetKeys: string[] | null;
		promptCount: number;
		exactPromptMatchCount: number;
	};
	brightDataTargets: OverseasFormalTarget[];
	providerConfigured: boolean;
	responseSnapshotsEnabled: boolean;
	runsPerPrompt: number;
}

export type OverseasFormalReadinessBlocker =
	| "brand_disabled"
	| "source_scope_disabled"
	| "prompt_identity_mismatch"
	| "brightdata_not_configured"
	| "no_brightdata_targets"
	| "response_snapshots_disabled"
	| "one_shot_call_cap_exceeded";

export interface OverseasFormalReadinessReport {
	ok: true;
	operation: "overseas_formal_readiness";
	brand: {
		name: string;
		enabled: boolean;
		enabledModelPolicy: "all" | "none" | "selected";
		enabledModelCount: number | null;
	};
	source: {
		scopeKey: string;
		enabled: boolean;
		executionPolicy: "legacy" | "manual_only" | "automatic";
		promptCount: number;
		exactPromptMatchCount: number;
	};
	targets: OverseasFormalTarget[];
	oneShot: {
		promptCount: number;
		targetCount: number;
		samplesPerPrompt: 1;
		totalCalls: number;
		maxCalls: number;
		dailyAutomationEnabled: false;
	};
	dailyIfEnabled: {
		runsPerPrompt: number;
		callsPerCycle: number;
		cadenceHours: number;
	};
	responseSnapshotsEnabled: boolean;
	readyForOneShot: boolean;
	blockers: OverseasFormalReadinessBlocker[];
}

function executionPolicy(automaticTargetKeys: string[] | null): "legacy" | "manual_only" | "automatic" {
	if (automaticTargetKeys === null) return "legacy";
	return automaticTargetKeys.length === 0 ? "manual_only" : "automatic";
}

export function buildOverseasFormalReadiness(input: OverseasFormalReadinessInput): OverseasFormalReadinessReport {
	const targets = [...input.brightDataTargets].sort((left, right) =>
		left.surfaceTargetKey.localeCompare(right.surfaceTargetKey),
	);
	const totalCalls = OVERSEAS_FORMAL_PROMPT_COUNT * targets.length * OVERSEAS_FORMAL_ONE_SHOT_SAMPLES;
	const blockers: OverseasFormalReadinessBlocker[] = [];
	if (!input.brand.enabled) blockers.push("brand_disabled");
	if (!input.sourceScope.enabled) blockers.push("source_scope_disabled");
	if (
		input.sourceScope.promptCount !== OVERSEAS_FORMAL_PROMPT_COUNT ||
		input.sourceScope.exactPromptMatchCount !== OVERSEAS_FORMAL_PROMPT_COUNT
	) {
		blockers.push("prompt_identity_mismatch");
	}
	if (!input.providerConfigured) blockers.push("brightdata_not_configured");
	if (targets.length === 0) blockers.push("no_brightdata_targets");
	if (!input.responseSnapshotsEnabled) blockers.push("response_snapshots_disabled");
	if (totalCalls > OVERSEAS_FORMAL_MAX_CALLS) blockers.push("one_shot_call_cap_exceeded");

	return {
		ok: true,
		operation: "overseas_formal_readiness",
		brand: {
			name: input.brand.name,
			enabled: input.brand.enabled,
			enabledModelPolicy:
				input.brand.enabledModels === null ? "all" : input.brand.enabledModels.length === 0 ? "none" : "selected",
			enabledModelCount: input.brand.enabledModels?.length ?? null,
		},
		source: {
			scopeKey: input.sourceScope.key,
			enabled: input.sourceScope.enabled,
			executionPolicy: executionPolicy(input.sourceScope.automaticTargetKeys),
			promptCount: input.sourceScope.promptCount,
			exactPromptMatchCount: input.sourceScope.exactPromptMatchCount,
		},
		targets,
		oneShot: {
			promptCount: OVERSEAS_FORMAL_PROMPT_COUNT,
			targetCount: targets.length,
			samplesPerPrompt: OVERSEAS_FORMAL_ONE_SHOT_SAMPLES,
			totalCalls,
			maxCalls: OVERSEAS_FORMAL_MAX_CALLS,
			dailyAutomationEnabled: false,
		},
		dailyIfEnabled: {
			runsPerPrompt: input.runsPerPrompt,
			callsPerCycle: OVERSEAS_FORMAL_PROMPT_COUNT * targets.length * input.runsPerPrompt,
			cadenceHours: input.brand.delayHours,
		},
		responseSnapshotsEnabled: input.responseSnapshotsEnabled,
		readyForOneShot: blockers.length === 0,
		blockers,
	};
}
