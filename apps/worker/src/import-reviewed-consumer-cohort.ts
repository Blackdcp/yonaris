import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/lib/db/db";
import {
	brands,
	citations,
	competitors,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
} from "@workspace/lib/db/schema";
import { resolveManualObservationTarget } from "@workspace/lib/manual-observation-targets";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
	decideReviewedConsumerCohortImport,
	reviewedConsumerCitationIdentityMatches,
	reviewedConsumerCohortIdentityMatches,
} from "./reviewed-consumer-cohort-import-policy";
import {
	buildReviewedConsumerSourceKey,
	parseReviewedConsumerCohort,
	reviewedConsumerCohortFingerprint,
} from "./reviewed-consumer-cohort-policy";

const PROVIDER = "local-pc-reviewed";
const VERSION = "deepseek-web-20260814";

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
	const { requestFile, apply } = parseArguments(process.argv.slice(2));
	const request = parseReviewedConsumerCohort(
		JSON.parse((await readFile(path.resolve(requestFile), "utf8")).replace(/^\uFEFF/, "")),
	);
	const receipt = await importReviewedConsumerCohort(request, apply);
	process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

function parseArguments(arguments_: string[]): { requestFile: string; apply: boolean } {
	let requestFile: string | undefined;
	let apply = false;
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === "--apply") {
			apply = true;
			continue;
		}
		if (argument !== "--request-file") throw new ImportError("unknown_option", "Unknown option");
		const value = arguments_[index + 1];
		if (!value || value.startsWith("--")) throw new ImportError("missing_request_file", "Missing request file");
		requestFile = value;
		index += 1;
	}
	if (!requestFile) throw new ImportError("request_file_required", "Request file is required");
	return { requestFile, apply };
}

