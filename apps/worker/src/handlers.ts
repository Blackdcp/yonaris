import * as Sentry from "@sentry/node";
import { getDeployment } from "@workspace/deployment";
import type { OnboardingSuggestion } from "@workspace/lib/onboarding";
import type { Job, PgBoss } from "pg-boss";
import { type AnalyzeBrandData, analyzeBrandJob } from "./jobs/analyze-brand";
import { type GenerateReportData, generateReportJob } from "./jobs/generate-report";
import { type ProcessOverseasRunCallData, processOverseasRunCallJob } from "./jobs/process-overseas-run-call";
import { type ProcessPromptData, processPromptJob } from "./jobs/process-prompt";
import {
	type ResponseSnapshotMaintenanceData,
	responseSnapshotMaintenanceJob,
} from "./jobs/response-snapshot-maintenance";
import { type ScheduleMaintenanceData, scheduleMaintenanceJob } from "./jobs/schedule-maintenance";
import { type SyncAuth0MembershipsData, syncAuth0MembershipsJob } from "./jobs/sync-auth0-memberships";

export type WorkerQueueScope = "full" | "analysis-only";

/**
 * Wraps a pg-boss handler to report errors to Sentry before re-throwing.
 * Preserves the handler's return value (stored by pg-boss as the job output).
 */
function withSentry<T, R>(queueName: string, handler: (jobs: Job<T>[]) => Promise<R>): (jobs: Job<T>[]) => Promise<R> {
	return async (jobs) => {
		try {
			return await handler(jobs);
		} catch (error) {
			Sentry.withScope((scope) => {
				scope.setTag("queue", queueName);
				Sentry.captureException(error);
			});
			throw error;
		}
	};
}

/**
 * Register all job handlers with pg-boss.
 */
export async function registerHandlers(boss: PgBoss, scope: WorkerQueueScope = "full"): Promise<void> {
	if (scope === "full") {
		await boss.work<ProcessPromptData>(
			"process-prompt",
			{ localConcurrency: 10 },
			withSentry("process-prompt", processPromptJob),
		);
		console.log("Registered handler: process-prompt");
		await boss.work<ProcessOverseasRunCallData>(
			"process-overseas-run-call",
			{ localConcurrency: 6 },
			withSentry("process-overseas-run-call", processOverseasRunCallJob),
		);
		console.log("Registered handler: process-overseas-run-call");

		if (getDeployment().features.reportGeneration) {
			await boss.work<GenerateReportData>(
				"generate-report",
				{ localConcurrency: 2 },
				withSentry("generate-report", generateReportJob),
			);
			console.log("Registered handler: generate-report");
		}
	}

	// batchSize: 1 keeps the returned suggestion mapped 1:1 to a single job's
	// output, which the web app reads back via getJobById.
	await boss.work<AnalyzeBrandData, OnboardingSuggestion>(
		"analyze-brand",
		{ batchSize: 1, localConcurrency: 2 },
		withSentry("analyze-brand", analyzeBrandJob),
	);
	console.log("Registered handler: analyze-brand");

	if (scope === "full") {
		await boss.work<ScheduleMaintenanceData>(
			"schedule-maintenance",
			{ localConcurrency: 1 },
			withSentry("schedule-maintenance", scheduleMaintenanceJob),
		);
		console.log("Registered handler: schedule-maintenance");

		await boss.work<ResponseSnapshotMaintenanceData>(
			"response-snapshot-maintenance",
			{ localConcurrency: 1 },
			withSentry("response-snapshot-maintenance", responseSnapshotMaintenanceJob),
		);
		console.log("Registered handler: response-snapshot-maintenance");

		if (process.env.DEPLOYMENT_MODE === "whitelabel") {
			await boss.work<SyncAuth0MembershipsData>(
				"sync-auth0-memberships",
				{ localConcurrency: 1 },
				withSentry("sync-auth0-memberships", syncAuth0MembershipsJob),
			);
			console.log("Registered handler: sync-auth0-memberships");
		}
	}
}
