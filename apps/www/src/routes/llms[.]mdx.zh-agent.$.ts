import { createFileRoute } from "@tanstack/react-router";
import type { ZhMachinePageKey } from "@/content/site/zh-cn/machine";
import { renderZhAgentDocument, renderZhAgentIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

type Topic = Exclude<ZhMachinePageKey, "home">;
const topics = ["product", "approach", "research", "geo", "company", "diagnostic", "privacy"] as const satisfies readonly Topic[];

export const Route = createFileRoute("/llms.mdx/zh-agent/$")({
	server: { handlers: { GET: ({ params }) => {
		const topic = params._splat;
		if (topic === "index") return machineDocumentResponse(renderZhAgentIndex(), { language: "zh" });
		if (!topic || !topics.includes(topic as Topic)) return new Response("Not Found", { status: 404 });
		return machineDocumentResponse(renderZhAgentDocument(topic as Topic), { language: "zh" });
	} } },
});
