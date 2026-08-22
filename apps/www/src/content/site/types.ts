export type Locale = "en" | "zh";

export type CorePageKey = "home" | "product" | "approach" | "research" | "company" | "geo" | "diagnostic";

export type AgentPageKey = Exclude<CorePageKey, "home">;

export type ClaimStatus = "current-software" | "managed-delivery" | "verified-evidence" | "illustrative" | "direction";

export interface FactualClaim {
	id: string;
	status: ClaimStatus;
	text: string;
	limitation?: string;
}

export type SiteRouteClass = "core" | "resource" | "utility" | "legacy" | "machine";

export type IndexPolicy = "index,follow" | "noindex,follow";

export const SITE_ROUTE_KEYS = [
	"home",
	"product",
	"approach",
	"research",
	"company",
	"geo",
	"diagnostic",
	"resources",
	"openSource",
	"privacy",
	"blog",
	"glossary",
	"docs",
	"status",
	"brand",
	"changelog",
	"roadmap",
	"aiSearch",
	"aeoFor",
	"aiVisibility",
	"agent",
	"llms",
	"sitemap",
	"robots",
	"rss",
	"api",
	"og",
	"repoActivity",
	"markdownInternal",
] as const;

export type SiteRouteKey = (typeof SITE_ROUTE_KEYS)[number];

export interface SiteRouteDefinition {
	key: SiteRouteKey;
	routeClass: SiteRouteClass;
	canonicals: Partial<Record<Locale, `/${string}`>>;
	patterns?: readonly `/${string}`[];
	navigation: readonly ("primary" | "footer" | "contextual" | "utility")[];
	indexPolicy: IndexPolicy;
	agentPath?: `/${string}`;
	sitemap: false | { priority: number; lastVerified?: `${number}-${number}-${number}` };
}

export interface RedirectRule {
	from: `/${string}`;
	to: `/${string}`;
	statusCode: 308;
}
