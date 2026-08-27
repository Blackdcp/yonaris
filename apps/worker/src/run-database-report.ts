import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { db } from "@workspace/lib/db/db";
import { brands, competitors, measurementScopes, prompts, reports } from "@workspace/lib/db/schema";
import { parseGeneratedReportOutput } from "@workspace/lib/report-output";
import { and, asc, eq, sql } from "drizzle-orm";
import {
	assertExistingReportMatches,
	assessDatabaseReportCompletion,
	buildDatabaseReportSummary,
	DATABASE_REPORT_EXPECTED_RUNS,
	DATABASE_REPORT_OUTPUT_LANGUAGE,
	DATABASE_REPORT_TARGET,
	type DatabaseReportRequest,
	DatabaseReportRequestError,
	type DatabaseReportSummaryState,
	parseDatabaseReportCliOptions,
	parseDatabaseReportRequest,
	selectDeterministicPrompt,
	selectExactlyOne,
} from "./database-report-request";
import { processFreshlyInsertedReport } from "./report-execution";
import { reportExecutionStore } from "./report-execution-store";

const REQUEST_DIRECTORY = resolve(__dirname, "report-requests");
const MAX_REQUEST_BYTES = 16 * 1024;

type ReportRow = typeof reports.$inferSelect;

type SafeReportState = DatabaseReportSummaryState;

class UnhealthyReportStateError extends DatabaseReportRequestError {
	constructor(
		readonly request: DatabaseReportRequest,
		readonly state: SafeReportState,
	) {
		super(
			"report_state_unhealthy",
			"The fixed report is not a valid one-run completion; replay is refused without rerunning",
		);
	}
}

function iso(value: Date | null): string | null {
	return value?.toISOString() ?? null;
}

function inspectReport(report: ReportRow): { healthy: boolean; state: SafeReportState } {
	const assessment = assessDatabaseReportCompletion(report);
	return {
		healthy: assessment.healthy,
		state: {
			brandName: report.brandName,
			outputLanguage: report.outputLanguage,
			promptCount: assessment.promptCount,
			competitorCount: assessment.competitorCount,
			status: report.status,
			actualRuns: assessment.actualRuns,
			createdAt: iso(report.createdAt),
			completedAt: iso(report.completedAt),
			updatedAt: iso(report.updatedAt),
		},
	};
}

async function readRequestFile(requestFile: string): Promise<DatabaseReportRequest> {
	let requestRoot: string;
	let requestedPath: string;
	try {
		requestRoot = await realpath(REQUEST_DIRECTORY);
		requestedPath = await realpath(resolve(process.cwd(), requestFile));
	} catch {
		throw new DatabaseReportRequestError("request_file_unreadable", "The request manifest could not be read");
	}
	const pathWithinRoot = relative(requestRoot, requestedPath);
	if (
		pathWithinRoot === "" ||
		pathWithinRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
		pathWithinRoot === ".." ||
		isAbsolute(pathWithinRoot) ||
		extname(requestedPath).toLowerCase() !== ".json"
	) {
		throw new DatabaseReportRequestError(
			"request_file_outside_allowlist",
			"The request manifest must be a checked-in JSON file under src/report-requests",
		);
	}
	const metadata = await stat(requestedPath);
	if (!metadata.isFile() || metadata.size > MAX_REQUEST_BYTES) {
		throw new DatabaseReportRequestError("request_file_invalid", "The request manifest is not an allowed file");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(requestedPath, "utf8"));
	} catch {
		throw new DatabaseReportRequestError("request_file_invalid", "The request manifest is not valid JSON");
	}
	return parseDatabaseReportRequest(parsed);
}

async function findReport(reportId: string): Promise<ReportRow | null> {
	const rows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
	return rows[0] ?? null;
}

async function resolveBrand(request: DatabaseReportRequest) {
	const where =
		"idExact" in request.brand
			? eq(brands.id, request.brand.idExact)
			: sql`lower(${brands.name}) = ${request.brand.nameExact.toLowerCase()}`;
	const rows = await db
		.select({ id: brands.id, name: brands.name, website: brands.website })
		.from(brands)
		.where(and(where, eq(brands.enabled, true)))
		.limit(2);
	return selectExactlyOne(rows, "brand_not_found", "brand_ambiguous", "brand");
}

function normalizeWebsite(website: string): void {
	try {
		const url = new URL(website.startsWith("http") ? website : `https://${website}`);
		if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) throw new Error("invalid");
	} catch {
		throw new DatabaseReportRequestError("invalid_brand_website", "The selected brand has an invalid website");
	}
}

