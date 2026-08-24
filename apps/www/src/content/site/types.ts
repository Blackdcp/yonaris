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
	const visited = new WeakSet<object>();

	function freezeNested(candidate: unknown): void {
		if (candidate === null || typeof candidate !== "object" || visited.has(candidate)) return;

		visited.add(candidate);
		Object.freeze(candidate);
		for (const key of Reflect.ownKeys(candidate)) {
			freezeNested(Reflect.get(candidate, key));
		}
	}

	freezeNested(value);

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
