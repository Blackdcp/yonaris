import { db } from "@workspace/lib/db/db";
import { brands, measurementScopes, member, prompts } from "@workspace/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { evaluateCustomerProgramProvisionAccess } from "@/lib/auth/program-policies";

const samplingMarketSchema = z
	.string()
	.trim()
	.regex(/^[A-Za-z]{2}$/, "market must be a two-letter country or market code")
	.transform((value) => value.toUpperCase())
	.refine((value) => value !== "ZZ", "sampling scopes require an explicit market");

const samplingLocaleSchema = z
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
	.transform((value) => Intl.getCanonicalLocales(value)[0] ?? value)
	.refine((value) => value !== "und", "sampling scopes require an explicit locale");

const samplingTimezoneSchema = z
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

export const provisionSamplingScopeInputSchema = z.object({
	brandId: z.string().trim().min(1, "brandId is required"),
	key: z
		.string()
		.trim()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "key must be a lowercase slug"),
	name: z.string().trim().min(1).max(120),
	market: samplingMarketSchema,
	locale: samplingLocaleSchema,
	timezone: samplingTimezoneSchema,
	evaluationRole: z.enum(["scored", "observation"]),
	sourceScopeId: z.guid().optional(),
});

export type ProvisionSamplingScopeInput = z.infer<typeof provisionSamplingScopeInputSchema>;
type MeasurementScope = typeof measurementScopes.$inferSelect;

export interface SamplingScopeSourcePrompt {
	brandId: string;
	scopeId: string | null;
	value: string;
	enabled: boolean;
	tags: string[];
	systemTags: string[];
}

export interface ManualSamplingScopeInsert {
	brandId: string;
	key: string;
	name: string;
	market: string;
	locale: string;
	timezone: string;
	automaticTargetKeys: string[];
	samplingEvaluationRole: "scored" | "observation";
	enabled: true;
	isDefault: false;
}

export interface SamplingScopeProvisioningRepository {
	lockBrand(brandId: string): Promise<{ organizationId: string } | null>;
	listMembershipRolesForUpdate(userId: string, organizationId: string, limit: number): Promise<string[]>;
	findScopeIdByKey(brandId: string, key: string): Promise<string | null>;
	sourceScopeBelongsToBrand(sourceScopeId: string, brandId: string): Promise<boolean>;
	listSourcePrompts(brandId: string, sourceScopeId: string): Promise<SamplingScopeSourcePrompt[]>;
	insertManualScope(input: ManualSamplingScopeInsert): Promise<MeasurementScope | null>;
	insertPromptCopies(scopeId: string, promptsToCopy: SamplingScopeSourcePrompt[]): Promise<void>;
}

export async function provisionManualSamplingScopeWithRepository(
	data: ProvisionSamplingScopeInput,
	repository: SamplingScopeProvisioningRepository,
	options: { expectedOrganizationId?: string; expectedUserId?: string } = {},
): Promise<{ scope: MeasurementScope; copiedPromptCount: number }> {
	const lockedBrand = await repository.lockBrand(data.brandId);
	if (!lockedBrand) throw new Error(`Brand "${data.brandId}" not found`);
	if (options.expectedOrganizationId && lockedBrand.organizationId !== options.expectedOrganizationId) {
		throw new Error("Not Found: Brand is not accessible");
	}
	if (options.expectedOrganizationId || options.expectedUserId) {
		if (!options.expectedOrganizationId || !options.expectedUserId) {
			throw new Error("Customer program authorization context is incomplete");
		}
		const roles = await repository.listMembershipRolesForUpdate(
			options.expectedUserId,
			options.expectedOrganizationId,
			2,
		);
		if (roles.length === 0) throw new Error("Not Found: Brand is not accessible");
		if (roles.length > 1) throw new Error("Forbidden: Ambiguous organization membership");
		if (evaluateCustomerProgramProvisionAccess(roles[0]) === "deny") {
			throw new Error("Forbidden: Only organization owners and admins can create programs");
		}
	}

	if (await repository.findScopeIdByKey(data.brandId, data.key)) {
		throw new Error(`Measurement scope key "${data.key}" already exists for this brand`);
	}

	let sourcePrompts: SamplingScopeSourcePrompt[] = [];
	if (data.sourceScopeId) {
		if (!(await repository.sourceScopeBelongsToBrand(data.sourceScopeId, data.brandId))) {
			throw new Error("The prompt source scope does not belong to this brand");
		}

		const candidates = await repository.listSourcePrompts(data.brandId, data.sourceScopeId);
		sourcePrompts = candidates.filter(
			(prompt) => prompt.brandId === data.brandId && prompt.scopeId === data.sourceScopeId && prompt.enabled,
		);
	}

	const scope = await repository.insertManualScope({
		brandId: data.brandId,
		key: data.key,
		name: data.name,
		market: data.market,
		locale: data.locale,
		timezone: data.timezone,
		automaticTargetKeys: [],
		samplingEvaluationRole: data.evaluationRole,
		enabled: true,
		isDefault: false,
	});
	if (!scope) throw new Error("Failed to create sampling measurement scope");

	if (sourcePrompts.length > 0) await repository.insertPromptCopies(scope.id, sourcePrompts);

	return { scope, copiedPromptCount: sourcePrompts.length };
}

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

