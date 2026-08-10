import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { getFilteredVisibilityFn, type FilteredVisibilityResponse } from "@/server/visibility";

export type LookbackPeriod = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

export interface FilteredVisibilityFilters {
	scopeId: string;
	lookback?: LookbackPeriod;
	model?: string;
	/** Tag filter (resolved to prompt IDs server-side). */
	tags?: string[];
	/** Search term applied to prompt text (resolved server-side). */
	search?: string;
}

export function useFilteredVisibility(brandId?: string, filters?: FilteredVisibilityFilters) {
	const params = useParams({ strict: false }) as { brand?: string };
	const resolvedBrandId = brandId || params.brand;

	const query = useQuery({
		queryKey: [
			"filtered-visibility",
			resolvedBrandId,
			filters?.lookback,
			filters?.scopeId,
			filters?.model,
			filters?.tags?.join(","),
			filters?.search,
		],
		queryFn: () =>
			getFilteredVisibilityFn({
				data: {
					brandId: resolvedBrandId!,
					scopeId: filters!.scopeId,
					lookback: filters?.lookback || "1m",
					model: filters?.model,
					tags: filters?.tags?.join(","),
					search: filters?.search,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
			}),
		enabled: !!resolvedBrandId && !!filters?.scopeId,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		refetchInterval: 60_000,
	});

	return {
		filteredVisibility: query.data,
		isLoading: query.isLoading,
		isValidating: query.isFetching,
		isError: query.error,
		revalidate: query.refetch,
	};
}
