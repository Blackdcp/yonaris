import { and, eq, isNull } from "drizzle-orm";
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
	const [inserted] = await db
		.insert(measurementScopes)
		.values({
			brandId,
			...LEGACY_SCOPE,
			isDefault: true,
		})
		.onConflictDoNothing({ target: [measurementScopes.brandId, measurementScopes.key] })
		.returning({ id: measurementScopes.id });

	if (inserted) return inserted.id;

	const existing = await db.query.measurementScopes.findFirst({
		where: and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, LEGACY_SCOPE.key)),
		columns: { id: true },
	});
	if (!existing) {
		throw new Error(`Failed to resolve the legacy measurement scope for brand ${brandId}`);
	}

	return existing.id;
}

export async function resolveMeasurementScopeForBrand(brandId: string, scopeId?: string): Promise<MeasurementScope> {
	const resolvedScopeId = scopeId ?? (await ensureLegacyMeasurementScope(brandId));
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
