import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";
import { renderRobots } from "@/lib/sitemap";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const siteUrl = SITE_URL || new URL(request.url).origin;
				return new Response(renderRobots(siteUrl), {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			},
		},
	},
});
