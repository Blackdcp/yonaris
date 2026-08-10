import { DeliveryTaskLeaseError } from "@workspace/lib/db/delivery-batches";
import {
	EvidenceArtifactNotFoundError,
	EvidenceArtifactStateError,
	EvidenceArtifactValidationError,
} from "@workspace/lib/db/evidence-artifacts";
import { describe, expect, it } from "vitest";
import { mapSamplingEvidenceDomainError, samplingEvidenceDownloadUrl } from "./sampling-evidence";

describe("sampling evidence server mapping", () => {
	it.each([
		[new EvidenceArtifactValidationError("too large", "too_large"), 413],
		[new EvidenceArtifactValidationError("bad media", "unsupported_media"), 415],
		[new EvidenceArtifactValidationError("wrong kind", "kind_mismatch"), 415],
		[new EvidenceArtifactValidationError("invalid"), 400],
		[new EvidenceArtifactNotFoundError("10000000-0000-4000-8000-000000000001"), 404],
		[new EvidenceArtifactStateError("already attached"), 409],
		[new DeliveryTaskLeaseError("10000000-0000-4000-8000-000000000001"), 409],
	] as const)("maps %s to HTTP %i", (error, status) => {
		expect(mapSamplingEvidenceDomainError(error)).toMatchObject({ status });
	});

	it("builds an internal download URL without embedding lease credentials", () => {
		const url = samplingEvidenceDownloadUrl("brand/with spaces", "10000000-0000-4000-8000-000000000001");

		expect(url).toBe("/api/admin/sampling/evidence/10000000-0000-4000-8000-000000000001?brandId=brand%2Fwith%20spaces");
		expect(url).not.toContain("lease");
	});
});
