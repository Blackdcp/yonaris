import type { SiteRouteDefinition } from "@/content/site/types";
import { SITE_MANIFEST } from "./site-manifest";

const siteRoutes: readonly SiteRouteDefinition[] = SITE_MANIFEST;

export interface SitemapEntry {
	path: string;
	priority: number;
	lastVerified?: string;
	alternates?: readonly { hreflang: "en" | "zh-CN" | "x-default"; path: string }[];
}

function coreAlternates(canonicals: { en?: string; zh?: string }): SitemapEntry["alternates"] {
	if (!canonicals.en || !canonicals.zh) return undefined;
	return [
		{ hreflang: "en", path: canonicals.en },
		{ hreflang: "zh-CN", path: canonicals.zh },
		{ hreflang: "x-default", path: canonicals.en },
	];
}

export function buildSitemapEntries(): readonly SitemapEntry[] {
	return siteRoutes.flatMap((route) => {
		const sitemap = route.sitemap;
		if (route.indexPolicy !== "index,follow" || sitemap === false) return [];

		const alternates = route.routeClass === "core" ? coreAlternates(route.canonicals) : undefined;
		return (["en", "zh"] as const).flatMap((locale) => {
			const path = route.canonicals[locale];
			if (!path) return [];
			return [
				{
					path,
					priority: sitemap.priority,
					...(sitemap.lastVerified ? { lastVerified: sitemap.lastVerified } : {}),
					...(alternates ? { alternates } : {}),
				},
			];
		});
	});
}

function normalizeOrigin(origin: string): string {
	return origin.replace(/\/+$/, "");
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function absoluteUrl(origin: string, path: string): string {
	return `${normalizeOrigin(origin)}${path}`;
}

export function renderSitemap(origin: string): string {
	const entries = buildSitemapEntries();
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
	.map((entry) => {
		const lastmod = entry.lastVerified ? `\n    <lastmod>${escapeXml(entry.lastVerified)}</lastmod>` : "";
		const alternates = entry.alternates
			?.map(
				(alternate) =>
					`    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(absoluteUrl(origin, alternate.path))}" />`,
			)
			.join("\n");
		return `  <url>
    <loc>${escapeXml(absoluteUrl(origin, entry.path))}</loc>${lastmod}
    <priority>${entry.priority}</priority>${alternates ? `\n${alternates}` : ""}
  </url>`;
	})
	.join("\n")}
</urlset>`;
}

export function renderRobots(origin: string): string {
	return `User-agent: *
Allow: /

Sitemap: ${normalizeOrigin(origin)}/sitemap.xml`;
}
