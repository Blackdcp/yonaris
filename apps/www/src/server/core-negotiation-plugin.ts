import type { NitroAppPlugin } from "nitro/types";
import { restoreApplicationVary } from "@/lib/machine-response";

/**
 * Nitro's public-asset middleware prepares `Vary: Accept-Encoding` before it
 * knows whether the request will be handled by the application. H3 then gives
 * that prepared header precedence over the application's `Vary` header.
 * Restore every application Vary dimension on the finalized response, while
 * retaining dimensions prepared by Nitro. This covers both the 14 core pages
 * and the existing bare Docs content negotiation without disabling compression.
 */
export default ((nitroApp) => {
	nitroApp.hooks.hook("response", (response) => {
		restoreApplicationVary(response);
	});
}) satisfies NitroAppPlugin;
