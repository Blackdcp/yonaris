import { createFileRoute } from "@tanstack/react-router";
import type { AgentPageKey } from "@/content/site/types";
import { renderZhAgentDocument, renderZhAgentIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

const topics = [
	"product",
	"approach",
	"geo",
	"company",
	"diagnostic",
	"privacy",
] as const satisfies readonly AgentPageKey[];

export const Route = createFileRoute("/llms.mdx/zh-agent/$")({
	server: {
		handlers: {
			GET: ({ params }) => {
				const topic = params._splat;
				if (topic === "index") return machineDocumentResponse(renderZhAgentIndex(), { language: "zh" });
				if (!topic || !topics.includes(topic as AgentPageKey)) return new Response("Not Found", { status: 404 });
				return machineDocumentResponse(renderZhAgentDocument(topic as AgentPageKey), { language: "zh" });
			},
		},
	},
});
