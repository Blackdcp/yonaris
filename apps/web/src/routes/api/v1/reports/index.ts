/**
 * /api/v1/reports - External API endpoint for report generation
 * Protected by API key authentication.
 *
 * POST: Create a new report and queue generation.
 * GET: List reports with pagination.
 */
import { createFileRoute } from "@tanstack/react-router";
import { isArtifactZhCnWriteEnabled } from "@workspace/config/artifact-output-language";
import { isContentLanguage } from "@workspace/config/language";
import { db } from "@workspace/lib/db/db";
import { type NewReport, reports } from "@workspace/lib/db/schema";
import { validatePublicHttpUrl } from "@workspace/lib/public-http-url";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";
import { getDeployment } from "@/lib/config/server";
import { sendReportJob } from "@/lib/job-scheduler";
import { normalizeManualPromptValues, REPORT_REQUEST_LIMITS } from "@/lib/report-request-policy";

export const REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE = "report-output-language-temporarily-unavailable";

function reportOutputLanguageUnavailableResponse(): Response {
	return Response.json(
		{
			error: "Service Unavailable",
			message: "Simplified Chinese report generation is temporarily unavailable",
			code: REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE,
		},
		{ status: 503 },
	);
}

async function markReportFailed(reportId: string): Promise<void> {
	await db.update(reports).set({ status: "failed", updatedAt: new Date() }).where(eq(reports.id, reportId));
}

const createReportBody = z.object({
	brandName: z
		.string("brandName is required and must be a non-empty string")
		.trim()
		.min(1, "brandName is required and must be a non-empty string")
		.max(REPORT_REQUEST_LIMITS.brandNameCharacters),
	brandWebsite: z
		.string("brandWebsite is required and must be a non-empty string")
		.trim()
		.min(1, "brandWebsite is required and must be a non-empty string")
		.max(REPORT_REQUEST_LIMITS.websiteCharacters)
		.refine((website) => {
			try {
				new URL(website.startsWith("http") ? website : `https://${website}`);
				return true;
			} catch {
				return false;
			}
		}, "brandWebsite must be a valid URL"),
	manualPrompts: z
		.array(z.string().max(REPORT_REQUEST_LIMITS.manualPromptCharacters))
		.max(REPORT_REQUEST_LIMITS.manualPromptCount)
		.optional(),
	outputLanguage: z.enum(["en", "zh-CN"]).default("en"),
});

function requireReportGenerationEnabled(): void {
	if (!getDeployment().features.reportGeneration) {
		throw new ApiError(403, "Forbidden", "Report generation is disabled for this deployment");
	}
}

export const Route = createFileRoute("/api/v1/reports/")({
	server: {
		handlers: {
			POST: createApiHandler({
				body: createReportBody,
				status: 201,
				handle: async ({ body }) => {
					requireReportGenerationEnabled();
					if (body.outputLanguage === "zh-CN" && !isArtifactZhCnWriteEnabled()) {
						return reportOutputLanguageUnavailableResponse();
					}

					let parsedManualPrompts: string[];
					let brandWebsite: string;
					try {
						parsedManualPrompts = normalizeManualPromptValues(body.manualPrompts ?? []);
						brandWebsite = (
							await validatePublicHttpUrl(
								/^https?:\/\//i.test(body.brandWebsite) ? body.brandWebsite : `https://${body.brandWebsite}`,
							)
						).href;
					} catch {
						throw new ApiError(400, "Bad Request", "Report inputs exceed the allowed budget or URL safety policy");
					}

					const newReport: NewReport = {
						brandName: body.brandName.trim(),
						brandWebsite,
						status: "pending",
						outputLanguage: body.outputLanguage,
					};

					const result = await db.insert(reports).values(newReport).returning();
					const createdReport = result[0];
					if (!createdReport) {
						throw new ApiError(500, "Internal Server Error", "Failed to create report");
					}
					if (!isContentLanguage(createdReport.outputLanguage)) {
						await markReportFailed(createdReport.id);
						throw new ApiError(500, "Internal Server Error", "Invalid persisted report output language");
					}
					const outputLanguage = createdReport.outputLanguage;
					if (outputLanguage === "zh-CN" && !isArtifactZhCnWriteEnabled()) {
						await markReportFailed(createdReport.id);
						return reportOutputLanguageUnavailableResponse();
					}

					const success = await sendReportJob({
						reportId: createdReport.id,
						brandName: createdReport.brandName,
						brandWebsite: createdReport.brandWebsite,
						outputLanguage,
						manualPrompts: parsedManualPrompts.length > 0 ? parsedManualPrompts : undefined,
					});

					if (!success) {
						await markReportFailed(createdReport.id);
						throw new ApiError(500, "Internal Server Error", "Failed to queue report generation");
					}

					return {
						reportId: createdReport.id,
						status: createdReport.status,
						brandName: createdReport.brandName,
						brandWebsite: createdReport.brandWebsite,
						outputLanguage,
						createdAt: createdReport.createdAt,
					};
				},
			}),

			GET: createApiHandler({
				handle: async ({ request }) => {
					requireReportGenerationEnabled();
					const { searchParams } = new URL(request.url);
					const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
					const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("limit") || "20", 10)));
					const offset = (page - 1) * limit;

					const [totalCountResult] = await db.select({ count: count() }).from(reports);
					const totalCount = totalCountResult?.count || 0;
					const totalPages = Math.ceil(totalCount / limit);

					const reportsList = await db
						.select({
							id: reports.id,
							brandName: reports.brandName,
							brandWebsite: reports.brandWebsite,
							status: reports.status,
							outputLanguage: reports.outputLanguage,
							createdAt: reports.createdAt,
							completedAt: reports.completedAt,
						})
						.from(reports)
						.orderBy(desc(reports.createdAt))
						.limit(limit)
						.offset(offset);

					return {
						reports: reportsList,
						pagination: { page, limit, total: totalCount, totalPages },
					};
				},
			}),
		},
	},
});
