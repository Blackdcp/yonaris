import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/lib/db/db";
import {
	RESPONSE_SNAPSHOT_RETENTION_MS,
	reserveResponseSnapshotInTransaction,
} from "@workspace/lib/db/response-snapshots";
import {
	citations,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
	responseSnapshots,
} from "@workspace/lib/db/schema";
import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { createResponseSnapshotService } from "@workspace/lib/response-snapshots/service";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import type { Pool, PoolClient } from "pg";
import {
	buildResponseSnapshotBackfillPlan,
	type PlannedResponseSnapshotBackfillRun,
	parseResponseSnapshotBackfillCli,
	parseResponseSnapshotBackfillRequest,
	ResponseSnapshotBackfillPolicyError,
	type ResponseSnapshotBackfillRequest,
} from "./backfill-response-snapshots-policy";
import { assertResponseSnapshotCapacity } from "./jobs/response-snapshot-maintenance-policy";

const CHUNK_SIZE = 100;

class ResponseSnapshotBackfillError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ResponseSnapshotBackfillError";
	}
}

async function main(): Promise<void> {
	const options = parseResponseSnapshotBackfillCli(process.argv.slice(2));
	const request = parseResponseSnapshotBackfillRequest(
		JSON.parse((await readFile(path.resolve(options.requestFile), "utf8")).replace(/^\uFEFF/u, "")),
	);
	if (request.sourceCommitSha !== options.sourceSha) {
		throw new ResponseSnapshotBackfillError("source_sha_mismatch", "Request source SHA does not match this release");
	}
	const receipt = options.apply
		? await withBrandLock(request.brandId, () => executeBackfill(request, true))
		: await executeBackfill(request, false);
	process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function executeBackfill(request: ResponseSnapshotBackfillRequest, apply: boolean) {
	const { runRows, citationRows } = await readExactCohort(request);
	const plan = buildResponseSnapshotBackfillPlan(request, runRows, citationRows);
	const currentRows = await readCurrentSnapshots(request.runIds);
	assertCurrentSnapshotIdentities(plan.runs, currentRows);
	const statusCounts = countCurrentStatuses(currentRows);
	if (!apply) {
		return {
			ok: true,
			status: "dry_run",
			requestId: request.requestId,
			brandId: request.brandId,
			total: plan.expectedRunCount,
			runFingerprint: plan.runFingerprint,
			existing: currentRows.length,
			wouldCreate: plan.expectedRunCount - currentRows.length,
			currentStatuses: statusCounts,
		};
	}

	if (process.env.RESPONSE_SNAPSHOT_ENABLED !== "true") {
		throw new ResponseSnapshotBackfillError("snapshot_capture_disabled", "Response snapshot capture is disabled");
	}
	const storageRoot = process.env.RESPONSE_SNAPSHOT_ROOT;
	await assertResponseSnapshotCapacity({ enabled: true, storageRoot });
	if (!storageRoot)
		throw new ResponseSnapshotBackfillError("storage_root_missing", "Response snapshot storage root is missing");
	const storage = new FilesystemResponseSnapshotStorage(storageRoot);
	const service = createResponseSnapshotService({ storage });
	const byRunId = new Map(currentRows.map((row) => [row.promptRunId, row]));
	const receipt = { created: 0, alreadyReady: 0, pending: 0, failed: 0 };

	for (let offset = 0; offset < plan.runs.length; offset += CHUNK_SIZE) {
		const chunk = plan.runs.slice(offset, offset + CHUNK_SIZE);
		for (const run of chunk) {
			const existing = byRunId.get(run.runId);
			if (existing?.status === "ready") {
				receipt.alreadyReady += 1;
				continue;
			}
			if (existing?.status === "pending") {
				receipt.pending += 1;
				continue;
			}
			if (run.observedAt.getTime() + RESPONSE_SNAPSHOT_RETENTION_MS <= Date.now()) {
				throw new ResponseSnapshotBackfillError(
					"run_outside_retention",
					"Backfill run is outside the fixed retention window",
				);
			}
			const reservation = await db.transaction((tx) =>
				reserveResponseSnapshotInTransaction(tx, {
					promptRunId: run.runId,
					brandId: run.brandId,
					scopeId: run.scopeId,
					promptId: run.promptId,
					observedAt: run.observedAt,
				}),
			);
			const result = await service.record({ reservation, draft: buildDraft(run) });
			if (result.status === "ready" || result.status === "already_ready") receipt.created += 1;
			else if (result.queued) receipt.pending += 1;
			else receipt.failed += 1;
		}
	}
	if (receipt.failed > 0) {
		throw new ResponseSnapshotBackfillError(
			"snapshot_backfill_failed",
			"One or more snapshot bundles failed validation",
		);
	}
	return {
		ok: true,
		status: "applied",
		requestId: request.requestId,
		brandId: request.brandId,
		total: plan.expectedRunCount,
		runFingerprint: plan.runFingerprint,
		...receipt,
	};
}

async function readExactCohort(request: ResponseSnapshotBackfillRequest) {
	const runRows = await db
		.select({
			runId: promptRuns.id,
			brandId: promptRuns.brandId,
			promptId: promptRuns.promptId,
			scopeId: promptRuns.scopeId,
			promptBrandId: prompts.brandId,
			promptScopeId: prompts.scopeId,
			promptText: prompts.value,
			answerText: promptRuns.answerText,
			model: promptRuns.model,
			provider: promptRuns.provider,
			version: promptRuns.version,
			surfaceTargetKey: promptRuns.surfaceTargetKey,
			captureRouteKey: promptRuns.captureRouteKey,
			webSearchEnabled: promptRuns.webSearchEnabled,
			webQueries: promptRuns.webQueries,
			brandMentioned: promptRuns.brandMentioned,
			competitorsMentioned: promptRuns.competitorsMentioned,
			observedAt: promptRuns.observedAt,
			attemptStatus: observationAttempts.status,
			scopeMarket: measurementScopes.market,
			scopeLocale: measurementScopes.locale,
			scopeTimezone: measurementScopes.timezone,
		})
		.from(promptRuns)
		.innerJoin(prompts, eq(prompts.id, promptRuns.promptId))
		.leftJoin(observationAttempts, eq(observationAttempts.id, promptRuns.observationAttemptId))
		.leftJoin(measurementScopes, eq(measurementScopes.id, promptRuns.scopeId))
		.where(inArray(promptRuns.id, request.runIds))
		.orderBy(asc(promptRuns.id));

	const exactFilterRows = await db
		.select({ runId: promptRuns.id })
		.from(promptRuns)
		.where(
			and(
				eq(promptRuns.brandId, request.brandId),
				inArray(promptRuns.model, request.channelsExact),
				gte(promptRuns.observedAt, new Date(request.fromObservedAt)),
				lt(promptRuns.observedAt, new Date(request.toObservedAtExclusive)),
			),
		)
		.orderBy(asc(promptRuns.id));
	if (
		exactFilterRows.length !== request.runIds.length ||
		exactFilterRows.some((row, index) => row.runId !== request.runIds[index])
	) {
		throw new ResponseSnapshotBackfillError(
			"cohort_filter_mismatch",
			"Reviewed runIds are not the exact filtered cohort",
		);
	}

	const citationRows = await db
		.select({
			promptRunId: citations.promptRunId,
			promptId: citations.promptId,
			brandId: citations.brandId,
			model: citations.model,
			citationIndex: citations.citationIndex,
			url: citations.url,
			title: citations.title,
			domain: citations.domain,
		})
		.from(citations)
		.where(inArray(citations.promptRunId, request.runIds))
		.orderBy(asc(citations.promptRunId), asc(citations.citationIndex), asc(citations.id));
	return { runRows, citationRows };
}

async function readCurrentSnapshots(runIds: string[]) {
	return db
		.select({
			id: responseSnapshots.id,
			promptRunId: responseSnapshots.promptRunId,
			brandId: responseSnapshots.brandId,
			promptId: responseSnapshots.promptId,
			scopeId: responseSnapshots.scopeId,
			status: responseSnapshots.status,
		})
		.from(responseSnapshots)
		.where(and(inArray(responseSnapshots.promptRunId, runIds), eq(responseSnapshots.isCurrent, true)))
		.orderBy(asc(responseSnapshots.promptRunId));
}

function assertCurrentSnapshotIdentities(
	runs: PlannedResponseSnapshotBackfillRun[],
	snapshots: Awaited<ReturnType<typeof readCurrentSnapshots>>,
): void {
	const runById = new Map(runs.map((run) => [run.runId, run]));
	for (const snapshot of snapshots) {
		const run = runById.get(snapshot.promptRunId);
		if (
			!run ||
			snapshot.brandId !== run.brandId ||
			snapshot.promptId !== run.promptId ||
			snapshot.scopeId !== run.scopeId
		) {
			throw new ResponseSnapshotBackfillError("current_snapshot_conflict", "Current snapshot identity is inconsistent");
		}
	}
}

function countCurrentStatuses(rows: Awaited<ReturnType<typeof readCurrentSnapshots>>) {
	const counts = { pending: 0, ready: 0, failed: 0, expired: 0 };
	for (const row of rows) counts[row.status] += 1;
	return counts;
}

function buildDraft(run: PlannedResponseSnapshotBackfillRun): ResponseSnapshotDraft {
	return {
		runId: run.runId,
		brandId: run.brandId,
		scopeId: run.scopeId,
		promptId: run.promptId,
		promptText: run.promptText,
		answerText: run.answerText,
		citations: run.citations.map((citation) => ({
			url: citation.url ?? "",
			title: citation.title ?? null,
			domain: citation.domain ?? "",
			citationIndex: citation.citationIndex,
		})),
		webQueries: run.webQueries,
		queryAvailability:
			run.webQueries.length > 0 ? "available" : run.webSearchEnabled ? "unavailable" : "not_applicable",
		brandMentioned: run.brandMentioned,
		competitorsMentioned: run.competitorsMentioned,
		channel: run.model,
		modelVersion: run.version,
		market: run.scopeMarket ?? "ZZ",
		locale: run.scopeLocale ?? "und",
		timezone: run.scopeTimezone ?? "UTC",
		observedAt: run.observedAt.toISOString(),
		captureMethod: run.captureMethod,
		contentSource: run.contentSource,
		sourcePayloadSha256: run.sourcePayloadSha256,
	};
}

async function withBrandLock<T>(brandId: string, operation: () => Promise<T>): Promise<T> {
	const pool = db.$client as Pool;
	const client = await pool.connect();
	const lockName = `response-snapshot-backfill:${brandId}`;
	try {
		await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
		return await operation();
	} finally {
		await releaseLock(client, lockName);
	}
}

async function releaseLock(client: PoolClient, lockName: string): Promise<void> {
	try {
		await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
	} finally {
		client.release();
	}
}

main().catch((error: unknown) => {
	const known = error instanceof ResponseSnapshotBackfillPolicyError || error instanceof ResponseSnapshotBackfillError;
	process.stderr.write(
		`${JSON.stringify({
			ok: false,
			code: error instanceof ResponseSnapshotBackfillError ? error.code : known ? "request_invalid" : "backfill_failed",
			message: known ? error.message : "Response snapshot backfill failed",
		})}\n`,
	);
	process.exitCode = 1;
});
