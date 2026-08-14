import { describe, expect, it } from "vitest";
import { prepareResponseSnapshotBundle, type ResponseSnapshotDraft } from "../response-snapshots/contract";
import {
	calculateResponseSnapshotExpiresAt,
	isResponseSnapshotOutboxExpired,
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
});
