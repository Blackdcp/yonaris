import { GLOBAL_COPY } from "@/content/experience";
import type { HumanPageKey } from "@/content/experience/types";
import { organizationJsonLd, pageSocialMeta, siteHref, websiteJsonLd } from "@/lib/seo";

const pathFor: Record<HumanPageKey, `/${string}`> = {
	home: "/",
	product: "/product",
	approach: "/approach",
	geo: "/geo",
	company: "/company",
	diagnostic: "/diagnostic",
	privacy: "/privacy",
};

const chinaPathFor: Record<HumanPageKey, `/${string}`> = {
	home: "/zh",
	product: "/zh/product",
	approach: "/zh/approach",
	geo: "/zh/geo",
	company: "/zh/company",
	diagnostic: "/zh/diagnostic",
	privacy: "/zh/privacy",
};

export type GlobalEnglishPageKey = HumanPageKey;

export function globalEnglishPageHead(key: GlobalEnglishPageKey) {
	const page = GLOBAL_COPY[key];
	const title = page.metaTitle;
	const canonicalPath = pathFor[key];
	return {
		meta: [
			{ title },
			{ name: "description", content: page.metaDescription },
			{ name: "theme-color", content: "#f6f4f1" },
			...pageSocialMeta({ title, description: page.metaDescription, canonicalPath, locale: "en_US" }),
		],
		links: [
			{ rel: "canonical", href: siteHref(canonicalPath) },
			{ rel: "alternate", hrefLang: "en", href: siteHref(canonicalPath) },
			{ rel: "alternate", hrefLang: "zh-CN", href: siteHref(chinaPathFor[key]) },
			{ rel: "alternate", hrefLang: "x-default", href: siteHref(canonicalPath) },
		],
		scripts: [
			organizationJsonLd(page.metaDescription, "en"),
			...(key === "home" ? [websiteJsonLd(page.metaDescription, "en")] : []),
		],
	};
}
