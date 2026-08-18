import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { selectImplicitMeasurementScope } from "../measurement-scope-selection";
import { db } from "./db";
import { type MeasurementScope, measurementScopes, prompts } from "./schema";

export const LEGACY_SCOPE = {
	key: "legacy-unspecified",
	name: "Legacy / Unspecified",
	market: "ZZ",
	locale: "und",
	timezone: "UTC",
} as const;

/**
 * Return the compatibility scope used by existing brand and prompt creation
 * paths until the product exposes explicit scope selection.
 */
export async function ensureLegacyMeasurementScope(brandId: string): Promise<string> {
	const existing = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, LEGACY_SCOPE.key)),
		columns: { id: true },
	});
	if (existing) return existing.id;

	const defaultScope = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.isDefault, true)),
		columns: { id: true },
	});
	const [inserted] = await db
		.insert(measurementScopes)
		.values({
			brandId,
			...LEGACY_SCOPE,
			isDefault: !defaultScope,
		})
		.onConflictDoNothing()
		.returning({ id: measurementScopes.id });

	if (inserted) return inserted.id;

	const concurrentlyInserted = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, LEGACY_SCOPE.key)),
		columns: { id: true },
	});
	if (concurrentlyInserted) return concurrentlyInserted.id;

	// Another request may have created a default scope between the read and the
	// insert. In that case the partial unique default index rejects the first
	// insert; retry the compatibility scope as non-default.
	const [fallback] = await db
		.insert(measurementScopes)
		.values({ brandId, ...LEGACY_SCOPE, isDefault: false })
		.onConflictDoNothing({ target: [measurementScopes.brandId, measurementScopes.key] })
		.returning({ id: measurementScopes.id });
	if (fallback) return fallback.id;

	const finalExisting = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, LEGACY_SCOPE.key)),
		columns: { id: true },
	});
	if (!finalExisting) throw new Error(`Failed to resolve the legacy measurement scope for brand ${brandId}`);
	return finalExisting.id;
}

export async function resolveMeasurementScopeForBrand(brandId: string, scopeId?: string): Promise<MeasurementScope> {
	let resolvedScopeId = scopeId;
	if (!resolvedScopeId) {
		const candidates = await db
			.select({
				id: measurementScopes.id,
				enabled: measurementScopes.enabled,
				isDefault: measurementScopes.isDefault,
				samplingEvaluationRole: measurementScopes.samplingEvaluationRole,
				enabledPromptCount: count(prompts.id),
			})
			.from(measurementScopes)
			.leftJoin(
				prompts,
				and(eq(prompts.scopeId, measurementScopes.id), eq(prompts.brandId, brandId), eq(prompts.enabled, true)),
			)
			.where(and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.enabled, true)))
			.groupBy(measurementScopes.id)
			.orderBy(desc(measurementScopes.isDefault), asc(measurementScopes.createdAt), asc(measurementScopes.id));
		const selected = selectImplicitMeasurementScope(
			candidates.map((candidate) => ({
				...candidate,
				hasEnabledPrompts: candidate.enabledPromptCount > 0,
			})),
		);
		resolvedScopeId = selected?.id ?? (await ensureLegacyMeasurementScope(brandId));
	}
	const scope = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.id, resolvedScopeId), eq(measurementScopes.brandId, brandId)),
	});
	if (!scope) {
		throw new Error(`Measurement scope ${resolvedScopeId} does not belong to brand ${brandId}`);
	}
	if (!scope.enabled) {
		throw new Error(`Measurement scope ${scope.key} is disabled`);
	}
	return scope;
}

export async function resolvePromptMeasurementScope(prompt: {
	id: string;
	brandId: string;
	scopeId: string | null;
}): Promise<MeasurementScope> {
	let scopeId = prompt.scopeId;
	if (!scopeId) {
		scopeId = await ensureLegacyMeasurementScope(prompt.brandId);
		await db
			.update(prompts)
			.set({ scopeId })
			.where(and(eq(prompts.id, prompt.id), eq(prompts.brandId, prompt.brandId), isNull(prompts.scopeId)));
	}

	return resolveMeasurementScopeForBrand(prompt.brandId, scopeId);
}
