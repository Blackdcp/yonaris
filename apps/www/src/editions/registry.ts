import type { EditionDefinition, EditionPage, EditionPageRef, SiteEdition } from "./types";

export const GLOBAL_ENGLISH_SECTION_IDS = {
	home: [
		"hero",
		"market-shift",
		"buyer-questions",
		"operating-loop",
		"product-preview",
		"human-agent-parity",
		"evidence-boundary",
		"request-close",
	],
	product: ["scope-rings-hero", "evidence-workbench", "operating-loop", "responsibility-lanes", "request-close"],
	approach: ["premise-hero", "four-step-path", "step-artifacts", "repeat-observation-boundary", "request-close"],
	research: ["ledger-hero", "metric-anatomy", "cohort-comparison", "answer-annotation", "limits-and-request-close"],
	geo: [
		"entry-map-hero",
		"buyer-questions-and-artifacts",
		"applied-workflow",
		"scope-matrix",
		"product-evidence-bridge",
		"request-close",
	],
	company: [
		"operating-model-hero",
		"purpose-and-current-model",
		"verified-trust-slot",
		"principles",
		"diagnostic-close",
	],
	diagnostic: ["deliverable-hero", "request-timeline", "two-stage-form", "privacy-failure-and-alternate"],
	privacy: ["hero", "english-disclosure", "regional-boundaries"],
} as const;

const englishKeys = ["home", "product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const;
const englishPaths = [
	"/",
	"/product",
	"/approach",
	"/research",
	"/geo",
	"/company",
	"/diagnostic",
	"/privacy",
] as const;
const englishPages = englishKeys.map(
	(key, index): EditionPage => ({
		ref: `global-en:${key}`,
		editionId: "global-en",
		locale: "en",
		pathname: englishPaths[index],
		intentId: key,
		publication: "published",
		navigation: key === "privacy" ? ["footer"] : key === "diagnostic" ? ["utility", "footer"] : ["primary", "footer"],
		seo: { indexable: true, xDefault: true },
	}),
);

const zhKeys = ["home", "product", "approach", "research", "geo", "company", "diagnostic"] as const;
const zhPages = zhKeys.map(
	(key): EditionPage => ({
		ref: `zh-cn-legacy:${key}`,
		editionId: "zh-cn-legacy",
		locale: "zh-CN",
		pathname: key === "home" ? "/zh" : `/zh/${key}`,
		intentId: `zh-legacy-${key}`,
		publication: "published",
		navigation: ["footer"],
		seo: { indexable: true },
	}),
);

const editions: Record<SiteEdition, EditionDefinition> = {
	"global-en": {
		id: "global-en",
		home: "global-en:home",
		pages: englishPages,
		primaryNavigation: ["global-en:product", "global-en:approach", "global-en:research", "global-en:company"],
		footerNavigation: englishPages.filter((page) => page.navigation.includes("footer")).map((page) => page.ref),
		localeFallbackHome: "global-en:home",
		analyticsPolicy: "disabled",
		diagnosticPolicy: "disabled",
	},
	"zh-cn-legacy": {
		id: "zh-cn-legacy",
		home: "zh-cn-legacy:home",
		pages: zhPages,
		primaryNavigation: [],
		footerNavigation: zhPages.map((page) => page.ref),
		localeFallbackHome: "zh-cn-legacy:home",
		analyticsPolicy: "disabled",
		diagnosticPolicy: "legacy-v1",
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
