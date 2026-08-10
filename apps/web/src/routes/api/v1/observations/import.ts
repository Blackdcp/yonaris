/**
 * /api/v1/observations/import - preview or ingest consumer-surface samples.
 *
 * This is a push-ingestion lane for operator- or browser-assisted captures. It
 * deliberately accepts only registered consumer/search surfaces, never model
 * APIs presented as consumer-product observations.
 */

import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@workspace/lib/db/db";
import { resolveMeasurementScopeForBrand } from "@workspace/lib/db/measurement-scopes";
import {
	claimImportedObservationAttempt,
	markObservationFailed,
	ObservationSourceConflictError,
	persistSuccessfulObservation,
} from "@workspace/lib/db/observations";
import { brands, competitors, prompts } from "@workspace/lib/db/schema";
import {
	assertManualObservationPageUrl,
	MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS,
	MANUAL_OBSERVATION_SURFACE_TARGET_KEYS,
	resolveManualObservationTarget,
} from "@workspace/lib/manual-observation-targets";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import type { Citation } from "@workspace/lib/text-extraction";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";

const httpUrl = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "URL must use http or https");

const evidenceRefSchema = z.object({
	type: z.enum(["screenshot", "video", "page_snapshot", "other"]),
	uri: httpUrl,
	sha256: z
		.string()
		.trim()
		.regex(/^[a-fA-F0-9]{64}$/, "sha256 must contain 64 hexadecimal characters"),
});

const citationSchema = z.object({
	url: httpUrl,
	title: z.string().trim().max(1_000).optional(),
	citationIndex: z.number().int().min(0).max(32_767).optional(),
});

const importedObservationSchema = z.object({
	externalId: z.string().trim().min(1).max(200),
	promptId: z.guid("promptId must be a valid GUID"),
	promptText: z.string().min(1).max(50_000),
	surfaceTargetKey: z.enum(MANUAL_OBSERVATION_SURFACE_TARGET_KEYS),
	captureRouteKey: z.enum(MANUAL_OBSERVATION_CAPTURE_ROUTE_KEYS).default("manual_import.generic"),
	answerText: z.string().trim().min(1).max(500_000),
	observedAt: z.string().datetime({ offset: true }),
	pageUrl: httpUrl,
	sessionMode: z.enum(["anonymous_clean", "new_account_clean"]),
	searchMode: z.enum(["on", "off"]),
	modelVersion: z.string().trim().min(1).max(200).optional(),
	sampleIndex: z.number().int().min(1).max(32_767).default(1),
	actualMarket: z
		.string()
		.trim()
		.regex(/^[A-Za-z]{2}$/)
		.transform((value) => value.toUpperCase()),
	actualLocale: z
		.string()
		.trim()
		.min(2)
		.max(35)
		.refine((value) => {
			try {
				return Intl.getCanonicalLocales(value).length === 1;
			} catch {
				return false;
			}
		}, "actualLocale must be a valid BCP 47 language tag")
		.transform((value) => Intl.getCanonicalLocales(value)[0]),
	operatorReference: z.string().trim().min(1).max(200).optional(),
	evidenceRefs: z.array(evidenceRefSchema).min(1).max(20),
	citations: z.array(citationSchema).max(200).default([]),
	webQueries: z.array(z.string().trim().min(1).max(2_000)).max(100).default([]),
});

const importObservationsBody = z.object({
	brandId: z.string().trim().min(1, "brandId is required"),
	scopeId: z.guid("scopeId must be a valid GUID"),
	dryRun: z.boolean().default(true),
	observations: z.array(importedObservationSchema).min(1).max(100),
});

type ImportedObservation = z.infer<typeof importedObservationSchema>;

function normalizeCitations(input: ImportedObservation["citations"]): Citation[] {
	const seen = new Set<string>();
	const normalized: Citation[] = [];
	for (const [index, citation] of input.entries()) {
		if (seen.has(citation.url)) continue;
		seen.add(citation.url);
		normalized.push({
			url: citation.url,
			domain: new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase(),
			title: citation.title,
			citationIndex: citation.citationIndex ?? index,
		});
	}
	return normalized;
}

