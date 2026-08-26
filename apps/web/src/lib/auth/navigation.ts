import { safeReturnTo } from "@/lib/return-to";

/**
 * Authentication changes the authoritative server-side language source.
 * Reload the target document so the root locale is resolved before rendering.
 */
export function completeAuthenticationNavigation(returnTo?: string): void {
	window.location.assign(safeReturnTo(returnTo));
}
