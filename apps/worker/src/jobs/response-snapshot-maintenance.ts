import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as Sentry from "@sentry/node";
import { db } from "@workspace/lib/db/db";
import { responseSnapshots } from "@workspace/lib/db/schema";
import { FilesystemResponseSnapshotStorage } from "@workspace/lib/response-snapshots/filesystem-storage";
import { createResponseSnapshotService } from "@workspace/lib/response-snapshots/service";
import { isNotNull, sql } from "drizzle-orm";
import type { Pool, PoolClient } from "pg";
import type { Job } from "pg-boss";
import {
	assertResponseSnapshotCapacity,
	readResponseSnapshotRuntimeConfig,
	responseSnapshotMaintenanceCutoffs,
} from "./response-snapshot-maintenance-policy";

const MAINTENANCE_LOCK_NAME = "yonaris-response-snapshot-maintenance-v1";
const SAFE_BRAND = /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/u;
const SAFE_YEAR = /^\d{4}$/u;
const SAFE_MONTH = /^(0[1-9]|1[0-2])$/u;
const SAFE_RUN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/u;
const SAFE_REVISION = /^r[1-9]\d{0,4}$/u;
const MAX_ORPHAN_SCAN = 50_000;

export interface ResponseSnapshotMaintenanceData {
	source?: string;
}

type MaintenanceLock = { acquired: boolean; release: () => Promise<void> };
type Capacity = { state: "normal" | "warn"; usedPercent: number } | null;
type SnapshotService = Pick<
	ReturnType<typeof createResponseSnapshotService>,
	"flushPending" | "recoverStalePending" | "expire"
>;
type OrphanCleanupReceipt = { scanned: number; deleted: number; failed: number };
type TelemetryRow = { brandId: string; channel: string; month: string; count: number; bytes: number };
type SnapshotTelemetry = {
	ready: TelemetryRow[];
	pending: { count: number; oldestAgeSeconds: number | null };
	failed: Array<{ failureCode: string; count: number }>;
	expired: { count: number; bytes: number };
};

type MaintenanceDependencies = {
	env?: Record<string, string | undefined>;
	now?: () => Date;
	acquireLock?: () => Promise<MaintenanceLock>;
	assertCapacity?: (input: { enabled: boolean; storageRoot: string | undefined }) => Promise<Capacity>;
	createService?: (storageRoot: string, now: () => Date) => SnapshotService;
	cleanupOrphans?: (input: { storageRoot: string; before: Date; limit: number }) => Promise<OrphanCleanupReceipt>;
	readTelemetry?: () => Promise<SnapshotTelemetry>;
};

export type ResponseSnapshotMaintenanceReceipt =
	| { status: "disabled" }
	| { status: "already_running" }
	| {
			status: "completed";
			capacity: Capacity;
			flush: Awaited<ReturnType<SnapshotService["flushPending"]>>;
			recovery: Awaited<ReturnType<SnapshotService["recoverStalePending"]>>;
			expiry: Awaited<ReturnType<SnapshotService["expire"]>>;
			orphans: OrphanCleanupReceipt;
			telemetry: SnapshotTelemetry;
	  };

export async function responseSnapshotMaintenanceJob(jobs: Job<ResponseSnapshotMaintenanceData>[]): Promise<void> {
	for (const job of jobs) {
		await runResponseSnapshotMaintenance(job.data);
	}
}

