import { createFileRoute } from "@tanstack/react-router";
import { aeoVerticals } from "@/data/aeo-verticals";
import { aiSearchEngines } from "@/data/ai-search-engines";
import { glossaryTerms } from "@/data/glossary";
import { SITE_URL } from "@/lib/seo";
import { source } from "@/lib/source";

interface SitemapEntry {
	path: string;
	changefreq: string;
	priority: number;
	/**
	 * W3C date (YYYY-MM-DD). Only set when we have a real per-page date. A faked
	 * uniform lastmod (e.g. "today" on every URL) is an unreliable signal that
	 * Google discards, so pages without a genuine date omit it entirely.
	 */
	lastmod?: string;
}

const staticPages: SitemapEntry[] = [
	{ path: "/", changefreq: "weekly", priority: 1.0 },
	{ path: "/features", changefreq: "monthly", priority: 0.8 },
	{ path: "/pricing", changefreq: "monthly", priority: 0.8 },
	{ path: "/docs", changefreq: "weekly", priority: 0.9 },
	{ path: "/brand", changefreq: "monthly", priority: 0.5 },
	{ path: "/status", changefreq: "daily", priority: 0.5 },
];

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const siteUrl = SITE_URL || new URL(request.url).origin;
				const docsPages: SitemapEntry[] = source.getPages().map((page) => ({
					path: page.url,
					changefreq: "weekly",
					priority: 0.7,
				}));

				// Editorial programmatic sections.
				const glossaryPages: SitemapEntry[] = [
					{ path: "/glossary", changefreq: "monthly", priority: 0.7 },
					...glossaryTerms.map((t) => ({
						path: `/glossary/${t.slug}`,
						changefreq: "monthly",
						priority: 0.5,
					})),
				];

				const aiSearchPages: SitemapEntry[] = [
					{ path: "/ai-search", changefreq: "monthly", priority: 0.7 },
					...aiSearchEngines.map((e) => ({
						path: `/ai-search/${e.slug}`,
						changefreq: "monthly",
						priority: 0.6,
					})),
				];

				const aeoForPages: SitemapEntry[] = [
					{ path: "/aeo-for", changefreq: "monthly", priority: 0.7 },
					...aeoVerticals.map((v) => ({
						path: `/aeo-for/${v.slug}`,
						changefreq: "monthly",
						priority: 0.6,
					})),
				];

				const allPages: SitemapEntry[] = [
					...staticPages,
					...docsPages,
					...glossaryPages,
					...aiSearchPages,
					...aeoForPages,
				];

				const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map(
		(page) => `  <url>
    <loc>${siteUrl}${page.path}</loc>${page.lastmod ? `\n    <lastmod>${page.lastmod}</lastmod>` : ""}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`;

				return new Response(sitemap, {
					headers: { "Content-Type": "application/xml" },
				});
			},
		},
	},
});
