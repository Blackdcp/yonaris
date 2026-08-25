import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import type { EditionDefinition, EditionPage, EditionPageRef, SiteEdition } from "./types";

const globalPath: Record<HumanPageKey, `/${string}`> = {
	home: "/",
	product: "/product",
	approach: "/approach",
	geo: "/geo",
	company: "/company",
	diagnostic: "/diagnostic",
	privacy: "/privacy",
};

const chinaPath: Record<HumanPageKey, `/${string}`> = {
	home: "/zh",
	product: "/zh/product",
	approach: "/zh/approach",
	geo: "/zh/geo",
	company: "/zh/company",
	diagnostic: "/zh/diagnostic",
	privacy: "/zh/privacy",
};

function navigationFor(key: HumanPageKey): EditionPage["navigation"] {
	if (key === "diagnostic") return ["utility", "footer"];
	if (key === "privacy" || key === "home") return ["footer"];
	return ["primary", "footer"];
}

function pagesFor(editionId: SiteEdition): readonly EditionPage[] {
	return HUMAN_PAGE_KEYS.map((key) => ({
		ref: `${editionId}:${key}`,
		editionId,
		locale: editionId === "global-en" ? "en" : "zh-CN",
		pathname: editionId === "global-en" ? globalPath[key] : chinaPath[key],
		intentId: editionId === "global-en" ? key : `zh-${key}`,
		publication: "published",
		navigation: navigationFor(key),
		seo: { indexable: true, ...(editionId === "global-en" ? { xDefault: true } : {}) },
	}));
}

const globalPages = pagesFor("global-en");
const chinaPages = pagesFor("zh-cn");

const editions: Record<SiteEdition, EditionDefinition> = {
	"global-en": {
		id: "global-en",
		home: "global-en:home",
		pages: globalPages,
		primaryNavigation: ["global-en:product", "global-en:approach", "global-en:geo", "global-en:company"],
		footerNavigation: globalPages.filter((page) => page.navigation.includes("footer")).map((page) => page.ref),
		localeFallbackHome: "global-en:home",
		analyticsPolicy: "disabled",
		diagnosticPolicy: "global-v2",
	},
	"zh-cn": {
		id: "zh-cn",
		home: "zh-cn:home",
		pages: chinaPages,
		primaryNavigation: ["zh-cn:product", "zh-cn:approach", "zh-cn:geo", "zh-cn:company"],
		footerNavigation: chinaPages.filter((page) => page.navigation.includes("footer")).map((page) => page.ref),
		localeFallbackHome: "zh-cn:home",
		analyticsPolicy: "disabled",
		diagnosticPolicy: "regional-v2",
	},
};

export function getEdition(id: SiteEdition): EditionDefinition {
	return editions[id];
}

export function getEditionPage(ref: EditionPageRef): EditionPage {
	const page = Object.values(editions)
		.flatMap((edition) => edition.pages)
		.find((candidate) => candidate.ref === ref);
	if (!page) throw new Error(`Unknown edition page: ${ref}`);
	return page;
}

export function findPublishedEditionPage(pathname: string): EditionPage | undefined {
	return Object.values(editions)
		.flatMap((edition) => edition.pages)
		.find((page) => page.pathname === pathname && page.publication === "published");
}
