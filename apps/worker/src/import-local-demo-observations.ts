import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@workspace/lib/db/db";
import { claimImportedObservationAttempt, persistSuccessfulObservation } from "@workspace/lib/db/observations";
import { brands, competitors, measurementScopes, promptRuns, prompts } from "@workspace/lib/db/schema";
import { resolveManualObservationTarget } from "@workspace/lib/manual-observation-targets";
import { analyzeMentions } from "@workspace/lib/mention-analysis";
import { and, eq, sql } from "drizzle-orm";
import { buildLocalDemoDefaultScopePromotion } from "./local-demo-import-policy";

type ImportObservation = {
	externalId: string;
	promptIndex: 1 | 2 | 3;
	sampleIndex: number;
	promptText: string;
	answerText: string;
	observedAt: string;
	pageUrl: string;
	answerCharacters: number;
};

type ImportFile = {
	schemaVersion: 1;
	importId: "stepfun-local-pc-doubao-demo-20260814";
	brandNameExact: "StepFun";
	scopeKeyExact: "cn-zh-scored";
	surfaceTargetKey: "doubao.consumer_web";
	captureRouteKey: "browser_runner.doubao";
	sessionMode: "dedicated_sampling_profile";
	searchMode: "native_auto";
	source: "local_pc_demo";
	observations: ImportObservation[];
};

class ImportError extends Error {
	constructor(readonly code: string, message: string) {
		super(message);
		this.name = "ImportError";
	}
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const request = parseImportFile(JSON.parse((await readFile(resolve(options.requestFile), "utf8")).replace(/^\uFEFF/, "")));
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
		if (!value || value.startsWith("--")) throw new ImportError("missing_request_file", "--request-file requires a value");
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
		schemaVersion: 1,
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
	const observations = value.observations.map(parseImportObservation);
	const counts = new Map<number, number>();
	for (const observation of observations) {
		counts.set(observation.promptIndex, (counts.get(observation.promptIndex) ?? 0) + 1);
	}
	if (counts.get(1) !== 6 || counts.get(2) !== 6 || counts.get(3) !== 6) {
		throw new ImportError("invalid_request", "Import request must contain six observations per prompt");
	}
	return { ...expected, observations };
}

function parseImportObservation(value: unknown): ImportObservation {
	if (!isRecord(value)) throw new ImportError("invalid_request", "Observation must be an object");
	const externalId = stringField(value, "externalId", 1, 200);
	if (!externalId.startsWith("stepfun-local-pc-demo-20260814-")) {
		throw new ImportError("invalid_request", "Unexpected external id");
	}
	const promptIndex = numberField(value, "promptIndex", 1, 3) as 1 | 2 | 3;
	const sampleIndex = numberField(value, "sampleIndex", 1, 32_767);
	const promptText = stringField(value, "promptText", 1, 50_000);
	const answerText = stringField(value, "answerText", 1, 500_000);
	const observedAt = stringField(value, "observedAt", 1, 100);
	if (Number.isNaN(new Date(observedAt).getTime())) throw new ImportError("invalid_request", "Invalid observedAt");
	const pageUrl = stringField(value, "pageUrl", 1, 10_000);
	const url = new URL(pageUrl);
	if (url.protocol !== "https:" || !url.hostname.endsWith("doubao.com")) {
		throw new ImportError("invalid_request", "Page URL must be an HTTPS Doubao URL");
	}
	const answerCharacters = numberField(value, "answerCharacters", 1, 500_000);
	if (answerCharacters !== answerText.length) throw new ImportError("invalid_request", "Answer character count mismatch");
	return { externalId, promptIndex, sampleIndex, promptText, answerText, observedAt, pageUrl, answerCharacters };
}

function stringField(record: Record<string, unknown>, key: string, min: number, max: number): string {
	const value = record[key];
	if (typeof value !== "string" || value.length < min || value.length > max) {
		throw new ImportError("invalid_request", `Invalid ${key}`);
	}
	return value;
}

function numberField(record: Record<string, unknown>, key: string, min: number, max: number): number {
	const value = record[key];
	if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
		throw new ImportError("invalid_request", `Invalid ${key}`);
	}
	return value;
}

function canonical(value: string): string {
	return value.normalize("NFKC");
}

