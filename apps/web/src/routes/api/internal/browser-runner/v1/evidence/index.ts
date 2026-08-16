import { createFileRoute } from "@tanstack/react-router";
import { EVIDENCE_ARTIFACT_MAX_BYTES, stageEvidenceArtifact } from "@workspace/lib/db/evidence-artifacts";
import { BrowserRunnerHttpError, browserRunnerErrorResponse, requireBrowserRunner } from "@/server/browser-runner-auth";
import { assertRunnerTask, runnerClaimant } from "@/server/browser-runner-service";
import { mapSamplingEvidenceDomainError, toSamplingEvidenceArtifactDto } from "@/server/sampling-evidence";
import {
	parseSamplingEvidenceUploadHeaders,
	readRequestBodyWithinLimit,
	samplingEvidenceErrorResponse,
} from "@/server/sampling-evidence-http";

export const Route = createFileRoute("/api/internal/browser-runner/v1/evidence/")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const principal = await requireBrowserRunner(request);
					const runnerId = principal.id;
					const headers = parseSamplingEvidenceUploadHeaders(request);
					await assertRunnerTask(headers.taskId, headers.brandId, runnerId);
					const content = await readRequestBodyWithinLimit(request, EVIDENCE_ARTIFACT_MAX_BYTES);
					const claimedBy = runnerClaimant(runnerId);
					const artifact = await stageEvidenceArtifact({
						brandId: headers.brandId,
						claim: {
							taskId: headers.taskId,
							claimedBy,
							leaseToken: headers.leaseToken,
							leaseGeneration: headers.leaseGeneration,
						},
						uploadedBy: claimedBy,
						expectedKind: headers.kind,
						originalFilename: headers.fileName,
						content,
					});
					return Response.json(
						{ artifact: toSamplingEvidenceArtifactDto(artifact) },
						{ status: 201, headers: { "Cache-Control": "no-store" } },
					);
				} catch (error) {
					if (error instanceof BrowserRunnerHttpError) return browserRunnerErrorResponse(error);
					return samplingEvidenceErrorResponse(mapSamplingEvidenceDomainError(error) ?? error);
				}
			},
		},
	},
});
