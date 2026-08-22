import { type ApproachContent, approachContentByLocale, getApproachContent } from "./approach";
import { type CompanyContent, companyContentByLocale, getCompanyContent } from "./company";
import { type DiagnosticContent, diagnosticContentByLocale, getDiagnosticContent } from "./diagnostic";
import { type GeoContent, geoContentByLocale, getGeoContent } from "./geo";
import { type GlobalContent, getGlobalContent, globalContentByLocale } from "./global";
import { getProductContent, type ProductContent, productContentByLocale } from "./product";
import { getResearchContent, type ResearchContent, researchContentByLocale } from "./research";
import type { CorePageKey, FactualClaim, Locale } from "./types";

export const CORE_PAGE_KEYS = [
	"home",
	"product",
	"approach",
	"research",
	"company",
	"geo",
	"diagnostic",
] as const satisfies readonly CorePageKey[];

export interface CoreFacts {
	title: string;
	currentScope: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export interface CorePageContentMap {
	home: GlobalContent;
	product: ProductContent;
	approach: ApproachContent;
	research: ResearchContent;
	company: CompanyContent;
	geo: GeoContent;
	diagnostic: DiagnosticContent;
}

const corePageContent = {
	home: globalContentByLocale,
	product: productContentByLocale,
	approach: approachContentByLocale,
	research: researchContentByLocale,
	company: companyContentByLocale,
	geo: geoContentByLocale,
	diagnostic: diagnosticContentByLocale,
} satisfies { [K in CorePageKey]: Readonly<Record<Locale, CorePageContentMap[K]>> };

export function getCorePageContent<K extends CorePageKey>(key: K, locale: Locale): CorePageContentMap[K] {
	return corePageContent[key][locale] as CorePageContentMap[K];
}

export function getCoreFacts(key: CorePageKey, locale: Locale): CoreFacts {
	const content = getCorePageContent(key, locale);
	return {
		title: content.meta.title,
		currentScope: content.currentScope,
		claims: content.claims,
		limitations: content.limitations,
	};
}

export type { ResourcesContent } from "./resources";
export { getResourcesContent } from "./resources";
export type { CorePageKey, FactualClaim, Locale } from "./types";
export type {
	ApproachContent,
	CompanyContent,
	DiagnosticContent,
	GeoContent,
	GlobalContent,
	ProductContent,
	ResearchContent,
};
export {
	getApproachContent,
	getCompanyContent,
	getDiagnosticContent,
	getGeoContent,
	getGlobalContent,
	getProductContent,
	getResearchContent,
};
