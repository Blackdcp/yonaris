/**
 * /api/v1/prompts/:promptId — single prompt resource.
 *
 * GET     fetch one prompt
 * PATCH   update value / enabled / tags
 * DELETE  remove the prompt (cascades to runs + citations)
 *
 * Protected by API key authentication.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@workspace/lib/db/db";
import { resolveMeasurementScopeForBrand } from "@workspace/lib/db/measurement-scopes";
import { brands, citations, observationAttempts, promptRuns, prompts } from "@workspace/lib/db/schema";
import { computeSystemTags, sanitizeUserTags } from "@workspace/lib/tag-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";
import { createPromptJobScheduler, removePromptJobScheduler } from "@/lib/job-scheduler";

// z.guid(), not z.uuid(): matches the loose 8-4-4-4-12 hex check this API has
// always used; z.uuid() enforces RFC version bits and rejects existing IDs.
const promptParams = z.object({ promptId: z.guid("Invalid prompt ID format") });

const updatePromptBody = z
	.object({
		value: z.string().trim().min(1, "value must be a non-empty string").optional(),
		enabled: z.boolean().optional(),
		tags: z.array(z.string()).optional(),
	})
	.refine((body) => Object.keys(body).length > 0, "At least one of value, enabled, or tags must be provided");

function isConstraintError(error: unknown, code: string, constraint: string): boolean {
	let current = error;
	while (current && typeof current === "object") {
		if ("code" in current && current.code === code && "constraint" in current && current.constraint === constraint) {
			return true;
		}
		current = "cause" in current ? current.cause : undefined;
	}
	return false;
}

export const Route = createFileRoute("/api/v1/prompts/$promptId")({
	server: {
		handlers: {
			GET: createApiHandler({
				params: promptParams,
				handle: async ({ params }) => {
					const prompt = await db
						.select({
							id: prompts.id,
							brandId: prompts.brandId,
							scopeId: prompts.scopeId,
							value: prompts.value,
							enabled: prompts.enabled,
							tags: prompts.tags,
							systemTags: prompts.systemTags,
							createdAt: prompts.createdAt,
							updatedAt: prompts.updatedAt,
						})
						.from(prompts)
						.where(eq(prompts.id, params.promptId))
						.limit(1);

					if (prompt.length === 0) {
						throw new ApiError(404, "Not Found", `Prompt with ID '${params.promptId}' not found`);
					}

					return prompt[0];
				},
			}),

			PATCH: createApiHandler({
				params: promptParams,
				body: updatePromptBody,
				handle: async ({ params, body }) => {
					const { promptId } = params;
					const { value, enabled, tags } = body;

					const existingPrompt = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);
					if (existingPrompt.length === 0) {
						throw new ApiError(404, "Not Found", `Prompt with ID '${promptId}' not found`);
					}

					const brandInfo = await db.select().from(brands).where(eq(brands.id, existingPrompt[0].brandId)).limit(1);
					if (brandInfo.length === 0) {
						throw new ApiError(500, "Internal Server Error", "Brand not found for prompt");
					}
					const brand = brandInfo[0];
					if (value !== undefined && value !== existingPrompt[0].value) {
						throw new ApiError(
							409,
							"Prompt Frozen",
							"Stored prompt text is immutable; create a new prompt and disable this one instead.",
						);
					}
					let scopeForEnable: Awaited<ReturnType<typeof resolveMeasurementScopeForBrand>> | undefined;
					if (enabled === true && !existingPrompt[0].enabled) {
						try {
							scopeForEnable = await resolveMeasurementScopeForBrand(
								existingPrompt[0].brandId,
								existingPrompt[0].scopeId ?? undefined,
							);
						} catch (error) {
							throw new ApiError(
								409,
								"Scope Unavailable",
								error instanceof Error ? error.message : "The prompt's measurement scope is unavailable.",
							);
						}
					}

					const updateData: Partial<typeof prompts.$inferInsert> = {};
					if (value !== undefined) {
						updateData.value = value;
						updateData.systemTags = computeSystemTags(value, brand.name, brand.website);
					}
					if (enabled !== undefined) {
						updateData.enabled = enabled;
					}
					if (tags !== undefined) {
						updateData.tags = sanitizeUserTags(tags);
					}

					const [updatedPrompt] = await db.update(prompts).set(updateData).where(eq(prompts.id, promptId)).returning();
					// The existence check above can race with a concurrent delete;
					// the update's returning() is the source of truth.
					if (!updatedPrompt) {
						throw new ApiError(404, "Not Found", `Prompt with ID '${promptId}' not found`);
					}

					if (enabled !== undefined) {
						const wasEnabled = existingPrompt[0].enabled;
						const isNowEnabled = enabled;

						if (!wasEnabled && isNowEnabled) {
							if (
								scopeForEnable &&
								(scopeForEnable.automaticTargetKeys === null || scopeForEnable.automaticTargetKeys.length > 0)
							) {
								await createPromptJobScheduler(promptId);
							}
						} else if (wasEnabled && !isNowEnabled) {
							await removePromptJobScheduler(promptId);
						}
					}

					return updatedPrompt;
				},
			}),

			DELETE: createApiHandler({
				params: promptParams,
				handle: async ({ params }) => {
					const { promptId } = params;

					const existingPrompt = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);
					if (existingPrompt.length === 0) {
						throw new ApiError(404, "Not Found", `Prompt with ID '${promptId}' not found`);
					}
					const [attempt, historicalRun] = await Promise.all([
						db.query.observationAttempts.findFirst({
							where: eq(observationAttempts.promptId, promptId),
							columns: { id: true },
						}),
						db.query.promptRuns.findFirst({
							where: eq(promptRuns.promptId, promptId),
							columns: { id: true },
						}),
					]);
					if (attempt || historicalRun) {
						throw new ApiError(
							409,
							"Prompt Has Measurements",
							"Measured prompts cannot be deleted because their audit history must be retained; disable the prompt instead.",
						);
					}

					await removePromptJobScheduler(promptId);

					const result = await (async () => {
						try {
							return await db.transaction(async (tx) => {
								await tx.delete(citations).where(eq(citations.promptId, promptId));
								const deletedRuns = await tx
									.delete(promptRuns)
									.where(eq(promptRuns.promptId, promptId))
									.returning({ id: promptRuns.id });
								const deletedPrompt = await tx.delete(prompts).where(eq(prompts.id, promptId)).returning();
								return { deletedRuns, deletedPrompt };
							});
						} catch (error) {
							if (isConstraintError(error, "23503", "observation_attempts_prompt_id_prompts_id_fk")) {
								throw new ApiError(
									409,
									"Prompt Has Measurements",
									"Measurement began while deletion was requested; disable the prompt instead.",
								);
							}
							throw error;
						}
					})();

					// The pre-transaction existence check can race with a concurrent
					// delete; the transaction's returning() is the source of truth.
					const deleted = result.deletedPrompt[0];
					if (!deleted) {
						throw new ApiError(404, "Not Found", `Prompt with ID '${promptId}' not found`);
					}

					return { ...deleted, deletedRunsCount: result.deletedRuns.length };
				},
			}),
		},
	},
});
