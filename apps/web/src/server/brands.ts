/**
 * Server functions for brand operations.
 * Replaces apps/web/src/app/api/brands/* API routes.
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_COMPETITORS } from "@workspace/lib/constants";
import { db } from "@workspace/lib/db/db";
import { ensureLegacyMeasurementScope } from "@workspace/lib/db/measurement-scopes";
import { provisionAdditionalLocalOrg } from "@workspace/lib/db/provisioning";
import { brands, competitors, measurementScopes, prompts } from "@workspace/lib/db/schema";
import { parseScrapeTargets, selectTargetsForBrand } from "@workspace/lib/providers";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { canInitiatePlatformExecution } from "@/lib/auth/execution-boundaries";
import {
	isAdmin,
	isPlatformIdentity,
	listUserOrganizations,
	requireAuthSession,
	requireBrandAccess,
	requireBrandWriteAccess,
	requireOrgWriteAccess,
} from "@/lib/auth/helpers";
import { evaluateRequireCanCreateBrands } from "@/lib/auth/policies";
import {
	MAX_ALIAS_LENGTH,
	MAX_BRAND_DOMAINS,
	MAX_BRAND_NAME_LENGTH,
	MAX_COMPETITOR_DOMAINS,
	MAX_COMPETITOR_NAME_LENGTH,
	MAX_DOMAIN_INPUT_LENGTH,
	MAX_RESOURCE_ALIASES,
	MAX_WEBSITE_INPUT_LENGTH,
	normalizeBrandUpdate,
} from "@/lib/brand-settings";
import { validateWebsiteUrl } from "@/lib/brand-website";
import { getDeployment } from "@/lib/config/server";
import { cleanAndValidateDomain } from "@/lib/domain-categories";
import { type CustomerBrandDto, toCustomerBrandDto, toCustomerCompetitorDto } from "./customer-data-dto";

export const updateBrandInputSchema = z.object({
	brandId: z.string().min(1),
	name: z.string().max(MAX_BRAND_NAME_LENGTH).optional(),
	website: z.string().max(MAX_WEBSITE_INPUT_LENGTH).optional(),
	additionalDomains: z.array(z.string().trim().min(1).max(MAX_DOMAIN_INPUT_LENGTH)).max(MAX_BRAND_DOMAINS).optional(),
	aliases: z.array(z.string().max(MAX_ALIAS_LENGTH)).max(MAX_RESOURCE_ALIASES).optional(),
});

export const updateCompetitorsInputSchema = z.object({
	brandId: z.string().min(1),
	competitors: z
		.array(
			z.object({
				name: z.string().trim().min(1).max(MAX_COMPETITOR_NAME_LENGTH),
				domains: z.array(z.string().trim().min(1).max(MAX_DOMAIN_INPUT_LENGTH)).min(1).max(MAX_COMPETITOR_DOMAINS),
				aliases: z.array(z.string().max(MAX_ALIAS_LENGTH)).max(MAX_RESOURCE_ALIASES).optional().default([]),
			}),
		)
		.max(MAX_COMPETITORS),
});

/** Resolve public product/model ids only; execution-route metadata stays platform-side. */
function computeEffectiveModels(enabledModels: string[] | null): string[] {
	try {
		const configs = parseScrapeTargets(process.env.SCRAPE_TARGETS);
		return [...new Set(selectTargetsForBrand(configs, enabledModels).map((config) => config.model))];
	} catch {
		// A misconfigured SCRAPE_TARGETS would already be surfacing via
		// `validateScrapeTargets` at boot; here we'd rather degrade to empty
		// lists than crash the brand fetch.
		return [];
	}
}

function getDefaultBrandDomains(): string[] {
	const raw = process.env.DEFAULT_BRAND_DOMAINS;
	if (!raw) return [];
	return raw
		.split(",")
		.map((d) => d.trim())
		.filter(Boolean)
		.map((d) => cleanAndValidateDomain(d))
		.filter((d): d is string => d !== null);
}

// ============================================================================
// Helper functions (migrated from apps/web/src/lib/metadata.ts)
// ============================================================================

