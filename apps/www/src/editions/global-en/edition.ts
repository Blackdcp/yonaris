import { GLOBAL_ENGLISH_CONTENT } from "@/content/site/global-en";
import { organizationJsonLd, siteHref, websiteJsonLd } from "@/lib/seo";
import { GLOBAL_ENGLISH_SECTION_IDS } from "../registry";

export const globalEnglishPageContracts = {
	home: {
		canonicalPath: "/",
		title: GLOBAL_ENGLISH_CONTENT.home.headline,
		description: GLOBAL_ENGLISH_CONTENT.home.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.home,
	},
	product: {
		canonicalPath: "/product",
		title: GLOBAL_ENGLISH_CONTENT.product.headline,
		description: GLOBAL_ENGLISH_CONTENT.product.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.product,
	},
	approach: {
		canonicalPath: "/approach",
		title: GLOBAL_ENGLISH_CONTENT.approach.headline,
		description: GLOBAL_ENGLISH_CONTENT.approach.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.approach,
	},
	research: {
		canonicalPath: "/research",
		title: GLOBAL_ENGLISH_CONTENT.research.headline,
		description: GLOBAL_ENGLISH_CONTENT.research.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.research,
	},
	geo: {
		canonicalPath: "/geo",
		title: GLOBAL_ENGLISH_CONTENT.geo.headline,
		description: GLOBAL_ENGLISH_CONTENT.geo.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.geo,
	},
	company: {
		canonicalPath: "/company",
		title: GLOBAL_ENGLISH_CONTENT.company.headline,
		description: GLOBAL_ENGLISH_CONTENT.company.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.company,
	},
	diagnostic: {
		canonicalPath: "/diagnostic",
		title: GLOBAL_ENGLISH_CONTENT.diagnostic.headline,
		description: GLOBAL_ENGLISH_CONTENT.diagnostic.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.diagnostic,
	},
	privacy: {
		canonicalPath: "/privacy",
		title: GLOBAL_ENGLISH_CONTENT.privacy.headline,
		description: GLOBAL_ENGLISH_CONTENT.privacy.description,
		sectionIds: GLOBAL_ENGLISH_SECTION_IDS.privacy,
	},
} as const;

export type GlobalEnglishPageKey = keyof typeof globalEnglishPageContracts;

export function globalEnglishPageHead(key: GlobalEnglishPageKey) {
	const page = globalEnglishPageContracts[key];
	const title = `${page.title} | Yonaris`;
	return {
		meta: [
			{ title },
			{ name: "description", content: page.description },
			{ name: "theme-color", content: "#0b1220" },
			{ property: "og:title", content: title },
			{ property: "og:description", content: page.description },
		],
		links: [
			{ rel: "canonical", href: siteHref(page.canonicalPath) },
			{ rel: "alternate", hrefLang: "en", href: siteHref(page.canonicalPath) },
			{ rel: "alternate", hrefLang: "x-default", href: siteHref(page.canonicalPath) },
		],
		scripts: [organizationJsonLd(), ...(key === "home" ? [websiteJsonLd()] : [])],
	};
}
