import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";
import { renderSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const siteUrl = SITE_URL || new URL(request.url).origin;
				return new Response(renderSitemap(siteUrl), {
					headers: { "Content-Type": "application/xml; charset=utf-8" },
				});
			},
		},
	},
});
