import { createFileRoute } from "@tanstack/react-router";
import { getLLMText } from "@/lib/get-llm-text";
import { machineDocumentResponse } from "@/lib/machine-response";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms.mdx/docs/$")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const slugs = params._splat?.split("/") ?? [];
				const page = source.getPage(slugs);
				if (!page) return new Response("Not Found", { status: 404 });

				return machineDocumentResponse(await getLLMText(page));
			},
		},
	},
});
