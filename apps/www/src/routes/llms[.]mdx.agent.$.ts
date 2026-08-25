import { createFileRoute } from "@tanstack/react-router";
import type { AgentPageKey } from "@/content/site/types";
import { renderAgentDocument, renderAgentIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

const pageKeys = [
	"product",
	"approach",
	"geo",
	"company",
	"diagnostic",
	"privacy",
] as const satisfies readonly AgentPageKey[];

export const Route = createFileRoute("/llms.mdx/agent/$")({
	server: {
		handlers: {
			GET: ({ params }) => {
				const pageKey = params._splat;
				if (pageKey === "index") return machineDocumentResponse(renderAgentIndex());
				if (!pageKey || !pageKeys.includes(pageKey as AgentPageKey)) return new Response("Not Found", { status: 404 });
				return machineDocumentResponse(renderAgentDocument(pageKey as AgentPageKey));
			},
		},
	},
});
