import { DeliveryTaskLeaseError } from "@workspace/lib/db/delivery-batches";
import {
	EvidenceArtifactNotFoundError,
	EvidenceArtifactStateError,
	EvidenceArtifactValidationError,
	type EvidenceArtifactView,
} from "@workspace/lib/db/evidence-artifacts";
import { isAdmin } from "@/lib/auth/helpers";
import { resolveAuthSession } from "@/lib/auth/resolve-session";
import { SamplingEvidenceHttpError } from "./sampling-evidence-http";

export interface SamplingEvidenceArtifactDto {
	id: string;
	taskId: string;
	batchId: string;
	brandId: string;
	scopeId: string;
	leaseGeneration: number;
	kind: "screenshot" | "page_snapshot";
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	sha256: string;
	status: "staged" | "attached";
	createdAt: string;
	attachedAt: string | null;
	downloadUrl: string;
}

function extensionForMediaType(mediaType: string): string {
	switch (mediaType) {
		case "image/png":
			return "png";
		case "image/jpeg":
			return "jpg";
		case "image/webp":
			return "webp";
		case "application/pdf":
			return "pdf";
		default:
			return "bin";
	}
}

export function samplingEvidenceDownloadUrl(brandId: string, artifactId: string): string {
	return `/api/admin/sampling/evidence/${encodeURIComponent(artifactId)}?brandId=${encodeURIComponent(brandId)}`;
}

export function toSamplingEvidenceArtifactDto(artifact: EvidenceArtifactView): SamplingEvidenceArtifactDto {
	return {
		id: artifact.id,
		taskId: artifact.taskId,
		batchId: artifact.batchId,
		brandId: artifact.brandId,
		scopeId: artifact.scopeId,
		leaseGeneration: artifact.leaseGeneration,
		kind: artifact.kind,
		fileName: artifact.originalFilename ?? `evidence-${artifact.id}.${extensionForMediaType(artifact.mediaType)}`,
		mimeType: artifact.mediaType,
		sizeBytes: artifact.byteSize,
		sha256: artifact.sha256,
		status: artifact.status,
		createdAt: artifact.createdAt.toISOString(),
		attachedAt: artifact.attachedAt?.toISOString() ?? null,
		downloadUrl: samplingEvidenceDownloadUrl(artifact.brandId, artifact.id),
	};
}

export async function requireSamplingEvidenceAdmin(request: Request) {
	const session = await resolveAuthSession(request.headers);
	if (!session) throw new SamplingEvidenceHttpError(401, "Authentication required");
	if (!isAdmin(session)) throw new SamplingEvidenceHttpError(403, "Administrator access required");
	return session;
}

export function mapSamplingEvidenceDomainError(error: unknown): SamplingEvidenceHttpError | undefined {
	if (error instanceof EvidenceArtifactNotFoundError) {
		return new SamplingEvidenceHttpError(404, error.message);
	}
	if (error instanceof EvidenceArtifactStateError || error instanceof DeliveryTaskLeaseError) {
		return new SamplingEvidenceHttpError(409, error.message);
	}
	if (error instanceof EvidenceArtifactValidationError) {
		if (error.code === "too_large") return new SamplingEvidenceHttpError(413, error.message);
		if (error.code === "unsupported_media" || error.code === "kind_mismatch") {
			return new SamplingEvidenceHttpError(415, error.message);
		}
		return new SamplingEvidenceHttpError(400, error.message);
	}
	return undefined;
}
