/**
 * /app/$brand/settings/prompts - Prompt management page
 *
 * Editor to add/edit/remove prompts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { LEGACY_SCOPE } from "@workspace/lib/db/measurement-scopes";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { z } from "zod";
import { PromptsEditor } from "@/components/prompts-editor";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { getBrand } from "@/server/brands";

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
	validateSearch: (search: Record<string, unknown>): { scope?: string } => ({
		scope: z.string().uuid().safeParse(search.scope).success ? (search.scope as string) : undefined,
	}),
	loaderDeps: ({ search }) => ({ scopeId: search.scope }),
	loader: async ({ params }) => getBrand({ data: { brandId: params.brand } }),
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches as unknown as Array<{ loaderData?: Record<string, unknown> }>);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "settings.prompts.metaTitle"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "settings.prompts.metaDescription") },
			],
		};
	},
	pendingComponent: PromptsSettingsSkeleton,
	component: PromptsSettingsPage,
});

function PromptsSettingsPage() {
	const { t } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { scope: requestedScopeId } = Route.useSearch();
	const brand = Route.useLoaderData();

	if (!brand) {
		return (
			<p className="text-sm text-destructive" role="alert">
				{t("common.error.unexpected")}
			</p>
		);
	}

	const enabledScopes = (brand.measurementScopes ?? []).filter((scope) => scope.enabled);
	const scope =
		enabledScopes.find((candidate) => candidate.id === requestedScopeId) ??
		enabledScopes.find((candidate) => candidate.deliveryMode === "assisted") ??
		enabledScopes.find((candidate) => candidate.isDefault) ??
		enabledScopes[0];
	if (!scope) {
		return (
			<p className="text-sm text-destructive" role="alert">
				{t("common.error.unexpected")}
			</p>
		);
	}

	const brandPrompts = (brand.prompts ?? [])
		.filter((prompt) => prompt.scopeId === scope.id)
		.sort((left, right) => left.value.localeCompare(right.value) || left.id.localeCompare(right.id));
	const displayScopeName = scope.key === LEGACY_SCOPE.key ? t("settings.prompts.legacyScope") : scope.name;

	return (
		<PromptsEditor
			key={scope.id}
			initialPrompts={brandPrompts}
			brandId={brandId}
			scopeId={scope.id}
			pageTitle={t("settings.prompts.title", { scope: displayScopeName })}
			pageDescription={t("settings.prompts.description")}
		/>
	);
}
