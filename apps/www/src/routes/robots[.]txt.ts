import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const siteUrl = SITE_URL || new URL(request.url).origin;
				const robots = `User-agent: *
Allow: /
Allow: /agent/
Allow: /llms.txt
Allow: /llms-full.txt

Sitemap: ${siteUrl}/sitemap.xml`;

				return new Response(robots, {
					headers: { "Content-Type": "text/plain" },
				});
			},
		},
	},
});
