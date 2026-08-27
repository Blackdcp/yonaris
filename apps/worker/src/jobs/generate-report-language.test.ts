import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersistedReportExecution, ReportExecutionClaim, ReportExecutionStore } from "../report-execution-store";
import type { ReportJobContext, ReportProcessingResult } from "../report-worker";
import * as generateReportModule from "./generate-report";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";
const INITIAL_TOKEN = new Date("2026-08-27T09:00:00.000Z");
const CLAIM_TOKEN = new Date("2026-08-27T10:11:12.345Z");

type QueuedReport = {
	reportId: string;
	brandName: string;
	brandWebsite: string;
	outputLanguage?: unknown;
	manualPrompts?: readonly string[];
	competitorSnapshot?: ReadonlyArray<{ name: string; domain: string }>;
	runsPerTargetOverride?: number;
	expectedRunCount?: number;
};

type MemoryReport = PersistedReportExecution & {
	reportId: string;
	progress: number;
	rawOutput: unknown;
};

class MemoryReportExecutionStore implements ReportExecutionStore {
	readonly readCalls: string[] = [];
	readonly claimCalls: ReportExecutionClaim[] = [];

	constructor(readonly row: MemoryReport | null) {}

	async read(reportId: string): Promise<PersistedReportExecution | null> {
		this.readCalls.push(reportId);
		if (!this.row || this.row.reportId !== reportId) return null;
		return {
			outputLanguage: this.row.outputLanguage,
			status: this.row.status,
			updatedAt: this.row.updatedAt,
		};
	}

	async failPending(reportId: string, failedAt: Date): Promise<boolean> {
		if (!this.row || this.row.reportId !== reportId || this.row.status !== "pending") return false;
		this.row.status = "failed";
		this.row.updatedAt = failedAt;
		return true;
	}

	async claim(claim: ReportExecutionClaim): Promise<boolean> {
		this.claimCalls.push(claim);
		if (
			!this.row ||
			this.row.reportId !== claim.reportId ||
			this.row.outputLanguage !== claim.outputLanguage ||
			(this.row.status !== "pending" && this.row.status !== "failed")
		) {
			return false;
		}
		this.row.status = "processing";
		this.row.updatedAt = claim.token;
		return true;
	}

	async persistProgress(claim: ReportExecutionClaim, progress: number): Promise<boolean> {
		if (!this.row || !this.matchesActiveClaim(claim)) return false;
		this.row.progress = Math.round(progress);
		return true;
	}

	async complete(claim: ReportExecutionClaim, rawOutput: unknown, completedAt: Date): Promise<boolean> {
		if (!this.row || !this.matchesActiveClaim(claim)) return false;
		this.row.status = "completed";
		this.row.progress = 100;
		this.row.rawOutput = rawOutput;
		this.row.updatedAt = completedAt;
		return true;
	}

	async fail(claim: ReportExecutionClaim, failedAt: Date): Promise<boolean> {
		if (!this.row || !this.matchesActiveClaim(claim)) return false;
		this.row.status = "failed";
		this.row.updatedAt = failedAt;
		return true;
	}

	private matchesActiveClaim(claim: ReportExecutionClaim): boolean {
		return Boolean(
			this.row &&
				this.row.reportId === claim.reportId &&
				this.row.outputLanguage === claim.outputLanguage &&
				this.row.status === "processing" &&
				this.row.updatedAt.getTime() === claim.token.getTime(),
		);
	}
}

type HandlerDependencies = {
	stateStore: ReportExecutionStore;
	now: () => Date;
	processReport: (job: ReportJobContext) => Promise<ReportProcessingResult>;
	log: (message: string, ...details: unknown[]) => void;
	error: (message: string, ...details: unknown[]) => void;
};

type GenerateReportHandler = (jobs: Array<{ data: QueuedReport }>) => Promise<void>;
type GenerateReportHandlerFactory = (dependencies: HandlerDependencies) => GenerateReportHandler;

function getHandlerFactory(): GenerateReportHandlerFactory {
	const candidate = (generateReportModule as unknown as { createGenerateReportJobHandler?: unknown })
		.createGenerateReportJobHandler;
	assert.equal(typeof candidate, "function", "generate-report must expose its real dependency-injected handler");
	return candidate as GenerateReportHandlerFactory;
}

function queuedReport(outputLanguage?: unknown): QueuedReport {
	return {
		reportId: REPORT_ID,
		brandName: "原始品牌 / Raw Brand",
		brandWebsite: "https://raw-brand.example/path?source=原始#unchanged",
		manualPrompts: ["  原始 Prompt / MiXeD Case ?  "],
		...(outputLanguage === undefined ? {} : { outputLanguage }),
	};
}

