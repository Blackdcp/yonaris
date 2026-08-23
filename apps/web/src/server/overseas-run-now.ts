import { isAbsolute } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@workspace/lib/db/db";
import {
	createOverseasRunCohort,
	listOverseasRunCohorts,
	summarizeOverseasRunCohort,
} from "@workspace/lib/db/overseas-runs";
import { brands, measurementScopes, prompts } from "@workspace/lib/db/schema";
import { getProvider } from "@workspace/lib/providers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { dispatchOverseasRunCalls } from "./overseas-run-dispatch";
import {
	assertOverseasRunNowChannelsReady,
	assertOverseasRunNowPromptCompatibility,
	assertOverseasRunNowProvidersConfigured,
	planOverseasRunNow,
} from "./overseas-run-now-policy";

const channelKeySchema = z.enum(["chatgpt", "perplexity", "gemini", "copilot", "google-ai-mode", "google-ai-overview"]);

const runInputSchema = z
	.object({
		brandId: z.string().trim().min(1).max(200),
		scopeId: z.guid(),
		channelKeys: z.array(channelKeySchema).min(1).max(6),
		idempotencyKey: z.string().trim().min(1).max(200),
	})
	.strict();

const listInputSchema = z.object({
	brandId: z.string().trim().min(1).max(200),
	limit: z.number().int().min(1).max(50).default(20),
});

async function requirePlatformAdmin() {
	const session = await requireAuthSession();
	if (!isAdmin(session)) throw new Error("Forbidden: Platform administrator access required");
	return session;
}

export const runOverseasNowFn = createServerFn({ method: "POST" })
	.validator(runInputSchema)
	.handler(async ({ data }) => {
		const session = await requirePlatformAdmin();
		if (
			process.env.RESPONSE_SNAPSHOT_ENABLED !== "true" ||
			!process.env.RESPONSE_SNAPSHOT_ROOT ||
			!isAbsolute(process.env.RESPONSE_SNAPSHOT_ROOT)
		) {
			throw new Error("HTML/JSON response snapshot storage is not ready");
		}
		const [brand, scope, enabledPrompts] = await Promise.all([
			db.query.brands.findFirst({ where: eq(brands.id, data.brandId) }),
			db.query.measurementScopes.findFirst({
				where: and(eq(measurementScopes.id, data.scopeId), eq(measurementScopes.brandId, data.brandId)),
			}),
			db
				.select({ id: prompts.id, value: prompts.value })
				.from(prompts)
				.where(and(eq(prompts.brandId, data.brandId), eq(prompts.scopeId, data.scopeId), eq(prompts.enabled, true))),
		]);
		if (!brand || !scope) throw new Error("The selected customer or Program does not exist");
		if (
			!scope.enabled ||
			scope.samplingEvaluationRole !== "scored" ||
			!Array.isArray(scope.automaticTargetKeys) ||
			scope.automaticTargetKeys.length !== 0 ||
			scope.market.toUpperCase() === "CN"
		) {
			throw new Error("Select an enabled, scored, manual-only overseas Program");
		}
		const plan = planOverseasRunNow({
			prompts: enabledPrompts,
			channelKeys: data.channelKeys,
			scope: { market: scope.market, locale: scope.locale, timezone: scope.timezone },
		});
		assertOverseasRunNowProvidersConfigured(plan.channels, (provider) => getProvider(provider).isConfigured());
		assertOverseasRunNowPromptCompatibility(
			plan.calls,
			(provider, prompt) => getProvider(provider).validatePrompt?.(prompt) ?? null,
		);
		await assertOverseasRunNowChannelsReady(
			plan.channels,
			(config) => getProvider(config.provider).validateTarget?.(config) ?? null,
			async (config) => (await getProvider(config.provider).preflightTarget?.(config)) ?? null,
		);
		const created = await createOverseasRunCohort({
			brandId: data.brandId,
			scopeId: data.scopeId,
			idempotencyKey: data.idempotencyKey,
			manifest: plan.manifest,
			manifestFingerprint: plan.manifestFingerprint,
			createdBy: session.user.id,
			calls: plan.calls.map((call) => ({
				promptId: call.promptId,
				promptText: call.promptText,
				channelKey: call.channelKey,
				model: call.config.model,
				provider: call.config.provider,
				requestedVersion: call.config.version,
				webSearchEnabled: call.config.webSearch,
				surfaceTargetKey: call.surfaceTargetKey,
				captureRouteKey: call.captureRouteKey,
				sampleIndex: call.sampleIndex,
			})),
		});
		const dispatch = await dispatchOverseasRunCalls(created.cohort.id);
		return {
			cohortId: created.cohort.id,
			created: created.created,
			callCount: plan.callCount,
			dispatch,
		};
	});

export const listOverseasRunCohortsFn = createServerFn({ method: "GET" })
	.validator(listInputSchema)
	.handler(async ({ data }) => {
		await requirePlatformAdmin();
		const cohorts = await listOverseasRunCohorts(data);
		return {
			cohorts: await Promise.all(
				cohorts.map(async (cohort) => ({
					id: cohort.id,
					brandId: cohort.brandId,
					scopeId: cohort.scopeId,
					status: cohort.status,
					plannedCallCount: cohort.plannedCallCount,
					createdAt: cohort.createdAt.toISOString(),
					completedAt: cohort.completedAt?.toISOString() ?? null,
					progress: await summarizeOverseasRunCohort(cohort.id),
				})),
			),
		};
	});
