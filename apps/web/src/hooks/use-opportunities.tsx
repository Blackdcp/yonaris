import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { OutputLanguage } from "@workspace/config/language";
import type { OpportunitiesReason, OpportunitiesResponse } from "@/server/opportunities";
import { getOpportunitiesFn } from "@/server/opportunities";

export const opportunitiesKeys = {
	all: ["opportunities-report"] as const,
	detail: (brandId: string, scopeId: string, language: OutputLanguage) =>
		[...opportunitiesKeys.all, brandId, scopeId, language] as const,
};

const NOT_GENERATED_REFETCH_MS = 30_000;

export function opportunitiesCachePolicy(reason: OpportunitiesReason | undefined): {
	staleTime: number;
	refetchInterval: number | false;
	refetchOnWindowFocus: boolean;
} {
	if (reason === "not_generated") {
		return {
			staleTime: NOT_GENERATED_REFETCH_MS,
			refetchInterval: NOT_GENERATED_REFETCH_MS,
			refetchOnWindowFocus: true,
		};
	}
	return {
		staleTime: Number.POSITIVE_INFINITY,
		refetchInterval: false,
		refetchOnWindowFocus: false,
	};
}

/**
 * Opportunities AEO report for one measurement scope. Customer reads are
 * deliberately cache-only: an admin must explicitly request generation.
 */
export function useOpportunities(
	brandId: string | undefined,
	scopeId: string | undefined,
	outputLanguage: OutputLanguage,
	enabled = true,
) {
	const params = useParams({ strict: false }) as { brand?: string };
	const resolvedBrandId = brandId || params.brand;

	const query = useQuery<OpportunitiesResponse>({
		queryKey: opportunitiesKeys.detail(resolvedBrandId || "", scopeId || "", outputLanguage),
		queryFn: () =>
			getOpportunitiesFn({
				data: { brandId: resolvedBrandId ?? "", scopeId: scopeId ?? "", outputLanguage },
			}),
		enabled: enabled && !!resolvedBrandId && !!scopeId,
		staleTime: (query) =>
			opportunitiesCachePolicy((query.state.data as OpportunitiesResponse | undefined)?.reason).staleTime,
		refetchInterval: (query) =>
			opportunitiesCachePolicy((query.state.data as OpportunitiesResponse | undefined)?.reason).refetchInterval,
		refetchOnWindowFocus: (query) =>
			opportunitiesCachePolicy((query.state.data as OpportunitiesResponse | undefined)?.reason).refetchOnWindowFocus,
		retry: false,
	});

	return {
		data: query.data,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		isError: !!query.error,
		revalidate: query.refetch,
	};
}
