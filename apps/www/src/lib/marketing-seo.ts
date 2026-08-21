import { getMarketingPageMeta, type Locale, type MarketingPageKey } from "./marketing-content";
import { canonicalUrl, ogMeta, organizationJsonLd } from "./seo";

export function marketingPageHead(locale: Locale, pageKey: MarketingPageKey) {
	const page = getMarketingPageMeta(locale, pageKey);
	const enPath = locale === "en" ? page.canonicalPath : page.alternatePath;
	const zhPath = locale === "zh" ? page.canonicalPath : page.alternatePath;
	return {
		meta: [
			{ title: page.title },
			{ name: "description", content: page.description },
			{ name: "theme-color", content: "#0b1220" },
			...ogMeta({
				title: page.title,
				description: page.description,
				path: page.canonicalPath,
				locale: locale === "zh" ? "zh_CN" : "en_US",
			}),
		],
		links: [
			{ rel: "canonical", href: canonicalUrl(page.canonicalPath) },
			{ rel: "alternate", hrefLang: "en", href: canonicalUrl(enPath) },
			{ rel: "alternate", hrefLang: "zh-CN", href: canonicalUrl(zhPath) },
			{ rel: "alternate", hrefLang: "x-default", href: canonicalUrl(enPath) },
		],
		scripts: [organizationJsonLd()],
	};
}
