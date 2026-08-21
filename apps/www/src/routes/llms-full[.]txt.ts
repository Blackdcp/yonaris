import { createFileRoute } from "@tanstack/react-router";
import { renderLlmsFull } from "@/lib/marketing-content";

export const Route = createFileRoute("/llms-full.txt")({
	server: {
		handlers: {
			GET: () => new Response(renderLlmsFull(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } }),
		},
	},
});
