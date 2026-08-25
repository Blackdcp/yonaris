import { CHINA_COPY } from "@/content/experience";
import type { HumanPageKey } from "@/content/experience/types";
import { organizationJsonLd, pageSocialMeta, siteHref, websiteJsonLd } from "@/lib/seo";

const pathFor: Record<HumanPageKey, `/${string}`> = {
	home: "/zh",
	product: "/zh/product",
	approach: "/zh/approach",
	geo: "/zh/geo",
	company: "/zh/company",
	diagnostic: "/zh/diagnostic",
	privacy: "/zh/privacy",
};

const globalPathFor: Record<HumanPageKey, `/${string}`> = {
	home: "/",
	product: "/product",
	approach: "/approach",
	geo: "/geo",
	company: "/company",
	diagnostic: "/diagnostic",
	privacy: "/privacy",
};

export type ZhPageKey = HumanPageKey;

export function zhPageHead(key: ZhPageKey) {
	const page = CHINA_COPY[key];
	const title = page.metaTitle;
	const canonicalPath = pathFor[key];
	return {
		meta: [
			{ title },
			{ name: "description", content: page.metaDescription },
			{ name: "theme-color", content: "#f6f4f1" },
			...pageSocialMeta({ title, description: page.metaDescription, canonicalPath, locale: "zh_CN" }),
		],
		links: [
			{ rel: "canonical", href: siteHref(canonicalPath) },
			{ rel: "alternate", hrefLang: "zh-CN", href: siteHref(canonicalPath) },
			{ rel: "alternate", hrefLang: "en", href: siteHref(globalPathFor[key]) },
			{ rel: "alternate", hrefLang: "x-default", href: siteHref(globalPathFor[key]) },
		],
		scripts: [
			organizationJsonLd(page.metaDescription, "zh-CN"),
			...(key === "home" ? [websiteJsonLd(page.metaDescription, "zh-CN")] : []),
		],
	};
}