export async function provisionManualSamplingScope(
	data: ProvisionSamplingScopeInput,
	options: { expectedOrganizationId?: string; expectedUserId?: string } = {},
): Promise<{ scope: MeasurementScope; copiedPromptCount: number }> {
	try {
		return await db.transaction(async (tx) =>
			provisionManualSamplingScopeWithRepository(
				data,
				{
					lockBrand: async (brandId) => {
						const [lockedBrand] = await tx
							.select({ organizationId: brands.organizationId })
							.from(brands)
							.where(eq(brands.id, brandId))
							.limit(1)
							.for("update");
						return lockedBrand ?? null;
					},
					listMembershipRolesForUpdate: async (userId, organizationId, limit) => {
						const rows = await tx
							.select({ role: member.role })
							.from(member)
							.where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
							.limit(limit)
							.for("share");
						return rows.map(({ role }) => role);
					},
					findScopeIdByKey: async (brandId, key) => {
						const existing = await tx.query.measurementScopes.findFirst({
							where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, key)),
							columns: { id: true },
						});
						return existing?.id ?? null;
					},
					sourceScopeBelongsToBrand: async (sourceScopeId, brandId) => {
						const sourceScope = await tx.query.measurementScopes.findFirst({
							where: and(eq(measurementScopes.id, sourceScopeId), eq(measurementScopes.brandId, brandId)),
							columns: { id: true },
						});
						return Boolean(sourceScope);
					},
					listSourcePrompts: (brandId, sourceScopeId) =>
						tx
							.select({
								brandId: prompts.brandId,
								scopeId: prompts.scopeId,
								value: prompts.value,
								enabled: prompts.enabled,
								tags: prompts.tags,
								systemTags: prompts.systemTags,
							})
							.from(prompts)
							.where(and(eq(prompts.brandId, brandId), eq(prompts.scopeId, sourceScopeId), eq(prompts.enabled, true)))
							.orderBy(asc(prompts.createdAt), asc(prompts.id)),
					insertManualScope: async (input) => {
						const [scope] = await tx.insert(measurementScopes).values(input).returning();
						return scope ?? null;
					},
					insertPromptCopies: async (scopeId, promptsToCopy) => {
						await tx.insert(prompts).values(
							promptsToCopy.map((prompt) => ({
								brandId: data.brandId,
								scopeId,
								value: prompt.value,
								enabled: true,
								tags: prompt.tags,
								systemTags: prompt.systemTags,
							})),
						);
					},
				},
				options,
			),
		);
	} catch (error) {
		if (isUniqueConstraintError(error, "measurement_scopes_brand_key_uidx")) {
			throw new Error(`Measurement scope key "${data.key}" already exists for this brand`);
		}
		throw error;
	}
}