async function getCustomerBrandFromDb(brandId: string): Promise<CustomerBrandDto | undefined> {
	try {
		const brand = await db.query.brands.findFirst({
			where: eq(brands.id, brandId),
			columns: {
				id: true,
				name: true,
				website: true,
				additionalDomains: true,
				aliases: true,
				enabled: true,
				onboarded: true,
				delayOverrideHours: true,
				enabledModels: true,
				updatedAt: true,
			},
		});
		if (!brand) return undefined;

		const brandPrompts = await db.query.prompts.findMany({
			where: eq(prompts.brandId, brandId),
			columns: { id: true, scopeId: true, value: true, enabled: true, tags: true, systemTags: true },
		});
		const brandCompetitors = await db.query.competitors.findMany({
			where: eq(competitors.brandId, brandId),
			columns: { id: true, name: true, domains: true, aliases: true },
		});
		const brandScopes = await db.query.measurementScopes.findMany({
			where: eq(measurementScopes.brandId, brandId),
			orderBy: (scope, { asc, desc }) => [desc(scope.isDefault), asc(scope.createdAt), asc(scope.id)],
			columns: {
				id: true,
				key: true,
				name: true,
				market: true,
				locale: true,
				timezone: true,
				automaticTargetKeys: true,
				samplingEvaluationRole: true,
				enabled: true,
				isDefault: true,
			},
		});

		return toCustomerBrandDto(
			{
				...brand,
				prompts: brandPrompts,
				competitors: brandCompetitors,
				measurementScopes: brandScopes,
			},
			computeEffectiveModels(brand.enabledModels),
		);
	} catch (error) {
		console.error("Error fetching brand with prompts:", error);
		return undefined;
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all brands the current user has access to.
 *
 * Org scoping is the access-control mechanism: we resolve the orgs the user is
 * a member of and return only brands owned by those orgs (`brands.organization_id
 * IN (...)`). A user in org A never sees org B's brands.
 */
export const getBrands = createServerFn({ method: "GET" }).handler(async () => {
	const session = await requireAuthSession();
	if (isPlatformIdentity(session)) {
		throw new Error("Not Found: Customer workspaces are not available to platform identities");
	}
	const userOrgs = await listUserOrganizations(session.user.id);
	const orgIds = userOrgs.map((o) => o.id);

	if (orgIds.length === 0) {
		return [];
	}

	const scopedBrands = await db.select({ id: brands.id }).from(brands).where(inArray(brands.organizationId, orgIds));

	const brandsData = await Promise.all(scopedBrands.map((brand) => getCustomerBrandFromDb(brand.id)));

	return brandsData.filter((brand): brand is CustomerBrandDto => brand !== undefined);
});

/**
 * Get a single brand by ID
 */
export const getBrand = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string() }))
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandAccess(session.user.id, data.brandId);

		const brand = await getCustomerBrandFromDb(data.brandId);
		if (!brand) {
			throw new Error("Brand not found");
		}

		return brand;
	});

/**
 * Create a new brand
 */
export const createBrandFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string().min(1).max(200),
			brandName: z.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH),
			website: z.string().trim().min(1).max(MAX_WEBSITE_INPUT_LENGTH),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		if (isPlatformIdentity(session)) {
			throw new Error("Not Found: Customer onboarding is not available to platform identities");
		}
		// Onboarding creates the brand row for an already-provisioned organization,
		// so this one pre-brand path must authorize the organization directly.
		await requireOrgWriteAccess(session.user.id, data.brandId);

		const urlValidation = validateWebsiteUrl(data.website);
		if (!urlValidation.isValid) {
			throw new Error(urlValidation.error);
		}

		const defaultDomains = getDefaultBrandDomains();

		const result = await db
			.insert(brands)
			.values({
				id: data.brandId,
				// brandId is the org id from the URL (access verified above); the
				// brand belongs to that org.
				organizationId: data.brandId,
				name: data.brandName,
				website: urlValidation.formattedUrl,
				enabled: true,
				...(defaultDomains.length > 0 && { additionalDomains: defaultDomains }),
			})
			.onConflictDoNothing()
			.returning();

		const brand =
			result[0] ??
			(await db.query.brands.findFirst({
				where: eq(brands.id, data.brandId),
			}));

		if (!brand) {
			throw new Error("Failed to create brand");
		}
		await ensureLegacyMeasurementScope(brand.id);

		return { success: true, brandId: brand.id };
	});

