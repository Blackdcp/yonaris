import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@workspace/lib/db/db";
import {
	brands,
	citations as citationRows,
	competitors,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
} from "@workspace/lib/db/schema";
import { resolveManualObservationTarget } from "@workspace/lib/manual-observation-targets";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { assertLocalDemoAtomicPostcondition, buildLocalDemoAtomicRepairPlan } from "./local-demo-atomic-import-policy";
import {
	assertLocalDemoExistingObservationIdentity,
	assertLocalDemoImportObservationSet,
	buildLocalDemoDefaultScopePromotion,
	type LocalDemoImportObservation,
	parseLocalDemoImportObservation,
	toLocalDemoCitations,
} from "./local-demo-import-policy";

type ImportFile = {
	schemaVersion: 2;
	importId: "stepfun-local-pc-doubao-demo-20260814";
	brandNameExact: "StepFun";
	scopeKeyExact: "cn-zh-scored";
	surfaceTargetKey: "doubao.consumer_web";
	captureRouteKey: "browser_runner.doubao";
	sessionMode: "dedicated_sampling_profile";
	searchMode: "native_auto";
	source: "local_pc_demo";
	observations: LocalDemoImportObservation[];
};

class ImportError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ImportError";
	}
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const request = parseImportFile(
		JSON.parse((await readFile(resolve(options.requestFile), "utf8")).replace(/^\uFEFF/, "")),
	);
	const receipt = await runImport(request, options.apply);
	process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

function parseArgs(args: string[]): { requestFile: string; apply: boolean } {
	let requestFile: string | undefined;
	let apply = false;
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--apply") {
			apply = true;
			continue;
		}
		if (arg !== "--request-file") throw new ImportError("unknown_option", "Unknown option");
		const value = args[index + 1];
		if (!value || value.startsWith("--"))
			throw new ImportError("missing_request_file", "--request-file requires a value");
		requestFile = value;
		index += 1;
	}
	if (!requestFile) throw new ImportError("request_file_required", "--request-file is required");
	return { requestFile, apply };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseImportFile(value: unknown): ImportFile {
	if (!isRecord(value)) throw new ImportError("invalid_request", "Import request must be an object");
	const expected: Omit<ImportFile, "observations"> = {
		schemaVersion: 2,
		importId: "stepfun-local-pc-doubao-demo-20260814",
		brandNameExact: "StepFun",
		scopeKeyExact: "cn-zh-scored",
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sessionMode: "dedicated_sampling_profile",
		searchMode: "native_auto",
		source: "local_pc_demo",
	};
	for (const [key, expectedValue] of Object.entries(expected)) {
		if (value[key] !== expectedValue) throw new ImportError("invalid_request", `Unexpected ${key}`);
	}
	if (!Array.isArray(value.observations) || value.observations.length !== 18) {
		throw new ImportError("invalid_request", "Import request must contain exactly 18 observations");
	}
	let observations: LocalDemoImportObservation[];
	try {
		observations = value.observations.map(parseLocalDemoImportObservation);
		assertLocalDemoImportObservationSet(observations);
	} catch (error) {
		throw new ImportError("invalid_request", error instanceof Error ? error.message : "Invalid observation");
	}
	return { ...expected, observations };
}

function canonical(value: string): string {
	return value.normalize("NFKC");
}

