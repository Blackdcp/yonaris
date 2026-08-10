import { useQuery } from "@tanstack/react-query";
import { getPromptStatsFn } from "@/server/prompts";

export const promptStatsKeys = {
	all: ["prompt-stats"] as const,
	detail: (promptId: string, days: number) => [...promptStatsKeys.all, promptId, days] as const,
};

export function usePromptStats(promptId?: string, options?: { days?: number }) {
	const days = options?.days || 7;
	const resolvedPromptId = promptId ?? "";

	const query = useQuery({
		queryKey: promptStatsKeys.detail(resolvedPromptId, days),
		queryFn: () => getPromptStatsFn({ data: { promptId: resolvedPromptId, days } }),
		enabled: !!promptId,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});

	return {
		data: query.data,
		promptStats: query.data,
		isLoading: query.isLoading,
		isError: query.error,
		revalidate: query.refetch,
		// Convenience accessors (match Next.js hook)
		prompt: query.data?.prompt,
		aggregations: query.data?.aggregations,
	};
}