async function importReviewedConsumerCohort(request: ReturnType<typeof parseReviewedConsumerCohort>, apply: boolean) {
	const brand = await db.query.brands.findFirst({
		where: and(eq(brands.id, request.brandId), eq(brands.name, "StepFun")),
	});
	if (!brand) throw new ImportError("brand_not_found", "StepFun brand not found");
	const scope = await db.query.measurementScopes.findFirst({
		where: and(
			eq(measurementScopes.brandId, brand.id),
			eq(measurementScopes.key, request.scopeKey),
			eq(measurementScopes.enabled, true),
		),
	});
	if (
		!scope ||
		scope.market !== request.market ||
		scope.locale !== request.locale ||
		scope.timezone !== request.timezone ||
		scope.samplingEvaluationRole !== request.evaluationRole
	) {
		throw new ImportError("scope_mismatch", "StepFun CN scored scope does not match the reviewed cohort");
	}
	const promptRows = await db
		.select()
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)));
	const promptByText = new Map(promptRows.map((prompt) => [canonical(prompt.value), prompt]));
	const selectedPrompts = new Set<string>();
	for (const observation of request.observations) {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) throw new ImportError("prompt_not_found", "Reviewed DeepSeek prompt not found in production");
		selectedPrompts.add(prompt.id);
	}
	if (selectedPrompts.size !== 3) throw new ImportError("prompt_count_mismatch", "Expected exactly three prompts");

	const competitorRows = await db.query.competitors.findMany({ where: eq(competitors.brandId, brand.id) });
	const target = resolveManualObservationTarget({
		surfaceTargetKey: request.surfaceTargetKey,
		captureRouteKey: request.captureRouteKey,
	});
	if (target.model !== request.model) throw new ImportError("target_mismatch", "DeepSeek target model mismatch");
	const manifestFingerprint = reviewedConsumerCohortFingerprint(request);
	const prepared = request.observations.map((observation) => {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) throw new ImportError("prompt_not_found", "Reviewed DeepSeek prompt not found");
		const mention = analyzeMentions(observation.answerText, brand, competitorRows);
		return {
			observation,
			prompt,
			mention,
			sourceKey: buildReviewedConsumerSourceKey(observation),
			sampleFingerprint: sha256(JSON.stringify(observation)),
		};
	});
	const expectedDiagnostic = {
		totalRuns: 18,
		brandMentionedRuns: prepared.filter((item) => item.mention.brandMentioned).length,
		distinctPrompts: 3,
		webSearchObservedRuns: prepared.filter((item) => item.observation.webSearchObserved === true).length,
		totalQueries: prepared.reduce((total, item) => total + item.observation.webQueries.length, 0),
		totalCitations: prepared.reduce((total, item) => total + item.observation.citations.length, 0),
	};
	if (!apply) {
		return {
			status: "dry_run",
			importId: request.importId,
			brandId: brand.id,
			scopeId: scope.id,
			total: 18,
			manifestFingerprint,
			expectedDiagnostic,
		};
	}

	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${request.importId}, 0))`);
		const sourcePrefix = "reviewed-consumer-cohort:stepfun-local-pc-deepseek-18-20260814:";
		const existingAttempts = await tx
			.select()
			.from(observationAttempts)
			.where(and(eq(observationAttempts.brandId, brand.id), like(observationAttempts.sourceKey, `${sourcePrefix}%`)))
			.for("update");
		const existingRuns = await tx
			.select()
			.from(promptRuns)
			.where(
				and(
					eq(promptRuns.brandId, brand.id),
					eq(promptRuns.scopeId, scope.id),
					eq(promptRuns.provider, PROVIDER),
					eq(promptRuns.version, VERSION),
				),
			)
			.for("update");
		let disposition: ReturnType<typeof decideReviewedConsumerCohortImport>;
		try {
			disposition = decideReviewedConsumerCohortImport(
				prepared.map((item) => ({ sourceKey: item.sourceKey })),
				existingAttempts,
				existingRuns,
			);
		} catch {
			throw new ImportError("existing_cohort_conflict", "Existing DeepSeek cohort is partial or inconsistent");
		}

		if (disposition.action === "unchanged") {
			await assertExactExistingCohort({
				tx,
				prepared,
				existingAttempts,
				existingRuns,
				brandId: brand.id,
				scopeId: scope.id,
				surfaceTargetKey: target.surfaceTargetKey,
				captureRouteKey: target.captureRouteKey,
				model: target.model,
				manifestFingerprint,
			});
			const diagnostic = await readDiagnostic(tx, brand.id, scope.id);
			if (JSON.stringify(diagnostic) !== JSON.stringify(expectedDiagnostic)) {
				throw new ImportError(
					"existing_cohort_conflict",
					"Existing DeepSeek cohort diagnostic does not match the reviewed manifest",
				);
			}
			return {
				status: "applied",
				lifecycle: "unchanged",
				total: 18,
				manifestFingerprint,
				diagnostic,
			};
		}

		const attemptValues = prepared.map((item) => {
			const id = randomUUID();
			const observedAt = new Date(item.observation.observedAt);
			return {
				id,
				sourceKey: item.sourceKey,
				promptId: item.prompt.id,
				promptText: item.observation.promptText,
				brandId: brand.id,
				scopeId: scope.id,
				surfaceTargetKey: target.surfaceTargetKey,
				captureRouteKey: target.captureRouteKey,
				model: target.model,
				provider: PROVIDER,
				requestedVersion: VERSION,
				webSearchEnabled: true,
				webSearchObserved: item.observation.webSearchObserved,
				sampleIndex: item.observation.sampleIndex,
				executionCount: 1,
				status: "succeeded" as const,
				startedAt: observedAt,
				completedAt: observedAt,
				captureMetadata: {
					source: "local_pc_reviewed_consumer_cohort",
					importId: request.importId,
					manifestFingerprint,
					sampleFingerprint: item.sampleFingerprint,
					sessionMode: request.sessionMode,
					searchMode: request.searchMode,
					pageUrl: item.observation.pageUrl,
					evidence: item.observation.evidence,
				},
				createdAt: observedAt,
				updatedAt: observedAt,
			};
		});
		await tx.insert(observationAttempts).values(attemptValues);
		const attemptIdBySourceKey = new Map(attemptValues.map((item) => [item.sourceKey, item.id]));
		const runValues = prepared.map((item) => {
			const id = randomUUID();
			const observedAt = new Date(item.observation.observedAt);
			const observationAttemptId = attemptIdBySourceKey.get(item.sourceKey);
			if (!observationAttemptId) throw new ImportError("internal_mapping_error", "Missing attempt mapping");
			return {
				id,
				promptId: item.prompt.id,
				brandId: brand.id,
				observationAttemptId,
				scopeId: scope.id,
				surfaceTargetKey: target.surfaceTargetKey,
				captureRouteKey: target.captureRouteKey,
				model: target.model,
				provider: PROVIDER,
				version: VERSION,
				webSearchEnabled: true,
				webSearchObserved: item.observation.webSearchObserved,
				rawOutput: {
					schemaVersion: 1,
					captureMode: "local_pc_reviewed_consumer_cohort",
					answerText: item.observation.answerText,
					pageUrl: item.observation.pageUrl,
					webSearchObserved: item.observation.webSearchObserved,
					webQueries: item.observation.webQueries,
					citations: item.observation.citations,
					evidence: item.observation.evidence,
					manifestFingerprint,
				},
				answerText: item.observation.answerText,
				webQueries: item.observation.webQueries,
				brandMentioned: item.mention.brandMentioned,
				competitorsMentioned: item.mention.competitorsMentioned,
				observedAt,
				createdAt: observedAt,
			};
		});
		await tx.insert(promptRuns).values(runValues);
		const runIdByAttemptId = new Map(runValues.map((item) => [item.observationAttemptId, item.id]));
		const citationValues = prepared.flatMap((item) => {
			const attemptId = attemptIdBySourceKey.get(item.sourceKey);
			const promptRunId = attemptId ? runIdByAttemptId.get(attemptId) : undefined;
			if (!promptRunId) throw new ImportError("internal_mapping_error", "Missing run mapping");
			return item.observation.citations.map((citation) => ({
				promptRunId,
				promptId: item.prompt.id,
				brandId: brand.id,
				model: target.model,
				url: citation.url,
				domain: new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase(),
				title: citation.title,
				citationIndex: citation.citationIndex,
				createdAt: new Date(item.observation.observedAt),
			}));
		});
		if (citationValues.length > 0) await tx.insert(citations).values(citationValues);

		const diagnostic = await readDiagnostic(tx, brand.id, scope.id);
		if (JSON.stringify(diagnostic) !== JSON.stringify(expectedDiagnostic)) {
			throw new ImportError("postcondition_failed", "DeepSeek cohort diagnostic did not match the reviewed manifest");
		}
		return {
			status: "applied",
			lifecycle: "inserted",
			total: 18,
			manifestFingerprint,
			diagnostic,
		};
	});
}

async function assertExactExistingCohort(input: {
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
	prepared: Array<{
		observation: ReturnType<typeof parseReviewedConsumerCohort>["observations"][number];
		prompt: typeof prompts.$inferSelect;
		mention: ReturnType<typeof analyzeMentions>;
		sourceKey: string;
		sampleFingerprint: string;
	}>;
	existingAttempts: Array<typeof observationAttempts.$inferSelect>;
	existingRuns: Array<typeof promptRuns.$inferSelect>;
	brandId: string;
	scopeId: string;
	surfaceTargetKey: string;
	captureRouteKey: string;
	model: string;
	manifestFingerprint: string;
}) {
	const attemptsBySourceKey = new Map(input.existingAttempts.map((item) => [item.sourceKey, item]));
	const runsByAttemptId = new Map(input.existingRuns.map((item) => [item.observationAttemptId, item]));
	const storedCitations = await input.tx
		.select()
		.from(citations)
		.where(
			inArray(
				citations.promptRunId,
				input.existingRuns.map((item) => item.id),
			),
		)
		.for("update");
	const citationsByRunId = new Map<string, Array<typeof citations.$inferSelect>>();
	for (const citation of storedCitations) {
		const values = citationsByRunId.get(citation.promptRunId) ?? [];
		values.push(citation);
		citationsByRunId.set(citation.promptRunId, values);
	}
	for (const item of input.prepared) {
		const attempt = attemptsBySourceKey.get(item.sourceKey);
		const run = attempt ? runsByAttemptId.get(attempt.id) : undefined;
		const metadata = isRecord(attempt?.captureMetadata) ? attempt.captureMetadata : {};
		const expectedObservedAt = new Date(item.observation.observedAt).getTime();
		const expectedCreatedAt = new Date(item.observation.observedAt);
		const expectedCitations = item.observation.citations;
		const actualCitations = [...(run ? (citationsByRunId.get(run.id) ?? []) : [])].sort(
			(left, right) => left.citationIndex - right.citationIndex,
		);
		const identityMatches =
			attempt &&
			run &&
			reviewedConsumerCohortIdentityMatches(attempt, run, {
				promptId: item.prompt.id,
				brandId: input.brandId,
				scopeId: input.scopeId,
				surfaceTargetKey: input.surfaceTargetKey,
				captureRouteKey: input.captureRouteKey,
				model: input.model,
				provider: PROVIDER,
				version: VERSION,
				webSearchEnabled: true,
				webSearchObserved: item.observation.webSearchObserved,
			});
		if (
			!attempt ||
			!run ||
			!identityMatches ||
			attempt.sampleIndex !== item.observation.sampleIndex ||
			attempt.webSearchObserved !== item.observation.webSearchObserved ||
			metadata.manifestFingerprint !== input.manifestFingerprint ||
			metadata.sampleFingerprint !== item.sampleFingerprint ||
			run.promptId !== item.prompt.id ||
			run.answerText !== item.observation.answerText ||
			run.webSearchObserved !== item.observation.webSearchObserved ||
			!sameArray(run.webQueries, item.observation.webQueries) ||
			run.brandMentioned !== item.mention.brandMentioned ||
			!sameArray(run.competitorsMentioned, item.mention.competitorsMentioned) ||
			run.observedAt?.getTime() !== expectedObservedAt ||
			actualCitations.length !== expectedCitations.length ||
			expectedCitations.some((citation, index) => {
				const actual = actualCitations[index];
				return (
					!actual ||
					!reviewedConsumerCitationIdentityMatches(actual, {
						promptId: item.prompt.id,
						brandId: input.brandId,
						model: input.model,
						url: citation.url,
						domain: new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase(),
						title: citation.title,
						citationIndex: citation.citationIndex,
						createdAt: expectedCreatedAt,
					})
				);
			})
		) {
			throw new ImportError("existing_cohort_conflict", "Existing DeepSeek cohort content mismatch");
		}
	}
}

async function readDiagnostic(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	brandId: string,
	scopeId: string,
) {
	const [runDiagnostic] = await tx
		.select({
			totalRuns: sql<number>`count(*)::int`,
			brandMentionedRuns: sql<number>`count(*) filter (where ${promptRuns.brandMentioned})::int`,
			distinctPrompts: sql<number>`count(distinct ${promptRuns.promptId})::int`,
			webSearchObservedRuns: sql<number>`count(*) filter (where ${promptRuns.webSearchObserved})::int`,
			totalQueries: sql<number>`coalesce(sum(cardinality(${promptRuns.webQueries})), 0)::int`,
		})
		.from(promptRuns)
		.where(
			and(
				eq(promptRuns.brandId, brandId),
				eq(promptRuns.scopeId, scopeId),
				eq(promptRuns.provider, PROVIDER),
				eq(promptRuns.version, VERSION),
			),
		);
	const [citationDiagnostic] = await tx
		.select({ totalCitations: sql<number>`count(*)::int` })
		.from(citations)
		.innerJoin(promptRuns, eq(citations.promptRunId, promptRuns.id))
		.where(
			and(
				eq(promptRuns.brandId, brandId),
				eq(promptRuns.scopeId, scopeId),
				eq(promptRuns.provider, PROVIDER),
				eq(promptRuns.version, VERSION),
			),
		);
	return {
		totalRuns: runDiagnostic?.totalRuns ?? 0,
		brandMentionedRuns: runDiagnostic?.brandMentionedRuns ?? 0,
		distinctPrompts: runDiagnostic?.distinctPrompts ?? 0,
		webSearchObservedRuns: runDiagnostic?.webSearchObservedRuns ?? 0,
		totalQueries: runDiagnostic?.totalQueries ?? 0,
		totalCitations: citationDiagnostic?.totalCitations ?? 0,
	};
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: string): string {
	return value.normalize("NFKC");
}

function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

void main().catch((error) => {
	const code = error instanceof ImportError ? error.code : "unexpected_error";
	process.stdout.write(`${JSON.stringify({ status: "error", code })}\n`);
	process.exitCode = 1;
});