export async function runResponseSnapshotMaintenance(
	data: ResponseSnapshotMaintenanceData = {},
	dependencies: MaintenanceDependencies = {},
): Promise<ResponseSnapshotMaintenanceReceipt> {
	const env = dependencies.env ?? process.env;
	const config = readResponseSnapshotRuntimeConfig(env);
	if (!config.enabled) return { status: "disabled" };

	const storageRoot = env.RESPONSE_SNAPSHOT_ROOT;
	const acquireLock = dependencies.acquireLock ?? acquireMaintenanceLock;
	const lock = await acquireLock();
	if (!lock.acquired) return { status: "already_running" };

	const now = dependencies.now ?? (() => new Date());
	try {
		const capacity = await (dependencies.assertCapacity ?? assertResponseSnapshotCapacity)({
			enabled: true,
			storageRoot,
		});
		if (!storageRoot) throw new Error("RESPONSE_SNAPSHOT_ROOT is required while snapshot capture is enabled");
		if (capacity?.state === "warn") {
			console.warn(
				`[response-snapshots] capacity warning (${capacity.usedPercent.toFixed(1)}% used; new capture stops at 80%)`,
			);
			Sentry.captureMessage("Response snapshot storage capacity warning", "warning");
		}

		const service = (dependencies.createService ?? createFilesystemService)(storageRoot, now);
		const cutoffs = responseSnapshotMaintenanceCutoffs(now());
		const flush = await service.flushPending({ limit: cutoffs.flushLimit });
		const recovery = await service.recoverStalePending({
			before: cutoffs.stalePendingBefore,
			limit: cutoffs.recoverLimit,
		});
		const expiry = await service.expire({ before: cutoffs.expireBefore, limit: cutoffs.expireLimit });
		const orphans = await (dependencies.cleanupOrphans ?? cleanupFilesystemOrphans)({
			storageRoot,
			before: cutoffs.orphanBefore,
			limit: cutoffs.orphanLimit,
		});
		const telemetry = await (dependencies.readTelemetry ?? readResponseSnapshotTelemetry)();
		const receipt = { status: "completed" as const, capacity, flush, recovery, expiry, orphans, telemetry };
		const maintenanceFailures = flush.retryLater + recovery.failed + expiry.deleteRetry + orphans.failed;
		if (maintenanceFailures > 0) {
			Sentry.withScope((scope) => {
				scope.setTag("maintenance", "response-snapshots");
				scope.setContext("counts", {
					flushRetryLater: flush.retryLater,
					recoveryFailed: recovery.failed,
					expiryDeleteRetry: expiry.deleteRetry,
					orphanCleanupFailed: orphans.failed,
				});
				Sentry.captureMessage("Response snapshot maintenance requires retry", "warning");
			});
		}
		console.log("[response-snapshots] maintenance", JSON.stringify({ source: safeSource(data.source), ...receipt }));
		return receipt;
	} finally {
		await lock.release();
	}
}

async function acquireMaintenanceLock(): Promise<MaintenanceLock> {
	const pool = db.$client as Pool;
	const client = await pool.connect();
	let acquired = false;
	try {
		const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [
			MAINTENANCE_LOCK_NAME,
		]);
		acquired = result.rows[0]?.acquired === true;
		if (!acquired) client.release();
		return acquired ? lockHandle(client) : { acquired: false, release: async () => undefined };
	} catch (error) {
		client.release();
		throw error;
	}
}

function lockHandle(client: PoolClient): MaintenanceLock {
	let released = false;
	return {
		acquired: true,
		async release() {
			if (released) return;
			released = true;
			try {
				await client.query("SELECT pg_advisory_unlock(hashtext($1))", [MAINTENANCE_LOCK_NAME]);
			} finally {
				client.release();
			}
		},
	};
}

function createFilesystemService(storageRoot: string, now: () => Date): SnapshotService {
	return createResponseSnapshotService({ storage: new FilesystemResponseSnapshotStorage(storageRoot), now });
}

export async function cleanupFilesystemOrphans(input: {
	storageRoot: string;
	before: Date;
	limit: number;
}): Promise<OrphanCleanupReceipt> {
	const referencedRows = await db
		.select({ storageKey: responseSnapshots.storageKey })
		.from(responseSnapshots)
		.where(isNotNull(responseSnapshots.storageKey));
	const referenced = new Set(referencedRows.flatMap(({ storageKey }) => (storageKey ? [storageKey] : [])));
	const storage = new FilesystemResponseSnapshotStorage(input.storageRoot);
	const receipt: OrphanCleanupReceipt = { scanned: 0, deleted: 0, failed: 0 };

	for await (const candidate of walkSnapshotRevisionKeys(input.storageRoot)) {
		if (receipt.scanned >= MAX_ORPHAN_SCAN || receipt.deleted >= input.limit) break;
		receipt.scanned += 1;
		if (referenced.has(candidate.key)) continue;
		try {
			const manifestStat = await lstat(join(candidate.directory, "manifest.json"));
			if (manifestStat.isSymbolicLink() || !manifestStat.isFile() || manifestStat.mtime > input.before) continue;
			const stored = await storage.head(candidate.key);
			if (!stored) continue;
			await storage.delete(candidate.key);
			receipt.deleted += 1;
		} catch {
			receipt.failed += 1;
		}
	}
	return receipt;
}

