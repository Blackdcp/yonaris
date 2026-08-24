import type { CorePageKey, Locale, RedirectRule, SiteRouteDefinition, SiteRouteKey } from "@/content/site/types";

export { SITE_ROUTE_KEYS } from "@/content/site/types";

const CORE_LAST_VERIFIED = "2026-08-22" as const;

export const SITE_MANIFEST = [
	{
		key: "home",
		routeClass: "core",
		canonicals: { en: "/", zh: "/zh" },
		navigation: ["footer"],
		indexPolicy: "index,follow",
		sitemap: { priority: 1, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "product",
		routeClass: "core",
		canonicals: { en: "/product", zh: "/zh/product" },
		navigation: ["primary", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/product",
		sitemap: { priority: 0.9, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "approach",
		routeClass: "core",
		canonicals: { en: "/approach", zh: "/zh/approach" },
		navigation: ["primary", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/approach",
		sitemap: { priority: 0.8, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "research",
		routeClass: "core",
		canonicals: { en: "/research", zh: "/zh/research" },
		navigation: ["primary", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/research",
		sitemap: { priority: 0.8, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "company",
		routeClass: "core",
		canonicals: { en: "/company", zh: "/zh/company" },
		navigation: ["primary", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/company",
		sitemap: { priority: 0.7, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "geo",
		routeClass: "core",
		canonicals: { en: "/geo", zh: "/zh/geo" },
		navigation: ["contextual", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/geo",
		sitemap: { priority: 0.8, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "diagnostic",
		routeClass: "core",
		canonicals: { en: "/diagnostic", zh: "/zh/diagnostic" },
		navigation: ["utility", "footer"],
		indexPolicy: "index,follow",
		agentPath: "/agent/diagnostic",
		sitemap: { priority: 0.9, lastVerified: CORE_LAST_VERIFIED },
	},
	{
		key: "privacy",
		routeClass: "resource",
		canonicals: { en: "/privacy" },
		navigation: ["footer"],
		indexPolicy: "index,follow",
		sitemap: { priority: 0.3 },
	},
	{
		key: "agent",
		routeClass: "machine",
		canonicals: { en: "/agent" },
		patterns: ["/agent/*"],
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "llms",
		routeClass: "machine",
		canonicals: { en: "/llms.txt" },
		patterns: ["/llms-full.txt"],
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "sitemap",
		routeClass: "machine",
		canonicals: { en: "/sitemap.xml" },
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "robots",
		routeClass: "machine",
		canonicals: { en: "/robots.txt" },
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "api",
		routeClass: "machine",
		canonicals: { en: "/api" },
		patterns: ["/api/*"],
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "og",
		routeClass: "machine",
		canonicals: { en: "/og.png" },
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
	{
		key: "markdownInternal",
		routeClass: "machine",
		canonicals: { en: "/llms.mdx/site" },
		patterns: ["/llms.mdx/*"],
		navigation: [],
		indexPolicy: "noindex,follow",
		sitemap: false,
	},
] as const satisfies readonly SiteRouteDefinition[];

const siteRoutes: readonly SiteRouteDefinition[] = SITE_MANIFEST;

export const SITE_REDIRECTS = [
	{ from: "/platform", to: "/product", statusCode: 308 },
	{ from: "/features", to: "/product", statusCode: 308 },
	{ from: "/zh/platform", to: "/zh/product", statusCode: 308 },
	{ from: "/methodology", to: "/approach", statusCode: 308 },
	{ from: "/zh/methodology", to: "/zh/approach", statusCode: 308 },
	{ from: "/results", to: "/research", statusCode: 308 },
	{ from: "/zh/results", to: "/zh/research", statusCode: 308 },
	{ from: "/vision", to: "/company", statusCode: 308 },
	{ from: "/pricing", to: "/diagnostic", statusCode: 308 },
	{ from: "/off-site-aeo", to: "/geo", statusCode: 308 },
	{ from: "/agent/platform", to: "/agent/product", statusCode: 308 },
	{ from: "/agent/methodology", to: "/agent/approach", statusCode: 308 },
	{ from: "/agent/results", to: "/agent/research", statusCode: 308 },
] as const satisfies readonly RedirectRule[];

function normalizePathname(pathname: string): string {
	if (pathname === "/") return pathname;
	return pathname.replace(/\/+$/, "") || "/";
}

function matchesPattern(pathname: string, pattern: string): boolean {
	if (!pattern.endsWith("/*")) return pathname === pattern;
	const base = pattern.slice(0, -2);
	return pathname === base || pathname.startsWith(`${base}/`);
}

export function getSiteRoute(key: SiteRouteKey): SiteRouteDefinition {
	const route = siteRoutes.find((candidate) => candidate.key === key);
	if (!route) throw new Error(`Unknown site route key: ${key}`);
	return route;
}

export function findSiteRoute(pathname: string): SiteRouteDefinition | undefined {
	const normalized = normalizePathname(pathname);
	const canonical = siteRoutes.find((route) => Object.values(route.canonicals).includes(normalized as `/${string}`));
	if (canonical) return canonical;

	const patterned = siteRoutes.find((route) => route.patterns?.some((pattern) => matchesPattern(normalized, pattern)));
	if (patterned) return patterned;

	const redirect = getRedirect(normalized);
	return redirect ? findSiteRoute(redirect.to) : undefined;
}

export function getCorePath(key: CorePageKey, locale: Locale): string {
	const route = getSiteRoute(key);
	const path = route.canonicals[locale];
	if (!path) throw new Error(`Missing ${locale} canonical for core route: ${key}`);
	return path;
}

export function getRedirect(pathname: string): RedirectRule | undefined {
	const normalized = normalizePathname(pathname);
	return SITE_REDIRECTS.find((redirect) => redirect.from === normalized);
}

export function getCoreLastVerified(key: CorePageKey): `${number}-${number}-${number}` {
	const sitemap = getSiteRoute(key).sitemap;
	if (sitemap === false || !sitemap.lastVerified) throw new Error(`Missing last-verified date for core route: ${key}`);
	return sitemap.lastVerified;
}
