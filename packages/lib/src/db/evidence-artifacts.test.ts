import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	buildEvidenceArtifactReference,
	EVIDENCE_ARTIFACT_MAX_BYTES,
	EVIDENCE_BATCH_MAX_BYTES,
	EVIDENCE_STAGED_CLEANUP_BATCH_SIZE,
	EvidenceArtifactValidationError,
	type EvidenceArtifactView,
	isEvidenceByteCapacityAvailable,
	isStagedEvidenceArtifactCleanupEligible,
	prepareEvidenceArtifact,
} from "./evidence-artifacts";

describe("evidence artifact validation", () => {
	it.each([
		{
			name: "PNG",
			content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
			kind: "screenshot",
			mediaType: "image/png",
		},
		{
			name: "JPEG",
			content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd9]),
			kind: "screenshot",
			mediaType: "image/jpeg",
		},
		{
			name: "WebP",
			content: Buffer.from("RIFF0000WEBPpayload", "ascii"),
			kind: "screenshot",
			mediaType: "image/webp",
		},
		{
			name: "PDF",
			content: Buffer.from("%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n", "ascii"),
			kind: "page_snapshot",
			mediaType: "application/pdf",
		},
	] as const)("accepts $name by magic bytes and computes its digest", ({ content, kind, mediaType }) => {
		const prepared = prepareEvidenceArtifact(content);

		expect(prepared.kind).toBe(kind);
		expect(prepared.mediaType).toBe(mediaType);
		expect(prepared.byteSize).toBe(content.byteLength);
		expect(prepared.sha256).toBe(createHash("sha256").update(content).digest("hex"));
	});

	it.each([
		["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
		["HTML", Buffer.from("<!doctype html><title>not evidence</title>")],
		["video", Buffer.from("....ftypmp42video")],
		["truncated PDF", Buffer.from("%PDF-1.7\nmissing eof")],
	])("rejects %s content", (_name, content) => {
		expect(() => prepareEvidenceArtifact(content)).toThrowError(
			expect.objectContaining({ name: "EvidenceArtifactValidationError", code: "unsupported_media" }),
		);
	});

	it("accepts strict UTF-8 HTML only as an explicitly declared page snapshot", () => {
		const html = Buffer.from("  <!doctype html><html><body>captured page</body></html>", "utf8");
		const prepared = prepareEvidenceArtifact(html, "page_snapshot");

		expect(prepared.kind).toBe("page_snapshot");
		expect(prepared.mediaType).toBe("text/html");
		expect(() => prepareEvidenceArtifact(html)).toThrowError(expect.objectContaining({ code: "unsupported_media" }));
		expect(() => prepareEvidenceArtifact(html, "screenshot")).toThrowError(
			expect.objectContaining({ code: "unsupported_media" }),
		);
	});

	it("rejects malformed or binary HTML page snapshots", () => {
		expect(() =>
			prepareEvidenceArtifact(Buffer.from("<title>missing document root</title>"), "page_snapshot"),
		).toThrowError(expect.objectContaining({ code: "unsupported_media" }));
		expect(() =>
			prepareEvidenceArtifact(Buffer.from([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x00]), "page_snapshot"),
		).toThrowError(expect.objectContaining({ code: "unsupported_media" }));
		expect(() =>
			prepareEvidenceArtifact(Buffer.from([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0xff]), "page_snapshot"),
		).toThrowError(expect.objectContaining({ code: "unsupported_media" }));
	});

	it("rejects content above the artifact limit", () => {
		const content = Buffer.alloc(EVIDENCE_ARTIFACT_MAX_BYTES + 1);
		content.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

		expect(() => prepareEvidenceArtifact(content)).toThrowError(expect.objectContaining({ code: "too_large" }));
	});

	it("rejects an operator kind that disagrees with the file", () => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

		expect(() => prepareEvidenceArtifact(png, "page_snapshot")).toThrowError(
			expect.objectContaining({ code: "kind_mismatch" }),
		);
	});

	it("enforces the delivery-batch byte boundary without an overflow gap", () => {
		expect(isEvidenceByteCapacityAvailable(EVIDENCE_BATCH_MAX_BYTES - 1, 1, EVIDENCE_BATCH_MAX_BYTES)).toBe(true);
		expect(isEvidenceByteCapacityAvailable(EVIDENCE_BATCH_MAX_BYTES, 1, EVIDENCE_BATCH_MAX_BYTES)).toBe(false);
		expect(isEvidenceByteCapacityAvailable(-1, 1, EVIDENCE_BATCH_MAX_BYTES)).toBe(false);
	});

	it("bounds one staged cleanup pass to 400 MiB at the per-artifact maximum", () => {
		expect(EVIDENCE_STAGED_CLEANUP_BATCH_SIZE).toBe(50);
		expect(EVIDENCE_STAGED_CLEANUP_BATCH_SIZE * EVIDENCE_ARTIFACT_MAX_BYTES).toBe(400 * 1024 * 1024);
	});

	it("cleans expired or superseded staged evidence without deleting the active heartbeat generation", () => {
		const now = new Date("2026-08-11T12:00:00.000Z");
		const before = new Date("2026-08-10T12:00:00.000Z");
		const staleArtifact = {
			status: "staged" as const,
			createdAt: new Date("2026-08-10T11:59:59.999Z"),
			leaseGeneration: 4,
			taskStatus: "claimed" as const,
			taskLeaseGeneration: 4,
			taskLeaseExpiresAt: new Date("2026-08-11T12:05:00.000Z"),
		};

		expect(isStagedEvidenceArtifactCleanupEligible(staleArtifact, { before, now })).toBe(false);
		expect(
			isStagedEvidenceArtifactCleanupEligible(
				{ ...staleArtifact, taskLeaseExpiresAt: new Date("2026-08-11T12:00:00.000Z") },
				{ before, now },
			),
		).toBe(true);
		expect(
			isStagedEvidenceArtifactCleanupEligible(
				{ ...staleArtifact, taskLeaseGeneration: staleArtifact.leaseGeneration + 1 },
				{ before, now },
			),
		).toBe(true);
		expect(
			isStagedEvidenceArtifactCleanupEligible(
				{ ...staleArtifact, taskStatus: "available", taskLeaseExpiresAt: null },
				{ before, now },
			),
		).toBe(true);
		expect(isStagedEvidenceArtifactCleanupEligible({ ...staleArtifact, createdAt: before }, { before, now })).toBe(
			false,
		);
		expect(isStagedEvidenceArtifactCleanupEligible({ ...staleArtifact, status: "attached" }, { before, now })).toBe(
			false,
		);
	});
});

