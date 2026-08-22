import assert from "node:assert/strict";
import test from "node:test";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft } from "@workspace/lib/response-snapshots/contract";
import { normalizeResponseSnapshotCitationTitle } from "../response-snapshot-citation-policy";
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

test("draft construction normalizes query evidence without exposing a sentinel", () => {
	for (const { webQueries, webSearchEnabled, webSearchObserved, expectedAvailability } of [
		{
			webQueries: ["unavailable"],
			webSearchEnabled: true,
			webSearchObserved: true,
			expectedAvailability: "unavailable",
		},
		{ webQueries: [], webSearchEnabled: true, webSearchObserved: null, expectedAvailability: "unavailable" },
		{ webQueries: [], webSearchEnabled: true, webSearchObserved: false, expectedAvailability: "not_applicable" },
		{
			webQueries: ["unexpected query"],
			webSearchEnabled: false,
			webSearchObserved: null,
			expectedAvailability: "not_applicable",
		},
	] as const) {
		const draft = buildPromptResponseSnapshotDraft({
			promptRunId: "run-1",
			brandId: "stepfun",
			scopeId: "scope-1",
			promptId: "prompt-1",
			promptText: "Which AI assistant should I use?",
			answerText: "StepFun is one option.",
			citations: [{ url: "https://example.com/source", title: undefined, domain: "example.com", citationIndex: 0 }],
			webQueries: [...webQueries],
			webSearchEnabled,
			webSearchObserved,
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

		assert.equal(draft.queryAvailability, expectedAvailability);
		assert.deepEqual(draft.webQueries, []);
		assert.equal(draft.citations[0]?.title, null);
		assert.equal(draft.answerHtml, SNAPSHOT_SOURCE.answerHtml);
		assert.equal(draft.sourcePayloadSha256, SNAPSHOT_SOURCE.sourcePayloadSha256);
	}
});

test("draft construction safely bounds provider citation titles before snapshot validation", () => {
	const draft = buildPromptResponseSnapshotDraft({
		promptRunId: "run-long-citation-title",
		brandId: "ppio",
		scopeId: "global-market",
		promptId: "prompt-1",
		promptText: "Which infrastructure providers support AI workloads?",
		answerText: "PPIO is one provider.",
		citations: [
			{
				url: "https://example.com/source",
				title: "x".repeat(1_194),
				domain: "example.com",
				citationIndex: 0,
			},
		],
		webQueries: [],
		webSearchEnabled: true,
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "google-ai-mode.consumer_web",
		modelVersion: "google-ai-mode",
		market: "US",
		locale: "en-US",
		timezone: "UTC",
		observedAt: new Date("2026-08-18T00:00:00.000Z"),
		snapshotSource: SNAPSHOT_SOURCE,
	});

	assert.equal(draft.citations[0]?.title?.length, 1_000);
	assert.doesNotThrow(() => prepareResponseSnapshotBundle(draft));
});

test("citation title normalization preserves valid values and never splits a surrogate pair", () => {
	assert.equal(normalizeResponseSnapshotCitationTitle("  Source title  "), "Source title");
	assert.equal(normalizeResponseSnapshotCitationTitle("   "), null);
	assert.equal(normalizeResponseSnapshotCitationTitle("x".repeat(1_000)), "x".repeat(1_000));

	const bounded = normalizeResponseSnapshotCitationTitle(`${"x".repeat(999)}😀tail`);
	assert.equal(bounded, "x".repeat(999));
	assert.ok((bounded?.length ?? 0) <= 1_000);
});

test("native HTML at the four-megabyte raw boundary falls back after final bundle validation", () => {
	const draft = buildPromptResponseSnapshotDraft({
		promptRunId: "run-oversized-native-html",
		brandId: "ppio",
		scopeId: "global-market",
		promptId: "prompt-1",
		promptText: "Which infrastructure providers support AI workloads?",
		answerText: "PPIO is one provider.",
		citations: [{ url: "https://example.com/source", title: "Source", domain: "example.com", citationIndex: 0 }],
		webQueries: ["unavailable"],
		webSearchEnabled: true,
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "google-ai-mode.consumer_web",
		modelVersion: "google-ai-mode",
		market: "US",
		locale: "en-US",
		timezone: "UTC",
		observedAt: new Date("2026-08-18T00:00:00.000Z"),
		snapshotSource: {
			...SNAPSHOT_SOURCE,
			answerHtml: "x".repeat(4 * 1024 * 1024),
		},
	});

	assert.equal(draft.contentSource, "rendered_from_structured_response");
	assert.equal(draft.answerHtml, undefined);
	assert.doesNotThrow(() => prepareResponseSnapshotBundle(draft));
});

test("sanitizer-expanded native HTML falls back after final bundle validation", () => {
	const draft = buildPromptResponseSnapshotDraft({
		promptRunId: "run-sanitizer-expanded-native-html",
		brandId: "ppio",
		scopeId: "global-market",
		promptId: "prompt-1",
		promptText: "Which infrastructure providers support AI workloads?",
		answerText: "PPIO is one provider.",
		citations: [{ url: "https://example.com/source", title: "Source", domain: "example.com", citationIndex: 0 }],
		webQueries: ["unavailable"],
		webSearchEnabled: true,
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "google-ai-mode.consumer_web",
		modelVersion: "google-ai-mode",
		market: "US",
		locale: "en-US",
		timezone: "UTC",
		observedAt: new Date("2026-08-18T00:00:00.000Z"),
		snapshotSource: {
			...SNAPSHOT_SOURCE,
			answerHtml: `<article>${"&".repeat(900_000)}</article>`,
		},
	});

	assert.equal(draft.contentSource, "rendered_from_structured_response");
	assert.equal(draft.answerHtml, undefined);
	assert.doesNotThrow(() => prepareResponseSnapshotBundle(draft));
});

test("native HTML fallback does not swallow unrelated response snapshot contract errors", () => {
	assert.throws(
		() =>
			buildPromptResponseSnapshotDraft({
				promptRunId: "run-invalid-contract",
				brandId: "ppio",
				scopeId: "global-market",
				promptId: "prompt-1",
				promptText: "Which infrastructure providers support AI workloads?",
				answerText: "PPIO is one provider.",
				citations: [],
				webQueries: [],
				webSearchEnabled: false,
				brandMentioned: true,
				competitorsMentioned: [],
				channel: "google-ai-mode.consumer_web",
				modelVersion: "google-ai-mode",
				market: "US",
				locale: "en-US",
				timezone: "UTC",
				observedAt: new Date("2026-08-18T00:00:00.000Z"),
				snapshotSource: { ...SNAPSHOT_SOURCE, sourcePayloadSha256: "not-a-sha" },
			}),
		/sourcePayloadSha256/,
	);
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
