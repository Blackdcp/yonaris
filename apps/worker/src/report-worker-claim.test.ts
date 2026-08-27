import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelConfig } from "@workspace/lib/providers";
import type { ReportExecutionClaim, ReportExecutionStatus, ReportExecutionStore } from "./report-execution-store";
import { createProcessReportJob } from "./report-worker";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";
const CLAIM_TOKEN = new Date("2026-08-27T10:11:12.345Z");
const FINISHED_AT = new Date("2026-08-27T10:12:00.000Z");
const claim: ReportExecutionClaim = { reportId: REPORT_ID, outputLanguage: "zh-CN", token: CLAIM_TOKEN };

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

const scrapeConfig: ModelConfig = {
	provider: "test-provider",
	model: "test-model",
	version: "schema-v1",
	webSearch: true,
};

function job(row: MemoryRow) {
	return {
		data: {
			reportId: REPORT_ID,
			brandName: "原始品牌 / Raw Brand",
			brandWebsite: "https://raw-brand.example/path?source=原始#unchanged",
			outputLanguage: "zh-CN" as const,
			manualPrompts: ["  原始 Prompt / MiXeD Case ?  "],
			competitorSnapshot: [{ name: "竞品 / Competitor", domain: "competitor.example" }],
			runsPerTargetOverride: 1,
			expectedRunCount: 1,
		},
		claim,
		stateStore: memoryStore(row),
		log: () => undefined,
	};
}

