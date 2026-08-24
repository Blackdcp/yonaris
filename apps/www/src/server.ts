import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { appendVary, preserveApplicationVary } from "@/lib/machine-response";
import { resolveMarkdownRequest, rewriteMarkdownRequest } from "@/lib/markdown-negotiation";

function configuredPosthogOrigin(): string | undefined {
	if (!process.env.VITE_POSTHOG_KEY?.trim()) return undefined;
	const host = process.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
	try {
		return new URL(host).origin;
	} catch {
		return undefined;
	}
}

const posthogOrigin = configuredPosthogOrigin();

const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy": [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		`connect-src 'self'${posthogOrigin ? ` ${posthogOrigin}` : ""} https://*.mux.com https://*.litix.io`,
		"media-src 'self' blob: https://*.mux.com",
		"worker-src 'self' blob:",
		"frame-src 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join("; "),
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

function addSecurityHeaders(response: Response): Response {
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}

export default createServerEntry({
	async fetch(request) {
		const coreMarkdown = resolveMarkdownRequest(request);

		let req = request;
		if (coreMarkdown.targetPath) {
			req = rewriteMarkdownRequest(request, coreMarkdown.targetPath);
		}

		const response = await handler.fetch(req);
		if (coreMarkdown.variesOnAccept) {
			appendVary(response.headers, "Accept");
			preserveApplicationVary(response);
		}
		return addSecurityHeaders(response);
	},
});
