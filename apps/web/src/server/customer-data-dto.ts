import { parseScrapeTargets } from "@workspace/config/scrape-targets";
import { selectImplicitMeasurementScope } from "@workspace/lib/measurement-scope-selection";
import { getObservationTargetCohort, resolveObservationTarget } from "@workspace/lib/observation-targets";
import type { ResponseSnapshotContentSource } from "@workspace/lib/response-snapshots/contract";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export type CustomerDeliveryMode = "legacy" | "assisted" | "automatic";
export type CustomerMeasurementLane = "scored" | "observation" | "consumer" | "diagnostic" | "unspecified";

export interface CustomerPromptDto {
	id: string;
	scopeId: string | null;
	value: string;
	enabled: boolean;
	tags: string[];
	systemTags: string[];
}

export interface CustomerCompetitorDto {
	id: string;
	name: string;
	domains: string[];
	aliases: string[];
}

export function toCustomerCompetitorDto(input: CustomerCompetitorDto): CustomerCompetitorDto {
	return {
		id: input.id,
		name: input.name,
		domains: [...input.domains],
		aliases: [...input.aliases],
	};
}

export interface CustomerMeasurementScopeDto {
	id: string;
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	enabled: boolean;
	isDefault: boolean;
	deliveryMode: CustomerDeliveryMode;
	lane: CustomerMeasurementLane;
}

export interface CustomerBrandDto {
	id: string;
	name: string;
	website: string;
	additionalDomains: string[];
	aliases: string[];
	enabled: boolean;
	onboarded: boolean;
	delayOverrideHours: number | null;
	updatedAt: Date;
	/** Public product/model identifiers only. Provider and capture-route data never crosses the customer boundary. */
	effectiveModels: string[];
	prompts: CustomerPromptDto[];
	competitors: CustomerCompetitorDto[];
	measurementScopes: CustomerMeasurementScopeDto[];
}

export interface CustomerBrandSource {
	id: string;
	name: string;
	website: string;
	additionalDomains: string[];
	aliases: string[];
	enabled: boolean;
	onboarded: boolean;
	delayOverrideHours: number | null;
	updatedAt: Date;
	prompts: CustomerPromptDto[];
	competitors: CustomerCompetitorDto[];
	measurementScopes: Array<
		Omit<CustomerMeasurementScopeDto, "deliveryMode" | "lane"> & {
			automaticTargetKeys: string[] | null;
			samplingEvaluationRole: "scored" | "observation" | null;
		}
	>;
}

export function deriveCustomerScopeClassification(input: {
	automaticTargetKeys: readonly string[] | null;
	samplingEvaluationRole: "scored" | "observation" | null;
}): { deliveryMode: CustomerDeliveryMode; lane: CustomerMeasurementLane } {
	const deliveryMode =
		input.automaticTargetKeys === null ? "legacy" : input.automaticTargetKeys.length === 0 ? "assisted" : "automatic";
	if (input.samplingEvaluationRole) return { deliveryMode, lane: input.samplingEvaluationRole };
	if (deliveryMode === "legacy") return { deliveryMode, lane: "unspecified" };
	if (deliveryMode === "assisted") return { deliveryMode, lane: "consumer" };

	try {
		const cohorts = new Set(
			parseScrapeTargets(input.automaticTargetKeys?.join(",")).map((target) =>
				getObservationTargetCohort(resolveObservationTarget(target)),
			),
		);
		return {
			deliveryMode,
			lane: cohorts.has("consumer_measurement") ? "consumer" : "diagnostic",
		};
	} catch {
		return { deliveryMode, lane: "unspecified" };
	}
}

