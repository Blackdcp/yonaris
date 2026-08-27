import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertExistingReportMatches,
	assessDatabaseReportCompletion,
	buildDatabaseReportSummary,
	DATABASE_REPORT_OUTPUT_LANGUAGE,
	DATABASE_REPORT_TARGET,
	type DatabaseReportRequest,
	DatabaseReportRequestError,
	parseDatabaseReportCliOptions,
	parseDatabaseReportRequest,
	selectDeterministicPrompt,
} from "./database-report-request";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";

const manifest: DatabaseReportRequest = {
	schemaVersion: 1,
	requestId: "mentensor-real-20260811",
	reportId: REPORT_ID,
	brand: { nameExact: "MemTensor" },
	scope: { keyExact: "legacy-unspecified" },
	promptSelection: { limit: 1, preferUnbranded: true },
	execution: { targets: [DATABASE_REPORT_TARGET], runsPerTarget: 1 },
};

describe("database report CLI input", () => {
	it("defaults to dry-run and supports mutually exclusive apply/status modes", () => {
		assert.deepEqual(parseDatabaseReportCliOptions(["--request-file", "request.json"]), {
			requestFile: "request.json",
			mode: "dry-run",
		});
		assert.equal(parseDatabaseReportCliOptions(["--request-file", "request.json", "--apply"]).mode, "apply");
		assert.equal(
			parseDatabaseReportCliOptions(["--status-only", "--request-file", "request.json"]).mode,
			"status-only",
		);
		assert.throws(
			() => parseDatabaseReportCliOptions(["--request-file", "request.json", "--apply", "--status-only"]),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "conflicting_mode",
		);
	});
});

describe("database report request manifest", () => {
	it("accepts only the fixed one-target, one-run legacy request", () => {
		assert.deepEqual(parseDatabaseReportRequest(manifest), manifest);
	});

	it("fails closed when target or run budget changes", () => {
		assert.throws(
			() =>
				parseDatabaseReportRequest({
					...manifest,
					execution: { targets: [DATABASE_REPORT_TARGET], runsPerTarget: 2 },
				}),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "invalid_execution_budget",
		);
		assert.throws(
			() =>
				parseDatabaseReportRequest({
					...manifest,
					execution: { targets: ["claude:brightdata:online"], runsPerTarget: 1 },
				}),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "invalid_execution_budget",
		);
	});

	it("rejects extra fields so a reviewed manifest cannot hide work", () => {
		assert.throws(
			() => parseDatabaseReportRequest({ ...manifest, manualPrompts: ["secret"] }),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "invalid_manifest_shape",
		);
		assert.throws(
			() => parseDatabaseReportRequest({ ...manifest, outputLanguage: "zh-CN" }),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "invalid_manifest_shape",
		);
	});
});

describe("database report receipt metadata", () => {
	it("reports schema-version-1 database work as explicit English", () => {
		assert.deepEqual(
			buildDatabaseReportSummary(manifest, {
				brandName: "MemTensor 原始品牌",
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
				promptCount: 1,
				competitorCount: 2,
				status: "completed",
				actualRuns: 1,
				createdAt: "2026-08-11T00:00:00.000Z",
				completedAt: "2026-08-11T00:01:00.000Z",
				updatedAt: "2026-08-11T00:01:00.000Z",
			}),
			{
				ok: true,
				requestId: "mentensor-real-20260811",
				reportId: REPORT_ID,
				brandName: "MemTensor 原始品牌",
				outputLanguage: "en",
				scopeKey: "legacy-unspecified",
				promptCount: 1,
				competitorCount: 2,
				target: "chatgpt:brightdata:online",
				expectedRuns: 1,
				status: "completed",
				actualRuns: 1,
				createdAt: "2026-08-11T00:00:00.000Z",
				completedAt: "2026-08-11T00:01:00.000Z",
				updatedAt: "2026-08-11T00:01:00.000Z",
			},
		);
	});
});

