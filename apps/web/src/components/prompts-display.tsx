import { IconEditCircle } from "@tabler/icons-react";
import { Link, useSearch } from "@tanstack/react-router";
import type { Brand, Competitor } from "@workspace/lib/db/schema";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Inbox } from "lucide-react";
import { useMemo } from "react";
import { ALL_MODELS_VALUE, getAvailableModels } from "@/components/filter-bar";
import { FilteredListShell } from "@/components/filtered-list-shell";
import { PageHeader } from "@/components/page-header";
import { PromptOrderDropdown } from "@/components/prompt-order-dropdown";
import { VirtualizedPromptList } from "@/components/virtualized-prompt-list";
import { VisibilityBarSection } from "@/components/visibility-bar-section";
import { ChartDataProvider } from "@/contexts/chart-data-context";
import { useBatchChartData } from "@/hooks/use-batch-chart-data";
import { useBrand } from "@/hooks/use-brands";
import { useListFilters } from "@/hooks/use-list-filters";
import { usePromptsSummary } from "@/hooks/use-prompts-summary";
import { useScopeModels } from "@/hooks/use-scope-models";
import { useI18n } from "@/i18n/provider";
import type { LookbackPeriod } from "@/lib/chart-utils";
import { coercePromptOrder, orderPrompts } from "@/lib/prompt-order";

interface PromptsDisplayProps {
	pageTitle: string;
	pageDescription: string;
	pageInfoContent?: React.ReactNode;
	editLink?: string;
}

const CONTENT_SKELETON_KEYS = ["first", "second", "third"] as const;

/** Host component: renders the page shell (title, sticky bar, content)
 *  and composes independent sub-sections. It doesn't subscribe to any
 *  filter state itself — each section reads the URL keys it cares about
 *  so a filter change only re-renders the sections that depend on it. */
export function PromptsDisplay({ pageTitle, pageDescription, pageInfoContent, editLink }: PromptsDisplayProps) {
	const { brand } = useBrand();
	return (
		<PageHeader title={pageTitle} subtitle={pageDescription} infoContent={pageInfoContent}>
			<PromptsContent brandId={brand?.id} editLink={editLink} />
		</PageHeader>
	);
}

/** Owns the single `usePromptsSummary` subscription for the page. Derives
 *  `availableTags`, the search-filtered prompt id list (used by both the
 *  visibility bar and the chart list), and passes them down. Child
 *  components still hold their own subscriptions to whichever URL keys
 *  they need, so a click on "Lookback" only invalidates the data users
 *  and not `FilterBar` itself. */
function PromptsContent({ brandId, editLink }: { brandId: string | undefined; editLink?: string }) {
	const { t } = useI18n();
	const filters = useListFilters();
	const { scopeId, model, lookback, tags, search } = filters;
	const { models: scopeModels, isResolved: scopeModelsResolved } = useScopeModels(brandId, scopeId);
	// `order` is this route's own search key (not a narrowing filter), so it
	// rides outside `useListFilters` / `isFiltered`.
	const order = useSearch({
		strict: false,
		select: (s) => coercePromptOrder((s as { order?: unknown }).order),
	});

	// Models come from this Scope's configured routes plus observations already
	// captured in it, so a manual China Scope never inherits overseas filters.
	const availableModels = useMemo(() => getAvailableModels(scopeModels), [scopeModels]);
	const availableIndividualModels = scopeModels;

	const modelParam =
		model === ALL_MODELS_VALUE || (scopeModelsResolved && !scopeModels.includes(model)) ? undefined : model;
	const {
		promptsSummary,
		isLoading: isLoadingSummary,
		isError: summaryError,
	} = usePromptsSummary(brandId, {
		scopeId: scopeId ?? "",
		lookback,
		model: modelParam,
		tags: tags.length > 0 ? tags : undefined,
	});

	const availableTags = promptsSummary?.availableTags ?? [];

	// The prompt list is still search-filtered client-side for display, then
	// re-ordered per the `order` control (#60). The chart/visibility sections
	// no longer receive this id list — they resolve the same prompts
	// server-side from the tag + search filters (issue #68).
	const sortedPrompts = useMemo(() => {
		if (!promptsSummary) return [];
		const allPrompts = promptsSummary.prompts;
		const filtered = search
			? allPrompts.filter((p) => p.value.toLowerCase().includes(search.toLowerCase()))
			: allPrompts;
		return orderPrompts(filtered, order);
	}, [promptsSummary, search, order]);

	const isInitialLoad = filters.isScopeResolving || (isLoadingSummary && !promptsSummary);

	return (
		<FilteredListShell
			filters={filters}
			availableTags={availableTags}
			availableModels={availableModels}
			showSearch
			showModelSelector
			showResultCount
			filterBarExtras={<PromptOrderDropdown />}
			filterSectionExtras={<VisibilityBarSection brandId={brandId} modelParam={modelParam} />}
			isLoading={isInitialLoad}
			loadingState={<ContentLoadingSkeleton />}
			isError={Boolean(summaryError)}
			errorState={
				<Card className="p-6">
					<div className="text-center text-muted-foreground">
						<p className="mb-2">{t("visibility.error")}</p>
					</div>
				</Card>
			}
			totalCount={promptsSummary?.prompts?.length}
			filteredCount={sortedPrompts.length}
			noMatchesTitle={t("visibility.noMatches")}
			noMatchesDescription={t("customer.filters.tryAdjust")}
			emptyState={
				<div className="border-2 border-dashed border-muted rounded-lg min-h-48 flex items-center justify-center">
					<div className="text-center py-8 text-muted-foreground">
						<Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p className="mb-4">{t("visibility.empty")}</p>
						{editLink && (
							<Button asChild size="sm" className="h-7 flex cursor-pointer">
								<Link to={editLink}>
									<IconEditCircle />
									<span>{t("visibility.editPrompts")}</span>
								</Link>
							</Button>
						)}
					</div>
				</div>
			}
		>
			<ChartSection
				brandId={brandId}
				scopeId={scopeId ?? ""}
				lookback={lookback}
				selectedModel={model}
				modelParam={modelParam}
				searchQuery={search}
				selectedTags={tags}
				sortedPrompts={sortedPrompts}
				availableIndividualModels={availableIndividualModels}
			/>
		</FilteredListShell>
	);
}

