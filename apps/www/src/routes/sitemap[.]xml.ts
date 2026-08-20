import { createFileRoute } from "@tanstack/react-router";
import { MARKETING_SITEMAP_PATHS } from "@/lib/marketing-content";
import { SITE_URL } from "@/lib/seo";

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

const staticPages: SitemapEntry[] = MARKETING_SITEMAP_PATHS.map((path) => ({
	path,
	changefreq: path === "/" || path === "/zh" ? "weekly" : "monthly",
	priority: path === "/" ? 1 : path === "/zh" || path.endsWith("/diagnostic") ? 0.9 : path.startsWith("/agent") || path.startsWith("/llms") ? 0.6 : 0.8,
}));

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const siteUrl = SITE_URL || new URL(request.url).origin;
				const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
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
