import { createFileRoute } from "@tanstack/react-router";
import { CORE_PAGE_KEYS } from "@/content/site";
import type { CorePageKey, Locale } from "@/content/site/types";
import { renderCoreMarkdown } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/llms.mdx/site/$")({
	server: {
		handlers: {
			GET: ({ params }) => {
				const segments = params._splat?.split("/") ?? [];
				const locale = segments[0] as Locale | undefined;
				const pageKey = segments[1] as CorePageKey | undefined;
				if (
					segments.length !== 2 ||
					(locale !== "en" && locale !== "zh") ||
					!pageKey ||
					!CORE_PAGE_KEYS.includes(pageKey)
				) {
					return new Response("Not Found", { status: 404 });
				}

				return machineDocumentResponse(renderCoreMarkdown(pageKey, locale), { language: locale });
			},
		},
	},
});
