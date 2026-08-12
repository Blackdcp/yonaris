import { createServerFn } from "@tanstack/react-start";
import { db } from "@workspace/lib/db/db";
import { resolveMeasurementScopeForBrand } from "@workspace/lib/db/measurement-scopes";
import { brands, promptRuns } from "@workspace/lib/db/schema";
import { parseScrapeTargets, selectTargetsForBrand } from "@workspace/lib/providers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuthSession, requireBrandAccess } from "@/lib/auth/helpers";

export const getScopeModelsFn = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string(), scopeId: z.string().uuid() }))
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandAccess(session.user.id, data.brandId);
		const [scope, brand, observedModels] = await Promise.all([
			resolveMeasurementScopeForBrand(data.brandId, data.scopeId),
			db.query.brands.findFirst({
				where: eq(brands.id, data.brandId),
				columns: { enabledModels: true },
			}),
			db
				.selectDistinct({ model: promptRuns.model })
				.from(promptRuns)
				.where(and(eq(promptRuns.brandId, data.brandId), eq(promptRuns.scopeId, data.scopeId))),
		]);
		if (!brand) throw new Error("Brand not found");

		const automaticTargets =
			scope.automaticTargetKeys === null
				? selectTargetsForBrand(parseScrapeTargets(process.env.SCRAPE_TARGETS), brand.enabledModels)
				: scope.automaticTargetKeys.length > 0
					? parseScrapeTargets(scope.automaticTargetKeys.join(","))
					: [];
		return [
			...new Set([...automaticTargets.map((target) => target.model), ...observedModels.map(({ model }) => model)]),
		].sort();
	});