describe("processReportJob claim wiring", () => {
	it("runs the provider once and atomically persists raw evidence under the current claim", async () => {
		const row = claimedRow();
		const rawOutput = { untouched: "原始字节语义 / RAW" };
		let providerCalls = 0;
		const processReportJob = createProcessReportJob({
			analyzeBrand: async () => {
				throw new Error("manual snapshot path must not analyze the brand");
			},
			parseScrapeTargets: () => [scrapeConfig],
			getProvider: () => ({
				run: async () => {
					providerCalls += 1;
					return {
						modelVersion: "provider-raw-v1",
						rawOutput,
						webQueries: [" 原始 Query "],
						textContent: "Raw Brand and Competitor",
						citations: [],
					};
				},
			}),
			now: () => new Date(FINISHED_AT),
		});

		const result = await processReportJob(job(row));

		assert.deepEqual(result, { success: true, reportId: REPORT_ID, outputLanguage: "zh-CN" });
		assert.equal(providerCalls, 1);
		assert.equal(row.status, "completed");
		assert.equal(row.progress, 100);
		const persisted = row.rawOutput as {
			promptRuns: Array<{ promptValue: string; runs: Array<{ rawOutput: unknown; webQueries: string[] }> }>;
		};
		assert.equal(persisted.promptRuns[0]?.promptValue, "  原始 Prompt / MiXeD Case ?  ");
		assert.equal(persisted.promptRuns[0]?.runs[0]?.rawOutput, rawOutput);
		assert.deepEqual(persisted.promptRuns[0]?.runs[0]?.webQueries, [" 原始 Query "]);
	});

	it("conditionally fails the current claim and rethrows the provider error", async () => {
		const row = claimedRow();
		const providerError = new Error("provider unavailable");
		const processReportJob = createProcessReportJob({
			analyzeBrand: async () => {
				throw new Error("manual snapshot path must not analyze the brand");
			},
			parseScrapeTargets: () => [scrapeConfig],
			getProvider: () => ({ run: async () => Promise.reject(providerError) }),
			now: () => new Date(FINISHED_AT),
		});

		await assert.rejects(processReportJob(job(row)), providerError);

		assert.equal(row.status, "failed");
		assert.equal(row.rawOutput, null);
	});

	it("keeps the claim processing until every already-started provider call settles", async () => {
		const row = claimedRow();
		const providerError = new Error("fast provider failure");
		let releaseInnerSibling!: () => void;
		let releaseOuterSibling!: () => void;
		let markInnerSiblingStarted!: () => void;
		let markOuterSiblingStarted!: () => void;
		const innerSiblingStarted = new Promise<void>((resolve) => {
			markInnerSiblingStarted = resolve;
		});
		const outerSiblingStarted = new Promise<void>((resolve) => {
			markOuterSiblingStarted = resolve;
		});
		type ProviderResult = {
			modelVersion: string;
			rawOutput: { untouched: string };
			webQueries: string[];
			textContent: string;
			citations: never[];
		};
		const result = (label: string): ProviderResult => ({
			modelVersion: `${label}-v1`,
			rawOutput: { untouched: `${label} raw evidence` },
			webQueries: [`${label} raw query`],
			textContent: "Raw Brand",
			citations: [],
		});
		const innerSiblingResult = new Promise<ProviderResult>((resolve) => {
			releaseInnerSibling = () => resolve(result("inner-slow"));
		});
		const outerSiblingResult = new Promise<ProviderResult>((resolve) => {
			releaseOuterSibling = () =>
				resolve({
					...result("outer-slow"),
				});
		});
		const processReportJob = createProcessReportJob({
			analyzeBrand: async () => {
				throw new Error("manual snapshot path must not analyze the brand");
			},
			parseScrapeTargets: () => [
				{ ...scrapeConfig, provider: "fast-provider", model: "fast-model" },
				{ ...scrapeConfig, provider: "slow-provider", model: "slow-model" },
			],
			getProvider: (provider) => ({
				run: async (_model, promptValue) => {
					if (promptValue === "Outer slow Prompt") {
						if (provider === "fast-provider") return result("outer-fast");
						markOuterSiblingStarted();
						return outerSiblingResult;
					}
					if (provider === "fast-provider") throw providerError;
					markInnerSiblingStarted();
					return innerSiblingResult;
				},
			}),
			now: () => new Date(FINISHED_AT),
		});
		const concurrentJob = job(row);
		concurrentJob.data.manualPrompts = ["Fast failing Prompt", "Outer slow Prompt"];

		let observedError: unknown;
		let settled = false;
		const processing = processReportJob(concurrentJob).then(
			() => {
				settled = true;
			},
			(error) => {
				settled = true;
				observedError = error;
			},
		);

		await Promise.all([innerSiblingStarted, outerSiblingStarted]);
		await new Promise<void>((resolve) => setImmediate(resolve));
		try {
			assert.equal(settled, false, "each Prompt must wait for its already-started sibling model call");
			assert.equal(row.status, "processing", "retry must not be able to claim while paid work remains in flight");

			releaseInnerSibling();
			await new Promise<void>((resolve) => setImmediate(resolve));
			assert.equal(settled, false, "the candidate batch must wait for its already-started sibling Prompt");
			assert.equal(row.status, "processing", "the outer batch must retain its claim while paid work remains in flight");
		} finally {
			releaseInnerSibling();
			releaseOuterSibling();
			await processing;
		}

		assert.equal(observedError, providerError);
		assert.equal(row.status, "failed");
	});

	it("rethrows the first observed provider rejection after every started provider settles", async () => {
		const row = claimedRow();
		const laterInputOrderError = new Error("lower-index provider failed later");
		const firstObservedError = new Error("higher-index provider failed first");
		let rejectLowerIndex!: (error: Error) => void;
		let rejectHigherIndex!: (error: Error) => void;
		let markLowerIndexStarted!: () => void;
		let markHigherIndexStarted!: () => void;
		const lowerIndexStarted = new Promise<void>((resolve) => {
			markLowerIndexStarted = resolve;
		});
		const higherIndexStarted = new Promise<void>((resolve) => {
			markHigherIndexStarted = resolve;
		});
		const lowerIndexResult = new Promise<never>((_resolve, reject) => {
			rejectLowerIndex = reject;
		});
		const higherIndexResult = new Promise<never>((_resolve, reject) => {
			rejectHigherIndex = reject;
		});
		const processReportJob = createProcessReportJob({
			analyzeBrand: async () => {
				throw new Error("manual snapshot path must not analyze the brand");
			},
			parseScrapeTargets: () => [
				{ ...scrapeConfig, provider: "lower-index-provider", model: "lower-index-model" },
				{ ...scrapeConfig, provider: "higher-index-provider", model: "higher-index-model" },
			],
			getProvider: (provider) => ({
				run: async () => {
					if (provider === "lower-index-provider") {
						markLowerIndexStarted();
						return lowerIndexResult;
					}
					markHigherIndexStarted();
					return higherIndexResult;
				},
			}),
			now: () => new Date(FINISHED_AT),
		});

		let observedError: unknown;
		let settled = false;
		const processing = processReportJob(job(row)).then(
			() => {
				settled = true;
			},
			(error) => {
				settled = true;
				observedError = error;
			},
		);

		await Promise.all([lowerIndexStarted, higherIndexStarted]);
		rejectHigherIndex(firstObservedError);
		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.equal(settled, false, "the claim must remain active until the lower-index sibling also settles");
		assert.equal(row.status, "processing");

		rejectLowerIndex(laterInputOrderError);
		await processing;

		assert.equal(observedError, firstObservedError);
		assert.equal(row.status, "failed");
	});
});
