import { db } from "@workspace/lib/db/db";
import {
	claimOverseasRunCall,
	completeOverseasRunCall,
	failOverseasRunCall,
	recordOverseasPaidIntent,
} from "@workspace/lib/db/overseas-runs";
import { brands, competitors, measurementScopes } from "@workspace/lib/db/schema";
import { getProvider } from "@workspace/lib/providers";
import { eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { runModelIteration } from "./process-prompt";

export interface ProcessOverseasRunCallData {
	cohortId: string;
	callId: string;
}

interface ClaimedCallIdentity {
	id: string;
	cohortId: string;
}

interface ExecutionDependencies<TCall extends ClaimedCallIdentity> {
	claim(callId: string): Promise<TCall | null>;
	execute(
		call: TCall,
		hooks: { beforeProviderRun(): Promise<void> },
	): Promise<{ observationAttemptId: string; promptRunId: string; providerSubmissionId?: string }>;
	recordPaidIntent(callId: string): Promise<void>;
	complete(input: {
		callId: string;
		observationAttemptId: string;
		promptRunId: string;
		providerSubmissionId?: string;
	}): Promise<void>;
	fail(input: { callId: string; failureClass: string; failureCode: string; failureMessage: string }): Promise<void>;
}

export async function executeOverseasRunCall<TCall extends ClaimedCallIdentity>(
	job: ProcessOverseasRunCallData,
	dependencies: ExecutionDependencies<TCall>,
): Promise<"succeeded" | "failed" | "skipped"> {
	const call = await dependencies.claim(job.callId);
	if (!call) return "skipped";
	if (call.cohortId !== job.cohortId) {
		await dependencies.fail({
			callId: call.id,
			failureClass: "OverseasRunIdentityError",
			failureCode: "cohort_mismatch",
			failureMessage: "The queued overseas call does not belong to the requested cohort",
		});
		return "failed";
	}
	try {
		const result = await dependencies.execute(call, {
			beforeProviderRun: async () => dependencies.recordPaidIntent(call.id),
		});
		await dependencies.complete({ callId: call.id, ...result });
		return "succeeded";
	} catch (error) {
		await dependencies.fail({
			callId: call.id,
			failureClass: error instanceof Error ? error.name : "UnknownError",
			failureCode: errorCode(error),
			failureMessage: error instanceof Error ? error.message : String(error),
		});
		return "failed";
	}
}

export async function processOverseasRunCallJob(jobs: Job<ProcessOverseasRunCallData>[]): Promise<void> {
	for (const job of jobs) {
		await executeOverseasRunCall(job.data, productionDependencies);
	}
}

const productionDependencies: ExecutionDependencies<NonNullable<Awaited<ReturnType<typeof claimOverseasRunCall>>>> = {
	claim: (callId) => claimOverseasRunCall({ callId }),
	recordPaidIntent: async (callId) => {
		await recordOverseasPaidIntent({ callId });
	},
	complete: completeOverseasRunCall,
	fail: failOverseasRunCall,
	async execute(call, hooks) {
		const [brand, scope, competitorsList] = await Promise.all([
			db.query.brands.findFirst({ where: eq(brands.id, call.brandId) }),
			db.query.measurementScopes.findFirst({ where: eq(measurementScopes.id, call.scopeId) }),
			db.query.competitors.findMany({ where: eq(competitors.brandId, call.brandId) }),
		]);
		if (!brand || !scope) throw new Error("The overseas call brand or Program no longer exists");
		const config = {
			model: call.model,
			provider: call.provider,
			version: call.requestedVersion ?? undefined,
			webSearch: call.webSearchEnabled,
		};
		const result = await runModelIteration({
			sourceJobId: `overseas-run:${call.cohortId}:${call.id}`,
			promptId: call.promptId,
			promptValue: call.promptText,
			brand,
			scope,
			competitorsList,
			config,
			providerImpl: getProvider(call.provider),
			runIndex: call.sampleIndex,
			beforeProviderRun: hooks.beforeProviderRun,
		});
		if (!result) throw new Error("The overseas observation completed without a prompt run");
		return result;
	},
};

function errorCode(error: unknown): string {
	if (error && typeof error === "object" && "code" in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string" || typeof code === "number") return String(code).slice(0, 100);
	}
	return "execution_failed";
}