function toCanonicalDomain(domains: string[]): string | null {
	for (const candidate of domains) {
		const value = candidate.trim();
		if (!value) continue;
		try {
			const url = new URL(value.startsWith("http") ? value : `https://${value}`);
			if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname) return value;
		} catch {
			// Try the next stored domain; invalid competitors are excluded before any paid call.
		}
	}
	return null;
}

async function resolveExecutionSnapshot(request: DatabaseReportRequest) {
	const brand = await resolveBrand(request);
	normalizeWebsite(brand.website);

	const scopeRows = await db
		.select({
			id: measurementScopes.id,
			key: measurementScopes.key,
			name: measurementScopes.name,
			market: measurementScopes.market,
			locale: measurementScopes.locale,
		})
		.from(measurementScopes)
		.where(
			and(
				eq(measurementScopes.brandId, brand.id),
				eq(measurementScopes.key, request.scope.keyExact),
				eq(measurementScopes.enabled, true),
			),
		)
		.limit(2);
	const scope = selectExactlyOne(scopeRows, "scope_not_found", "scope_ambiguous", "enabled scope");

	const promptRows = await db
		.select({
			id: prompts.id,
			value: prompts.value,
			tags: prompts.tags,
			systemTags: prompts.systemTags,
			createdAt: prompts.createdAt,
		})
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)))
		.orderBy(asc(prompts.createdAt), asc(prompts.id));
	const prompt = selectDeterministicPrompt(promptRows, brand.name, brand.website);

	const competitorRows = await db
		.select({
			id: competitors.id,
			name: competitors.name,
			domains: competitors.domains,
			createdAt: competitors.createdAt,
		})
		.from(competitors)
		.where(eq(competitors.brandId, brand.id))
		.orderBy(asc(competitors.createdAt), asc(competitors.id));
	const seenNames = new Set<string>();
	const competitorSnapshot: Array<{ name: string; domain: string }> = [];
	for (const competitor of competitorRows) {
		const name = competitor.name.trim();
		const nameKey = name.toLowerCase();
		const domain = toCanonicalDomain(competitor.domains);
		if (!name || !domain || nameKey === brand.name.toLowerCase().trim() || seenNames.has(nameKey)) continue;
		seenNames.add(nameKey);
		competitorSnapshot.push({ name, domain });
	}
	if (competitorSnapshot.length === 0) {
		throw new DatabaseReportRequestError(
			"competitor_snapshot_empty",
			"The selected brand has no valid database competitor snapshot; no paid call was made",
		);
	}

	return { brand, scope, prompt, competitorSnapshot };
}

function dryRunState(snapshot: Awaited<ReturnType<typeof resolveExecutionSnapshot>>): SafeReportState {
	return {
		brandName: snapshot.brand.name,
		outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
		promptCount: 1,
		competitorCount: snapshot.competitorSnapshot.length,
		status: "pending",
		actualRuns: null,
		createdAt: null,
		completedAt: null,
		updatedAt: null,
	};
}

async function withSuppressedConsole<T>(operation: () => Promise<T>): Promise<T> {
	const original = { log: console.log, warn: console.warn, error: console.error };
	console.log = () => undefined;
	console.warn = () => undefined;
	console.error = () => undefined;
	try {
		return await operation();
	} finally {
		console.log = original.log;
		console.warn = original.warn;
		console.error = original.error;
	}
}

async function preflightProvider(): Promise<void> {
	process.env.SCRAPE_TARGETS = DATABASE_REPORT_TARGET;
	process.env.RUNS_PER_PROMPT = "1";
	await withSuppressedConsole(async () => {
		const [{ startCredentialRefresh }, { getProvider, parseScrapeTargets, validateScrapeTargets }] = await Promise.all([
			import("@workspace/lib/secrets"),
			import("@workspace/lib/providers"),
		]);
		await startCredentialRefresh();
		const targets = parseScrapeTargets(process.env.SCRAPE_TARGETS);
		if (targets.length !== 1) {
			throw new DatabaseReportRequestError("target_preflight_failed", "The fixed scrape target did not resolve once");
		}
		validateScrapeTargets(targets, getProvider);
	});
}

