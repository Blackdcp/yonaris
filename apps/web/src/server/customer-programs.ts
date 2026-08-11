import { createServerFn } from "@tanstack/react-start";
import { db } from "@workspace/lib/db/db";
import { brands, measurementScopes, member, prompts } from "@workspace/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuthSession } from "@/lib/auth/helpers";
import { type CustomerProgramAccessStore, resolveCustomerProgramAccess } from "@/lib/auth/program-access";
import { provisionManualSamplingScope, provisionSamplingScopeInputSchema } from "./sampling-scope-provisioning";

const customerProgramsInputSchema = z.object({ brandId: z.string().trim().min(1, "brandId is required") });

const accessStore: CustomerProgramAccessStore = {
	findBrand: async (brandId) => {
		const [brand] = await db
			.select({ id: brands.id, name: brands.name, organizationId: brands.organizationId })
			.from(brands)
			.where(eq(brands.id, brandId))
			.limit(1);
		return brand ?? null;
	},
	listMembershipRoles: async (userId, organizationId, limit) =>
		db
			.select({ role: member.role })
			.from(member)
			.where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
			.limit(limit)
			.then((rows) => rows.map(({ role }) => role)),
};

async function requireCustomerProgramAccess(userId: string, brandId: string) {
	return resolveCustomerProgramAccess({ userId, brandId }, accessStore);
}

export const getCustomerProgramContextFn = createServerFn({ method: "GET" })
	.validator(customerProgramsInputSchema)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		const access = await requireCustomerProgramAccess(session.user.id, data.brandId);
		const [scopeRows, promptRows] = await Promise.all([
			db
				.select()
				.from(measurementScopes)
				.where(eq(measurementScopes.brandId, access.brand.id))
				.orderBy(asc(measurementScopes.createdAt), asc(measurementScopes.id)),
			db
				.select({ scopeId: prompts.scopeId, enabled: prompts.enabled })
				.from(prompts)
				.where(eq(prompts.brandId, access.brand.id)),
		]);

		const promptCounts = new Map<string, { total: number; enabled: number }>();
		for (const prompt of promptRows) {
			if (!prompt.scopeId) continue;
			const counts = promptCounts.get(prompt.scopeId) ?? { total: 0, enabled: 0 };
			counts.total += 1;
			if (prompt.enabled) counts.enabled += 1;
			promptCounts.set(prompt.scopeId, counts);
		}

		return {
			brand: { id: access.brand.id, name: access.brand.name },
			canProvision: access.canProvision,
			membershipRole: access.membershipRole,
			programs: scopeRows.map((scope) => ({
				id: scope.id,
				key: scope.key,
				name: scope.name,
				market: scope.market,
				locale: scope.locale,
				timezone: scope.timezone,
				enabled: scope.enabled,
				isDefault: scope.isDefault,
				manualOnly: scope.automaticTargetKeys !== null && scope.automaticTargetKeys.length === 0,
				samplingEvaluationRole: scope.samplingEvaluationRole,
				promptCount: promptCounts.get(scope.id)?.total ?? 0,
				enabledPromptCount: promptCounts.get(scope.id)?.enabled ?? 0,
			})),
		};
	});

export const provisionCustomerProgramScopeFn = createServerFn({ method: "POST" })
	.validator(provisionSamplingScopeInputSchema)
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		const access = await requireCustomerProgramAccess(session.user.id, data.brandId);
		if (!access.canProvision) {
			throw new Error("Forbidden: Only organization owners and admins can create programs");
		}

		const result = await provisionManualSamplingScope(data, {
			expectedOrganizationId: access.brand.organizationId,
			expectedUserId: session.user.id,
		});
		return { scopeId: result.scope.id, copiedPromptCount: result.copiedPromptCount };
	});
