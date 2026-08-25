import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { Locale, SiteRouteDefinition, SiteRouteKey } from "@/content/site/types";
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

const coreKeys: ReadonlySet<string> = new Set(HUMAN_PAGE_KEYS);
const siteRoutes: readonly SiteRouteDefinition[] = SITE_MANIFEST;

const labels = {
	en: {
		home: "Home",
		product: "Platform",
		approach: "Services",
		geo: "Global markets",
		company: "Company",
		diagnostic: "Talk to us",
		privacy: "Privacy",
		agent: "For AI agents",
		llms: "llms.txt",
		explore: "Explore",
		access: "Access",
	},
	zh: {
		home: "首页",
		product: "产品",
		approach: "服务方案",
		geo: "全球服务",
		company: "关于我们",
		diagnostic: "预约沟通",
		privacy: "隐私说明",
		agent: "Agent 入口",
		llms: "llms.txt",
		explore: "了解 Yonaris",
		access: "访问入口",
	},
} as const;

function isCorePageKey(key: SiteRouteKey): key is HumanPageKey {
	return coreKeys.has(key);
}

function pathFor(key: SiteRouteKey, locale: Locale): string {
	if (isCorePageKey(key)) return getCorePath(key, locale);
	const route = getSiteRoute(key);
	return route.canonicals[locale] ?? route.canonicals.en ?? "/";
}

function itemFor(key: SiteRouteKey, locale: Locale): SiteNavigationItem {
	return { key, label: labels[locale][key as keyof (typeof labels)[Locale]], path: pathFor(key, locale) };
}

export function getPrimaryNavigation(locale: Locale): readonly SiteNavigationItem[] {
	return siteRoutes
		.filter((route) => route.navigation.includes("primary") && isCorePageKey(route.key))
		.map((route) => itemFor(route.key, locale));
}

export function getDiagnosticNavigation(locale: Locale): SiteNavigationItem {
	return itemFor("diagnostic", locale);
}

export function getLocaleSwitchPath(locale: Locale, activeKey: HumanPageKey = "home"): string {
	return getCorePath(activeKey, locale === "en" ? "zh" : "en");
}

export function getFooterNavigation(locale: Locale): readonly SiteFooterGroup[] {
	return [
		{
			label: labels[locale].explore,
			items: (["product", "approach", "geo", "company", "diagnostic"] as const).map((key) => itemFor(key, locale)),
		},
		{
			label: labels[locale].access,
			items: (["privacy", "agent", "llms"] as const).map((key) => itemFor(key, locale)),
		},
	];
}
