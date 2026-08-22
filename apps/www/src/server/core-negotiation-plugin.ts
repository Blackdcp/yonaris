import type { NitroAppPlugin } from "nitro/types";
import { appendVary } from "@/lib/machine-response";
import { resolveMarkdownRequest } from "@/lib/markdown-negotiation";

/**
 * Nitro's public-asset middleware prepares `Vary: Accept-Encoding` before it
 * knows whether the request will be handled by the application. H3 then gives
 * that prepared header precedence over the application's `Vary` header.
 * Restore the content-negotiation dimension on the finalized response, while
 * retaining every dimension prepared by Nitro or the application.
 */
export default ((nitroApp) => {
	nitroApp.hooks.hook("response", (response, event) => {
		if (resolveMarkdownRequest(event.req).variesOnAccept) {
			appendVary(response.headers, "Accept");
		}
	});
}) satisfies NitroAppPlugin;
