import { SITE_URL } from "./site-origin";

// Domains we own or co-own. Outbound links to these keep the Referer header —
// rel="noopener" only, never "noreferrer" — so the destination's analytics can
// attribute the visit back to this site. Every other external link gets the
// full rel="noopener noreferrer". Subdomains of the configured origin count.
const OWNED_DOMAINS = (() => {
	if (!SITE_URL) return [];
	try {
		return [new URL(SITE_URL).hostname];
	} catch {
		return [];
	}
})();

function isOwnedHost(hostname: string): boolean {
	return OWNED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * `rel` value for an outbound link. Owned domains keep the Referer (so their
 * analytics can attribute the traffic); everything else is fully isolated.
 */
export function externalRel(href: string): string {
	try {
		return isOwnedHost(new URL(href).hostname) ? "noopener" : "noopener noreferrer";
	} catch {
		return "noopener noreferrer";
	}
}
