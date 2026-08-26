import type { ExperienceLocale, HumanPageKey } from "@/content/experience/types";
import { agentCatalogPath, agentMarkdownPath, buildAgentEntityGraph, getAgentTopic } from "./machine-documents";
import { getMarketingOgImage } from "./og";
import { canonicalUrl, SITE_URL, siteHref } from "./site-origin";

export { canonicalUrl, SITE_URL, siteHref } from "./site-origin";
export const SITE_NAME = "Yonaris";
export const SITE_DESCRIPTION =
	"AI-native MarTech infrastructure built for decisions made by people and shaped by agents.";
export const SITE_LOGO_URL = SITE_URL ? `${SITE_URL}/brand/logos/yonaris-wordmark-navy.png` : undefined;

export function pageSocialMeta(options: {
	title: string;
	description: string;
	canonicalPath: string;
	locale: "en_US" | "zh_CN";
}) {
	const pageUrl = siteHref(options.canonicalPath);
	const imageUrl = siteHref(getMarketingOgImage({ title: options.title, description: options.description }));

	return [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:locale", content: options.locale },
		{ property: "og:title", content: options.title },
		{ property: "og:description", content: options.description },
		{ property: "og:url", content: pageUrl },
		{ property: "og:image", content: imageUrl },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: options.title },
		{ name: "twitter:description", content: options.description },
		{ name: "twitter:image", content: imageUrl },
	] as const;
}

export function jsonLd(data: Record<string, unknown>): { type: string; children: string } {
	return { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", ...data }) };
}

export function websiteJsonLd(description = SITE_DESCRIPTION, inLanguage = "en") {
	return jsonLd({
		"@type": "WebSite",
		"@id": siteHref("/#website"),
		name: SITE_NAME,
		url: siteHref("/"),
		description,
		inLanguage,
		publisher: { "@id": siteHref("/#organization") },
	});
}

export function organizationJsonLd() {
	return jsonLd({
		"@type": "Organization",
		"@id": siteHref("/#organization"),
		name: SITE_NAME,
		description: SITE_DESCRIPTION,
		url: siteHref("/"),
		logo: siteHref("/brand/logos/yonaris-wordmark-navy.png"),
	});
}

export function publicEntityGraph(options: { locale: ExperienceLocale; pageKey: HumanPageKey }): {
	type: "application/ld+json";
	children: string;
} {
	return {
		type: "application/ld+json",
		children: JSON.stringify({
			"@context": "https://schema.org",
			"@graph": buildAgentEntityGraph(options.locale, [options.pageKey], siteHref),
		}),
	};
}

export function machineDiscoveryLinks(locale: ExperienceLocale, pageKey: HumanPageKey) {
	return [
		{ rel: "alternate", type: "text/markdown", href: siteHref(agentMarkdownPath(locale, pageKey)) },
		{ rel: "alternate", type: "application/ld+json", href: siteHref(agentCatalogPath(locale)) },
		{ rel: "describedby", type: "text/plain", href: siteHref("/llms.txt") },
	] as const;
}

export function agentPageHead(locale: ExperienceLocale, pageKey: HumanPageKey) {
	const topic = getAgentTopic(locale, pageKey);
	return {
		meta: [{ title: topic.title }, { name: "robots", content: "noindex,follow" }],
		links: [{ rel: "canonical", href: siteHref(topic.humanPath) }, ...machineDiscoveryLinks(locale, pageKey)],
		scripts: [publicEntityGraph({ locale, pageKey })],
	};
}

export function rootOgImage(): string | undefined {
	return canonicalUrl(getMarketingOgImage({ title: SITE_NAME, description: SITE_DESCRIPTION }));
}
