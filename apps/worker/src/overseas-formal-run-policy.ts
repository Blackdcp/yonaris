import type { OverseasFormalRunRequest } from "./overseas-formal-run-request";

export interface OverseasFormalPromptIdentity {
	id: string;
	value: string;
	tags: string[];
	systemTags: string[];
}

export interface OverseasFormalTargetIdentity {
	model: string;
	provider: string;
	webSearch: boolean;
	surfaceTargetKey: string;
	captureRouteKey: string;
}

export interface OverseasFormalDestinationIdentity {
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	samplingEvaluationRole: string | null;
	automaticTargetKeys: string[] | null;
	enabled: boolean;
	isDefault: boolean;
	prompts: OverseasFormalPromptIdentity[];
}

function canonical(value: string): string {
	return value.normalize("NFKC");
}

function orderedReviewedPrompts(
	request: OverseasFormalRunRequest,
	prompts: readonly OverseasFormalPromptIdentity[],
): OverseasFormalPromptIdentity[] {
	if (
		prompts.length !== request.prompts.enabledCountExact ||
		new Set(prompts.map(({ id }) => id)).size !== prompts.length ||
		new Set(prompts.map(({ value }) => canonical(value))).size !== prompts.length
	) {
		throw new Error("Overseas formal prompt identity is not the exact reviewed three-prompt set");
	}
	const byCanonicalText = new Map(prompts.map((prompt) => [canonical(prompt.value), prompt]));
	const ordered = request.prompts.textsExact.map((expected) => byCanonicalText.get(canonical(expected)));
	if (ordered.some((prompt) => !prompt)) {
		throw new Error("Overseas formal prompt identity is not the exact reviewed three-prompt set");
	}
	return ordered as OverseasFormalPromptIdentity[];
}

export function buildOverseasFormalCallPlan(
	request: OverseasFormalRunRequest,
	prompts: readonly OverseasFormalPromptIdentity[],
	target: OverseasFormalTargetIdentity,
) {
	if (
		target.model !== request.target.model ||
		target.provider !== request.target.provider ||
		target.webSearch !== request.target.webSearch ||
		target.surfaceTargetKey !== request.target.surfaceTargetKey ||
		target.captureRouteKey !== request.target.captureRouteKey
	) {
		throw new Error("Overseas formal target identity does not match the fixed reviewed channel");
	}
	const reviewedPrompts = orderedReviewedPrompts(request, prompts);
	return {
		calls: reviewedPrompts.map((prompt) => ({
			prompt,
			sourceJobId: `overseas-formal:${request.requestId}:${prompt.id}`,
			sampleIndex: 1 as const,
		})),
	};
}

export function selectOverseasFormalDiagnosticCalls<T>(
	sourceCalls: readonly T[],
	destinationCalls: readonly T[] | null,
): readonly T[] {
	return destinationCalls ?? sourceCalls;
}

export function assertOverseasFormalDestination(
	request: OverseasFormalRunRequest,
	destination: OverseasFormalDestinationIdentity,
): void {
	const expected = request.destinationScope;
	if (
		destination.key !== expected.keyExact ||
		destination.name !== expected.nameExact ||
		destination.market !== expected.marketExact ||
		destination.locale !== expected.localeExact ||
		destination.timezone !== expected.timezoneExact ||
		destination.samplingEvaluationRole !== expected.evaluationRoleExact ||
		!Array.isArray(destination.automaticTargetKeys) ||
		destination.automaticTargetKeys.length !== 0 ||
		!destination.enabled ||
		destination.isDefault
	) {
		throw new Error("Overseas formal destination must remain the exact manual-only US scope");
	}
	orderedReviewedPrompts(request, destination.prompts);
}