export function toCustomerBrandDto(source: CustomerBrandSource, effectiveModels: readonly string[]): CustomerBrandDto {
	const populatedScopeIds = new Set(
		source.prompts.filter((prompt) => prompt.enabled && prompt.scopeId !== null).map((prompt) => prompt.scopeId),
	);
	const effectiveDefault = selectImplicitMeasurementScope(
		source.measurementScopes.map((scope) => ({
			...scope,
			hasEnabledPrompts: populatedScopeIds.has(scope.id),
		})),
	);

	return {
		id: source.id,
		name: source.name,
		website: source.website,
		additionalDomains: [...source.additionalDomains],
		aliases: [...source.aliases],
		enabled: source.enabled,
		onboarded: source.onboarded,
		delayOverrideHours: source.delayOverrideHours,
		updatedAt: source.updatedAt,
		effectiveModels: [...new Set(effectiveModels)],
		prompts: source.prompts.map(({ id, scopeId, value, enabled, tags, systemTags }) => ({
			id,
			scopeId,
			value,
			enabled,
			tags: [...tags],
			systemTags: [...systemTags],
		})),
		competitors: source.competitors.map(toCustomerCompetitorDto),
		measurementScopes: source.measurementScopes.map(
			({ id, key, name, market, locale, timezone, enabled, isDefault, ...classificationSource }) => ({
				id,
				key,
				name,
				market,
				locale,
				timezone,
				enabled,
				isDefault: effectiveDefault ? id === effectiveDefault.id : isDefault,
				...deriveCustomerScopeClassification(classificationSource),
			}),
		),
	};
}

export interface CustomerPromptRunDto {
	id: string;
	model: string;
	version: string;
	observedAt: string;
	webSearchEnabled: boolean;
	answerText: string;
	webQueries: string[];
	brandMentioned: boolean;
	competitorsMentioned: string[];
	snapshot: null | {
		id: string;
		status: "pending" | "ready" | "failed" | "expired";
		schemaVersion: string | null;
		contentSource: ResponseSnapshotContentSource | null;
		createdAt: string;
		expiresAt: string;
		htmlSha256: string | null;
		jsonSha256: string | null;
		visualEvidence: null | {
			mediaType: "image/jpeg";
			sha256: string;
			bytes: number;
		};
	};
}

export function toCustomerPromptRunDto(input: {
	id: string;
	model: string;
	version: string;
	observedAt: Date | null;
	createdAt: Date;
	webSearchEnabled: boolean;
	answerText: string | null;
	webQueries: string[];
	brandMentioned: boolean;
	competitorsMentioned: string[];
	snapshot: null | {
		id: string;
		status: "pending" | "ready" | "failed" | "expired";
		schemaVersion: string | null;
		contentSource: ResponseSnapshotContentSource | null;
		createdAt: Date;
		expiresAt: Date;
		htmlSha256: string | null;
		jsonSha256: string | null;
		visualEvidence: null | {
			mediaType: string;
			sha256: string;
			bytes: number;
		};
	};
}): CustomerPromptRunDto {
	return {
		id: input.id,
		model: input.model,
		version: input.version,
		observedAt: (input.observedAt ?? input.createdAt).toISOString(),
		webSearchEnabled: input.webSearchEnabled,
		answerText: input.answerText ?? "",
		webQueries: [...input.webQueries],
		brandMentioned: input.brandMentioned,
		competitorsMentioned: [...input.competitorsMentioned],
		snapshot: input.snapshot
			? {
					id: input.snapshot.id,
					status: input.snapshot.status,
					schemaVersion: input.snapshot.schemaVersion,
					contentSource: input.snapshot.contentSource,
					createdAt: input.snapshot.createdAt.toISOString(),
					expiresAt: input.snapshot.expiresAt.toISOString(),
					htmlSha256: input.snapshot.htmlSha256,
					jsonSha256: input.snapshot.jsonSha256,
					visualEvidence:
						input.snapshot.schemaVersion === "response-snapshot.v2" &&
						input.snapshot.visualEvidence?.mediaType === "image/jpeg" &&
						SHA256_PATTERN.test(input.snapshot.visualEvidence.sha256) &&
						Number.isSafeInteger(input.snapshot.visualEvidence.bytes) &&
						input.snapshot.visualEvidence.bytes > 0 &&
						input.snapshot.visualEvidence.bytes <= 2 * 1024 * 1024
							? {
									mediaType: "image/jpeg",
									sha256: input.snapshot.visualEvidence.sha256,
									bytes: input.snapshot.visualEvidence.bytes,
								}
							: null,
				}
			: null,
	};
}
