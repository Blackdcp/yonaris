import { statfs as nodeStatfs } from "node:fs/promises";
import { isAbsolute } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;

type StatfsResult = {
	blocks: number | bigint;
	bavail: number | bigint;
	bsize: number | bigint;
};

export class ResponseSnapshotCapacityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ResponseSnapshotCapacityError";
	}
}

export function evaluateResponseSnapshotCapacity(input: {
	blocks: number | bigint;
	availableBlocks: number | bigint;
}): { state: "normal" | "warn" | "stop"; usedPercent: number } {
	const blocks = Number(input.blocks);
	const available = Number(input.availableBlocks);
	if (!Number.isFinite(blocks) || !Number.isFinite(available) || blocks <= 0 || available < 0 || available > blocks) {
		throw new ResponseSnapshotCapacityError("Response snapshot storage capacity is invalid");
	}
	const usedPercent = ((blocks - available) / blocks) * 100;
	return { state: usedPercent >= 80 ? "stop" : usedPercent >= 70 ? "warn" : "normal", usedPercent };
}

export async function assertResponseSnapshotCapacity(
	input: { enabled: boolean; storageRoot: string | undefined },
	dependencies: { statfs?: (path: string) => Promise<StatfsResult> } = {},
): Promise<{ state: "normal" | "warn"; usedPercent: number } | null> {
	if (!input.enabled) return null;
	if (!input.storageRoot || !isAbsolute(input.storageRoot)) {
		throw new ResponseSnapshotCapacityError("Response snapshot storage root must be an absolute path");
	}
	let stats: StatfsResult;
	try {
		stats = await (dependencies.statfs ?? nodeStatfs)(input.storageRoot);
	} catch {
		throw new ResponseSnapshotCapacityError("Response snapshot storage capacity is unavailable");
	}
	const capacity = evaluateResponseSnapshotCapacity({ blocks: stats.blocks, availableBlocks: stats.bavail });
	const blockSize = Number(stats.bsize);
	if (!Number.isFinite(blockSize) || blockSize <= 0) {
		throw new ResponseSnapshotCapacityError("Response snapshot storage capacity is invalid");
	}
	if (capacity.state === "stop") {
		throw new ResponseSnapshotCapacityError("Response snapshot storage has reached the fixed 80% capacity limit");
	}
	return { state: capacity.state, usedPercent: capacity.usedPercent };
}

export function readResponseSnapshotRuntimeConfig(env: Record<string, string | undefined>) {
	const enabledValue = env.RESPONSE_SNAPSHOT_ENABLED ?? "false";
	if (enabledValue !== "true" && enabledValue !== "false") {
		throw new Error("RESPONSE_SNAPSHOT_ENABLED must be true or false");
	}
	assertFixedValue(env.RESPONSE_SNAPSHOT_RETENTION_DAYS, "90", "RESPONSE_SNAPSHOT_RETENTION_DAYS");
	assertFixedValue(env.RESPONSE_SNAPSHOT_WARN_USED_PERCENT, "70", "RESPONSE_SNAPSHOT_WARN_USED_PERCENT");
	assertFixedValue(env.RESPONSE_SNAPSHOT_STOP_USED_PERCENT, "80", "RESPONSE_SNAPSHOT_STOP_USED_PERCENT");
	assertFixedValue(env.RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS, "24", "RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS");
	return {
		enabled: enabledValue === "true",
		retentionDays: 90,
		warnUsedPercent: 70,
		stopUsedPercent: 80,
		outboxTtlHours: 24,
	};
}

export function isResponseSnapshotOutboxPastTtl(createdAt: Date, now: Date): boolean {
	assertValidDates(createdAt, now);
	return createdAt.getTime() + 24 * HOUR_MS <= now.getTime();
}

export function isResponseSnapshotExpired(expiresAt: Date, now: Date): boolean {
	assertValidDates(expiresAt, now);
	return expiresAt.getTime() <= now.getTime();
}

export function responseSnapshotMaintenanceCutoffs(now: Date) {
	if (Number.isNaN(now.getTime())) throw new Error("Maintenance time must be valid");
	return {
		flushLimit: 50,
		recoverLimit: 20,
		expireLimit: 500,
		orphanLimit: 100,
		stalePendingBefore: new Date(now.getTime() - 5 * 60 * 1_000),
		expireBefore: new Date(now),
		orphanBefore: new Date(now.getTime() - DAY_MS),
	};
}

function assertFixedValue(value: string | undefined, expected: string, name: string): void {
	if (value !== undefined && value !== expected) {
		throw new Error(`${name} is fixed at ${expected} in response snapshot v1`);
	}
}

function assertValidDates(...values: Date[]): void {
	if (values.some((value) => Number.isNaN(value.getTime()))) throw new Error("Snapshot timestamps must be valid");
}
