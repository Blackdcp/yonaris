import { mapBrowserExtensionSurfaces } from "@workspace/lib/browser-extension-surfaces";
import type { BrowserExtensionClaim, BrowserExtensionSurface } from "../contracts";
import { AdaptiveSurfacePool } from "./concurrency";
import type { TaskRunResult } from "./task-runner";

export type SurfacePollSummary = {
	succeeded: number;
	retryScheduled: number;
	needsHuman: number;
	incomplete: number;
};

type PollStartedWorkInput = {
	brandIds: readonly string[];
	surfaces: readonly BrowserExtensionSurface[];
	claim(brandId: string, surface: BrowserExtensionSurface): Promise<BrowserExtensionClaim | null>;
	run(claim: BrowserExtensionClaim): Promise<TaskRunResult>;
	pools?: Partial<Record<BrowserExtensionSurface, AdaptiveSurfacePool>>;
	now?: () => number;
};

export async function pollStartedWork(input: PollStartedWorkInput): Promise<{
	bySurface: Record<BrowserExtensionSurface, SurfacePollSummary>;
}> {
	const bySurface = emptySummaries();
	for (const surface of input.surfaces) {
		try {
			const pool = input.pools?.[surface] ?? new AdaptiveSurfacePool();
			if (!pool.canStart(input.now?.() ?? Date.now())) continue;
			for (let taskOrdinal = 0; taskOrdinal < 100; taskOrdinal += 1) {
				const [claim] = await claimRound(input.brandIds, surface, 1, input.claim);
				if (!claim) break;

				let result: TaskRunResult;
				try {
					result = await input.run(claim);
				} catch {
					result = { status: "incomplete", code: "coordinator_unhandled" };
				}

				switch (result.status) {
					case "succeeded":
						bySurface[surface].succeeded += 1;
						pool.recordStableSuccess();
						continue;
					case "retry_scheduled":
						bySurface[surface].retryScheduled += 1;
						break;
					case "needs_human":
						bySurface[surface].needsHuman += 1;
						if (result.code === "rate_limited") pool.recordRateLimit(input.now?.() ?? Date.now());
						break;
					case "incomplete":
						bySurface[surface].incomplete += 1;
						break;
				}
				break;
			}
		} catch {
			bySurface[surface].incomplete += 1;
		}
	}
	return { bySurface };
}

async function claimRound(
	brandIds: readonly string[],
	surface: BrowserExtensionSurface,
	maximum: number,
	claim: PollStartedWorkInput["claim"],
): Promise<BrowserExtensionClaim[]> {
	const claims: BrowserExtensionClaim[] = [];
	if (brandIds.length === 0) return claims;
	let emptyBrands = 0;
	let brandIndex = 0;
	while (claims.length < maximum && emptyBrands < brandIds.length) {
		const brandId = brandIds[brandIndex % brandIds.length];
		brandIndex += 1;
		if (!brandId) break;
		const next = await claim(brandId, surface);
		if (next) {
			claims.push(next);
			emptyBrands = 0;
		} else {
			emptyBrands += 1;
		}
	}
	return claims;
}

function emptySummaries(): Record<BrowserExtensionSurface, SurfacePollSummary> {
	return mapBrowserExtensionSurfaces(() => ({ succeeded: 0, retryScheduled: 0, needsHuman: 0, incomplete: 0 }));
}
