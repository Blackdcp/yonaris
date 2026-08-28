import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	assertReadableResponseSnapshot,
	parseResponseSnapshotVisualEvidenceManifest,
	parseResponseSnapshotVisualEvidenceManifestV3,
	ResponseSnapshotAccessError,
	resolveResponseSnapshotActorAccess,
	responseSnapshotAccessAction,
} from "./response-snapshots";

describe("response snapshot customer access", () => {
	it("allows an own-brand customer and a global admin, but denies report operators", () => {
		expect(resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: false, hasBrandAccess: true })).toBe(
			"customer",
		);
		expect(resolveResponseSnapshotActorAccess({ isAdmin: true, isReportOperator: false, hasBrandAccess: false })).toBe(
			"platform_admin",
		);
		expect(() =>
			resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: true, hasBrandAccess: false }),
		).toThrowError(expect.objectContaining({ code: "forbidden" }));
	});

	it("uses a 404-safe boundary for cross-brand access", () => {
		expect(() =>
			resolveResponseSnapshotActorAccess({ isAdmin: false, isReportOperator: false, hasBrandAccess: false }),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
	});

	it("exposes only ready current filesystem snapshots", () => {
		const now = new Date("2026-08-20T00:00:00.000Z");
		const expiresAt = new Date("2026-11-18T00:00:00.000Z");
		expect(() =>
			assertReadableResponseSnapshot({
				status: "pending",
				isCurrent: true,
				storageBackend: null,
				storageKey: null,
				expiresAt,
				now,
			}),
		).toThrowError(expect.objectContaining({ code: "pending" }));
		expect(() =>
			assertReadableResponseSnapshot({
				status: "expired",
				isCurrent: true,
				storageBackend: null,
				storageKey: null,
				expiresAt,
				now,
			}),
		).toThrowError(expect.objectContaining({ code: "expired" }));
		expect(() =>
			assertReadableResponseSnapshot({
				status: "failed",
				isCurrent: true,
				storageBackend: null,
				storageKey: null,
				expiresAt,
				now,
			}),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
		expect(() =>
			assertReadableResponseSnapshot({
				status: "ready",
				isCurrent: false,
				storageBackend: "filesystem",
				storageKey: "2026/08/15/stepfun/run-1/r1",
				expiresAt,
				now,
			}),
		).toThrowError(expect.objectContaining({ code: "not_found" }));
		expect(
			assertReadableResponseSnapshot({
				status: "ready",
				isCurrent: true,
				storageBackend: "filesystem",
				storageKey: "2026/08/15/stepfun/run-1/r1",
				expiresAt,
				now,
			}),
		).toBe("2026/08/15/stepfun/run-1/r1");
		expect(() =>
			assertReadableResponseSnapshot({
				status: "ready",
				isCurrent: true,
				storageBackend: "filesystem",
				storageKey: "2026/08/15/stepfun/run-1/r1",
				expiresAt: now,
				now,
			}),
		).toThrowError(expect.objectContaining({ code: "expired" }));
	});

	it("has stable non-sensitive error codes", () => {
		const error = new ResponseSnapshotAccessError("not_found", "Snapshot is unavailable");
		expect(error).toMatchObject({ name: "ResponseSnapshotAccessError", code: "not_found" });
	});

	it("records screenshot previews and downloads as distinct audit actions", () => {
		expect(responseSnapshotAccessAction({ asset: "screenshot", download: false })).toBe("view_screenshot");
		expect(responseSnapshotAccessAction({ asset: "screenshot", download: true })).toBe("download_screenshot");
	});

	it("pins screenshot lookup to the authorized run, attempt, brand, and scope", () => {
		const source = readFileSync(new URL("./response-snapshots.ts", import.meta.url), "utf8");
		const lookup = source.slice(
			source.indexOf("export async function loadAuthorizedResponseSnapshotScreenshot"),
			source.indexOf("export function responseSnapshotAccessAction"),
		);

		expect(lookup).toContain("eq(promptRuns.id, snapshot.promptRunId)");
		expect(lookup).toContain("eq(promptRuns.observationAttemptId, evidenceArtifacts.observationAttemptId)");
		expect(lookup).toContain("eq(evidenceArtifacts.brandId, snapshot.brandId)");
		expect(lookup).toContain("eq(evidenceArtifacts.scopeId, snapshot.scopeId)");
		expect(lookup).toContain('eq(evidenceArtifacts.kind, "screenshot")');
		expect(lookup).toContain('eq(evidenceArtifacts.status, "attached")');
		expect(lookup).toContain('eq(evidenceArtifacts.mediaType, "image/jpeg")');
		expect(lookup).toContain('snapshot.schemaVersion !== "response-snapshot.v2"');
		expect(lookup).toContain("eq(evidenceArtifacts.id, expected.artifactId)");
	});

	it("binds customer screenshot bytes to the exact v2 manifest reference", () => {
		const manifest = {
			schemaVersion: "response-snapshot-manifest.v2",
			runId: "11111111-1111-4111-8111-111111111111",
			artifacts: {},
			visualEvidence: {
				artifactId: "22222222-2222-4222-8222-222222222222",
				mediaType: "image/jpeg",
				sha256: "a".repeat(64),
				bytes: 1_024,
			},
		};
		expect(
			parseResponseSnapshotVisualEvidenceManifest(
				new TextEncoder().encode(`${JSON.stringify(manifest)}\n`),
				manifest.runId,
			),
		).toEqual(manifest.visualEvidence);
		expect(() =>
			parseResponseSnapshotVisualEvidenceManifest(
				new TextEncoder().encode(`${JSON.stringify({ ...manifest, runId: "other-run" })}\n`),
				manifest.runId,
			),
		).toThrow(/manifest/i);
	});

	it("binds complete and partial v3 evidence to ordered manifest references", () => {
		const runId = "11111111-1111-4111-8111-111111111111";
		const first = {
			artifactId: "22222222-2222-4222-8222-222222222222",
			mediaType: "image/jpeg",
			sha256: "a".repeat(64),
			bytes: 1_024,
		};
		const second = { ...first, artifactId: "33333333-3333-4333-8333-333333333333", sha256: "b".repeat(64) };
		const primary = { ...first, artifactId: "44444444-4444-4444-8444-444444444444", sha256: "c".repeat(64) };
		const visualEvidence = {
			status: "complete",
			primary,
			segments: [first, second],
			expectedSegmentCount: 2,
			capturedSegmentCount: 2,
		};
		const manifest = {
			schemaVersion: "response-snapshot-manifest.v3",
			runId,
			artifacts: {},
			visualEvidence,
		};

		expect(
			parseResponseSnapshotVisualEvidenceManifestV3(new TextEncoder().encode(JSON.stringify(manifest)), runId),
		).toEqual(visualEvidence);
		expect(() =>
			parseResponseSnapshotVisualEvidenceManifestV3(
				new TextEncoder().encode(
					JSON.stringify({ ...manifest, visualEvidence: { ...visualEvidence, capturedSegmentCount: 1 } }),
				),
				runId,
			),
		).toThrow(/visual evidence/i);
	});
});
