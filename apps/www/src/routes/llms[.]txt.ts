import { createFileRoute } from "@tanstack/react-router";
import { renderLlmsIndex } from "@/lib/marketing-content";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET() {
				return new Response(renderLlmsIndex(), {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			},
		},
	},
});
