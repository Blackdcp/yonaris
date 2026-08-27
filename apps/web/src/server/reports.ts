/**
 * Server functions for report operations.
 * Replaces apps/web/src/app/api/reports/route.ts
 */
import { createServerFn } from "@tanstack/react-start";
import { isArtifactZhCnWriteEnabled } from "@workspace/config/artifact-output-language";
import { isContentLanguage } from "@workspace/config/language";
import { db } from "@workspace/lib/db/db";
import { type NewReport, reports } from "@workspace/lib/db/schema";
import { validatePublicHttpUrl } from "@workspace/lib/public-http-url";
import { parseGeneratedReportOutput } from "@workspace/lib/report-output";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { canAccessPlatformReports } from "@/lib/auth/execution-boundaries";
import { hasReportAccess, isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";
import { sendReportJob } from "@/lib/job-scheduler";
import { normalizeManualPrompts, REPORT_REQUEST_LIMITS } from "@/lib/report-request-policy";

export const REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE = "report-output-language-temporarily-unavailable";

async function markReportFailed(reportId: string): Promise<void> {
	await db.update(reports).set({ status: "failed", updatedAt: new Date() }).where(eq(reports.id, reportId));
}

async function requireReportAccess() {
	const session = await requireAuthSession();
	if (
		!canAccessPlatformReports({
			reportGenerationEnabled: getDeployment().features.reportGeneration,
			platformAdmin: isAdmin(session),
			explicitReportOperator: hasReportAccess(session),
		})
	) {
		throw new Error("Access denied. Platform report operator access required.");
	}
}

/**
 * Get all reports
 */
export const getReportsFn = createServerFn({ method: "GET" }).handler(async () => {
	await requireReportAccess();

	return db
		.select({
			id: reports.id,
			brandName: reports.brandName,
			brandWebsite: reports.brandWebsite,
			status: reports.status,
			outputLanguage: reports.outputLanguage,
			createdAt: reports.createdAt,
			completedAt: reports.completedAt,
			updatedAt: reports.updatedAt,
		})
		.from(reports)
		.orderBy(desc(reports.createdAt));
});

/**
 * Get a single report by ID (includes rawOutput for rendering)
 */
export const getReportByIdFn = createServerFn({ method: "GET" })
	.validator(z.object({ reportId: z.string() }))
	.handler(async ({ data }) => {
		await requireReportAccess();

		const result = await db.select().from(reports).where(eq(reports.id, data.reportId)).limit(1);
		if (result.length === 0) throw new Error("Report not found");
		const report = result[0];
		return {
			...report,
			rawOutput: report.rawOutput === null ? null : parseGeneratedReportOutput(report.rawOutput),
		};
	});

/**
 * Create a new report and queue generation job
 */
export const createReportFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandName: z.string().trim().min(1).max(REPORT_REQUEST_LIMITS.brandNameCharacters),
			brandWebsite: z.string().trim().url().max(REPORT_REQUEST_LIMITS.websiteCharacters),
			manualPrompts: z.string().max(REPORT_REQUEST_LIMITS.manualPromptInputCharacters).optional(),
			outputLanguage: z.enum(["en", "zh-CN"]),
		}),
	)
	.handler(async ({ data }) => {
		await requireReportAccess();
		if (data.outputLanguage === "zh-CN" && !isArtifactZhCnWriteEnabled()) {
			throw new Error(REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE);
		}
		const brandWebsite = (await validatePublicHttpUrl(data.brandWebsite.trim())).href;

		const parsedManualPrompts = normalizeManualPrompts(data.manualPrompts);

		// Create report
		const newReport: NewReport = {
			brandName: data.brandName.trim(),
			brandWebsite,
			status: "pending",
			outputLanguage: data.outputLanguage,
		};

		const result = await db.insert(reports).values(newReport).returning();
		const createdReport = result[0];
		if (!createdReport) throw new Error("Failed to create report");
		if (!isContentLanguage(createdReport.outputLanguage)) {
			await markReportFailed(createdReport.id);
			throw new Error("Invalid persisted report output language");
		}
		const outputLanguage = createdReport.outputLanguage;
		if (outputLanguage === "zh-CN" && !isArtifactZhCnWriteEnabled()) {
			await markReportFailed(createdReport.id);
			throw new Error(REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE);
		}

		// Queue job
		try {
			const success = await sendReportJob({
				reportId: createdReport.id,
				brandName: createdReport.brandName,
				brandWebsite: createdReport.brandWebsite,
				outputLanguage,
				manualPrompts: parsedManualPrompts.length > 0 ? parsedManualPrompts : undefined,
			});
			if (!success) throw new Error("Failed to send report job");
		} catch {
			await markReportFailed(createdReport.id);
			throw new Error("Failed to queue report generation");
		}

		return { ...createdReport, outputLanguage, rawOutput: null };
	});
