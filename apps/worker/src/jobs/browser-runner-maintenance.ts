import {
	type BrowserRunnerDailySettlementReceipt,
	settleDueDomesticBrowserRunnerBatches,
} from "@workspace/lib/db/browser-runner";
import { db } from "@workspace/lib/db/db";
import type { Pool, PoolClient } from "pg";
import type { Job } from "pg-boss";

const MAINTENANCE_LOCK_NAME = "yonaris-browser-runner-daily-settlement-v1";

export interface BrowserRunnerMaintenanceData {
	source?: string;
}

type MaintenanceLock = { acquired: boolean; release: () => Promise<void> };
type MaintenanceDependencies = {
	now?: () => Date;
	acquireLock?: () => Promise<MaintenanceLock>;
	settle?: typeof settleDueDomesticBrowserRunnerBatches;
};

export type BrowserRunnerMaintenanceReceipt =
	| { status: "already_running" }
	| { status: "completed"; settlement: BrowserRunnerDailySettlementReceipt };

export async function browserRunnerMaintenanceJob(jobs: Job<BrowserRunnerMaintenanceData>[]): Promise<void> {
	for (const job of jobs) await runBrowserRunnerMaintenance(job.data);
}

export async function runBrowserRunnerMaintenance(
	data: BrowserRunnerMaintenanceData = {},
	dependencies: MaintenanceDependencies = {},
): Promise<BrowserRunnerMaintenanceReceipt> {
	const lock = await (dependencies.acquireLock ?? acquireMaintenanceLock)();
	if (!lock.acquired) return { status: "already_running" };
	try {
		const now = (dependencies.now ?? (() => new Date()))();
		const settlement = await (dependencies.settle ?? settleDueDomesticBrowserRunnerBatches)({ now });
		const receipt = { status: "completed" as const, settlement };
		console.log("[browser-runner] maintenance", JSON.stringify({ source: safeSource(data.source), ...receipt }));
		return receipt;
	} finally {
		await lock.release();
	}
}

async function acquireMaintenanceLock(): Promise<MaintenanceLock> {
	const pool = db.$client as Pool;
	const client = await pool.connect();
	try {
		const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS acquired", [
			MAINTENANCE_LOCK_NAME,
		]);
		if (result.rows[0]?.acquired !== true) {
			client.release();
			return { acquired: false, release: async () => undefined };
		}
		return lockHandle(client);
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

function safeSource(value: string | undefined): string {
	return value && /^[a-z0-9_-]{1,40}$/u.test(value) ? value : "unknown";
}
