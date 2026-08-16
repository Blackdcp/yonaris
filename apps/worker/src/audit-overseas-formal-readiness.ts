import { getDefaultDelayHours, getRunsPerPrompt } from "@workspace/lib/constants";
import { db } from "@workspace/lib/db/db";
import { brands, measurementScopes, prompts } from "@workspace/lib/db/schema";
import { resolveObservationTarget } from "@workspace/lib/observation-targets";
import { getProvider, parseScrapeTargets, selectTargetsForBrand } from "@workspace/lib/providers";
import { and, asc, eq } from "drizzle-orm";
import { buildOverseasFormalReadiness, countCanonicalReviewedPrompts } from "./overseas-formal-readiness";
import { EXPECTED_STEPFUN_PROMPTS } from "./sampling-batch-request";

function selectExactlyOne<T>(rows: T[], entity: string): T {
	if (rows.length !== 1) throw new Error(`${entity} did not resolve exactly once`);
	return rows[0] as T;
}

async function main(): Promise<void> {
	const brand = selectExactlyOne(
		await db
			.select({
				id: brands.id,
				name: brands.name,
				enabled: brands.enabled,
				enabledModels: brands.enabledModels,
				delayOverrideHours: brands.delayOverrideHours,
			})
			.from(brands)
			.where(eq(brands.name, "StepFun"))
			.limit(2),
		"StepFun brand",
	);
	const scope = selectExactlyOne(
		await db
			.select({
				id: measurementScopes.id,
				key: measurementScopes.key,
				enabled: measurementScopes.enabled,
				automaticTargetKeys: measurementScopes.automaticTargetKeys,
			})
			.from(measurementScopes)
			.where(and(eq(measurementScopes.brandId, brand.id), eq(measurementScopes.key, "cn-zh-scored")))
			.limit(2),
		"StepFun CN source scope",
	);
	const promptRows = await db
		.select({ value: prompts.value })
		.from(prompts)
		.where(and(eq(prompts.brandId, brand.id), eq(prompts.scopeId, scope.id), eq(prompts.enabled, true)))
		.orderBy(asc(prompts.createdAt), asc(prompts.id));
	const exactPromptMatchCount = countCanonicalReviewedPrompts(
		promptRows.map(({ value }) => value),
		EXPECTED_STEPFUN_PROMPTS,
	);
	const configuredTargets = parseScrapeTargets(process.env.SCRAPE_TARGETS);
	const brandTargets = selectTargetsForBrand(configuredTargets, brand.enabledModels);
	const brightDataConfigs = brandTargets.filter((target) => target.provider === "brightdata");
	const brightDataTargets = brightDataConfigs.map((config) => {
		const target = resolveObservationTarget(config);
		return {
			model: config.model,
			webSearch: config.webSearch,
			surfaceTargetKey: target.surfaceTargetKey,
			captureRouteKey: target.captureRouteKey,
		};
	});
	const report = buildOverseasFormalReadiness({
		brand: {
			name: brand.name,
			enabled: brand.enabled,
			enabledModels: brand.enabledModels,
			delayHours: brand.delayOverrideHours ?? getDefaultDelayHours(),
		},
		sourceScope: {
			key: scope.key,
			enabled: scope.enabled,
			automaticTargetKeys: scope.automaticTargetKeys,
			promptCount: promptRows.length,
			exactPromptMatchCount,
		},
		brightDataTargets,
		providerConfigured: getProvider("brightdata").isConfigured(),
		responseSnapshotsEnabled: process.env.RESPONSE_SNAPSHOT_ENABLED === "true",
		runsPerPrompt: getRunsPerPrompt(),
	});
	process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch(() => {
	process.stderr.write(
		`${JSON.stringify({ ok: false, operation: "overseas_formal_readiness", code: "readiness_audit_failed" })}\n`,
	);
	process.exitCode = 1;
});
