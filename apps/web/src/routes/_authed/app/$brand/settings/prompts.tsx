/**
 * /app/$brand/settings/prompts - Prompt management page
 *
 * Editor to add/edit/remove prompts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@workspace/lib/db/db";
import { ensureLegacyMeasurementScope } from "@workspace/lib/db/measurement-scopes";
import { measurementScopes, prompts } from "@workspace/lib/db/schema";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { PromptsEditor } from "@/components/prompts-editor";
import { requireAuthSession, requireBrandAccess } from "@/lib/auth/helpers";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

const getPromptsForEditing = createServerFn({ method: "GET" })
	.validator(z.object({ brandId: z.string(), scopeId: z.string().uuid().optional() }))
	.handler(async ({ data }) => {
		const session = await requireAuthSession();
		await requireBrandAccess(session.user.id, data.brandId);

		const scopes = await db.query.measurementScopes.findMany({
			where: and(eq(measurementScopes.brandId, data.brandId), eq(measurementScopes.enabled, true)),
			orderBy: (scope, { asc, desc }) => [desc(scope.isDefault), asc(scope.createdAt)],
		});
		const requestedScope = data.scopeId ? scopes.find((scope) => scope.id === data.scopeId) : undefined;
		if (data.scopeId && !requestedScope) {
			throw new Error("Not Found: Measurement program is not accessible");
		}
		// Customer configuration starts in a manual Program. Legacy/automatic
		// scopes remain visible in analytics, but execution configuration belongs
		// to the platform console and must never be the accidental edit target.
		const scope =
			requestedScope ?? scopes.find((candidate) => candidate.automaticTargetKeys?.length === 0) ?? scopes[0];
		const scopeId = scope?.id ?? (await ensureLegacyMeasurementScope(data.brandId));

		// Fetch all prompts (including disabled) for this measurement scope.
		const brandPrompts = await db
			.select()
			.from(prompts)
			.where(and(eq(prompts.brandId, data.brandId), eq(prompts.scopeId, scopeId)))
			.orderBy(prompts.value, desc(prompts.enabled), prompts.id);

		return { prompts: brandPrompts, scopeId, scopeName: scope?.name ?? "Legacy / Unspecified" };
	});

function PromptsSettingsSkeleton() {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-5 w-80" />
			</div>
			<div className="space-y-3">
				{[0, 1, 2, 3, 4].map((n) => (
					<div key={n} className="flex items-center gap-3 p-3 border rounded-lg">
						<Skeleton className="h-5 w-5" />
						<Skeleton className="h-5 flex-1" />
						<Skeleton className="h-8 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}

export const Route = createFileRoute("/_authed/app/$brand/settings/prompts")({
	loaderDeps: ({ search }) => ({
		scopeId: z.string().uuid().safeParse(search.scope).success ? search.scope : undefined,
	}),
	loader: async ({ params, deps }) => {
		return getPromptsForEditing({ data: { brandId: params.brand, scopeId: deps.scopeId } });
	},
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		return {
			meta: [
				{ title: buildTitle("Prompts", { appName, brandName }) },
				{ name: "description", content: "Add, edit, or remove tracked prompts." },
			],
		};
	},
	pendingComponent: PromptsSettingsSkeleton,
	component: PromptsSettingsPage,
});

function PromptsSettingsPage() {
	const { prompts: brandPrompts, scopeId, scopeName } = Route.useLoaderData();
	const { brand: brandId } = Route.useParams();

	return (
		<PromptsEditor
			key={scopeId}
			initialPrompts={brandPrompts}
			brandId={brandId}
			scopeId={scopeId}
			pageTitle={`Prompts - ${scopeName}`}
			pageDescription="Add, edit, or remove prompts for this measurement scope"
		/>
	);
}
