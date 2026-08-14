import "../instrument.server.mjs";
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { startCredentialRefresh } from "@workspace/lib/secrets";
import { applySecurityHeaders } from "./server-security-headers";

// Not awaited: the app has to serve sign-in and settings whether or not the
// credential store is reachable.
void startCredentialRefresh();

// HSTS asserts HTTPS-only for the host that served the response. Whitelabel
// deployments run on customer-controlled custom domains, where `includeSubDomains`
// would wrongly assert HTTPS across subdomains we don't own — so that directive
// is scoped to our own deployments. Browsers ignore HSTS received over plain
// HTTP, so it stays inert on localhost.
const strictTransportSecurity =
	process.env.DEPLOYMENT_MODE === "whitelabel" ? "max-age=63072000" : "max-age=63072000; includeSubDomains";

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

export default createServerEntry(
	wrapFetchWithSentry({
		async fetch(request: Request) {
			const response = await handler.fetch(request);
			return applySecurityHeaders(request, response, { strictTransportSecurity, posthogOrigin });
		},
	}),
);
