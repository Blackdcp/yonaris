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
