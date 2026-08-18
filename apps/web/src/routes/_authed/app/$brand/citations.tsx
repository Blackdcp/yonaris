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
import { getDaysFromLookback } from "@/lib/chart-utils";
import { getGoogleModuleCitationCount } from "@/lib/google-module";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

export const Route = createFileRoute("/_authed/app/$brand/citations")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		return {
			meta: [
				{ title: buildTitle("Citations", { appName, brandName }) },
				{ name: "description", content: "See which sources LLMs cite in responses to your prompts." },
			],
		};
	},
	component: CitationsPage,
});

function CitationsPage() {
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
			<p className="mb-2">
				Citations are the links and sources that AI models include in their responses when answering your prompts. They
				show which websites the AI considers authoritative or relevant to your topics.
			</p>
			<p>
				<strong>Competitor</strong> domains are only those you&apos;ve added to your{" "}
				{canManageBrand ? (
					<Link to="/app/$brand/settings/competitors" params={{ brand: brandId }} className="underline">
						tracked competitors list
					</Link>
				) : (
					"tracked competitors list"
				)}
				. Other domains appear under their detected category (Google, Social Media, Institutional, or Other).
			</p>
		</>
	);

	const showFullSkeleton = filters.isScopeResolving || (isLoading && !citationData);
	const emptyDescription =
		citationData?.citationAvailability.kind === "no_evaluated_runs"
			? "No prompt runs match this scope and time period yet."
			: citationData?.citationAvailability.kind === "no_search_enabled_runs"
				? `${citationData.evaluatedRuns} prompt runs completed, but none used web search, so no links could be extracted.`
				: `${citationData?.evaluatedRuns ?? 0} prompt runs completed, including ${citationData?.searchEnabledRuns ?? 0} search-enabled runs, but this platform did not expose any extractable source links in the captured answers.`;

	return (
		<PageHeader
			title="Citations"
			subtitle="See which sources LLMs cite when responding to your prompts."
			infoContent={infoContent}
		>
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
				isError={!filters.isScopeResolving && (Boolean(isError) || !citationData)}
				errorState={
					<Card>
						<CardContent className="pt-6">
							<div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
								Failed to load citation data. Please try again.
							</div>
						</CardContent>
					</Card>
				}
				totalCount={
					citationData
						? citationData.totalCitations + getGoogleModuleCitationCount(citationData.googleModule)
						: undefined
				}
				noMatchesTitle="No citations found for the selected filters."
				noMatchesDescription="Try adjusting your filters or time period."
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
