import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeClaimedReport, processFreshlyInsertedReport } from "./report-execution";
import type { ReportExecutionClaim, ReportExecutionStatus, ReportExecutionStore } from "./report-execution-store";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";
const CLAIM_TOKEN = new Date("2026-08-27T10:11:12.345Z");
const FINISHED_AT = new Date("2026-08-27T10:12:00.000Z");

const claim: ReportExecutionClaim = {
	reportId: REPORT_ID,
	outputLanguage: "zh-CN",
	token: CLAIM_TOKEN,
};

type MemoryRow = {
	reportId: string;
	outputLanguage: unknown;
	status: ReportExecutionStatus;
	updatedAt: Date;
	progress: number;
	rawOutput: unknown;
};

function claimedRow(): MemoryRow {
	return {
		reportId: REPORT_ID,
		outputLanguage: "zh-CN",
		status: "processing",
		updatedAt: new Date(CLAIM_TOKEN),
		progress: 0,
		rawOutput: null,
	};
}

function memoryStore(row: MemoryRow): ReportExecutionStore {
	const active = (candidate: ReportExecutionClaim) =>
		row.reportId === candidate.reportId &&
		row.outputLanguage === candidate.outputLanguage &&
		row.status === "processing" &&
		row.updatedAt.getTime() === candidate.token.getTime();
	return {
		read: async () => ({ outputLanguage: row.outputLanguage, status: row.status, updatedAt: row.updatedAt }),
		failPending: async () => false,
		claim: async () => false,
		persistProgress: async (candidate, progress) => {
			if (!active(candidate)) return false;
			row.progress = Math.round(progress);
			return true;
		},
		complete: async (candidate, rawOutput, completedAt) => {
			if (!active(candidate)) return false;
			row.status = "completed";
			row.progress = 100;
			row.rawOutput = rawOutput;
			row.updatedAt = completedAt;
			return true;
		},
		fail: async (candidate, failedAt) => {
			if (!active(candidate)) return false;
			row.status = "failed";
			row.updatedAt = failedAt;
			return true;
		},
	};
}

function executionInput<T>(row: MemoryRow, run: Parameters<typeof executeClaimedReport<T>>[0]["run"]) {
	return {
		claim,
		stateStore: memoryStore(row),
		now: () => new Date(FINISHED_AT),
		log: () => undefined,
		run,
	};
}

describe("claimed report execution lifecycle", () => {
	it("persists current-claim progress and atomically completes at progress 100", async () => {
		const row = claimedRow();
		const rawOutput = { raw: "原始 evidence" };

		const outcome = await executeClaimedReport(
			executionInput(row, async (updateProgress) => {
				await updateProgress(42.4);
				assert.equal(row.progress, 42);
				return { rawOutput, result: { success: true } };
			}),
		);

		assert.deepEqual(outcome, { disposition: "completed", value: { success: true } });
		assert.equal(row.status, "completed");
		assert.equal(row.progress, 100);
		assert.equal(row.rawOutput, rawOutput);
		assert.equal(row.updatedAt.toISOString(), FINISHED_AT.toISOString());
	});

	it("returns lost-claim without overwriting another completion", async () => {
		const row = claimedRow();
		const anotherOutput = { winner: "another worker" };

		const outcome = await executeClaimedReport(
			executionInput(row, async () => {
				row.status = "completed";
				row.progress = 100;
				row.rawOutput = anotherOutput;
				row.updatedAt = new Date("2026-08-27T10:11:59.999Z");
				return { rawOutput: { stale: true }, result: { success: true } };
			}),
		);

		assert.deepEqual(outcome, { disposition: "lost_claim" });
		assert.equal(row.status, "completed");
		assert.equal(row.rawOutput, anotherOutput);
	});

	it("conditionally fails the current claim and rethrows a provider error for retry", async () => {
		const row = claimedRow();
		const providerError = new Error("provider unavailable");

		await assert.rejects(
			executeClaimedReport(
				executionInput(row, async () => {
					throw providerError;
				}),
			),
			providerError,
		);

		assert.equal(row.status, "failed");
		assert.equal(row.updatedAt.toISOString(), FINISHED_AT.toISOString());
	});

	it("keeps a failed transition newer than its claim token during host clock rollback", async () => {
		const row = claimedRow();
		const providerError = new Error("provider unavailable");

		await assert.rejects(
			executeClaimedReport({
				claim,
				stateStore: memoryStore(row),
				now: () => new Date("2026-08-27T10:11:00.000Z"),
				log: () => undefined,
				run: async () => {
					throw providerError;
				},
			}),
			providerError,
		);

		assert.equal(row.updatedAt.toISOString(), "2026-08-27T10:11:12.346Z");
	});

	it("does not let a stale failure overwrite another completed claim", async () => {
		const row = claimedRow();
		const providerError = new Error("late provider failure");
		const anotherOutput = { winner: "another worker" };

		await assert.rejects(
			executeClaimedReport(
				executionInput(row, async () => {
					row.status = "completed";
					row.progress = 100;
					row.rawOutput = anotherOutput;
					row.updatedAt = new Date("2026-08-27T10:11:59.999Z");
					throw providerError;
				}),
			),
			providerError,
		);

		assert.equal(row.status, "completed");
		assert.equal(row.rawOutput, anotherOutput);
	});

	it("stops cleanly when a progress update discovers a lost claim", async () => {
		const row = claimedRow();

		const outcome = await executeClaimedReport(
			executionInput(row, async (updateProgress) => {
				row.updatedAt = new Date("2026-08-27T10:11:12.346Z");
				await updateProgress(5);
				throw new Error("unreachable");
			}),
		);

		assert.deepEqual(outcome, { disposition: "lost_claim" });
		assert.equal(row.status, "processing");
		assert.equal(row.progress, 0);
	});

	it("throws infrastructure write failures so pg-boss can retry", async () => {
		const row = claimedRow();
		const store = memoryStore(row);
		const writeFailure = new Error("database write unavailable");
		store.persistProgress = async () => {
			throw writeFailure;
		};

		await assert.rejects(
			executeClaimedReport({
				claim,
				stateStore: store,
				now: () => new Date(FINISHED_AT),
				log: () => undefined,
				run: async (updateProgress) => {
					await updateProgress(5);
					return { rawOutput: {}, result: { success: true } };
				},
			}),
			writeFailure,
		);
	});
});