function sourceKey(observation: ImportedObservation): string {
	return `import:${observation.externalId}`;
}

function sampleFingerprint(observation: ImportedObservation): string {
	return createHash("sha256").update(JSON.stringify(observation)).digest("hex");
}

export const Route = createFileRoute("/api/v1/observations/import")({
	server: {
		handlers: {
			POST: createApiHandler({
				body: importObservationsBody,
				mapError: (error) => {
					if (error instanceof ObservationSourceConflictError) {
						return new ApiError(409, "Conflict", error.message);
					}
					return undefined;
				},
				handle: async ({ body }) => {
					const brand = await db.query.brands.findFirst({ where: eq(brands.id, body.brandId) });
					if (!brand) {
						throw new ApiError(404, "Not Found", `Brand "${body.brandId}" not found.`);
					}

					let scope: Awaited<ReturnType<typeof resolveMeasurementScopeForBrand>>;
					try {
						scope = await resolveMeasurementScopeForBrand(body.brandId, body.scopeId);
					} catch (error) {
						throw new ApiError(
							400,
							"Validation Error",
							error instanceof Error ? error.message : "Invalid measurement scope.",
						);
					}
					if (scope.market === "ZZ" || scope.locale === "und") {
						throw new ApiError(
							409,
							"Scope Required",
							"Imported observations require an explicit market and locale, not the legacy unspecified scope.",
						);
					}
					if (scope.automaticTargetKeys === null || scope.automaticTargetKeys.length > 0) {
						throw new ApiError(
							409,
							"Manual-only Scope Required",
							"Consumer-surface imports currently require a manual-only scope so automatic API/vendor routes cannot be mixed into the same score.",
						);
					}

					const [competitorRows, promptRows] = await Promise.all([
						db.query.competitors.findMany({ where: eq(competitors.brandId, body.brandId) }),
						db
							.select()
							.from(prompts)
							.where(
								and(
									eq(prompts.brandId, body.brandId),
									eq(prompts.scopeId, body.scopeId),
									inArray(
										prompts.id,
										body.observations.map((observation) => observation.promptId),
									),
								),
							),
					]);
					const promptById = new Map(promptRows.map((prompt) => [prompt.id, prompt]));
					const seenSourceKeys = new Set<string>();
					const now = Date.now();
					const prepared = body.observations.map((observation) => {
						const prompt = promptById.get(observation.promptId);
						if (!prompt) {
							throw new ApiError(
								400,
								"Validation Error",
								`Prompt "${observation.promptId}" does not belong to the requested brand and scope.`,
							);
						}
						if (prompt.value !== observation.promptText) {
							throw new ApiError(
								409,
								"Prompt Mismatch",
								`Prompt text does not match the frozen value for prompt "${prompt.id}".`,
							);
						}
						if (observation.actualMarket !== scope.market || observation.actualLocale !== scope.locale) {
							throw new ApiError(
								409,
								"Scope Mismatch",
								`Observation ${observation.externalId} reports ${observation.actualMarket}/${observation.actualLocale}, ` +
									`but the scope is ${scope.market}/${scope.locale}.`,
							);
						}

						const observedAt = new Date(observation.observedAt);
						if (observedAt.getTime() > now + 5 * 60 * 1_000) {
							throw new ApiError(
								400,
								"Validation Error",
								`Observation "${observation.externalId}" is dated in the future.`,
							);
						}

						const idempotencyKey = sourceKey(observation);
						if (seenSourceKeys.has(idempotencyKey)) {
							throw new ApiError(
								400,
								"Validation Error",
								`Duplicate externalId "${observation.externalId}" appears in this request.`,
							);
						}
						seenSourceKeys.add(idempotencyKey);

						const target = resolveManualObservationTarget(observation);
						if (target.surfaceKind === "search_surface" && observation.searchMode !== "on") {
							throw new ApiError(
								400,
								"Validation Error",
								`Search surface ${target.surfaceTargetKey} requires searchMode "on".`,
							);
						}
						try {
							assertManualObservationPageUrl(target.surfaceTargetKey, observation.pageUrl);
						} catch (error) {
							throw new ApiError(
								400,
								"Validation Error",
								error instanceof Error ? error.message : "Page URL does not match the selected surface.",
							);
						}
						const mentionResult = analyzeMentions(observation.answerText, brand, competitorRows);
						const normalizedCitations = normalizeCitations(observation.citations);
						return {
							observation,
							prompt,
							target,
							observedAt,
							idempotencyKey,
							sampleFingerprint: sampleFingerprint(observation),
							mentionResult,
							normalizedCitations,
						};
					});

					const preview = prepared.map((item) => ({
						externalId: item.observation.externalId,
						promptId: item.prompt.id,
						surfaceTargetKey: item.target.surfaceTargetKey,
						captureRouteKey: item.target.captureRouteKey,
						model: item.target.model,
						observedAt: item.observedAt.toISOString(),
						brandMentioned: item.mentionResult.brandMentioned,
						competitorsMentioned: item.mentionResult.competitorsMentioned,
						citationCount: item.normalizedCitations.length,
						evidenceCount: item.observation.evidenceRefs.length,
					}));

					if (body.dryRun) {
						return { dryRun: true, valid: true, total: preview.length, observations: preview };
					}

					const results = [];
					for (const item of prepared) {
						const config = {
							model: item.target.model,
							provider: item.target.captureMode === "manual_import" ? "manual-import" : "assisted-browser",
							version: item.observation.modelVersion,
							webSearch: item.observation.searchMode === "on",
						};
						const captureMetadata = {
							measurementEligibility: "formal_clean_session",
							sessionMode: item.observation.sessionMode,
							searchMode: item.observation.searchMode,
							pageUrl: item.observation.pageUrl,
							actualMarket: item.observation.actualMarket,
							actualLocale: item.observation.actualLocale,
							operatorReference: item.observation.operatorReference,
							evidenceRefs: item.observation.evidenceRefs,
						};
						const attempt = await claimImportedObservationAttempt({
							sourceKey: item.idempotencyKey,
							promptId: item.prompt.id,
							promptText: item.prompt.value,
							brandId: brand.id,
							scope,
							target: item.target,
							config,
							sampleIndex: item.observation.sampleIndex,
							captureMetadata,
							sampleFingerprint: item.sampleFingerprint,
						});

						if (attempt.state === "completed") {
							results.push({
								externalId: item.observation.externalId,
								status: "duplicate" as const,
								attemptId: attempt.id,
								promptRunId: attempt.promptRunId ?? null,
							});
							continue;
						}
						if (attempt.state === "in_progress") {
							results.push({
								externalId: item.observation.externalId,
								status: "in_progress" as const,
								attemptId: attempt.id,
								promptRunId: null,
							});
							continue;
						}

						try {
							const promptRun = await persistSuccessfulObservation({
								attemptId: attempt.id,
								startedAt: attempt.startedAt,
								observedAt: item.observedAt,
								promptId: item.prompt.id,
								brand,
								scope,
								target: item.target,
								config,
								recordedVersion: item.observation.modelVersion ?? "consumer-surface-unspecified",
								answerText: item.observation.answerText,
								rawOutput: {
									schemaVersion: 1,
									captureMode: item.target.captureMode,
									answerText: item.observation.answerText,
									pageUrl: item.observation.pageUrl,
									citations: item.normalizedCitations,
									evidenceRefs: item.observation.evidenceRefs,
								},
								webQueries: item.observation.webQueries,
								brandMentioned: item.mentionResult.brandMentioned,
								competitorsMentioned: item.mentionResult.competitorsMentioned,
								extractedCitations: item.normalizedCitations,
							});
							results.push({
								externalId: item.observation.externalId,
								status: "imported" as const,
								attemptId: attempt.id,
								promptRunId: promptRun.id,
							});
						} catch (error) {
							await markObservationFailed({
								attemptId: attempt.id,
								startedAt: attempt.startedAt,
								error,
								stage: "import",
							});
							throw error;
						}
					}

					return { dryRun: false, total: results.length, observations: results };
				},
			}),
		},
	},
});
