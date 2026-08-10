import { createFileRoute } from "@tanstack/react-router";
import { EVIDENCE_ARTIFACT_MAX_BYTES, stageEvidenceArtifact } from "@workspace/lib/db/evidence-artifacts";
import {
	mapSamplingEvidenceDomainError,
	requireSamplingEvidenceAdmin,
	toSamplingEvidenceArtifactDto,
} from "@/server/sampling-evidence";
import {
	parseSamplingEvidenceUploadHeaders,
	readRequestBodyWithinLimit,
	requireExplicitSameOrigin,
	samplingEvidenceErrorResponse,
} from "@/server/sampling-evidence-http";

export const Route = createFileRoute("/api/admin/sampling/evidence/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					requireExplicitSameOrigin(request);
					const session = await requireSamplingEvidenceAdmin(request);
					const headers = parseSamplingEvidenceUploadHeaders(request);
					const content = await readRequestBodyWithinLimit(request, EVIDENCE_ARTIFACT_MAX_BYTES);
					const artifact = await stageEvidenceArtifact({
						brandId: headers.brandId,
						claim: {
							taskId: headers.taskId,
							claimedBy: session.user.id,
							leaseToken: headers.leaseToken,
							leaseGeneration: headers.leaseGeneration,
						},
						uploadedBy: session.user.id,
						expectedKind: headers.kind,
						originalFilename: headers.fileName,
						content,
					});
					return Response.json(
						{ artifact: toSamplingEvidenceArtifactDto(artifact) },
						{ status: 201, headers: { "Cache-Control": "private, no-store" } },
					);
				} catch (error) {
					return samplingEvidenceErrorResponse(mapSamplingEvidenceDomainError(error) ?? error);
				}
			},
		},
	},
});
