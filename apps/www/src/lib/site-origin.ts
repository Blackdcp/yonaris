const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
const defaultSiteUrl = "https://yonaris.com";

export const SITE_URL = (configuredSiteUrl || defaultSiteUrl).replace(/\/$/, "");

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
