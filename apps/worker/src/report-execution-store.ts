import type { OutputLanguage } from "@workspace/config/language";
import { db } from "@workspace/lib/db/db";
import { reports } from "@workspace/lib/db/schema";
import { and, eq, inArray, type SQL } from "drizzle-orm";

export type ReportExecutionStatus = "pending" | "processing" | "completed" | "failed";

export interface PersistedReportExecution {
	outputLanguage: unknown;
	status: ReportExecutionStatus;
	updatedAt: Date;
}

export interface ReportExecutionClaim {
	reportId: string;
	outputLanguage: OutputLanguage;
	token: Date;
}

export interface ReportExecutionStore {
	read: (reportId: string) => Promise<PersistedReportExecution | null>;
	failPending: (reportId: string, failedAt: Date) => Promise<boolean>;
	claim: (claim: ReportExecutionClaim) => Promise<boolean>;
	persistProgress: (claim: ReportExecutionClaim, progress: number) => Promise<boolean>;
	complete: (claim: ReportExecutionClaim, rawOutput: unknown, completedAt: Date) => Promise<boolean>;
	fail: (claim: ReportExecutionClaim, failedAt: Date) => Promise<boolean>;
}

export function createReportExecutionClaim(
	reportId: string,
	outputLanguage: OutputLanguage,
	now: Date,
	previousUpdatedAt: Date,
): ReportExecutionClaim {
	return {
		reportId,
		outputLanguage,
		token: new Date(Math.max(now.getTime(), previousUpdatedAt.getTime() + 1)),
	};
}

function requiredPredicate(predicate: SQL | undefined): SQL {
	if (!predicate) throw new Error("Report execution predicate must contain at least one condition");
	return predicate;
}

export function pendingReportPredicate(reportId: string) {
	return requiredPredicate(and(eq(reports.id, reportId), eq(reports.status, "pending")));
}

export function claimableReportPredicate(claim: ReportExecutionClaim) {
	return requiredPredicate(
		and(
			eq(reports.id, claim.reportId),
			eq(reports.outputLanguage, claim.outputLanguage),
			inArray(reports.status, ["pending", "failed"]),
		),
	);
}

export function activeReportClaimPredicate(claim: ReportExecutionClaim) {
	return requiredPredicate(
		and(
			eq(reports.id, claim.reportId),
			eq(reports.outputLanguage, claim.outputLanguage),
			eq(reports.status, "processing"),
			eq(reports.updatedAt, claim.token),
		),
	);
}

function updatedExactlyOne(rows: Array<{ id: string }>): boolean {
	return rows.length === 1;
}

export function claimedReportProgressUpdate(claim: ReportExecutionClaim, progress: number) {
	return db
		.update(reports)
		.set({ progress: Math.round(progress), updatedAt: claim.token })
		.where(activeReportClaimPredicate(claim))
		.returning({ id: reports.id });
}

export function pendingReportFailureUpdate(reportId: string, failedAt: Date) {
	return db
		.update(reports)
		.set({ status: "failed", updatedAt: failedAt })
		.where(pendingReportPredicate(reportId))
		.returning({ id: reports.id });
}

export function reportClaimUpdate(claim: ReportExecutionClaim) {
	return db
		.update(reports)
		.set({ status: "processing", updatedAt: claim.token })
		.where(claimableReportPredicate(claim))
		.returning({ id: reports.id });
}

export function claimedReportCompletionUpdate(claim: ReportExecutionClaim, rawOutput: unknown, completedAt: Date) {
	return db
		.update(reports)
		.set({
			status: "completed",
			progress: 100,
			rawOutput,
			completedAt,
			updatedAt: completedAt,
		})
		.where(activeReportClaimPredicate(claim))
		.returning({ id: reports.id });
}

export function claimedReportFailureUpdate(claim: ReportExecutionClaim, failedAt: Date) {
	return db
		.update(reports)
		.set({ status: "failed", updatedAt: failedAt })
		.where(activeReportClaimPredicate(claim))
		.returning({ id: reports.id });
}

export const reportExecutionStore: ReportExecutionStore = {
	async read(reportId) {
		const rows = await db
			.select({
				outputLanguage: reports.outputLanguage,
				status: reports.status,
				updatedAt: reports.updatedAt,
			})
			.from(reports)
			.where(eq(reports.id, reportId))
			.limit(1);
		return rows[0] ?? null;
	},
	async failPending(reportId, failedAt) {
		const rows = await pendingReportFailureUpdate(reportId, failedAt);
		return updatedExactlyOne(rows);
	},
	async claim(claim) {
		const rows = await reportClaimUpdate(claim);
		return updatedExactlyOne(rows);
	},
	async persistProgress(claim, progress) {
		const rows = await claimedReportProgressUpdate(claim, progress);
		return updatedExactlyOne(rows);
	},
	async complete(claim, rawOutput, completedAt) {
		const rows = await claimedReportCompletionUpdate(claim, rawOutput, completedAt);
		return updatedExactlyOne(rows);
	},
	async fail(claim, failedAt) {
		const rows = await claimedReportFailureUpdate(claim, failedAt);
		return updatedExactlyOne(rows);
	},
};
