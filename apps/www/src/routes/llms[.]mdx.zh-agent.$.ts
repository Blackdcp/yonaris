import { createFileRoute } from "@tanstack/react-router";
import type { HumanPageKey } from "@/content/experience/types";
import { agentDocumentLinks, agentMarkdownPath, renderCoreMarkdown } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

const pageKeys = new Map<string, HumanPageKey>([
	["index", "home"],
	["product", "product"],
	["approach", "approach"],
	["geo", "geo"],
	["company", "company"],
	["diagnostic", "diagnostic"],
	["privacy", "privacy"],
]);

function routeResponse(splat: string | undefined, head: boolean): Response {
	const pageKey = splat ? pageKeys.get(splat) : undefined;
	if (!pageKey) return new Response(head ? null : "Not Found", { status: 404 });
	return machineDocumentResponse(head ? null : renderCoreMarkdown(pageKey, "zh"), {
		language: "zh",
		contentLocation: agentMarkdownPath("zh", pageKey),
		links: agentDocumentLinks("zh", pageKey),
	});
}

export const Route = createFileRoute("/llms.mdx/zh-agent/$")({
	server: {
		handlers: {
			GET: ({ params }) => routeResponse(params._splat, false),
			HEAD: ({ params }) => routeResponse(params._splat, true),
		},
	},
});