describe("direct database report claim boundary", () => {
	it("processes only one freshly inserted exact pending row", async () => {
		const row = claimedRow();
		row.status = "pending";
		row.updatedAt = new Date("2026-08-27T09:00:00.000Z");
		const store = memoryStore(row);
		store.claim = async (candidate) => {
			if (row.status !== "pending" || row.outputLanguage !== candidate.outputLanguage) return false;
			row.status = "processing";
			row.updatedAt = candidate.token;
			return true;
		};
		let processCalls = 0;

		const result = await processFreshlyInsertedReport({
			insertedRows: [
				{
					reportId: REPORT_ID,
					outputLanguage: "zh-CN",
					status: "pending",
					updatedAt: new Date("2026-08-27T09:00:00.000Z"),
				},
			],
			expectedReportId: REPORT_ID,
			expectedOutputLanguage: "zh-CN",
			stateStore: store,
			now: () => new Date(CLAIM_TOKEN),
			process: async (directClaim) => {
				processCalls += 1;
				assert.equal(directClaim.token.toISOString(), CLAIM_TOKEN.toISOString());
				return "processed";
			},
		});

		assert.equal(result, "processed");
		assert.equal(processCalls, 1);
		assert.equal(row.status, "processing");
	});

	for (const insertedRows of [
		[],
		[
			{
				reportId: REPORT_ID,
				outputLanguage: "zh-CN" as const,
				status: "pending" as const,
				updatedAt: new Date("2026-08-27T09:00:00.000Z"),
			},
			{
				reportId: "f02722be-3362-4939-801e-9d476a31d41d",
				outputLanguage: "zh-CN" as const,
				status: "pending" as const,
				updatedAt: new Date("2026-08-27T09:00:00.000Z"),
			},
		],
	] as const) {
		it(`refuses ${insertedRows.length} inserted rows without invoking report work`, async () => {
			const row = claimedRow();
			let processCalls = 0;

			await assert.rejects(
				processFreshlyInsertedReport({
					insertedRows,
					expectedReportId: REPORT_ID,
					expectedOutputLanguage: "zh-CN",
					stateStore: memoryStore(row),
					now: () => new Date(CLAIM_TOKEN),
					process: async () => {
						processCalls += 1;
					},
				}),
				/one freshly inserted report row/,
			);

			assert.equal(processCalls, 0);
		});
	}

	it("does not invoke direct report work when the atomic claim is lost", async () => {
		const row = claimedRow();
		row.status = "pending";
		const store = memoryStore(row);
		store.claim = async () => false;
		let processCalls = 0;

		await assert.rejects(
			processFreshlyInsertedReport({
				insertedRows: [
					{
						reportId: REPORT_ID,
						outputLanguage: "zh-CN",
						status: "pending",
						updatedAt: new Date("2026-08-27T09:00:00.000Z"),
					},
				],
				expectedReportId: REPORT_ID,
				expectedOutputLanguage: "zh-CN",
				stateStore: store,
				now: () => new Date(CLAIM_TOKEN),
				process: async () => {
					processCalls += 1;
				},
			}),
			/atomic claim was lost/,
		);

		assert.equal(processCalls, 0);
	});
});
