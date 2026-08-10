import { useFilteredVisibility } from "@/hooks/use-filtered-visibility";
import { VisibilityBar, VisibilityBarSkeleton, VisibilityBarEmpty } from "@/components/visibility-bar";
import { useListFilters } from "@/hooks/use-list-filters";

/**
 * Self-contained visibility bar. Subscribes directly to the filter URL
 * keys it needs (lookback, model, tags, search) and fetches
 * `useFilteredVisibility` itself, so it's a sibling of the chart section
 * rather than something the parent has to wire through. The tag + search
 * filters are resolved to prompt IDs server-side, so we pass the criteria
 * rather than a prompt-id list (issue #68).
 *
 * The skeleton stays mounted inside a grid overlay so the bar reserves
 * its vertical space on load and doesn't shove the charts down when the
 * real bar comes in.
 */
export function VisibilityBarSection({
	brandId,
	modelParam,
}: {
	brandId: string | undefined;
	modelParam: string | undefined;
}) {
	const { scopeId, lookback, tags, search } = useListFilters();

	const {
		filteredVisibility,
		isLoading: isLoadingVisibility,
		isValidating: isValidatingVisibility,
	} = useFilteredVisibility(brandId, {
		scopeId: scopeId ?? "",
		lookback,
		tags: tags.length > 0 ? tags : undefined,
		search: search || undefined,
		model: modelParam,
	});

	const stable = filteredVisibility;

	const hasLoaded = stable && !isLoadingVisibility;
	const hasData = hasLoaded && stable.totalRuns > 0;
	const isEmpty = hasLoaded && stable.totalRuns === 0;
	// While refetching on an empty previous result, keep showing the skeleton
	// rather than flashing "no data" between states.
	const showingSkeleton = !stable || (stable.totalRuns === 0 && isValidatingVisibility);

	return (
		<div className="mt-3 grid [&>*]:col-start-1 [&>*]:row-start-1">
			<div className={hasData || (isEmpty && !showingSkeleton) ? "opacity-0 pointer-events-none" : undefined}>
				<VisibilityBarSkeleton />
			</div>
			{hasData && (
				<VisibilityBar
					currentVisibility={stable.currentVisibility}
					totalRuns={stable.totalRuns}
					totalPrompts={stable.totalPrompts}
					totalCitations={stable.totalCitations}
					visibilityTimeSeries={stable.visibilityTimeSeries}
					lookback={stable.lookback}
				/>
			)}
			{isEmpty && !showingSkeleton && <VisibilityBarEmpty />}
		</div>
	);
}
