/** /api/v1/observations/coverage - sample completeness for one scope/target. */
import { createFileRoute } from "@tanstack/react-router";
import { getDeliveryBatch } from "@workspace/lib/db/delivery-batches";
import { resolveMeasurementScopeForBrand } from "@workspace/lib/db/measurement-scopes";
import { getObservationCoverage } from "@workspace/lib/db/observation-coverage";
import { summarizeDeliveryCoverage } from "@workspace/lib/delivery-manifest";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";

const querySchema = z.object({
	brandId: z.string().trim().min(1),
	scopeId: z.guid(),
	batchId: z.guid().optional(),
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

					if (parsed.data.batchId) {
						const delivery = await getDeliveryBatch({
							brandId: parsed.data.brandId,
							batchId: parsed.data.batchId,
						});
						if (!delivery || delivery.batch.scopeId !== parsed.data.scopeId) {
							throw new ApiError(404, "Not Found", "Delivery batch was not found in this measurement scope.");
						}
						if (!delivery.batch.manifestHash || delivery.batch.status === "draft") {
							throw new ApiError(409, "Conflict", "Delivery batch manifest has not been frozen.");
						}

						const tasks = parsed.data.surfaceTargetKey
							? delivery.tasks.filter(({ surfaceTargetKey }) => surfaceTargetKey === parsed.data.surfaceTargetKey)
							: delivery.tasks;
						return {
							...parsed.data,
							batchStatus: delivery.batch.status,
							manifestHash: delivery.batch.manifestHash,
							...summarizeDeliveryCoverage(tasks),
							coverageBasis: "delivery_manifest" as const,
							contractualManifestApplied: true,
						};
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
