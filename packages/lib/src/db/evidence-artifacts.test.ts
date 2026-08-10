import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	buildEvidenceArtifactReference,
	EVIDENCE_ARTIFACT_MAX_BYTES,
	EvidenceArtifactValidationError,
	type EvidenceArtifactView,
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
