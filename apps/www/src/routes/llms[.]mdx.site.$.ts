import { createFileRoute } from "@tanstack/react-router";
import { CORE_PAGE_KEYS } from "@/content/site";
import type { CorePageKey, Locale } from "@/content/site/types";
import { agentDocumentLinks, agentMarkdownPath, renderCoreMarkdown } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

function routeResponse(splat: string | undefined, head: boolean): Response {
	const segments = splat?.split("/") ?? [];
	const locale = segments[0] as Locale | undefined;
	const pageKey = segments[1] as CorePageKey | undefined;
	if (
		segments.length !== 2 ||
		(locale !== "en" && locale !== "zh") ||
		!pageKey ||
		!CORE_PAGE_KEYS.includes(pageKey)
	) {
		return new Response(head ? null : "Not Found", { status: 404 });
	}

	return machineDocumentResponse(head ? null : renderCoreMarkdown(pageKey, locale), {
		language: locale,
		contentLocation: agentMarkdownPath(locale, pageKey),
		links: agentDocumentLinks(locale, pageKey),
	});
}

export const Route = createFileRoute("/llms.mdx/site/$")({
	server: {
		handlers: {
			GET: ({ params }) => routeResponse(params._splat, false),
			HEAD: ({ params }) => routeResponse(params._splat, true),
		},
	},
});
