import { describe, expect, it } from "vitest";
import {
	prepareResponseSnapshotBundle,
	type ResponseSnapshotDraft,
	type ResponseSnapshotDraftV2,
} from "../response-snapshots/contract";
import {
	buildReconstructedResponseSnapshotDraft,
	calculateResponseSnapshotExpiresAt,
	hydratePreparedResponseSnapshotBundle,
	isResponseSnapshotOutboxExpired,
	resolveReconstructedQueryEvidence,
	resolveResponseSnapshotEnqueueAction,
} from "./response-snapshots";

function bundle(answerText = "StepFun builds foundation models.") {
	const draft: ResponseSnapshotDraft = {
		runId: "11111111-1111-4111-8111-111111111111",
		brandId: "stepfun",
		scopeId: null,
		promptId: "33333333-3333-4333-8333-333333333333",
		promptText: "What is StepFun?",
		answerText,
		citations: [],
		webQueries: [],
		queryAvailability: "available",
		brandMentioned: true,
		competitorsMentioned: [],
		channel: "chatgpt",
		modelVersion: "consumer-web",
		market: "US",
		locale: "en-US",
		timezone: "America/New_York",
		observedAt: "2026-08-15T01:02:03.000Z",
		captureMethod: "brightdata_dataset",
		contentSource: "rendered_from_structured_response",
	};
	return prepareResponseSnapshotBundle(draft);
}

