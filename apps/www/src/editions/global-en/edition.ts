import { GLOBAL_ENGLISH_SECTION_IDS } from "../registry";
import { organizationJsonLd, siteHref, websiteJsonLd } from "@/lib/seo";

export const globalEnglishPageContracts = {
	home: { canonicalPath: "/", title: "Know how AI represents your brand—and what to do next.", description: "Review configured AI answer evidence and decide which next test deserves attention.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.home },
	product: { canonicalPath: "/product", title: "Make AI market answers observable.", description: "See the configured scope, answer evidence, human review, and next-test workflow.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.product },
	approach: { canonicalPath: "/approach", title: "Move from uncertainty to a reviewable next test.", description: "Follow one defined market question through observation, evidence review, and repeat measurement.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.approach },
	research: { canonicalPath: "/research", title: "Evidence needs a scope, denominator, and boundary.", description: "Inspect the ledger fields and measurement definitions behind reviewable AI market evidence.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.research },
	geo: { canonicalPath: "/geo", title: "See where your brand enters an AI answer.", description: "Map discovery, description, comparison, available sources, and repeat observation within a configured scope.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.geo },
	company: { canonicalPath: "/company", title: "Evidence before conclusion.", description: "Learn how Yonaris combines customer-visible software, operated collection, and human review.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.company },
	diagnostic: { canonicalPath: "/diagnostic", title: "Request a focused AI market diagnostic.", description: "Start a scope review for a focused, evidence-led AI market diagnostic.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.diagnostic },
	privacy: { canonicalPath: "/privacy", title: "Privacy", description: "Understand the privacy gate for the Yonaris global diagnostic journey.", sectionIds: GLOBAL_ENGLISH_SECTION_IDS.privacy },
} as const;

export type GlobalEnglishPageKey = keyof typeof globalEnglishPageContracts;

export function globalEnglishPageHead(key: GlobalEnglishPageKey) {
	const page = globalEnglishPageContracts[key];
	const title = `${page.title} | Yonaris`;
	return {
		meta: [
			{ title }, { name: "description", content: page.description }, { name: "theme-color", content: "#0b1220" },
			{ property: "og:title", content: title }, { property: "og:description", content: page.description },
		],
		links: [
			{ rel: "canonical", href: siteHref(page.canonicalPath) },
			{ rel: "alternate", hrefLang: "en", href: siteHref(page.canonicalPath) },
			{ rel: "alternate", hrefLang: "x-default", href: siteHref(page.canonicalPath) },
		],
		scripts: [organizationJsonLd(), ...(key === "home" ? [websiteJsonLd()] : [])],
	};
}
