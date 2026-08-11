import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
	assertExistingReportMatches,
	assessDatabaseReportCompletion,
	DATABASE_REPORT_TARGET,
	DatabaseReportRequestError,
	parseDatabaseReportCliOptions,
	parseDatabaseReportRequest,
	selectDeterministicPrompt,
} from "./database-report-request";

const REPORT_ID = "47eeb1e1-7a75-4a76-b1bb-324b87d93034";

const manifest = {
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
	it("keeps the checked-in Mentensor request on the reviewed contract", () => {
		const checkedIn = JSON.parse(
			readFileSync(resolve(__dirname, "report-requests/mentensor-real-20260811.json"), "utf8"),
		);
		assert.deepEqual(parseDatabaseReportRequest(checkedIn), manifest);
	});

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
				{ brandName: "Mentensor", brandWebsite: "https://mentensor.com" },
				{ brandName: "Mentensor", brandWebsite: "https://mentensor.com" },
			),
		);
	});

	it("rejects a UUID reused for another snapshot", () => {
		assert.throws(
			() =>
				assertExistingReportMatches(
					{ brandName: "Another", brandWebsite: "https://another.example" },
					{ brandName: "Mentensor", brandWebsite: "https://mentensor.com" },
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
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
				rawOutput: "not-json",
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
				rawOutput: { ...completedOutput, competitors: [] },
			}).healthy,
			false,
		);
		assert.equal(
			assessDatabaseReportCompletion({
				status: "completed",
				completedAt: new Date(),
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
});