describe("response snapshot database policies", () => {
	it("uses an exact 90-day retention period from observedAt", () => {
		const observedAt = new Date("2026-08-15T01:02:03.000Z");
		expect(calculateResponseSnapshotExpiresAt(observedAt).toISOString()).toBe("2026-11-13T01:02:03.000Z");
	});

	it("populates an empty reservation, reuses identical bytes and creates a revision for conflicting bytes", () => {
		const first = bundle();
		expect(resolveResponseSnapshotEnqueueAction(null, first)).toBe("populate_reservation");
		expect(
			resolveResponseSnapshotEnqueueAction(
				{
					htmlSha256: first.htmlSha256,
					jsonSha256: first.jsonSha256,
					manifestSha256: first.manifestSha256,
				},
				first,
			),
		).toBe("reuse_revision");
		expect(
			resolveResponseSnapshotEnqueueAction(
				{
					htmlSha256: first.htmlSha256,
					jsonSha256: first.jsonSha256,
					manifestSha256: first.manifestSha256,
				},
				bundle("A materially different answer."),
			),
		).toBe("create_revision");
		expect(
			resolveResponseSnapshotEnqueueAction(
				{
					status: "failed",
					htmlSha256: first.htmlSha256,
					jsonSha256: first.jsonSha256,
					manifestSha256: first.manifestSha256,
				},
				first,
			),
		).toBe("create_revision");
	});

	it("treats the outbox expiry boundary as end-exclusive", () => {
		const expiresAt = new Date("2026-08-16T00:00:00.000Z");
		expect(isResponseSnapshotOutboxExpired(expiresAt, new Date("2026-08-15T23:59:59.999Z"))).toBe(false);
		expect(isResponseSnapshotOutboxExpired(expiresAt, expiresAt)).toBe(true);
	});

	it("hydrates a queued v2 bundle for durable storage retry", () => {
		const draft: ResponseSnapshotDraftV2 = {
			schemaVersion: "response-snapshot.v2",
			runId: "11111111-1111-4111-8111-111111111111",
			brandId: "ppio",
			scopeId: "22222222-2222-4222-8222-222222222222",
			promptId: "33333333-3333-4333-8333-333333333333",
			promptText: "What is PPIO?",
			answerText: "PPIO provides cloud computing services.",
			citations: [],
			webQueries: [],
			queryAvailability: "unavailable",
			brandMentioned: true,
			competitorsMentioned: [],
			channel: "doubao.consumer_web",
			modelVersion: "consumer-web",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			observedAt: "2026-08-20T01:02:03.000Z",
			captureMethod: "consumer_web_browser",
			contentSource: "rendered_from_structured_response",
			visualEvidence: {
				artifactId: "44444444-4444-4444-8444-444444444444",
				mediaType: "image/jpeg",
				sha256: "a".repeat(64),
				bytes: 1_024,
			},
			adapterVersion: "doubao-web-20260821-localpc-v13",
			captureDiagnostics: {
				answerCount: 1,
				queryCount: 0,
				citationCount: 0,
				completionCount: 1,
				extractorVersion: "doubao-search-evidence.v1",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 0,
			},
		};
		const prepared = prepareResponseSnapshotBundle(draft);

		const hydrated = hydratePreparedResponseSnapshotBundle(
			{
				promptRunId: prepared.runId,
				brandId: prepared.brandId,
				observedAt: new Date(prepared.observedAt),
				contentSource: prepared.contentSource,
				captureMethod: prepared.captureMethod,
				schemaVersion: prepared.schemaVersion,
				templateVersion: prepared.templateVersion,
				sourcePayloadSha256: prepared.sourcePayloadSha256,
				htmlSha256: prepared.htmlSha256,
				jsonSha256: prepared.jsonSha256,
				manifestSha256: prepared.manifestSha256,
				htmlBytes: prepared.htmlBytes,
				jsonBytes: prepared.jsonBytes,
				manifestBytes: prepared.manifestBytes,
				htmlGzipBytes: prepared.htmlGzipBytes,
				jsonGzipBytes: prepared.jsonGzipBytes,
			},
			{
				htmlGzip: prepared.htmlGzip,
				jsonGzip: prepared.jsonGzip,
				manifestJson: prepared.manifestJson,
			},
		);

		expect(hydrated.schemaVersion).toBe("response-snapshot.v2");
		expect(hydrated.templateVersion).toBe("response-snapshot-html.v2");
		expect(hydrated.htmlGzip).toEqual(prepared.htmlGzip);
		expect(hydrated.jsonGzip).toEqual(prepared.jsonGzip);
		expect(hydrated.manifestJson).toEqual(prepared.manifestJson);
	});

	it("reconstructs a stale v2 reservation from durable observation metadata and its attached JPEG", () => {
		const reconstructed = buildReconstructedResponseSnapshotDraft({
			base: {
				runId: "11111111-1111-4111-8111-111111111111",
				brandId: "ppio",
				scopeId: "22222222-2222-4222-8222-222222222222",
				promptId: "33333333-3333-4333-8333-333333333333",
				promptText: "What is PPIO?",
				answerText: "PPIO provides cloud computing services.",
				citations: [],
				webQueries: [],
				queryAvailability: "unavailable",
				brandMentioned: true,
				competitorsMentioned: [],
				channel: "doubao.consumer_web",
				modelVersion: "consumer-web",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
				observedAt: "2026-08-20T01:02:03.000Z",
			},
			captureMetadata: {
				responseSnapshotSchemaVersion: "response-snapshot.v2",
				adapterVersion: "doubao-web-20260821-localpc-v13",
				queryAvailability: "unknown",
				captureDiagnostics: {
					answerCount: 1,
					queryCount: 0,
					citationCount: 0,
					completionCount: 1,
					extractorVersion: "doubao-search-evidence.v1",
					evidenceSource: "dom",
					searchBlockCount: 1,
					queryCandidateCount: 0,
					citationCandidateCount: 0,
				},
			},
			visualEvidence: [
				{
					artifactId: "44444444-4444-4444-8444-444444444444",
					mediaType: "image/jpeg",
					sha256: "a".repeat(64),
					bytes: 1_024,
				},
			],
		});

		expect(reconstructed).toMatchObject({
			schemaVersion: "response-snapshot.v2",
			captureMethod: "consumer_web_browser",
			contentSource: "rendered_from_structured_response",
			adapterVersion: "doubao-web-20260821-localpc-v13",
			queryAvailability: "unknown",
			visualEvidence: { artifactId: "44444444-4444-4444-8444-444444444444" },
		});
		expect(() =>
			buildReconstructedResponseSnapshotDraft({
				base: reconstructed,
				captureMetadata: {
					responseSnapshotSchemaVersion: "response-snapshot.v2",
					adapterVersion: "doubao-web-20260821-localpc-v13",
					queryAvailability: "unknown",
					captureDiagnostics: {
						answerCount: 1,
						queryCount: 0,
						citationCount: 0,
						completionCount: 1,
						extractorVersion: "doubao-search-evidence.v1",
						evidenceSource: "dom",
						searchBlockCount: 1,
						queryCandidateCount: 0,
						citationCandidateCount: 0,
					},
				},
				visualEvidence: [],
			}),
		).toThrow(/exactly one attached JPEG/i);
	});

	it("reconstructs ordered complete v3 evidence and rejects missing referenced artifacts", () => {
		const primaryId = "44444444-4444-4444-8444-444444444444";
		const firstId = "55555555-5555-4555-8555-555555555555";
		const secondId = "66666666-6666-4666-8666-666666666666";
		const base = {
			runId: "11111111-1111-4111-8111-111111111111",
			brandId: "ppio",
			scopeId: "22222222-2222-4222-8222-222222222222",
			promptId: "33333333-3333-4333-8333-333333333333",
			promptText: "What is PPIO?",
			answerText: "PPIO provides cloud computing services.",
			citations: [],
			webQueries: [],
			queryAvailability: "unavailable" as const,
			brandMentioned: true,
			competitorsMentioned: [],
			channel: "doubao.consumer_web",
			modelVersion: "consumer-web",
			market: "CN",
			locale: "zh-CN",
			timezone: "Asia/Shanghai",
			observedAt: "2026-08-20T01:02:03.000Z",
		};
		const captureMetadata = {
			responseSnapshotSchemaVersion: "response-snapshot.v3",
			adapterVersion: "doubao-web-20260828-localpc-v14",
			queryAvailability: "unknown",
			captureDiagnostics: {
				answerCount: 1,
				queryCount: 0,
				citationCount: 0,
				completionCount: 1,
				extractorVersion: "doubao-search-evidence.v1",
				evidenceSource: "dom",
				searchBlockCount: 1,
				queryCandidateCount: 0,
				citationCandidateCount: 0,
			},
			visualEvidence: {
				status: "complete",
				primaryArtifactId: primaryId,
				segmentArtifactIds: [firstId, secondId],
				expectedSegmentCount: 2,
				capturedSegmentCount: 2,
			},
		};
		const artifacts = [
			{ artifactId: secondId, mediaType: "image/jpeg", sha256: "c".repeat(64), bytes: 2_048 },
			{ artifactId: primaryId, mediaType: "image/jpeg", sha256: "a".repeat(64), bytes: 4_096 },
			{ artifactId: firstId, mediaType: "image/jpeg", sha256: "b".repeat(64), bytes: 1_024 },
		];

		const reconstructed = buildReconstructedResponseSnapshotDraft({ base, captureMetadata, visualEvidence: artifacts });

		expect(reconstructed).toMatchObject({
			schemaVersion: "response-snapshot.v3",
			visualEvidence: {
				status: "complete",
				primary: { artifactId: primaryId },
				segments: [{ artifactId: firstId }, { artifactId: secondId }],
			},
		});
		expect(() =>
			buildReconstructedResponseSnapshotDraft({ base, captureMetadata, visualEvidence: artifacts.slice(0, 2) }),
		).toThrow(/JPEG metadata/i);
	});

	it("does not expose the unavailable query sentinel while reconstructing a stale provider snapshot", () => {
		expect(resolveReconstructedQueryEvidence(["unavailable"], true, true)).toEqual({
			webQueries: [],
			queryAvailability: "unavailable",
		});
		expect(resolveReconstructedQueryEvidence(["real fan-out", "unavailable"], true, true)).toEqual({
			webQueries: [],
			queryAvailability: "unavailable",
		});
		expect(resolveReconstructedQueryEvidence([], false, null)).toEqual({
			webQueries: [],
			queryAvailability: "not_applicable",
		});
		expect(resolveReconstructedQueryEvidence([], true, false)).toEqual({
			webQueries: [],
			queryAvailability: "not_applicable",
		});
	});
});