/** Heavy chart subtree. Split out so it gets its own render boundary —
 *  `React.memo` on `VirtualizedPromptList` means this block only walks
 *  30 chart cards when its own props change, not every time a sibling
 *  state (like visibility refetch) moves. */
function ChartSection({
	brandId,
	scopeId,
	lookback,
	selectedModel,
	modelParam,
	searchQuery,
	selectedTags,
	sortedPrompts,
	availableIndividualModels,
}: {
	brandId: string | undefined;
	scopeId: string;
	lookback: LookbackPeriod;
	selectedModel: string;
	modelParam: string | undefined;
	searchQuery: string;
	selectedTags: string[];
	sortedPrompts: { id: string; value: string; firstEvaluatedAt?: Date | string | null }[];
	availableIndividualModels: string[];
}) {
	const { batchChartData, isLoading: isLoadingChartData } = useBatchChartData(brandId, {
		scopeId,
		lookback,
		model: modelParam,
		tags: selectedTags.length > 0 ? selectedTags : undefined,
		search: searchQuery || undefined,
	});

	const { startDate, endDate } = useMemo(() => {
		if (!batchChartData?.dateRange) {
			const now = new Date();
			return { startDate: now, endDate: now };
		}
		return {
			startDate: new Date(batchChartData.dateRange.fromDate),
			endDate: new Date(batchChartData.dateRange.toDate),
		};
	}, [batchChartData?.dateRange]);

	const brandForProvider: Brand | null = batchChartData?.brand
		? {
				id: batchChartData.brand.id,
				organizationId: batchChartData.brand.id,
				name: batchChartData.brand.name,
				website: "",
				additionalDomains: [],
				aliases: [],
				enabled: true,
				onboarded: true,
				delayOverrideHours: null,
				enabledModels: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			}
		: null;

	const competitorsForProvider: Competitor[] =
		batchChartData?.competitors?.map((c) => ({
			id: c.id,
			name: c.name,
			brandId: brandId || "",
			domains: [],
			aliases: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		})) || [];

	return (
		<ChartDataProvider
			batchData={batchChartData?.chartData || null}
			brand={brandForProvider}
			competitors={competitorsForProvider}
			startDate={startDate}
			endDate={endDate}
			isLoading={isLoadingChartData}
		>
			<VirtualizedPromptList
				prompts={sortedPrompts}
				brandId={brandId || ""}
				lookback={lookback}
				selectedModel={selectedModel}
				availableModels={availableIndividualModels}
				searchHighlight={searchQuery}
			/>
		</ChartDataProvider>
	);
}

function ContentLoadingSkeleton() {
	return (
		<div className="space-y-6">
			{CONTENT_SKELETON_KEYS.map((key) => (
				<Card key={key} className="py-3 gap-3">
					<CardHeader className="flex justify-between items-center px-3">
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-5 w-24 rounded-full" />
					</CardHeader>
					<Separator className="py-0 my-0" />
					<CardContent className="pl-0 pr-6">
						<div className="h-[250px] flex items-center justify-center">
							<div className="space-y-2">
								<Skeleton className="h-4 w-32 mx-auto" />
								<div className="flex justify-center space-x-2">
									<div className="h-2 w-2 bg-primary/20 rounded-full animate-pulse" />
									<div className="h-2 w-2 bg-primary/20 rounded-full animate-pulse [animation-delay:0.2s]" />
									<div className="h-2 w-2 bg-primary/20 rounded-full animate-pulse [animation-delay:0.4s]" />
								</div>
							</div>
						</div>
					</CardContent>
					<Separator className="py-0 my-0" />
					<CardFooter className="flex items-center justify-between px-3 pt-3 pb-0">
						<div className="flex items-center gap-2">
							<Skeleton className="h-6 w-16 rounded" />
							<Skeleton className="h-6 w-24 rounded" />
						</div>
						<Skeleton className="h-6 w-20 rounded" />
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
