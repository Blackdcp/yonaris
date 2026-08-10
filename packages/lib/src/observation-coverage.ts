import type { ObservationAttempt } from "./db/schema";

export type ObservationCoverageSelector = Pick<ObservationAttempt, "brandId" | "scopeId"> &
	Partial<Pick<ObservationAttempt, "surfaceTargetKey">>;

export type ObservationCoverage = {
	planned: number;
	pending: number;
	running: number;
	succeeded: number;
	failed: number;
	cancelled: number;
	available: boolean;
	/** A ratio from 0 to 1, or null when no planned samples exist. */
	coverage: number | null;
};

export type ObservationStatusCount = Pick<ObservationAttempt, "status"> & {
	count: number;
};

const EMPTY_COUNTS = {
	pending: 0,
	running: 0,
	succeeded: 0,
	failed: 0,
	cancelled: 0,
} satisfies Record<ObservationAttempt["status"], number>;

export function summarizeObservationCoverage(rows: readonly ObservationStatusCount[]): ObservationCoverage {
	const counts = { ...EMPTY_COUNTS };

	for (const row of rows) {
		counts[row.status] += row.count;
	}

	const planned = Object.values(counts).reduce((total, count) => total + count, 0);

	return {
		planned,
		...counts,
		available: planned > 0,
		coverage: planned > 0 ? counts.succeeded / planned : null,
	};
}

export function calculateObservationCoverage(
	attempts: readonly Pick<ObservationAttempt, "brandId" | "scopeId" | "surfaceTargetKey" | "status">[],
	selector: ObservationCoverageSelector,
): ObservationCoverage {
	const counts = attempts.reduce<ObservationStatusCount[]>((rows, attempt) => {
		if (
			attempt.brandId !== selector.brandId ||
			attempt.scopeId !== selector.scopeId ||
			(selector.surfaceTargetKey !== undefined && attempt.surfaceTargetKey !== selector.surfaceTargetKey)
		) {
			return rows;
		}

		const row = rows.find(({ status }) => status === attempt.status);
		if (row) {
			row.count += 1;
		} else {
			rows.push({ status: attempt.status, count: 1 });
		}
		return rows;
	}, []);

	return summarizeObservationCoverage(counts);
}
