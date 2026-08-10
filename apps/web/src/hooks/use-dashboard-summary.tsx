import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { getDashboardSummaryFn, type DashboardSummaryResponse } from "@/server/dashboard";

export type LookbackPeriod = "1w" | "1m" | "3m" | "6m" | "1y" | "all";
export type { DashboardSummaryResponse, VisibilityTimeSeriesPoint, CitationTimeSeriesPoint } from "@/server/dashboard";

export const dashboardKeys = {
	all: ["dashboard"] as const,
	summary: (brandId: string, scopeId: string, lookback: LookbackPeriod) =>
		[...dashboardKeys.all, "summary", brandId, scopeId, lookback] as const,
};

export function useDashboardSummary(
	brandId: string | undefined,
	scopeId: string | undefined,
	lookback: LookbackPeriod = "1m",
) {
	const params = useParams({ strict: false }) as { brand?: string };
	const resolvedBrandId = brandId || params.brand;

	const query = useQuery({
		queryKey: dashboardKeys.summary(resolvedBrandId || "", scopeId || "", lookback),
		queryFn: () =>
			getDashboardSummaryFn({
				data: {
					brandId: resolvedBrandId!,
					scopeId: scopeId!,
					lookback,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
			}),
		enabled: !!resolvedBrandId && !!scopeId,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		refetchInterval: 60_000, // Auto-refresh every 60 seconds
	});

	return {
		dashboardSummary: query.data,
		isLoading: query.isLoading,
		isError: query.error,
		revalidate: query.refetch,
	};
}
