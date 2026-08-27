import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildManualReportCandidates,
	dispatchQueuedReportJobData,
	normalizeQueuedReportJobData,
	preserveProviderReportRun,
	ReportJobDataError,
} from "./report-job-data";

const queuedReport = {
	reportId: "47eeb1e1-7a75-4a76-b1bb-324b87d93034",
	brandName: "原始品牌 / Raw Brand",
	brandWebsite: "https://raw-brand.example/path?source=原始#unchanged",
	manualPrompts: ["  原始 Prompt / MiXeD Case ?  "],
	competitorSnapshot: [{ name: "原始竞品 / Raw Rival", domain: "raw-rival.example/path?x=1#id" }],
} as const;

describe("report queue ingress language", () => {
	it("normalizes only a legacy omission to English", () => {
		const normalized = normalizeQueuedReportJobData(queuedReport);

		assert.equal(normalized.outputLanguage, "en");
		assert.equal(normalized.manualPrompts, queuedReport.manualPrompts);
		assert.equal(normalized.competitorSnapshot, queuedReport.competitorSnapshot);
	});

	it("preserves an explicit Simplified Chinese token", () => {
		assert.equal(normalizeQueuedReportJobData({ ...queuedReport, outputLanguage: "zh-CN" }).outputLanguage, "zh-CN");
	});

	it("rejects every unsupported explicit token before returning work", () => {
		for (const outputLanguage of ["zh", "CN", "zh-SG", "unknown", null, 42]) {
			assert.throws(
				() => normalizeQueuedReportJobData({ ...queuedReport, outputLanguage }),
				(error: unknown) =>
					error instanceof ReportJobDataError &&
					error.code === "invalid_output_language" &&
					error.message === "Unsupported report output language. Expected en or zh-CN.",
			);
		}
	});

	it("rejects an invalid token before any downstream database or provider work", async () => {
		let downstreamCalls = 0;

		await assert.rejects(
			dispatchQueuedReportJobData({ ...queuedReport, outputLanguage: "zh-SG" }, async () => {
				downstreamCalls++;
			}),
			(error: unknown) => error instanceof ReportJobDataError && error.code === "invalid_output_language",
		);
		assert.equal(downstreamCalls, 0);
	});
});

describe("report raw evidence boundary", () => {
	it("passes manual Prompt bytes unchanged to classification and provider candidates", () => {
		const classified: string[] = [];
		const candidates = buildManualReportCandidates(queuedReport.manualPrompts, (prompt) => {
			classified.push(prompt);
			return false;
		});

		assert.deepEqual(classified, ["  原始 Prompt / MiXeD Case ?  "]);
		assert.deepEqual(candidates, [{ prompt: "  原始 Prompt / MiXeD Case ?  ", brandedPrompt: false }]);
	});

	it("preserves provider text, queries, URLs, citations, and IDs without translation", () => {
		const rawOutput = {
			answerId: "回答-ID-001",
			citation: {
				title: "原始标题 / Raw Title",
				url: "https://evidence.example/raw?query=原始#citation-id",
			},
		};
		const webQueries = ["原始检索词 / Raw Query", "https://search.example/?q=原始#query-id"];
		const textContent = "  原始回答 / MiXeD Answer  ";

		const stored = preserveProviderReportRun({
			model: "chatgpt",
			configuredVersion: "configured-version",
			provider: "stub",
			webSearchEnabled: true,
			result: {
				modelVersion: "provider-version",
				rawOutput,
				webQueries,
				textContent,
			},
			brandMentioned: false,
			competitorsMentioned: ["原始竞品 / Raw Rival"],
		});

		assert.equal(stored.rawOutput, rawOutput);
		assert.equal(stored.webQueries, webQueries);
		assert.equal(stored.textContent, textContent);
		assert.deepEqual(stored, {
			model: "chatgpt",
			version: "provider-version",
			webSearchEnabled: true,
			rawOutput,
			webQueries,
			textContent,
			brandMentioned: false,
			competitorsMentioned: ["原始竞品 / Raw Rival"],
		});
	});
});