async function* walkSnapshotRevisionKeys(root: string): AsyncGenerator<{ key: string; directory: string }, void, void> {
	for await (const [brand, brandPath] of safeChildDirectories(root, SAFE_BRAND)) {
		for await (const [year, yearPath] of safeChildDirectories(brandPath, SAFE_YEAR)) {
			for await (const [month, monthPath] of safeChildDirectories(yearPath, SAFE_MONTH)) {
				for await (const [run, runPath] of safeChildDirectories(monthPath, SAFE_RUN)) {
					for await (const [revision, revisionPath] of safeChildDirectories(runPath, SAFE_REVISION)) {
						yield { key: `${brand}/${year}/${month}/${run}/${revision}`, directory: revisionPath };
					}
				}
			}
		}
	}
}

async function* safeChildDirectories(parent: string, pattern: RegExp): AsyncGenerator<[string, string], void, void> {
	for (const entry of await readdir(parent, { withFileTypes: true })) {
		if (!pattern.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) continue;
		yield [entry.name, join(parent, entry.name)];
	}
}

async function readResponseSnapshotTelemetry(): Promise<SnapshotTelemetry> {
	const [readyResult, pendingResult, failedResult, expiredResult] = await Promise.all([
		db.execute(sql`
		SELECT
			rs.brand_id AS "brandId",
			pr.model AS channel,
			to_char(date_trunc('month', rs.observed_at AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM') AS month,
			count(*)::int AS count,
			coalesce(sum(rs.html_gzip_bytes + rs.json_gzip_bytes + rs.manifest_bytes), 0)::bigint AS bytes
		FROM response_snapshots rs
		JOIN prompt_runs pr ON pr.id = rs.prompt_run_id
		WHERE rs.is_current = true AND rs.status = 'ready'
		GROUP BY rs.brand_id, pr.model, date_trunc('month', rs.observed_at AT TIME ZONE 'Asia/Shanghai')
		ORDER BY rs.brand_id, pr.model, month
	`),
		db.execute(sql`
			SELECT
				count(*)::int AS count,
				CASE WHEN min(created_at) IS NULL THEN NULL
					ELSE floor(extract(epoch FROM (statement_timestamp() - min(created_at))))::bigint
				END AS "oldestAgeSeconds"
			FROM response_snapshots
			WHERE is_current = true AND status = 'pending'
		`),
		db.execute(sql`
			SELECT failure_code AS "failureCode", count(*)::int AS count
			FROM response_snapshots
			WHERE is_current = true AND status = 'failed'
			GROUP BY failure_code
			ORDER BY failure_code
		`),
		db.execute(sql`
			SELECT
				count(*)::int AS count,
				coalesce(sum(html_gzip_bytes + json_gzip_bytes + manifest_bytes), 0)::bigint AS bytes
			FROM response_snapshots
			WHERE status = 'expired'
		`),
	]);
	const pending = (pendingResult.rows[0] ?? {}) as Record<string, unknown>;
	const expired = (expiredResult.rows[0] ?? {}) as Record<string, unknown>;
	return {
		ready: (readyResult.rows as Array<Record<string, unknown>>).map((row) => ({
			brandId: String(row.brandId),
			channel: String(row.channel),
			month: String(row.month),
			count: Number(row.count),
			bytes: Number(row.bytes),
		})),
		pending: {
			count: Number(pending.count ?? 0),
			oldestAgeSeconds: pending.oldestAgeSeconds === null ? null : Number(pending.oldestAgeSeconds ?? 0),
		},
		failed: (failedResult.rows as Array<Record<string, unknown>>).map((row) => ({
			failureCode: String(row.failureCode ?? "unknown"),
			count: Number(row.count),
		})),
		expired: { count: Number(expired.count ?? 0), bytes: Number(expired.bytes ?? 0) },
	};
}

function safeSource(value: string | undefined): string {
	return value && /^[a-z0-9_-]{1,40}$/u.test(value) ? value : "unknown";
}
