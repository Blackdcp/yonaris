export type AdminOpportunityScopeRow = {
	id: string;
	name: string;
	market: string;
	locale: string;
	enabled: boolean;
	samplingEvaluationRole: "scored" | "observation" | null;
	promptCount: number;
};

export type AdminOpportunityBrandRow = {
	id: string;
	name: string;
	scopes: AdminOpportunityScopeRow[];
};

export type AdminOpportunityBrand = {
	id: string;
	name: string;
	scopes: Array<{ id: string; name: string; market: string; locale: string; promptCount: number }>;
};

export function toAdminOpportunityBrands(brands: AdminOpportunityBrandRow[]): AdminOpportunityBrand[] {
	return brands.flatMap((brand) => {
		const scopes = brand.scopes
			.filter((scope) => scope.enabled && scope.samplingEvaluationRole === "scored" && scope.promptCount > 0)
			.map(({ id, name, market, locale, promptCount }) => ({ id, name, market, locale, promptCount }));
		return scopes.length > 0 ? [{ id: brand.id, name: brand.name, scopes }] : [];
	});
}

export function getOpportunityScopesForBrand(brands: AdminOpportunityBrand[], brandId: string) {
	return brands.find((brand) => brand.id === brandId)?.scopes ?? [];
}