async function runReport(
	request: DatabaseReportRequest,
	snapshot: Awaited<ReturnType<typeof resolveExecutionSnapshot>>,
): Promise<ReportRow> {
	await preflightProvider();

	const inserted = await db
		.insert(reports)
		.values({
			id: request.reportId,
			brandName: snapshot.brand.name,
			brandWebsite: snapshot.brand.website,
			outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
			status: "pending",
		})
		.onConflictDoNothing({ target: reports.id })
		.returning({
			reportId: reports.id,
			outputLanguage: reports.outputLanguage,
			status: reports.status,
			updatedAt: reports.updatedAt,
		});
	if (inserted.length !== 1) {
		const existing = await findReport(request.reportId);
		if (!existing) {
			throw new DatabaseReportRequestError("report_insert_conflict", "The report could not be created atomically");
		}
		assertExistingReportMatches(existing, {
			brandName: snapshot.brand.name,
			brandWebsite: snapshot.brand.website,
			outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
		});
		return existing;
	}

	try {
		await withSuppressedConsole(async () => {
			const { processReportJob } = await import("./report-worker.js");
			await processFreshlyInsertedReport({
				insertedRows: inserted,
				expectedReportId: request.reportId,
				expectedOutputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
				stateStore: reportExecutionStore,
				now: () => new Date(),
				process: async (claim) =>
					processReportJob({
						data: {
							reportId: request.reportId,
							brandName: snapshot.brand.name,
							brandWebsite: snapshot.brand.website,
							outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
							manualPrompts: [snapshot.prompt.value],
							competitorSnapshot: snapshot.competitorSnapshot,
							runsPerTargetOverride: 1,
							expectedRunCount: DATABASE_REPORT_EXPECTED_RUNS,
						},
						claim,
						stateStore: reportExecutionStore,
						log: () => undefined,
					}),
			});
		});
	} catch {
		throw new DatabaseReportRequestError(
			"report_execution_failed",
			"The controlled report execution failed; no automatic retry was attempted",
		);
	}

	const completed = await findReport(request.reportId);
	if (completed?.status !== "completed" || completed.rawOutput === null) {
		throw new DatabaseReportRequestError(
			"report_completion_unverified",
			"The controlled report did not reach a verifiable completed state",
		);
	}
	const output = parseGeneratedReportOutput(completed.rawOutput);
	const actualRuns = output.promptRuns.reduce((total, promptRun) => total + promptRun.runs.length, 0);
	if (actualRuns !== DATABASE_REPORT_EXPECTED_RUNS) {
		throw new DatabaseReportRequestError(
			"run_count_mismatch",
			"The completed report did not match the fixed execution budget",
		);
	}
	return completed;
}

async function main(): Promise<void> {
	const options = parseDatabaseReportCliOptions(process.argv.slice(2));
	const request = await readRequestFile(options.requestFile);

	if (options.mode === "status-only") {
		const report = await findReport(request.reportId);
		if (!report) {
			throw new DatabaseReportRequestError(
				"report_not_found",
				"The fixed report ID is absent; status-only mode will not recreate it",
			);
		}
		const inspection = inspectReport(report);
		if (!inspection.healthy) throw new UnhealthyReportStateError(request, inspection.state);
		process.stdout.write(`${JSON.stringify(buildDatabaseReportSummary(request, inspection.state))}\n`);
		return;
	}

	const snapshot = await resolveExecutionSnapshot(request);
	const existing = await findReport(request.reportId);
	if (existing) {
		assertExistingReportMatches(existing, {
			brandName: snapshot.brand.name,
			brandWebsite: snapshot.brand.website,
			outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
		});
		const inspection = inspectReport(existing);
		if (!inspection.healthy) throw new UnhealthyReportStateError(request, inspection.state);
		process.stdout.write(`${JSON.stringify(buildDatabaseReportSummary(request, inspection.state))}\n`);
		return;
	}

	if (options.mode === "dry-run") {
		process.stdout.write(`${JSON.stringify(buildDatabaseReportSummary(request, dryRunState(snapshot)))}\n`);
		return;
	}

	const report = await runReport(request, snapshot);
	const inspection = inspectReport(report);
	if (!inspection.healthy) throw new UnhealthyReportStateError(request, inspection.state);
	process.stdout.write(`${JSON.stringify(buildDatabaseReportSummary(request, inspection.state))}\n`);
}

main().catch((error: unknown) => {
	const known = error instanceof DatabaseReportRequestError;
	const unhealthySummary =
		error instanceof UnhealthyReportStateError
			? { ...buildDatabaseReportSummary(error.request, error.state), ok: false }
			: null;
	process.stderr.write(
		`${JSON.stringify({
			...(unhealthySummary ?? { ok: false }),
			code: known ? error.code : "database_report_operation_failed",
			message: known ? error.message : "The database report operation failed",
		})}\n`,
	);
	process.exitCode = 1;
});