function fingerprint(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
		};
	});

	if (!apply) {
		return {
			status: "dry_run",
			importId: request.importId,
			brandId: brand.id,
			scopeId: scope.id,
			total: preview.length,
			wouldSetDefaultScope: true,
			preview,
		};
	}

	const results = [];
	for (const observation of request.observations) {
		const prompt = promptByText.get(canonical(observation.promptText));
		if (!prompt) throw new ImportError("prompt_not_found", `Reviewed prompt ${observation.promptIndex} not found`);
		const mentionResult = analyzeMentions(observation.answerText, brand, competitorRows);
		const sourceKey = `local-demo:${request.importId}:${observation.externalId}`;
		const captureMetadata = {
			source: request.source,
			importId: request.importId,
			sessionMode: request.sessionMode,
			searchMode: request.searchMode,
			pageUrl: observation.pageUrl,
			actualMarket: "CN",
			actualLocale: "zh-CN",
			measurementEligibility: "local_pc_demo",
			note: "Local PC demonstration import requested by operator; not a frozen delivery batch.",
		};
		const attempt = await claimImportedObservationAttempt({
			sourceKey,
			promptId: prompt.id,
			promptText: prompt.value,
			brandId: brand.id,
			scope,
			target,
			config,
			webSearchObserved: null,
			sampleIndex: observation.sampleIndex,
			captureMetadata,
			sampleFingerprint: fingerprint(observation),
		});
		if (attempt.state === "completed") {
			results.push({
				externalId: observation.externalId,
				status: "duplicate",
				attemptId: attempt.id,
				promptRunId: attempt.promptRunId ?? null,
			});
			continue;
		}
		if (attempt.state === "in_progress") {
			results.push({ externalId: observation.externalId, status: "in_progress", attemptId: attempt.id, promptRunId: null });
			continue;
		}
		const promptRun = await persistSuccessfulObservation({
			attemptId: attempt.id,
			startedAt: attempt.startedAt,
			observedAt: new Date(observation.observedAt),
			promptId: prompt.id,
			brand,
			scope,
			target,
			config,
			webSearchObserved: null,
			recordedVersion: "local-pc-doubao-demo-20260814",
			answerText: observation.answerText,
			rawOutput: {
				schemaVersion: 1,
				captureMode: "local_pc_demo",
				answerText: observation.answerText,
				pageUrl: observation.pageUrl,
				source: request.source,
				importId: request.importId,
				webSearchObserved: null,
			},
			webQueries: [],
			brandMentioned: mentionResult.brandMentioned,
			competitorsMentioned: mentionResult.competitorsMentioned,
			extractedCitations: [],
		});
		results.push({
			externalId: observation.externalId,
			status: "imported",
			attemptId: attempt.id,
			promptRunId: promptRun.id,
		});
	}

	const defaultScopePromotion = buildLocalDemoDefaultScopePromotion({
		brandId: brand.id,
		scopeId: scope.id,
		importId: request.importId,
		source: request.source,
	});
	await db.transaction(async (tx) => {
		await tx
			.update(measurementScopes)
			.set({ isDefault: false })
			.where(eq(measurementScopes.brandId, defaultScopePromotion.brandId));
		await tx
			.update(measurementScopes)
			.set({ isDefault: true })
			.where(
				and(
					eq(measurementScopes.brandId, defaultScopePromotion.brandId),
					eq(measurementScopes.id, defaultScopePromotion.scopeId),
				),
			);
	});
	const [visibilityDiagnostic] = await db
		.select({
			totalRuns: sql<number>`count(*)::int`,
			brandMentionedRuns: sql<number>`count(*) FILTER (WHERE ${promptRuns.brandMentioned})::int`,
			distinctPrompts: sql<number>`count(DISTINCT ${promptRuns.promptId})::int`,
		})
		.from(promptRuns)
		.where(
			and(
				eq(promptRuns.brandId, brand.id),
				eq(promptRuns.scopeId, scope.id),
				eq(promptRuns.provider, "local-pc-demo"),
				eq(promptRuns.version, "local-pc-doubao-demo-20260814"),
			),
		);
	const defaultScope = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brand.id), eq(measurementScopes.isDefault, true)),
		columns: { id: true, key: true, name: true },
	});

	return {
		status: "applied",
		importId: request.importId,
		brandId: brand.id,
		scopeId: scope.id,
		total: results.length,
		imported: results.filter((result) => result.status === "imported").length,
		duplicates: results.filter((result) => result.status === "duplicate").length,
		inProgress: results.filter((result) => result.status === "in_progress").length,
		defaultScopeSet: true,
		defaultScope,
		visibilityDiagnostic,
		results,
	};
}

main().catch((error) => {
	const code = error instanceof ImportError ? error.code : "unexpected_error";
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`${JSON.stringify({ status: "failed", code, message })}\n`);
	process.exitCode = 1;
});
