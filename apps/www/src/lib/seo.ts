import { getMarketingOgImage } from "./og";

const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();

export const SITE_URL = configuredSiteUrl ? configuredSiteUrl.replace(/\/$/, "") : "";
export const SITE_NAME = "Yonaris";
export const SITE_DESCRIPTION =
	"Yonaris helps brands review how they appear when customers use AI to discover, compare, and choose.";
export const SITE_LOGO_URL = SITE_URL ? `${SITE_URL}/brand/logos/yonaris-wordmark-navy.png` : undefined;

export function canonicalUrl(path: string): string | undefined {
	if (path.startsWith("http")) return path;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return SITE_URL ? `${SITE_URL}${normalizedPath}` : undefined;
}

export function siteHref(path: string): string {
	if (path.startsWith("http")) return path;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return canonicalUrl(normalizedPath) ?? normalizedPath;
}

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
		name: SITE_NAME,
		...(SITE_URL ? { url: SITE_URL } : {}),
		description,
		inLanguage,
	});
}

export function organizationJsonLd(description = SITE_DESCRIPTION, inLanguage = "en") {
	return jsonLd({
		"@type": "Organization",
		name: SITE_NAME,
		description,
		inLanguage,
		...(SITE_URL ? { url: SITE_URL } : {}),
		...(SITE_LOGO_URL ? { logo: SITE_LOGO_URL } : {}),
	});
}

export function rootOgImage(): string | undefined {
	return canonicalUrl(getMarketingOgImage({ title: SITE_NAME, description: SITE_DESCRIPTION }));
}