describe("deterministic report prompt selection", () => {
	it("prefers an enabled unbranded prompt and has a stable tie-break", () => {
		const candidates = [
			{
				id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				value: "How does Mentensor work?",
				tags: [],
				systemTags: ["branded"],
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
			{
				id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
				value: "What are useful AI evaluation platforms?",
				tags: [],
				systemTags: ["unbranded"],
				createdAt: new Date("2026-01-02T00:00:00Z"),
			},
			{
				id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
				value: "Which model evaluation tools should I compare?",
				tags: [],
				systemTags: ["unbranded"],
				createdAt: new Date("2026-01-02T00:00:00Z"),
			},
		];

		assert.equal(
			selectDeterministicPrompt(candidates, "Mentensor", "https://mentensor.com").id,
			"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		);
	});
});

describe("report UUID idempotency", () => {
	it("accepts the same frozen brand snapshot as a no-op", () => {
		assert.doesNotThrow(() =>
			assertExistingReportMatches(
				{
					brandName: "Mentensor",
					brandWebsite: "https://mentensor.com",
					outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
				},
				{
					brandName: "Mentensor",
					brandWebsite: "https://mentensor.com",
					outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
				},
			),
		);
	});

	it("rejects a UUID reused for another snapshot", () => {
		assert.throws(
			() =>
				assertExistingReportMatches(
					{
						brandName: "Another",
						brandWebsite: "https://another.example",
						outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
					},
					{
						brandName: "Mentensor",
						brandWebsite: "https://mentensor.com",
						outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
					},
				),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "report_id_conflict",
		);
	});

	it("rejects a UUID reused for a different output language", () => {
		assert.throws(
			() =>
				assertExistingReportMatches(
					{
						brandName: "Mentensor",
						brandWebsite: "https://mentensor.com",
						outputLanguage: "zh-CN",
					},
					{
						brandName: "Mentensor",
						brandWebsite: "https://mentensor.com",
						outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
					},
				),
			(error: unknown) => error instanceof DatabaseReportRequestError && error.code === "report_id_conflict",
		);
	});
});

describe("receipt replay completion checks", () => {
	const completedOutput = {
		competitors: [{ name: "Competitor", domain: "competitor.example" }],
		prompts: [{ value: "Test prompt" }],
		promptRuns: [
			{
				promptValue: "Test prompt",
				runs: [
					{
						model: "chatgpt",
						version: "brightdata",
						webSearchEnabled: true,
						rawOutput: {},
						webQueries: [],
						textContent: "Answer",
						brandMentioned: false,
						competitorsMentioned: [],
					},
				],
			},
		],
	};

	it("accepts a historical string payload only when it is a completed one-run report", () => {
		assert.deepEqual(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date("2026-08-11T00:00:00Z"),
				rawOutput: JSON.stringify(completedOutput),
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
			}),
			{ healthy: true, promptCount: 1, competitorCount: 1, actualRuns: 1 },
		);
	});

	it("fails closed for pending, malformed, empty-competitor, or multi-run output", () => {
		assert.equal(
			assessDatabaseReportCompletion({
				status: "processing",
				completedAt: null,
				rawOutput: completedOutput,
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
				rawOutput: "not-json",
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
				rawOutput: { ...completedOutput, competitors: [] },
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
				outputLanguage: DATABASE_REPORT_OUTPUT_LANGUAGE,
				rawOutput: {
					...completedOutput,
					promptRuns: [
						{
							...completedOutput.promptRuns[0],
							runs: [...completedOutput.promptRuns[0].runs, ...completedOutput.promptRuns[0].runs],
						},
					],
				},
			}).healthy,
			false,
		);
	});

	it("rejects an otherwise healthy schema-version-1 report stored as Chinese", () => {
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date("2026-08-11T00:00:00Z"),
				rawOutput: completedOutput,
				outputLanguage: "zh-CN",
			}).healthy,
			false,
		);
	});
});