describe("evidence artifact references", () => {
	it("uses only server-owned artifact metadata", () => {
		const artifact: EvidenceArtifactView = {
			id: "10000000-0000-4000-8000-000000000001",
			taskId: "10000000-0000-4000-8000-000000000002",
			batchId: "10000000-0000-4000-8000-000000000003",
			brandId: "brand-1",
			scopeId: "10000000-0000-4000-8000-000000000004",
			leaseGeneration: 2,
			uploadedBy: "operator-1",
			kind: "screenshot",
			mediaType: "image/png",
			originalFilename: "capture.png",
			byteSize: 123,
			sha256: "a".repeat(64),
			storageBackend: "postgres",
			storageKey: "evidence/10000000-0000-4000-8000-000000000001",
			status: "staged",
			observationAttemptId: null,
			createdAt: new Date("2026-08-11T00:00:00Z"),
			attachedAt: null,
		};

		expect(
			buildEvidenceArtifactReference(artifact, (id) => `https://portal.yonaris.com/api/admin/sampling/evidence/${id}`),
		).toEqual({
			artifactId: artifact.id,
			type: "screenshot",
			uri: `https://portal.yonaris.com/api/admin/sampling/evidence/${artifact.id}`,
			sha256: artifact.sha256,
			mediaType: "image/png",
			byteSize: 123,
		});
	});

	it("refuses a non-HTTP download reference", () => {
		const artifact = { id: "artifact" } as EvidenceArtifactView;
		expect(() => buildEvidenceArtifactReference(artifact, () => "file:///tmp/evidence.png")).toThrow(
			EvidenceArtifactValidationError,
		);
	});
});
