import assert from "node:assert/strict";
import test from "node:test";
import type { ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import {
	archivePromptResponseSnapshotBestEffort,
	assertPromptSnapshotCaptureConfiguration,
	buildPromptResponseSnapshotDraft,
	resolvePromptSnapshotCapturePolicy,
} from "./process-prompt-snapshot-policy";

const SNAPSHOT_SOURCE = {
	captureMethod: "brightdata_dataset" as const,
	contentSource: "native_answer_html" as const,
	answerHtml: "<article>Archived answer</article>",
	sourcePayloadSha256: "a".repeat(64),
};

test("snapshot capture is explicit and limited to providers that return a supported source", () => {
	assert.equal(
		resolvePromptSnapshotCapturePolicy({
			enabled: false,
			storageRoot: "/var/lib/yonaris/response-snapshots",
			snapshotSource: SNAPSHOT_SOURCE,
		}),
		null,
	);
	assert.equal(
		resolvePromptSnapshotCapturePolicy({
			enabled: true,
			storageRoot: "/var/lib/yonaris/response-snapshots",
			snapshotSource: undefined,
		}),
		null,
	);
	assert.deepEqual(
		resolvePromptSnapshotCapturePolicy({
			enabled: true,
			storageRoot: "/var/lib/yonaris/response-snapshots",
			snapshotSource: SNAPSHOT_SOURCE,
		}),
		{ storageRoot: "/var/lib/yonaris/response-snapshots" },
	);
});

test("snapshot capture fails closed when enabled without an absolute storage root", () => {
	assert.throws(
		() =>
			resolvePromptSnapshotCapturePolicy({
				enabled: true,
				storageRoot: "relative/snapshots",
				snapshotSource: SNAPSHOT_SOURCE,
			}),
		/Snapshot storage root must be an absolute path/,
	);
});

test("Bright Data configuration is rejected before a provider call when archive storage is unusable", () => {
	assert.throws(
		() =>
			assertPromptSnapshotCaptureConfiguration({
				enabled: true,
				provider: "brightdata",
				storageRoot: undefined,
			}),
		/Snapshot storage root must be an absolute path/,
	);
	assert.doesNotThrow(() =>
		assertPromptSnapshotCaptureConfiguration({ enabled: true, provider: "openai-api", storageRoot: undefined }),
	);
});

test("draft construction preserves Elmo inputs and represents unavailable fan-out without a fake query", () => {
	const draft = buildPromptResponseSnapshotDraft({
		promptRunId: "run-1",
		brandId: "stepfun",
		scopeId: "scope-1",
		promptId: "prompt-1",
		promptText: "Which AI assistant should I use?",
		answerText: "StepFun is one option.",
		citations: [{ url: "https://example.com/source", title: undefined, domain: "example.com", citationIndex: 0 }],
		webQueries: ["unavailable"],
		webSearchEnabled: true,
		brandMentioned: true,
		competitorsMentioned: ["Competitor"],
		channel: "chatgpt.consumer_web",
		modelVersion: "gpt-5",
		market: "US",
		locale: "en-US",
		timezone: "America/New_York",
		observedAt: new Date("2026-08-15T00:00:00.000Z"),
		snapshotSource: SNAPSHOT_SOURCE,
	});

	assert.equal(draft.queryAvailability, "unavailable");
	assert.deepEqual(draft.webQueries, []);
	assert.equal(draft.citations[0]?.title, null);
	assert.equal(draft.answerHtml, SNAPSHOT_SOURCE.answerHtml);
	assert.equal(draft.sourcePayloadSha256, SNAPSHOT_SOURCE.sourcePayloadSha256);
});

test("snapshot recording errors are isolated after the prompt run succeeds", async () => {
	let recorded = 0;
	const result = await archivePromptResponseSnapshotBestEffort(
		{
			reservation: { snapshotId: "snapshot-1", revision: 1, expiresAt: new Date("2026-11-13T00:00:00.000Z") },
			draft: { runId: "run-1" } as ResponseSnapshotDraft,
			storageRoot: "/var/lib/yonaris/response-snapshots",
		},
		{
			async record() {
				recorded += 1;
				throw new Error("disk unavailable");
			},
		},
	);

	assert.equal(recorded, 1);
	assert.deepEqual(result, { status: "retry_later", snapshotId: "snapshot-1" });
});

test("snapshot draft construction errors are isolated after the prompt run succeeds", async () => {
	const result = await archivePromptResponseSnapshotBestEffort({
		reservation: { snapshotId: "snapshot-1", revision: 1, expiresAt: new Date("2026-11-13T00:00:00.000Z") },
		draft() {
			throw new Error("invalid provider HTML");
		},
		storageRoot: "/var/lib/yonaris/response-snapshots",
	});

	assert.deepEqual(result, { status: "retry_later", snapshotId: "snapshot-1" });
});

test("snapshot recording reports ready without changing the saved prompt run", async () => {
	const result = await archivePromptResponseSnapshotBestEffort(
		{
			reservation: { snapshotId: "snapshot-1", revision: 1, expiresAt: new Date("2026-11-13T00:00:00.000Z") },
			draft: { runId: "run-1" } as ResponseSnapshotDraft,
			storageRoot: "/var/lib/yonaris/response-snapshots",
		},
		{
			async record() {
				return { status: "ready" as const, snapshotId: "snapshot-1", queued: true };
			},
		},
	);

	assert.deepEqual(result, { status: "ready", snapshotId: "snapshot-1" });
});
