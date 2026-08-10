import { createFileRoute } from "@tanstack/react-router";
import { deleteStagedEvidenceArtifact, readEvidenceArtifact } from "@workspace/lib/db/evidence-artifacts";
import {
	mapSamplingEvidenceDomainError,
	requireSamplingEvidenceAdmin,
	toSamplingEvidenceArtifactDto,
} from "@/server/sampling-evidence";
import {
	attachmentContentDisposition,
	parseSamplingEvidenceClaimHeaders,
	requireExplicitSameOrigin,
	SamplingEvidenceHttpError,
	samplingEvidenceErrorResponse,
} from "@/server/sampling-evidence-http";

function artifactSelector(request: Request, artifactId: string): { brandId: string; artifactId: string } {
	const brandId = new URL(request.url).searchParams.get("brandId")?.trim();
	if (!brandId) throw new SamplingEvidenceHttpError(400, "brandId query parameter is required");
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(artifactId)) {
		throw new SamplingEvidenceHttpError(400, "artifactId must be a GUID");
	}
	return { brandId, artifactId };
}

export const Route = createFileRoute("/api/admin/sampling/evidence/$artifactId")({
	server: {
		handlers: {
			GET: async ({ request, params }: { request: Request; params: { artifactId: string } }) => {
				try {
					await requireSamplingEvidenceAdmin(request);
					const selector = artifactSelector(request, params.artifactId);
					const { artifact, content } = await readEvidenceArtifact(selector);
					const fileName = toSamplingEvidenceArtifactDto(artifact).fileName;
					return new Response(new Uint8Array(content), {
						headers: {
							"Cache-Control": "private, no-store",
							"Content-Disposition": attachmentContentDisposition(fileName),
							"Content-Length": String(artifact.byteSize),
							"Content-Type": artifact.mediaType,
							"Content-Security-Policy": "sandbox",
							ETag: `"${artifact.sha256}"`,
							"X-Content-Type-Options": "nosniff",
							"X-Yonaris-SHA256": artifact.sha256,
						},
					});
				} catch (error) {
					return samplingEvidenceErrorResponse(mapSamplingEvidenceDomainError(error) ?? error);
				}
			},

			DELETE: async ({ request, params }: { request: Request; params: { artifactId: string } }) => {
				try {
					requireExplicitSameOrigin(request);
					const session = await requireSamplingEvidenceAdmin(request);
					const selector = artifactSelector(request, params.artifactId);
					const claimHeaders = parseSamplingEvidenceClaimHeaders(request);
					if (claimHeaders.brandId !== selector.brandId) {
						throw new SamplingEvidenceHttpError(400, "brandId query and claim header must match");
					}
					await deleteStagedEvidenceArtifact({
						...selector,
						claim: {
							taskId: claimHeaders.taskId,
							claimedBy: session.user.id,
							leaseToken: claimHeaders.leaseToken,
							leaseGeneration: claimHeaders.leaseGeneration,
						},
					});
					return Response.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
				} catch (error) {
					return samplingEvidenceErrorResponse(mapSamplingEvidenceDomainError(error) ?? error);
				}
			},
		},
	},
});
