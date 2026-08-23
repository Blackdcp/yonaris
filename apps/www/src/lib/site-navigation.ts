import type { CorePageKey, Locale, SiteRouteDefinition, SiteRouteKey } from "@/content/site/types";
import { getCorePath, getSiteRoute, SITE_MANIFEST } from "./site-manifest";

export const PORTAL_URL = "https://portal.yonaris.com";

export interface SiteNavigationItem {
	key: SiteRouteKey;
	label: string;
	path: string;
}

export interface SiteFooterGroup {
	label: string;
	items: readonly SiteNavigationItem[];
}

const CORE_PAGE_KEYS: ReadonlySet<string> = new Set<CorePageKey>([
	"home",
	"product",
	"approach",
	"research",
	"company",
	"geo",
	"diagnostic",
]);

const siteRoutes: readonly SiteRouteDefinition[] = SITE_MANIFEST;

const labels = {
	en: {
		home: "Home",
		product: "Product",
		approach: "Approach",
		research: "Research",
		company: "Company",
		geo: "GEO",
		diagnostic: "Get a Free Diagnostic",
		privacy: "Privacy",
		status: "Status",
		agent: "Agent",
		llms: "llms.txt",
		explore: "Explore",
		machineGroup: "Company & agents",
	},
	zh: {
		home: "首页",
		product: "产品",
		approach: "方法",
		research: "研究",
		company: "公司",
		geo: "GEO",
		diagnostic: "获取免费诊断",
		privacy: "隐私",
		status: "状态",
		agent: "Agent",
		llms: "llms.txt",
		explore: "浏览",
		machineGroup: "公司与智能体",
	},
} as const;

function isCorePageKey(key: SiteRouteKey): key is CorePageKey {
	return CORE_PAGE_KEYS.has(key);
}

function pathFor(key: SiteRouteKey, locale: Locale): string {
	if (isCorePageKey(key)) return getCorePath(key, locale);
	const route = getSiteRoute(key);
	return route.canonicals[locale] ?? route.canonicals.en ?? "/";
}

function itemFor(key: SiteRouteKey, locale: Locale): SiteNavigationItem {
	return {
		key,
		label: labels[locale][key as keyof (typeof labels)[Locale]],
		path: pathFor(key, locale),
	};
}

export function getPrimaryNavigation(locale: Locale): readonly SiteNavigationItem[] {
	return siteRoutes
		.filter((route) => route.navigation.includes("primary") && isCorePageKey(route.key))
		.map((route) => itemFor(route.key, locale));
}

export function getDiagnosticNavigation(locale: Locale): SiteNavigationItem {
	return itemFor("diagnostic", locale);
}

export function getLocaleSwitchPath(locale: Locale, activeKey: CorePageKey = "home"): string {
	return getCorePath(activeKey, locale === "en" ? "zh" : "en");
}

export function getFooterNavigation(locale: Locale): readonly SiteFooterGroup[] {
	return [
		{
			label: labels[locale].explore,
			items: (["product", "approach", "research", "company", "geo"] as const).map((key) => itemFor(key, locale)),
		},
		{
			label: labels[locale].machineGroup,
			items: (["status", "privacy", "agent", "llms"] as const).map((key) => itemFor(key, locale)),
		},
	];
}
