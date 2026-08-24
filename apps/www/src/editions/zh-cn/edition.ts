import { ZH_PAGE_CONTENT } from "@/content/site/zh-cn/experience";
import { organizationJsonLd, siteHref, websiteJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

export const zhPageContracts = {
	home: { canonicalPath: "/zh", routeKey: "home" },
	product: { canonicalPath: "/zh/product", routeKey: "product" },
	approach: { canonicalPath: "/zh/approach", routeKey: "approach" },
	research: { canonicalPath: "/zh/research", routeKey: "research" },
	geo: { canonicalPath: "/zh/geo", routeKey: "geo" },
	company: { canonicalPath: "/zh/company", routeKey: "company" },
	diagnostic: { canonicalPath: "/zh/diagnostic", routeKey: "diagnostic" },
	privacy: { canonicalPath: "/zh/privacy", routeKey: "privacy" },
} as const;

export type ZhPageKey = keyof typeof zhPageContracts;

export function zhPageHead(key: ZhPageKey) {
	const contract = zhPageContracts[key];
	const content = ZH_PAGE_CONTENT[key];
	const head = siteRouteHead(contract.routeKey, {
		canonicalPath: contract.canonicalPath,
		title: `${content.title} | Yonaris`,
		description: content.lead,
		locale: "zh",
	});

	return {
		...head,
		links: [...head.links, { rel: "alternate", hrefLang: "zh-CN", href: siteHref(contract.canonicalPath) }],
		scripts: [organizationJsonLd(), ...(key === "home" ? [websiteJsonLd()] : [])],
	};
}
