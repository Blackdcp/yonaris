/**
 * /api/v1/measurement-scopes - measurement scope collection.
 *
 * GET  list a brand's measurement scopes
 * POST create a measurement scope for a brand
 *
 * Protected by API key authentication.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@workspace/lib/db/db";
import { brands, measurementScopes } from "@workspace/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, createApiHandler } from "@/lib/api/handler";

const marketSchema = z
	.string()
	.trim()
	.regex(/^[A-Za-z]{2}$/, "market must be a two-letter country or market code")
	.transform((value) => value.toUpperCase());

const localeSchema = z
	.string()
	.trim()
	.min(2)
	.max(35)
	.refine((value) => {
		try {
			return Intl.getCanonicalLocales(value).length === 1;
		} catch {
			return false;
		}
	}, "locale must be a valid BCP 47 language tag")
	.transform((value) => Intl.getCanonicalLocales(value)[0]);

const timezoneSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
			return true;
		} catch {
			return false;
		}
	}, "timezone must be a valid IANA time zone")
	.transform((value) => new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone);

const createMeasurementScopeBody = z.object({
	brandId: z.string().trim().min(1, "brandId is required"),
	key: z
		.string()
		.trim()
		.min(1, "key is required")
		.max(64)
		.regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "key must be a lowercase slug"),
	name: z.string().trim().min(1, "name is required").max(120),
	market: marketSchema,
	locale: localeSchema,
	timezone: timezoneSchema,
	isDefault: z.boolean().optional().default(false),
});

function isUniqueConstraintError(error: unknown, constraint: string): boolean {
	let current = error;
	while (current && typeof current === "object") {
		if ("code" in current && current.code === "23505" && "constraint" in current && current.constraint === constraint) {
			return true;
		}
		current = "cause" in current ? current.cause : undefined;
	}
	return false;
}

async function requireBrand(brandId: string): Promise<void> {
	const [brand] = await db
		.select({ id: brands.id, organizationId: brands.organizationId })
		.from(brands)
		.where(eq(brands.id, brandId))
		.limit(1);
	if (!brand) {
		throw new ApiError(404, "Not Found", `Brand "${brandId}" not found.`);
	}
}

export const Route = createFileRoute("/api/v1/measurement-scopes/")({
	server: {
		handlers: {
			GET: createApiHandler({
				handle: async ({ request }) => {
					const brandId = new URL(request.url).searchParams.get("brandId")?.trim();
					if (!brandId) {
						throw new ApiError(400, "Validation Error", "brandId query parameter is required");
					}

					await requireBrand(brandId);
					const scopes = await db
						.select()
						.from(measurementScopes)
						.where(eq(measurementScopes.brandId, brandId))
						.orderBy(desc(measurementScopes.isDefault), asc(measurementScopes.createdAt));

					return { scopes };
				},
			}),

			POST: createApiHandler({
				body: createMeasurementScopeBody,
				status: 201,
				handle: async ({ body }) => {
					try {
						return await db.transaction(async (tx) => {
							const [brand] = await tx
								.select({ id: brands.id, organizationId: brands.organizationId })
								.from(brands)
								.where(eq(brands.id, body.brandId))
								.limit(1);
							if (!brand) {
								throw new ApiError(404, "Not Found", `Brand "${body.brandId}" not found.`);
							}

							if (body.isDefault) {
								await tx
									.update(measurementScopes)
									.set({ isDefault: false })
									.where(and(eq(measurementScopes.brandId, body.brandId), eq(measurementScopes.isDefault, true)));
							}

							const [scope] = await tx.insert(measurementScopes).values(body).returning();
							return scope;
						});
					} catch (error) {
						if (isUniqueConstraintError(error, "measurement_scopes_brand_key_uidx")) {
							throw new ApiError(
								409,
								"Conflict",
								`Measurement scope key "${body.key}" already exists for brand "${body.brandId}".`,
							);
						}
						if (isUniqueConstraintError(error, "measurement_scopes_one_default_per_brand_uidx")) {
							throw new ApiError(409, "Conflict", "The brand's default scope changed concurrently; retry the request.");
						}
						throw error;
					}
				},
			}),
		},
	},
});
