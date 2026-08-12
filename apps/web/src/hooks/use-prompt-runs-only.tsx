import { useQuery } from "@tanstack/react-query";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";
import { getPromptRunsFn } from "@/server/prompts";

export const promptRunsKeys = {
	all: ["prompt-runs"] as const,
	list: (promptId: string, options: { page: number; limit: number; days: number }) =>
		[...promptRunsKeys.all, promptId, options] as const,
};

export function usePromptRunsOnly(promptId?: string, options?: { page?: number; limit?: number; days?: number }) {
	const page = options?.page || 1;
	const limit = options?.limit || 10;
	const days = options?.days || 7;
	const resolvedPromptId = promptId ?? "";

	const query = useQuery({
		queryKey: promptRunsKeys.list(resolvedPromptId, { page, limit, days }),
		queryFn: () => getPromptRunsFn({ data: { promptId: resolvedPromptId, page, limit, days } }),
		enabled: !!promptId,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});

	const total = Number(query.data?.total || 0);
	const totalPages = Math.ceil(total / limit) || 1;

	return {
		runs: (query.data?.runs || []) as CustomerPromptRunDto[],
		total,
		hasMore: query.data?.hasMore || false,
		isLoading: query.isLoading,
		isError: query.error,
		revalidate: query.refetch,
		// Pagination object matching Next.js hook shape
		pagination: query.data
			? {
					page,
					limit,
					total,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				}
			: undefined,
	};
}
