import { and, count, eq } from "drizzle-orm";
import {
	type ObservationCoverage,
	type ObservationCoverageSelector,
	summarizeObservationCoverage,
} from "../observation-coverage";
import { db } from "./db";
import { observationAttempts } from "./schema";

export async function getObservationCoverage(selector: ObservationCoverageSelector): Promise<ObservationCoverage> {
	const conditions = [
		eq(observationAttempts.brandId, selector.brandId),
		eq(observationAttempts.scopeId, selector.scopeId),
	];
	if (selector.surfaceTargetKey !== undefined) {
		conditions.push(eq(observationAttempts.surfaceTargetKey, selector.surfaceTargetKey));
	}

	const rows = await db
		.select({
			status: observationAttempts.status,
			count: count(),
		})
		.from(observationAttempts)
		.where(and(...conditions))
		.groupBy(observationAttempts.status);

	return summarizeObservationCoverage(rows);
}
