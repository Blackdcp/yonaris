import { createServerFn } from "@tanstack/react-start";
import { Redis } from "@upstash/redis";
import { STATUS_TARGETS } from "@workspace/config/scrape-targets";
import type { StatusEntry, TargetStatus } from "./status-helpers";

export type { StatusEntry, TargetStatus } from "./status-helpers";

interface StatusDataBoundary {
	targets: readonly string[];
	now: () => number;
	read: (key: string, minimumScore: number) => Promise<unknown[]>;
}

function parseStatusEntry(value: unknown): StatusEntry | undefined {
	try {
		const parsed = typeof value === "string" ? JSON.parse(value) : value;
		if (!parsed || typeof parsed !== "object") return undefined;
		return parsed as StatusEntry;
	} catch {
		return undefined;
	}
}

/**
 * Failure-safe boundary shared by the status page and status share image.
 * Provider history is supporting evidence only: missing storage or malformed
 * entries must become an honest empty history, never a service-health claim.
 */
export async function loadStatusDataWith({ targets, now, read }: StatusDataBoundary): Promise<TargetStatus[]> {
	const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;
	return Promise.all(
		targets.map(async (target) => {
			try {
				const raw = await read(`provider-status:${target}`, sevenDaysAgo);
				const entries = raw.map(parseStatusEntry).filter((entry): entry is StatusEntry => Boolean(entry));
				return { target, entries };
			} catch {
				return { target, entries: [] };
			}
		}),
	);
}

export async function loadStatusData(): Promise<TargetStatus[]> {
	const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
	const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
	if (!url || !token) return STATUS_TARGETS.map((target) => ({ target, entries: [] }));

	const redis = new Redis({ url, token });
	return loadStatusDataWith({
		targets: STATUS_TARGETS,
		now: Date.now,
		read: (key, minimumScore) => redis.zrange(key, minimumScore, "+inf", { byScore: true }),
	});
}

export const getStatusData = createServerFn({ method: "GET" }).handler(async () => loadStatusData());
