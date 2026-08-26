/**
 * /app/$brand/citations - Citations tracking page
 *
 * Shows citation statistics with filtering by model, tags, and lookback period.
 */

import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { CitationsDisplay } from "@/components/citations-display";
import { ALL_MODELS_VALUE, getAvailableModels } from "@/components/filter-bar";
import { FilteredListShell } from "@/components/filtered-list-shell";
import { PageHeader } from "@/components/page-header";
import { useBrandAccess } from "@/hooks/use-brand-access";
import { brandKeys, useBrand } from "@/hooks/use-brands";
import { useCitations } from "@/hooks/use-citations";
import { dashboardKeys } from "@/hooks/use-dashboard-summary";
import { useListFilters } from "@/hooks/use-list-filters";
import { useScopeModels } from "@/hooks/use-scope-models";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { getDaysFromLookback } from "@/lib/chart-utils";
import { getGoogleModuleCitationCount } from "@/lib/google-module";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/$brand/citations")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "citation.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "citation.meta.description") },
			],
		};
	},
	component: CitationsPage,
});

function CitationsPage() {
	const { t, formatNumber } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { canManageBrand } = useBrandAccess();
	const queryClient = useQueryClient();

	const filters = useListFilters();
	const days = getDaysFromLookback(filters.lookback);

	const { brand } = useBrand(brandId);
	const { models: scopeModels, isResolved: scopeModelsResolved } = useScopeModels(brandId, filters.scopeId);
	const availableModels = getAvailableModels(scopeModels);

	// Get citation data with tag and model filter
	const modelParam =
		filters.model === ALL_MODELS_VALUE || (scopeModelsResolved && !scopeModels.includes(filters.model))
			? undefined
			: filters.model;
	const {
		citations: citationData,
		isLoading,
		isError,
		revalidate: revalidateCitations,
	} = useCitations(brandId, {
		scopeId: filters.scopeId ?? "",
		days,
		tags: filters.tags.length > 0 ? filters.tags : undefined,
		model: modelParam,
	});

	const infoContent = (
		<>
			<p className="mb-2">{t("citation.info")}</p>
			<p>
				{t("citation.competitorInfo")}{" "}
				{canManageBrand ? (
					<Link to="/app/$brand/settings/competitors" params={{ brand: brandId }} className="underline">
						{t("citation.trackedCompetitors")}
					</Link>
				) : null}
			</p>
		</>
	);

	const showFullSkeleton = filters.isScopeResolving || (isLoading && !citationData);
	const emptyDescription =
		citationData?.citationAvailability.kind === "no_evaluated_runs"
			? t("citation.noRuns")
			: citationData?.citationAvailability.kind === "no_search_enabled_runs"
				? t("citation.availability.noSearch", { runs: formatNumber(citationData.evaluatedRuns) })
				: t("citation.availability.noLinks", {
						runs: formatNumber(citationData?.evaluatedRuns ?? 0),
						searchRuns: formatNumber(citationData?.searchEnabledRuns ?? 0),
					});

	return (
		<PageHeader title={t("citation.title")} subtitle={t("citation.description")} infoContent={infoContent}>
			<FilteredListShell
				filters={filters}
				availableTags={citationData?.availableTags || []}
				availableModels={availableModels}
				showModelSelector
				isLoading={showFullSkeleton}
				loadingState={
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-48" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
								<Skeleton className="h-4 w-2/3" />
							</div>
						</CardContent>
					</Card>
				}
				isError={!filters.isScopeResolving && Boolean(isError) && !citationData}
				errorState={
					<Card>
						<CardContent className="pt-6">
							<div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{t("citation.error")}</div>
						</CardContent>
					</Card>
				}
				totalCount={
					citationData
						? citationData.totalCitations + getGoogleModuleCitationCount(citationData.googleModule)
						: undefined
				}
				noMatchesTitle={t("citation.noMatches")}
				noMatchesDescription={t("customer.filters.tryAdjust")}
				emptyState={
					<Card>
						<CardContent className="pt-6">
							<div className="text-muted-foreground text-center py-8">{emptyDescription}</div>
						</CardContent>
					</Card>
				}
			>
				{citationData && (
					<CitationsDisplay
						citationData={citationData}
						brandId={brandId}
						brandName={brand?.name}
						showStats={true}
						maxDomains={10}
						maxUrls={20}
						days={days}
						canManageBrand={canManageBrand}
						onCompetitorAdded={() => {
							revalidateCitations();
							queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
							queryClient.invalidateQueries({ queryKey: brandKeys.competitors(brandId) });
							queryClient.invalidateQueries({ queryKey: brandKeys.detail(brandId) });
						}}
					/>
				)}
			</FilteredListShell>
		</PageHeader>
	);
}