/**
 * Create a customer organization + brand without granting the platform
 * operator a customer membership. Customer identities are provisioned through
 * the separate platform access workflow. The deployment feature keeps
 * whitelabel (Auth0-owned orgs) and demo (read-only) modes closed.
 */
export const createBrandWithOrgFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandName: z.string().trim().min(1).max(MAX_BRAND_NAME_LENGTH),
			website: z.string().trim().min(1).max(MAX_WEBSITE_INPUT_LENGTH),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		const deployment = getDeployment();
		if (!canInitiatePlatformExecution(isAdmin(session))) {
			throw new Error("Forbidden: Platform administrator access required");
		}

		if (evaluateRequireCanCreateBrands(deployment.features.canCreateBrands) === "deny") {
			throw new Error("Brand creation is not allowed in this deployment");
		}

		const urlValidation = validateWebsiteUrl(data.website);
		if (!urlValidation.isValid) {
			throw new Error(urlValidation.error);
		}

		const trimmedName = data.brandName.trim();
		if (!trimmedName) {
			throw new Error("Brand name must be a non-empty string");
		}

		const defaultDomains = getDefaultBrandDomains();
		// Create organization and brand atomically, without making the platform
		// operator a customer member. Customer identities are provisioned later.
		const { orgId } = await provisionAdditionalLocalOrg({
			name: trimmedName,
			brand: {
				website: urlValidation.formattedUrl,
				...(defaultDomains.length > 0 && { additionalDomains: defaultDomains }),
			},
		});
		await ensureLegacyMeasurementScope(orgId);

		return { brandId: orgId };
	});

/**
 * Update a brand
 */
export const updateBrandFn = createServerFn({ method: "POST" })
	.validator(updateBrandInputSchema)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandWriteAccess(session.user.id, data.brandId);

		const normalized = normalizeBrandUpdate({
			name: data.name,
			website: data.website,
			additionalDomains: data.additionalDomains,
			aliases: data.aliases,
		});
		if (!normalized.ok) {
			throw new Error(normalized.error);
		}
		const updateData = normalized.updates;

		const result = await db
			.update(brands)
			.set({ ...updateData, updatedAt: new Date() })
			.where(eq(brands.id, data.brandId))
			.returning({ id: brands.id });

		if (!result[0]) {
			throw new Error("Failed to update brand");
		}

		return { success: true, brandId: result[0].id };
	});

/**
 * Get competitors for a brand
 */
export const getCompetitors = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string() }))
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandAccess(session.user.id, data.brandId);

		const rows = await db.query.competitors.findMany({
			where: eq(competitors.brandId, data.brandId),
			columns: { id: true, name: true, domains: true, aliases: true },
		});
		return rows.map(toCustomerCompetitorDto);
	});

/**
 * Update competitors for a brand (bulk replace)
 */
export const updateCompetitors = createServerFn({ method: "POST" })
	.validator(updateCompetitorsInputSchema)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandWriteAccess(session.user.id, data.brandId);

		// Validate and clean domains
		const cleanedCompetitors = data.competitors.map((c) => {
			const cleanedDomains = c.domains.map((d) => cleanAndValidateDomain(d));
			const invalid = c.domains.filter((_, i) => !cleanedDomains[i]);
			if (invalid.length > 0) {
				throw new Error(`Invalid domain(s) for "${c.name}": ${invalid.join(", ")}`);
			}
			return {
				name: c.name,
				domains: cleanedDomains.filter(Boolean) as string[],
				aliases: c.aliases,
			};
		});

		await db.transaction(async (tx) => {
			await tx.delete(competitors).where(eq(competitors.brandId, data.brandId));

			if (cleanedCompetitors.length > 0) {
				await tx.insert(competitors).values(
					cleanedCompetitors.map((c) => ({
						brandId: data.brandId,
						name: c.name,
						domains: c.domains,
						aliases: c.aliases,
					})),
				);
			}
		});
		return { success: true };
	});

