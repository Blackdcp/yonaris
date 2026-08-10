/** /api/v1/observations/coverage - sample completeness for one scope/target. */
import { createFileRoute } from "@tanstack/react-router";
import { getObservationCoverage } from "@workspace/lib/db/observation-coverage";
import { resolveMeasurementScopeForBrand } from "@workspace/lib/db/measurement-scopes";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";

const querySchema = z.object({
	brandId: z.string().trim().min(1),
	scopeId: z.guid(),
	surfaceTargetKey: z.string().trim().min(1).max(200).optional(),
});

export const Route = createFileRoute("/api/v1/observations/coverage")({
	server: {
		handlers: {
			GET: createApiHandler({
				handle: async ({ request }) => {
					const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
					if (!parsed.success) {
						throw new ApiError(
							400,
							"Validation Error",
							parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
						);
					}

					try {
						await resolveMeasurementScopeForBrand(parsed.data.brandId, parsed.data.scopeId);
					} catch (error) {
						throw new ApiError(
							400,
							"Validation Error",
							error instanceof Error ? error.message : "Invalid measurement scope.",
						);
					}

					const coverage = await getObservationCoverage(parsed.data);
					return {
						...parsed.data,
						...coverage,
						coverageBasis: "registered_attempts" as const,
						contractualManifestApplied: false,
					};
				},
			}),
		},
	},
});
