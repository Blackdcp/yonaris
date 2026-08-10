import { useQuery } from "@tanstack/react-query";
import { getScopeModelsFn } from "@/server/measurement-scopes";

export const scopeModelKeys = {
	models: (brandId: string, scopeId: string) => ["measurement-scope-models", brandId, scopeId] as const,
};

export function useScopeModels(brandId: string | undefined, scopeId: string | undefined) {
	const resolvedBrandId = brandId ?? "";
	const resolvedScopeId = scopeId ?? "";
	const query = useQuery({
		queryKey: scopeModelKeys.models(resolvedBrandId, resolvedScopeId),
		queryFn: () => getScopeModelsFn({ data: { brandId: resolvedBrandId, scopeId: resolvedScopeId } }),
		enabled: Boolean(brandId && scopeId),
		staleTime: 30_000,
	});

	return {
		models: query.data ?? [],
		isLoading: query.isLoading,
		isResolved: query.isSuccess,
		isError: query.error,
	};
}