/**
 * Add an additional domain to the brand itself
 */
export const addDomainToBrandFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string(),
			domain: z.string().trim().min(1).max(MAX_DOMAIN_INPUT_LENGTH),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandWriteAccess(session.user.id, data.brandId);

		const domain = cleanAndValidateDomain(data.domain);
		if (!domain) throw new Error(`Invalid domain: ${data.domain}`);

		const [result] = await db
			.update(brands)
			.set({
				additionalDomains: sql`array_append(${brands.additionalDomains}, ${domain})`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(brands.id, data.brandId),
					sql`NOT (${domain} = ANY(${brands.additionalDomains}))`,
					sql`cardinality(${brands.additionalDomains}) < ${MAX_BRAND_DOMAINS}`,
				),
			)
			.returning({ id: brands.id });

		if (result) return { success: true, brandId: result.id };

		const brand = await db.query.brands.findFirst({
			where: eq(brands.id, data.brandId),
			columns: { id: true, additionalDomains: true },
		});
		if (!brand) throw new Error("Brand not found");
		if (!brand.additionalDomains.includes(domain) && brand.additionalDomains.length >= MAX_BRAND_DOMAINS) {
			throw new Error(`Cannot add domain. Maximum of ${MAX_BRAND_DOMAINS} additional domains reached.`);
		}
		return { success: true, brandId: brand.id };
	});

/**
 * Add a domain to an existing competitor
 */
export const addDomainToCompetitorFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string(),
			competitorId: z.string(),
			domain: z.string().trim().min(1).max(MAX_DOMAIN_INPUT_LENGTH),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandWriteAccess(session.user.id, data.brandId);

		const existing = await db.query.competitors.findFirst({
			where: and(eq(competitors.id, data.competitorId), eq(competitors.brandId, data.brandId)),
			columns: { id: true, domains: true },
		});
		if (!existing) throw new Error("Competitor not found");

		const domain = cleanAndValidateDomain(data.domain);
		if (!domain) throw new Error(`Invalid domain: ${data.domain}`);
		if (existing.domains.includes(domain)) return { success: true, competitorId: existing.id };
		if (existing.domains.length >= MAX_COMPETITOR_DOMAINS) {
			throw new Error(`Cannot add domain. Maximum of ${MAX_COMPETITOR_DOMAINS} competitor domains reached.`);
		}

		const updatedDomains = [...existing.domains, domain];
		const [result] = await db
			.update(competitors)
			.set({ domains: updatedDomains, updatedAt: new Date() })
			.where(eq(competitors.id, data.competitorId))
			.returning({ id: competitors.id });

		if (!result) throw new Error("Failed to update competitor");
		return { success: true, competitorId: result.id };
	});

/**
 * Create a new competitor from a domain
 */
export const createCompetitorFromDomainFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string(),
			name: z.string().trim().min(1).max(MAX_COMPETITOR_NAME_LENGTH),
			domain: z.string().trim().min(1).max(MAX_DOMAIN_INPUT_LENGTH),
		}),
	)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandWriteAccess(session.user.id, data.brandId);

		const domain = cleanAndValidateDomain(data.domain);
		if (!domain) throw new Error(`Invalid domain: ${data.domain}`);

		const [currentCount] = await db
			.select({ count: count() })
			.from(competitors)
			.where(eq(competitors.brandId, data.brandId));

		if ((currentCount?.count || 0) >= MAX_COMPETITORS) {
			throw new Error(`Cannot add competitor. Maximum of ${MAX_COMPETITORS} competitors reached.`);
		}

		const [result] = await db
			.insert(competitors)
			.values({
				brandId: data.brandId,
				name: data.name.trim(),
				domains: [domain],
			})
			.returning({ id: competitors.id });

		if (!result) throw new Error("Failed to create competitor");
		return { success: true, competitorId: result.id };
	});