function persistedReport(status: MemoryReport["status"], outputLanguage: unknown = "en"): MemoryReport {
	return {
		reportId: REPORT_ID,
		outputLanguage,
		status,
		updatedAt: new Date(INITIAL_TOKEN),
		progress: status === "completed" ? 100 : 0,
		rawOutput: status === "completed" ? { existing: true } : null,
	};
}

function createHarness(row: MemoryReport | null) {
	const store = new MemoryReportExecutionStore(row);
	const processed: ReportJobContext[] = [];
	const logs: string[] = [];
	const errors: string[] = [];
	const dependencies: HandlerDependencies = {
		stateStore: store,
		now: () => new Date(CLAIM_TOKEN),
		processReport: async (job) => {
			processed.push(job);
			return { success: true, reportId: job.data.reportId, outputLanguage: job.data.outputLanguage };
		},
		log: (message) => logs.push(message),
		error: (message) => errors.push(message),
	};
	return { dependencies, errors, logs, processed, row, store };
}

describe("generate report queue execution boundary", () => {
	it("conditionally fails a pending row for a locatable invalid queue token", async () => {
		const harness = createHarness(persistedReport("pending"));
		const handler = getHandlerFactory()(harness.dependencies);

		await handler([{ data: queuedReport("zh-SG") }]);

		assert.equal(harness.row?.status, "failed");
		assert.deepEqual(harness.store.readCalls, []);
		assert.deepEqual(harness.processed, []);
	});

	for (const status of ["processing", "completed"] as const) {
		it(`does not overwrite a ${status} row for an invalid queue token`, async () => {
			const harness = createHarness(persistedReport(status));
			const handler = getHandlerFactory()(harness.dependencies);

			await handler([{ data: queuedReport("zh-SG") }]);

			assert.equal(harness.row?.status, status);
			assert.deepEqual(harness.processed, []);
		});
	}

	it("acknowledges a missing persisted report without claiming or processing", async () => {
		const harness = createHarness(null);
		const handler = getHandlerFactory()(harness.dependencies);

		await handler([{ data: queuedReport("en") }]);

		assert.deepEqual(harness.store.readCalls, [REPORT_ID]);
		assert.deepEqual(harness.store.claimCalls, []);
		assert.deepEqual(harness.processed, []);
	});

	for (const status of ["pending", "completed", "processing"] as const) {
		it(`rejects a queue/database language mismatch without overwriting a ${status} row`, async () => {
			const harness = createHarness(persistedReport(status, "zh-CN"));
			const handler = getHandlerFactory()(harness.dependencies);

			await handler([{ data: queuedReport("en") }]);

			assert.equal(harness.row?.status, status === "pending" ? "failed" : status);
			assert.deepEqual(harness.processed, []);
		});
	}

	for (const status of ["pending", "completed", "processing"] as const) {
		it(`rejects an invalid persisted language without overwriting a ${status} row`, async () => {
			const harness = createHarness(persistedReport(status, "zh-SG"));
			const handler = getHandlerFactory()(harness.dependencies);

			await handler([{ data: queuedReport("en") }]);

			assert.equal(harness.row?.status, status === "pending" ? "failed" : status);
			assert.deepEqual(harness.processed, []);
		});
	}

	for (const status of ["completed", "processing"] as const) {
		it(`acknowledges an exact ${status} report without a provider call`, async () => {
			const harness = createHarness(persistedReport(status, "zh-CN"));
			const handler = getHandlerFactory()(harness.dependencies);

			await handler([{ data: queuedReport("zh-CN") }]);

			assert.deepEqual(harness.store.claimCalls, []);
			assert.deepEqual(harness.processed, []);
			assert.equal(harness.row?.status, status);
		});
	}

	for (const status of ["pending", "failed"] as const) {
		it(`atomically claims and processes an exact ${status} report`, async () => {
			const harness = createHarness(persistedReport(status, "zh-CN"));
			const handler = getHandlerFactory()(harness.dependencies);

			await handler([{ data: queuedReport("zh-CN") }]);

			assert.equal(harness.row?.status, "processing");
			assert.equal(harness.row?.updatedAt.toISOString(), CLAIM_TOKEN.toISOString());
			assert.equal(harness.processed.length, 1);
			assert.deepEqual(harness.processed[0]?.claim, {
				reportId: REPORT_ID,
				outputLanguage: "zh-CN",
				token: CLAIM_TOKEN,
			});
			assert.equal(harness.processed[0]?.stateStore, harness.store);
		});
	}

	it("acknowledges a lost claim race without starting provider work", async () => {
		const harness = createHarness(persistedReport("pending", "en"));
		const row = harness.row;
		assert.ok(row);
		harness.store.claim = async (claim) => {
			harness.store.claimCalls.push(claim);
			row.status = "processing";
			row.updatedAt = new Date("2026-08-27T10:11:12.346Z");
			return false;
		};
		const handler = getHandlerFactory()(harness.dependencies);

		await handler([{ data: queuedReport("en") }]);

		assert.equal(harness.store.claimCalls.length, 1);
		assert.deepEqual(harness.processed, []);
	});

	it("acknowledges a claim lost during processing without logging a successful completion", async () => {
		const harness = createHarness(persistedReport("pending", "en"));
		harness.dependencies.processReport = async (job) => {
			harness.processed.push(job);
			return { success: false, reportId: REPORT_ID, outputLanguage: "en", lostClaim: true };
		};
		const handler = getHandlerFactory()(harness.dependencies);

		await handler([{ data: queuedReport("en") }]);

		assert.equal(harness.processed.length, 1);
		assert.equal(
			harness.logs.some((message) => message.includes("claim was lost")),
			true,
		);
		assert.equal(
			harness.logs.some((message) => message.includes("completed successfully")),
			false,
		);
	});

	it("rejects an unknown processing result without logging a successful completion", async () => {
		const harness = createHarness(persistedReport("pending", "en"));
		harness.dependencies.processReport = async (job) => {
			harness.processed.push(job);
			return {
				success: false,
				reportId: REPORT_ID,
				outputLanguage: "en",
				lostClaim: false,
			} as unknown as ReportProcessingResult;
		};
		const handler = getHandlerFactory()(harness.dependencies);

		await assert.rejects(handler([{ data: queuedReport("en") }]), /unexpected result/i);

		assert.equal(harness.processed.length, 1);
		assert.equal(
			harness.logs.some((message) => message.includes("completed successfully")),
			false,
		);
	});

	it("runs a legacy omitted job as English only when the persisted row is English", async () => {
		const harness = createHarness(persistedReport("pending", "en"));
		const handler = getHandlerFactory()(harness.dependencies);
		const data = queuedReport();

		await handler([{ data }]);

		assert.equal(harness.processed.length, 1);
		assert.deepEqual(harness.processed[0]?.data, {
			...data,
			outputLanguage: "en",
			competitorSnapshot: undefined,
			runsPerTargetOverride: undefined,
			expectedRunCount: undefined,
		});
		assert.equal(harness.processed[0]?.data.manualPrompts, data.manualPrompts);
	});

	it("fails a pending Simplified Chinese row for a legacy omitted English job", async () => {
		const harness = createHarness(persistedReport("pending", "zh-CN"));
		const handler = getHandlerFactory()(harness.dependencies);

		await handler([{ data: queuedReport() }]);

		assert.equal(harness.row?.status, "failed");
		assert.deepEqual(harness.processed, []);
	});

	it("propagates deterministic rejection write failures for pg-boss retry", async () => {
		const harness = createHarness(persistedReport("pending", "en"));
		const infrastructureFailure = new Error("database unavailable");
		harness.store.failPending = async () => {
			throw infrastructureFailure;
		};
		const handler = getHandlerFactory()(harness.dependencies);

		await assert.rejects(handler([{ data: queuedReport("CN") }]), infrastructureFailure);
		assert.deepEqual(harness.processed, []);
	});

	it("propagates persisted reads and atomic claim failures for pg-boss retry", async () => {
		const readHarness = createHarness(persistedReport("pending", "en"));
		const readFailure = new Error("read unavailable");
		readHarness.store.read = async () => {
			throw readFailure;
		};
		await assert.rejects(getHandlerFactory()(readHarness.dependencies)([{ data: queuedReport("en") }]), readFailure);

		const claimHarness = createHarness(persistedReport("pending", "en"));
		const claimFailure = new Error("claim unavailable");
		claimHarness.store.claim = async () => {
			throw claimFailure;
		};
		await assert.rejects(getHandlerFactory()(claimHarness.dependencies)([{ data: queuedReport("en") }]), claimFailure);

		assert.deepEqual(readHarness.processed, []);
		assert.deepEqual(claimHarness.processed, []);
	});
});
