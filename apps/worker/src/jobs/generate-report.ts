import { isContentLanguage } from "@workspace/config/language";
import type { Job } from "pg-boss";
import { createReportExecutionClaim, type ReportExecutionStore, reportExecutionStore } from "../report-execution-store";
import { normalizeQueuedReportJobData, type QueuedReportJobData, ReportJobDataError } from "../report-job-data";
import { processReportJob, type ReportJobContext, type ReportProcessingResult } from "../report-worker";

export interface GenerateReportData extends QueuedReportJobData {}

export interface GenerateReportJobDependencies {
	stateStore: ReportExecutionStore;
	now: () => Date;
	processReport: (job: ReportJobContext) => Promise<ReportProcessingResult>;
	log: (message: string, ...details: unknown[]) => void;
	error: (message: string, ...details: unknown[]) => void;
}

const REPORT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function locatableReportId(data: QueuedReportJobData): string | null {
	const reportId = (data as { reportId?: unknown }).reportId;
	return typeof reportId === "string" && REPORT_ID_PATTERN.test(reportId) ? reportId : null;
}

function reportsLostClaim(
	result: unknown,
	reportId: string,
	outputLanguage: ReportProcessingResult["outputLanguage"],
): result is Extract<ReportProcessingResult, { success: false }> {
	return (
		result !== null &&
		typeof result === "object" &&
		(result as { success?: unknown }).success === false &&
		(result as { lostClaim?: unknown }).lostClaim === true &&
		(result as { reportId?: unknown }).reportId === reportId &&
		(result as { outputLanguage?: unknown }).outputLanguage === outputLanguage
	);
}

function reportsCompleted(
	result: unknown,
	reportId: string,
	outputLanguage: ReportProcessingResult["outputLanguage"],
): result is Extract<ReportProcessingResult, { success: true }> {
	return (
		result !== null &&
		typeof result === "object" &&
		(result as { success?: unknown }).success === true &&
		(result as { reportId?: unknown }).reportId === reportId &&
		(result as { outputLanguage?: unknown }).outputLanguage === outputLanguage
	);
}

const productionDependencies: GenerateReportJobDependencies = {
	stateStore: reportExecutionStore,
	now: () => new Date(),
	processReport: processReportJob,
	log: (message, ...details) => console.log(message, ...details),
	error: (message, ...details) => console.error(message, ...details),
};

/**
 * Generate a report - runs website analysis, competitor research, and prompt testing.
 * This is a pg-boss job handler.
 */
export function createGenerateReportJobHandler(
	dependencies: GenerateReportJobDependencies,
): (jobs: Job<GenerateReportData>[]) => Promise<void> {
	return async (jobs) => {
		// pg-boss v12 passes an array of jobs - process each one
		for (const job of jobs) {
			let normalizedData: ReturnType<typeof normalizeQueuedReportJobData>;
			try {
				normalizedData = normalizeQueuedReportJobData(job.data);
			} catch (error) {
				if (!(error instanceof ReportJobDataError)) throw error;
				const reportId = locatableReportId(job.data);
				if (reportId) await dependencies.stateStore.failPending(reportId, dependencies.now());
				dependencies.error(`Rejected report job ${reportId ?? "with an invalid report ID"}: ${error.message}`);
				continue;
			}

			const persistedReport = await dependencies.stateStore.read(normalizedData.reportId);
			if (!persistedReport) {
				dependencies.error(`Rejected report job ${normalizedData.reportId}: persisted report not found`);
				continue;
			}
			if (!isContentLanguage(persistedReport.outputLanguage)) {
				await dependencies.stateStore.failPending(normalizedData.reportId, dependencies.now());
				dependencies.error(`Rejected report job ${normalizedData.reportId}: invalid persisted output language`);
				continue;
			}
			if (persistedReport.outputLanguage !== normalizedData.outputLanguage) {
				await dependencies.stateStore.failPending(normalizedData.reportId, dependencies.now());
				dependencies.error(`Rejected report job ${normalizedData.reportId}: queued output language mismatch`);
				continue;
			}
			if (persistedReport.status === "completed") {
				dependencies.log(`Acknowledged report job ${normalizedData.reportId}: report is already completed`);
				continue;
			}
			if (persistedReport.status === "processing") {
				dependencies.log(
					`Acknowledged report job ${normalizedData.reportId}: report is already processing; stale processing rows require operator recovery`,
				);
				continue;
			}

			const claim = createReportExecutionClaim(
				normalizedData.reportId,
				persistedReport.outputLanguage,
				dependencies.now(),
				persistedReport.updatedAt,
			);
			if (!(await dependencies.stateStore.claim(claim))) {
				dependencies.log(`Acknowledged report job ${normalizedData.reportId}: atomic report claim was lost`);
				continue;
			}

			const persistedData = { ...normalizedData, outputLanguage: persistedReport.outputLanguage };
			const {
				reportId,
				brandName,
				brandWebsite,
				outputLanguage,
				manualPrompts,
				competitorSnapshot,
				runsPerTargetOverride,
				expectedRunCount,
			} = persistedData;

			dependencies.log(`Generating report ${reportId} for ${brandName} (output language: ${outputLanguage})`);

			const log = (message: string) => dependencies.log(`[Report ${reportId}] ${message}`);

			const result = await dependencies.processReport({
				data: {
					reportId,
					brandName,
					brandWebsite,
					outputLanguage,
					manualPrompts,
					competitorSnapshot,
					runsPerTargetOverride,
					expectedRunCount,
				},
				claim,
				stateStore: dependencies.stateStore,
				log,
			});

			if (reportsLostClaim(result, reportId, outputLanguage)) {
				dependencies.log(`Acknowledged report job ${reportId}: execution claim was lost`);
				continue;
			}
			if (!reportsCompleted(result, reportId, outputLanguage)) {
				throw new Error(`Report ${reportId} returned an unexpected result`);
			}
			dependencies.log(`Report ${reportId} completed successfully (output language: ${outputLanguage})`);
		}
	};
}

export const generateReportJob = createGenerateReportJobHandler(productionDependencies);
