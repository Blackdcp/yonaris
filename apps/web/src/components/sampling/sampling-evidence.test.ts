import { describe, expect, it } from "vitest";
import {
	evidenceKindForFile,
	MAX_SAMPLING_EVIDENCE_FILE_BYTES,
	MAX_SAMPLING_EVIDENCE_TASK_BYTES,
	SAMPLING_EVIDENCE_API_PATH,
	samplingEvidenceSubmitBlocker,
	samplingEvidenceUploadHeaders,
	validateSamplingEvidenceFile,
} from "./sampling-evidence";

describe("sampling evidence validation", () => {
	it("accepts the four v1 formats and maps them to frozen evidence kinds", () => {
		expect(evidenceKindForFile({ name: "screen.png", type: "image/png", size: 10 })).toBe("screenshot");
		expect(evidenceKindForFile({ name: "screen.jpg", type: "image/jpeg", size: 10 })).toBe("screenshot");
		expect(evidenceKindForFile({ name: "screen.webp", type: "image/webp", size: 10 })).toBe("screenshot");
		expect(evidenceKindForFile({ name: "result.pdf", type: "application/pdf", size: 10 })).toBe("page_snapshot");
	});

	it("uses the extension only when the browser omits MIME metadata", () => {
		expect(evidenceKindForFile({ name: "result.PDF", type: "", size: 10 })).toBe("page_snapshot");
		expect(evidenceKindForFile({ name: "recording.mp4", type: "video/mp4", size: 10 })).toBeNull();
		expect(evidenceKindForFile({ name: "renamed.pdf", type: "video/mp4", size: 10 })).toBeNull();
	});

	it("enforces per-file, per-task, and count limits", () => {
		expect(
			validateSamplingEvidenceFile(
				{ name: "large.png", type: "image/png", size: MAX_SAMPLING_EVIDENCE_FILE_BYTES + 1 },
				{ artifactCount: 0, totalBytes: 0 },
			),
		).toMatchObject({ ok: false, message: expect.stringContaining("8 MiB") });
		expect(
			validateSamplingEvidenceFile(
				{ name: "last.pdf", type: "application/pdf", size: 2 },
				{ artifactCount: 2, totalBytes: MAX_SAMPLING_EVIDENCE_TASK_BYTES - 1 },
			),
		).toMatchObject({ ok: false, message: expect.stringContaining("40 MiB") });
		expect(
			validateSamplingEvidenceFile(
				{ name: "extra.png", type: "image/png", size: 1 },
				{ artifactCount: 20, totalBytes: 20 },
			),
		).toMatchObject({ ok: false, message: expect.stringContaining("at most 20") });
	});
});

describe("sampling evidence upload request", () => {
	it("keeps the claim token in exact same-origin headers and encodes the filename", () => {
		const leaseToken = "secret-lease-token-never-in-a-url";
		const headers = samplingEvidenceUploadHeaders({
			file: { name: "客户 截图.png", type: "image/png" } as File,
			kind: "screenshot",
			task: { brandId: "brand-1", id: "10000000-0000-4000-8000-000000000001" },
			lease: { leaseToken, leaseGeneration: 3 },
			onProgress: () => undefined,
		});

		expect(SAMPLING_EVIDENCE_API_PATH).toBe("/api/admin/sampling/evidence");
		expect(SAMPLING_EVIDENCE_API_PATH).not.toContain(leaseToken);
		expect(headers).toMatchObject({
			"Content-Type": "image/png",
			"X-Yonaris-Brand-Id": "brand-1",
			"X-Yonaris-Task-Id": "10000000-0000-4000-8000-000000000001",
			"X-Yonaris-Lease-Token": leaseToken,
			"X-Yonaris-Lease-Generation": "3",
			"X-Yonaris-Evidence-Kind": "screenshot",
			"X-Yonaris-Filename": encodeURIComponent("客户 截图.png"),
		});
	});
});

describe("sampling evidence submit gate", () => {
	it("blocks recovery, transfers, failures, and an insufficient ready count", () => {
		expect(
			samplingEvidenceSubmitBlocker({ states: [], minimumArtifacts: 1, recovering: true, recoveryError: null }),
		).toContain("loading");
		expect(
			samplingEvidenceSubmitBlocker({
				states: [{ state: "uploading" }],
				minimumArtifacts: 1,
				recovering: false,
				recoveryError: null,
			}),
		).toContain("finish");
		expect(
			samplingEvidenceSubmitBlocker({
				states: [{ state: "ready" }, { state: "failed" }],
				minimumArtifacts: 1,
				recovering: false,
				recoveryError: null,
			}),
		).toContain("failed");
		expect(
			samplingEvidenceSubmitBlocker({ states: [], minimumArtifacts: 1, recovering: false, recoveryError: null }),
		).toContain("at least 1");
	});

	it("allows submit only when every row is ready and the minimum is met", () => {
		expect(
			samplingEvidenceSubmitBlocker({
				states: [{ state: "ready" }, { state: "ready" }],
				minimumArtifacts: 2,
				recovering: false,
				recoveryError: null,
			}),
		).toBeNull();
	});
});
