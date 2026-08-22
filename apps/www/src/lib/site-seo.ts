import { getCorePageContent, getPrivacyContent, getResourcesContent } from "@/content/site";
import type { CorePageKey, IndexPolicy, Locale, SiteRouteKey } from "@/content/site/types";
import { ogMeta, organizationJsonLd, siteHref, websiteJsonLd } from "./seo";
import { getCorePath, getSiteRoute } from "./site-manifest";

interface SiteHead {
	meta: object[];
	links: object[];
	scripts?: object[];
}

type SupportingPageKey = Extract<SiteRouteKey, "resources" | "openSource" | "privacy">;

const supportingPageMeta: Record<
	Exclude<SupportingPageKey, "resources" | "privacy">,
	{ title: string; description: string }
> = {
	openSource: {
		title: "Open Source",
		description:
			"Learn how Elmo-compatible open-source infrastructure supports Yonaris without defining the company identity or product promise.",
	},
};

function pageTitle(title: string): string {
	return title.endsWith("| Yonaris") ? title : `${title} | Yonaris`;
}

export function routeRobotsMeta(routeKey: SiteRouteKey): { name: "robots"; content: IndexPolicy } | undefined {
	const policy = getSiteRoute(routeKey).indexPolicy;
	return policy === "noindex,follow" ? { name: "robots", content: policy } : undefined;
}

export function siteRouteHead(
	routeKey: SiteRouteKey,
	options: {
		canonicalPath: `/${string}`;
		title: string;
		description: string;
		locale?: Locale;
	},
): { meta: object[]; links: object[] } {
	const robots = routeRobotsMeta(routeKey);
	return {
		meta: [
			{ title: options.title },
			{ name: "description", content: options.description },
			{ name: "theme-color", content: "#0b1220" },
			...(robots ? [robots] : []),
			...ogMeta({
				title: options.title,
				description: options.description,
				path: options.canonicalPath,
				locale: options.locale === "zh" ? "zh_CN" : "en_US",
			}),
		],
		links: [{ rel: "canonical", href: siteHref(options.canonicalPath) }],
	};
}

export function corePageHead(pageKey: CorePageKey, locale: Locale): SiteHead {
	const content = getCorePageContent(pageKey, locale);
	const canonicalPath = getCorePath(pageKey, locale) as `/${string}`;
	const englishPath = getCorePath(pageKey, "en");
	const chinesePath = getCorePath(pageKey, "zh");
	const head = siteRouteHead(pageKey, {
		canonicalPath,
		title: pageTitle(content.meta.title),
		description: content.meta.description,
		locale,
	});

	return {
		...head,
		links: [
			...head.links,
			{ rel: "alternate", hrefLang: "en", href: siteHref(englishPath) },
			{ rel: "alternate", hrefLang: "zh-CN", href: siteHref(chinesePath) },
			{ rel: "alternate", hrefLang: "x-default", href: siteHref(englishPath) },
		],
		scripts: [organizationJsonLd(), ...(pageKey === "home" ? [websiteJsonLd()] : [])],
	};
}

export function supportingPageHead(routeKey: SupportingPageKey): { meta: object[]; links: object[] } {
	const route = getSiteRoute(routeKey);
	const canonicalPath = route.canonicals.en;
	if (!canonicalPath) throw new Error(`Missing English canonical for supporting route: ${routeKey}`);

	const meta =
		routeKey === "resources"
			? getResourcesContent("en").meta
			: routeKey === "privacy"
				? getPrivacyContent().meta
				: supportingPageMeta[routeKey];

	return siteRouteHead(routeKey, {
		canonicalPath,
		title: pageTitle(meta.title),
		description: meta.description,
	});
}
