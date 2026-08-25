import type { HumanPageKey } from "@/content/experience/types";

export type Locale = "en" | "zh";
export type CorePageKey = HumanPageKey;
export type AgentPageKey = Exclude<CorePageKey, "home">;

export type SiteRouteClass = "core" | "utility" | "legacy" | "machine";
export type IndexPolicy = "index,follow" | "noindex,follow";

export const SITE_ROUTE_KEYS = [
	"home",
	"product",
	"approach",
	"geo",
	"company",
	"diagnostic",
	"privacy",
	"agent",
	"llms",
	"sitemap",
	"robots",
	"api",
	"og",
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