function fingerprint(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameInstant(value: Date | null, expected: Date): boolean {
	return value !== null && value.getTime() === expected.getTime();
}

async function runImport(request: ImportFile, apply: boolean) {
	const brand = await db.query.brands.findFirst({ where: eq(brands.name, request.brandNameExact) });
	if (!brand) throw new ImportError("brand_not_found", "StepFun brand not found");
	const scope = await db.query.measurementScopes.findFirst({
		where: and(
			eq(measurementScopes.brandId, brand.id),
			eq(measurementScopes.key, request.scopeKeyExact),
			eq(measurementScopes.enabled, true),
		),
	});
	if (!scope) throw new ImportError("scope_not_found", "StepFun CN scored scope not found");
	if (
		scope.market !== "CN" ||
		scope.locale !== "zh-CN" ||
		scope.timezone !== "Asia/Shanghai" ||
		scope.samplingEvaluationRole !== "scored"
	) {
		throw new ImportError("scope_mismatch", "StepFun CN scored scope does not match the expected contract");
	}

	const promptRows = await db
		.select()
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)));
	const promptByText = new Map(promptRows.map((prompt) => [canonical(prompt.value), prompt]));
	const promptIds = new Set<string>();
	for (const observation of request.observations) {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) {
			throw new ImportError("prompt_not_found", `Reviewed prompt ${observation.promptIndex} not found in production`);
		}
		promptIds.add(prompt.id);
	}
	if (promptIds.size !== 3) throw new ImportError("prompt_count_mismatch", "Expected exactly three production prompts");
	for (const promptId of promptIds) {
		const count = request.observations.filter((observation) => {
			const prompt = promptByText.get(canonical(observation.promptText));
			return prompt?.id === promptId;
		}).length;
		if (count !== 6) throw new ImportError("sample_count_mismatch", "Expected six observations per prompt");
	}

	const competitorRows = await db.query.competitors.findMany({ where: eq(competitors.brandId, brand.id) });
	const target = resolveManualObservationTarget({
		surfaceTargetKey: request.surfaceTargetKey,
		captureRouteKey: request.captureRouteKey,
	});
	const config = {
		model: target.model,
		provider: "local-pc-demo",
		version: "local-pc-doubao-demo-20260814",
		webSearch: true,
	};

	const preview = request.observations.map((observation) => {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) throw new ImportError("prompt_not_found", `Reviewed prompt ${observation.promptIndex} not found`);
		const mentionResult = analyzeMentions(observation.answerText, brand, competitorRows);
		return {
			externalId: observation.externalId,
			promptId: prompt.id,
			promptIndex: observation.promptIndex,
			sampleIndex: observation.sampleIndex,
			brandMentioned: mentionResult.brandMentioned,
			competitorsMentioned: mentionResult.competitorsMentioned,
			answerCharacters: observation.answerText.length,
			webQueryCount: observation.webQueries.length,
			citationCount: observation.citations.length,
		};
	});
	const expectedDiagnostic = {
		totalRuns: preview.length,
		brandMentionedRuns: preview.filter((item) => item.brandMentioned).length,
		distinctPrompts: promptIds.size,
		webSearchObservedRuns: request.observations.filter((item) => item.webSearchObserved).length,
		queryBearingRuns: request.observations.filter((item) => item.webQueries.length > 0).length,
		totalQueries: request.observations.reduce((total, item) => total + item.webQueries.length, 0),
		citationBearingRuns: request.observations.filter((item) => item.citations.length > 0).length,
		totalCitations: request.observations.reduce((total, item) => total + item.citations.length, 0),
	};

	if (!apply) {
		return {
			status: "dry_run",
			importId: request.importId,
			brandId: brand.id,
			scopeId: scope.id,
			total: preview.length,
			wouldSetDefaultScope: true,
			expectedDiagnostic,
			preview,
		};
	}

	const preparedObservations = request.observations.map((observation) => {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) throw new ImportError("prompt_not_found", `Reviewed prompt ${observation.promptIndex} not found`);
		const mentionResult = analyzeMentions(observation.answerText, brand, competitorRows);
		const sourceKey = `local-demo:${request.importId}:${observation.externalId}`;
		const sampleFingerprint = fingerprint(observation);
		return {
			observation,
			prompt,
			mentionResult,
			sourceKey,
			sampleFingerprint,
			extractedCitations: toLocalDemoCitations(observation.citations),
			captureMetadata: {
				source: request.source,
				importId: request.importId,
				sessionMode: request.sessionMode,
				searchMode: request.searchMode,
				pageUrl: observation.pageUrl,
				actualMarket: "CN",
				actualLocale: "zh-CN",
				measurementEligibility: "local_pc_demo",
				note: "Local PC demonstration import requested by operator; not a frozen delivery batch.",
			},
			rawOutput: {
				schemaVersion: 2,
				captureMode: "local_pc_demo",
				answerText: observation.answerText,
				pageUrl: observation.pageUrl,
				source: request.source,
				importId: request.importId,
				webSearchObserved: observation.webSearchObserved,
				webQueries: observation.webQueries,
				citations: observation.citations,
			},
		};
	});
	const defaultScopePromotion = buildLocalDemoDefaultScopePromotion({
		brandId: brand.id,
		scopeId: scope.id,
		importId: request.importId,
		source: request.source,
	});

	const atomicResult = await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${request.importId}, 0))`);
		const sourceKeyPrefix = `local-demo:${request.importId}:`;
		const existingAttempts = await tx
			.select()
			.from(observationAttempts)
			.where(and(eq(observationAttempts.brandId, brand.id), like(observationAttempts.sourceKey, `${sourceKeyPrefix}%`)))
			.for("update");
		const existingRuns = await tx
			.select()
			.from(promptRuns)
			.where(
				and(
					eq(promptRuns.brandId, brand.id),
					eq(promptRuns.scopeId, scope.id),
					eq(promptRuns.provider, config.provider),
					eq(promptRuns.version, config.version),
				),
			)
			.for("update");
		const existingCitations =
			existingRuns.length === 0
				? []
				: await tx
						.select()
						.from(citationRows)
						.where(
							inArray(
								citationRows.promptRunId,
								existingRuns.map((run) => run.id),
							),
						)
						.for("update");

		let repairPlan: ReturnType<typeof buildLocalDemoAtomicRepairPlan>;
		try {
			repairPlan = buildLocalDemoAtomicRepairPlan({
				expected: preparedObservations.map((item) => ({
					sourceKey: item.sourceKey,
					sampleFingerprint: item.sampleFingerprint,
				})),
				attempts: existingAttempts,
				runs: existingRuns,
			});
		} catch (error) {
			throw new ImportError(
				"existing_observation_mismatch",
				error instanceof Error ? error.message : "Existing local demo cohort mismatch",
			);
		}

		const attemptsById = new Map(existingAttempts.map((attempt) => [attempt.id, attempt]));
		const runsById = new Map(existingRuns.map((run) => [run.id, run]));
		const planBySourceKey = new Map(repairPlan.map((item) => [item.sourceKey, item]));
		const citationsByRunId = new Map<string, typeof existingCitations>();
		for (const citation of existingCitations) {
			const current = citationsByRunId.get(citation.promptRunId) ?? [];
			current.push(citation);
			citationsByRunId.set(citation.promptRunId, current);
		}
		const validated = preparedObservations.map((item) => {
			const plan = planBySourceKey.get(item.sourceKey);
			const attempt = plan ? attemptsById.get(plan.attemptId) : undefined;
			const existingRun = plan ? runsById.get(plan.promptRunId) : undefined;
			if (!plan || !attempt || !existingRun) {
				throw new ImportError("existing_observation_mismatch", "Existing local demo cohort mapping is incomplete");
			}
			const existingMetadata = isRecord(attempt.captureMetadata) ? attempt.captureMetadata : {};
			const expectedIdentity = {
				promptId: item.prompt.id,
				brandId: brand.id,
				scopeId: scope.id,
				surfaceTargetKey: target.surfaceTargetKey,
				captureRouteKey: target.captureRouteKey,
				model: config.model,
				provider: config.provider,
				version: config.version,
				webSearchEnabled: config.webSearch,
				sampleIndex: item.observation.sampleIndex,
				importId: request.importId,
				source: request.source,
			};
			try {
				if (attempt.sourceKey !== item.sourceKey || canonical(attempt.promptText) !== canonical(item.prompt.value)) {
					throw new Error("Existing local demo source or prompt text mismatch");
				}
				assertLocalDemoExistingObservationIdentity(
					{
						promptId: attempt.promptId,
						brandId: attempt.brandId,
						scopeId: attempt.scopeId,
						surfaceTargetKey: attempt.surfaceTargetKey,
						captureRouteKey: attempt.captureRouteKey,
						model: attempt.model,
						provider: attempt.provider,
						version: attempt.requestedVersion,
						webSearchEnabled: attempt.webSearchEnabled,
						sampleIndex: attempt.sampleIndex,
						importId: existingMetadata.importId,
						source: existingMetadata.source,
					},
					expectedIdentity,
				);
				assertLocalDemoExistingObservationIdentity(
					{
						promptId: existingRun.promptId,
						brandId: existingRun.brandId,
						scopeId: existingRun.scopeId,
						surfaceTargetKey: existingRun.surfaceTargetKey,
						captureRouteKey: existingRun.captureRouteKey,
						model: existingRun.model,
						provider: existingRun.provider,
						version: existingRun.version,
						webSearchEnabled: existingRun.webSearchEnabled,
						sampleIndex: attempt.sampleIndex,
						importId: existingMetadata.importId,
						source: existingMetadata.source,
					},
					expectedIdentity,
				);
			} catch (error) {
				throw new ImportError(
					"existing_observation_mismatch",
					error instanceof Error ? error.message : "Existing local demo identity mismatch",
				);
			}
			const expectedObservedAt = new Date(item.observation.observedAt);
			const storedCitations = [...(citationsByRunId.get(existingRun.id) ?? [])].sort(
				(left, right) => left.citationIndex - right.citationIndex,
			);
			const citationsCurrent =
				storedCitations.length === item.extractedCitations.length &&
				item.extractedCitations.every((citation, index) => {
					const stored = storedCitations[index];
					return (
						stored !== undefined &&
						stored.promptRunId === existingRun.id &&
						stored.promptId === item.prompt.id &&
						stored.brandId === brand.id &&
						stored.model === config.model &&
						stored.url === citation.url &&
						stored.domain === citation.domain &&
						stored.title === citation.title &&
						stored.citationIndex === citation.citationIndex &&
						stored.createdAt.getTime() === expectedObservedAt.getTime()
					);
				});
			const structuredDetailCurrent =
				plan.structuredDetailCurrent &&
				attempt.webSearchObserved === item.observation.webSearchObserved &&
				existingRun.webSearchObserved === item.observation.webSearchObserved &&
				existingRun.answerText === item.observation.answerText &&
				sameStringArray(existingRun.webQueries, item.observation.webQueries) &&
				existingRun.brandMentioned === item.mentionResult.brandMentioned &&
				sameStringArray(existingRun.competitorsMentioned, item.mentionResult.competitorsMentioned) &&
				sameInstant(existingRun.observedAt, expectedObservedAt) &&
				existingRun.createdAt.getTime() === expectedObservedAt.getTime() &&
				citationsCurrent;
			return { ...item, ...plan, attempt, existingRun, existingMetadata, structuredDetailCurrent };
		});

		const results = [];
		for (const item of validated) {
			if (item.structuredDetailCurrent) {
				results.push({
					externalId: item.observation.externalId,
					status: "unchanged",
					attemptId: item.attempt.id,
					promptRunId: item.existingRun.id,
				});
				continue;
			}
			const updatedAttempts = await tx
				.update(observationAttempts)
				.set({
					webSearchObserved: item.observation.webSearchObserved,
					captureMetadata: {
						...item.existingMetadata,
						...item.captureMetadata,
						sampleFingerprint: item.sampleFingerprint,
						structuredDetailRevision: 1,
					},
				})
				.where(and(eq(observationAttempts.id, item.attempt.id), eq(observationAttempts.status, "succeeded")))
				.returning({ id: observationAttempts.id });
			const updatedRuns = await tx
				.update(promptRuns)
				.set({
					webSearchObserved: item.observation.webSearchObserved,
					rawOutput: item.rawOutput,
					answerText: item.observation.answerText,
					webQueries: item.observation.webQueries,
					brandMentioned: item.mentionResult.brandMentioned,
					competitorsMentioned: item.mentionResult.competitorsMentioned,
					observedAt: new Date(item.observation.observedAt),
					createdAt: new Date(item.observation.observedAt),
				})
				.where(and(eq(promptRuns.id, item.existingRun.id), eq(promptRuns.observationAttemptId, item.attempt.id)))
				.returning({ id: promptRuns.id });
			if (updatedAttempts.length !== 1 || updatedRuns.length !== 1) {
				throw new ImportError("atomic_repair_conflict", "A locked local demo row changed during atomic repair");
			}
			await tx.delete(citationRows).where(eq(citationRows.promptRunId, item.existingRun.id));
			await tx.insert(citationRows).values(
				item.extractedCitations.map((citation) => ({
					promptRunId: item.existingRun.id,
					promptId: item.prompt.id,
					brandId: brand.id,
					model: config.model,
					url: citation.url,
					domain: citation.domain,
					title: citation.title,
					citationIndex: citation.citationIndex,
					createdAt: new Date(item.observation.observedAt),
				})),
			);
			results.push({
				externalId: item.observation.externalId,
				status: "repaired",
				attemptId: item.attempt.id,
				promptRunId: item.existingRun.id,
			});
		}

		await tx
			.update(measurementScopes)
			.set({ isDefault: false })
			.where(eq(measurementScopes.brandId, defaultScopePromotion.brandId));
		const promotedScopes = await tx
			.update(measurementScopes)
			.set({ isDefault: true })
			.where(
				and(
					eq(measurementScopes.brandId, defaultScopePromotion.brandId),
					eq(measurementScopes.id, defaultScopePromotion.scopeId),
				),
			)
			.returning({ id: measurementScopes.id });
		if (promotedScopes.length !== 1) {
			throw new ImportError("default_scope_mismatch", "Expected StepFun default scope could not be promoted");
		}

		const [visibilityDiagnostic] = await tx
			.select({
				totalRuns: sql<number>`count(*)::int`,
				brandMentionedRuns: sql<number>`count(*) FILTER (WHERE ${promptRuns.brandMentioned})::int`,
				distinctPrompts: sql<number>`count(DISTINCT ${promptRuns.promptId})::int`,
				webSearchObservedRuns: sql<number>`count(*) FILTER (WHERE ${promptRuns.webSearchObserved})::int`,
				queryBearingRuns: sql<number>`count(*) FILTER (WHERE cardinality(${promptRuns.webQueries}) > 0)::int`,
				totalQueries: sql<number>`coalesce(sum(cardinality(${promptRuns.webQueries})), 0)::int`,
			})
			.from(promptRuns)
			.where(
				and(
					eq(promptRuns.brandId, brand.id),
					eq(promptRuns.scopeId, scope.id),
					eq(promptRuns.provider, config.provider),
					eq(promptRuns.version, config.version),
				),
			);
		const [citationDiagnostic] = await tx
			.select({
				citationBearingRuns: sql<number>`count(DISTINCT ${citationRows.promptRunId})::int`,
				totalCitations: sql<number>`count(*)::int`,
				distinctCitationUrls: sql<number>`count(DISTINCT ${citationRows.url})::int`,
				distinctCitationDomains: sql<number>`count(DISTINCT ${citationRows.domain})::int`,
			})
			.from(citationRows)
			.innerJoin(promptRuns, eq(promptRuns.id, citationRows.promptRunId))
			.where(
				and(
					eq(promptRuns.brandId, brand.id),
					eq(promptRuns.scopeId, scope.id),
					eq(promptRuns.provider, config.provider),
					eq(promptRuns.version, config.version),
				),
			);
		if (!visibilityDiagnostic || !citationDiagnostic) {
			throw new ImportError("atomic_postcondition_failed", "Local demo diagnostic row is missing");
		}
		const defaultScopes = await tx
			.select({ id: measurementScopes.id, key: measurementScopes.key, name: measurementScopes.name })
			.from(measurementScopes)
			.where(and(eq(measurementScopes.brandId, brand.id), eq(measurementScopes.isDefault, true)));
		try {
			assertLocalDemoAtomicPostcondition({
				actualDiagnostic: { ...visibilityDiagnostic, ...citationDiagnostic },
				expectedDiagnostic,
				actualDefaultScopeIds: defaultScopes.map((item) => item.id),
				expectedDefaultScopeId: scope.id,
			});
		} catch (error) {
			throw new ImportError(
				"atomic_postcondition_failed",
				error instanceof Error ? error.message : "Local demo atomic postcondition failed",
			);
		}

		return {
			results,
			visibilityDiagnostic,
			citationDiagnostic,
			defaultScope: defaultScopes[0],
		};
	});

	return {
		status: "applied",
		importId: request.importId,
		brandId: brand.id,
		scopeId: scope.id,
		total: atomicResult.results.length,
		imported: 0,
		repaired: atomicResult.results.filter((result) => result.status === "repaired").length,
		duplicates: atomicResult.results.filter((result) => result.status === "unchanged").length,
		inProgress: 0,
		defaultScopeSet: true,
		defaultScope: atomicResult.defaultScope,
		visibilityDiagnostic: atomicResult.visibilityDiagnostic,
		citationDiagnostic: atomicResult.citationDiagnostic,
		expectedDiagnostic,
		structuredDetailsComplete: true,
		results: atomicResult.results,
	};
}

main().catch((error) => {
	const code = error instanceof ImportError ? error.code : "unexpected_error";
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${JSON.stringify({ status: "failed", code, message })}\n`);
	process.exitCode = 1;
});
