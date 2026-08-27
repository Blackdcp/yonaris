import type { OutputLanguage } from "@workspace/config/language";
import {
	createReportExecutionClaim,
	type ReportExecutionClaim,
	type ReportExecutionStatus,
	type ReportExecutionStore,
} from "./report-execution-store";

class ReportClaimLostError extends Error {
	constructor() {
		super("The report execution claim is no longer current");
		this.name = "ReportClaimLostError";
	}
}

function timeAfterClaim(claim: ReportExecutionClaim, requestedTime: Date): Date {
	return new Date(Math.max(requestedTime.getTime(), claim.token.getTime() + 1));
}

export type ClaimedReportExecutionOutcome<T> = { disposition: "completed"; value: T } | { disposition: "lost_claim" };

export interface ClaimedReportExecutionInput<T> {
	claim: ReportExecutionClaim;
	stateStore: ReportExecutionStore;
	now: () => Date;
	log: (message: string) => void;
	run: (updateProgress: (progress: number) => Promise<void>) => Promise<{ rawOutput: unknown; result: T }>;
}

export async function executeClaimedReport<T>(
	input: ClaimedReportExecutionInput<T>,
): Promise<ClaimedReportExecutionOutcome<T>> {
	const updateProgress = async (progress: number): Promise<void> => {
		const updated = await input.stateStore.persistProgress(input.claim, progress);
		if (!updated) throw new ReportClaimLostError();
	};

	try {
		const completedWork = await input.run(updateProgress);
		const completed = await input.stateStore.complete(
			input.claim,
			completedWork.rawOutput,
			timeAfterClaim(input.claim, input.now()),
		);
		if (!completed) {
			input.log(`Report ${input.claim.reportId} completion skipped because its claim was lost`);
			return { disposition: "lost_claim" };
		}
		return { disposition: "completed", value: completedWork.result };
	} catch (error) {
		if (error instanceof ReportClaimLostError) {
			input.log(`Report ${input.claim.reportId} stopped because its claim was lost`);
			return { disposition: "lost_claim" };
		}

		const failed = await input.stateStore.fail(input.claim, timeAfterClaim(input.claim, input.now()));
		if (!failed) {
			input.log(`Report ${input.claim.reportId} failure status skipped because its claim was lost`);
		}
		throw error;
	}
}

export interface FreshlyInsertedReportExecution {
	reportId: string;
	outputLanguage: unknown;
	status: ReportExecutionStatus;
	updatedAt: Date;
}

export interface FreshDirectReportInput<T> {
	insertedRows: readonly FreshlyInsertedReportExecution[];
	expectedReportId: string;
	expectedOutputLanguage: OutputLanguage;
	stateStore: ReportExecutionStore;
	now: () => Date;
	process: (claim: ReportExecutionClaim) => Promise<T>;
}

export async function processFreshlyInsertedReport<T>(input: FreshDirectReportInput<T>): Promise<T> {
	if (input.insertedRows.length !== 1) {
		throw new Error("Direct report execution requires exactly one freshly inserted report row");
	}
	const inserted = input.insertedRows[0];
	if (!inserted) {
		throw new Error("Direct report execution requires exactly one freshly inserted report row");
	}
	if (
		inserted.reportId !== input.expectedReportId ||
		inserted.outputLanguage !== input.expectedOutputLanguage ||
		inserted.status !== "pending"
	) {
		throw new Error("The freshly inserted report row did not match the direct execution contract");
	}

	const claim = createReportExecutionClaim(
		inserted.reportId,
		input.expectedOutputLanguage,
		input.now(),
		inserted.updatedAt,
	);
	if (!(await input.stateStore.claim(claim))) {
		throw new Error("The freshly inserted report atomic claim was lost");
	}
	return input.process(claim);
}
