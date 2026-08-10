import type { SamplingLease } from "./types";

export interface StoredSamplingLease extends SamplingLease {
	brandId: string;
	taskId: string;
}

function leaseKey(taskId: string): string {
	return `yonaris:sampling-claim:${taskId}`;
}

export function storeSamplingLease(lease: StoredSamplingLease): void {
	if (typeof window === "undefined") return;
	window.sessionStorage.setItem(leaseKey(lease.taskId), JSON.stringify(lease));
}

export function readSamplingLease(taskId: string): StoredSamplingLease | null {
	if (typeof window === "undefined") return null;
	const value = window.sessionStorage.getItem(leaseKey(taskId));
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as Partial<StoredSamplingLease>;
		if (
			parsed.taskId !== taskId ||
			typeof parsed.brandId !== "string" ||
			typeof parsed.leaseToken !== "string" ||
			typeof parsed.leaseGeneration !== "number"
		) {
			return null;
		}
		return parsed as StoredSamplingLease;
	} catch {
		return null;
	}
}

export function clearSamplingLease(taskId: string): void {
	if (typeof window === "undefined") return;
	window.sessionStorage.removeItem(leaseKey(taskId));
}
