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

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
	? T
	: T extends readonly (infer Item)[]
		? readonly DeepReadonly<Item>[]
		: T extends object
			? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
			: T;

export function deepFreeze<T>(value: T): DeepReadonly<T> {
	if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
		return value as DeepReadonly<T>;
	}

	Object.freeze(value);
	for (const key of Reflect.ownKeys(value)) {
		deepFreeze(Reflect.get(value, key));
	}

	return value as DeepReadonly<T>;
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
