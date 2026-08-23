import { parseDiagnosticSearch } from "./diagnostic-schema";

export const DIAGNOSTIC_PREFILL_SEARCH_GLOBAL = "__YONARIS_DIAGNOSTIC_PREFILL_SEARCH__" as const;

const SENSITIVE_PROPERTY_KEYS = new Set([
	"website",
	"brand",
	"market",
	"question",
	"competitors",
	"name",
	"email",
	"consent",
	"companyurl",
	"domain",
	"uuid",
	"idempotencykey",
	"response",
	"payload",
	"lead",
]);
const URL_PROPERTY_KEYS = new Set(["$current_url", "$referrer", "$initial_referrer", "$initial_current_url"]);

let hydrationPrefill: string | undefined;

export function buildDiagnosticAnalyticsBootstrapScript(): string {
	return `(()=>{const p=location.pathname;if(p!=="/diagnostic"&&p!=="/zh/diagnostic")return;window.${DIAGNOSTIC_PREFILL_SEARCH_GLOBAL}=location.search;history.replaceState(history.state,"",location.pathname+location.hash)})();`;
}

function sanitizeUrlLike(value: string): string {
	if (
		!value ||
		[...value].some((character) => {
			const codePoint = character.codePointAt(0);
			return /\s/u.test(character) || (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f));
		})
	)
		return "";
	const absolute = /^[a-z][a-z\d+.-]*:\/\//iu.test(value);
	try {
		const url = new URL(value, "https://yonaris.invalid");
		url.search = "";
		return absolute ? url.toString() : `${url.pathname}${url.hash}`;
	} catch {
		return "";
	}
}

export function sanitizeAnalyticsUrl(value: string): string {
	return sanitizeUrlLike(value);
}

export function sanitizeAnalyticsReferrer(value: string): string {
	return sanitizeUrlLike(value);
}

function normalizePropertyKey(key: string): string {
	return key.replace(/[^a-z\d]/giu, "").toLowerCase();
}

function sanitizeNestedValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sanitizeNestedValue);
	if (typeof value !== "object" || value === null) return value;
	return sanitizeAnalyticsProperties(value as Record<string, unknown>);
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown>): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (SENSITIVE_PROPERTY_KEYS.has(normalizePropertyKey(key))) continue;
		if (URL_PROPERTY_KEYS.has(key) && typeof value === "string") {
			sanitized[key] = key.includes("referrer") ? sanitizeAnalyticsReferrer(value) : sanitizeAnalyticsUrl(value);
			continue;
		}
		sanitized[key] = sanitizeNestedValue(value);
	}
	return sanitized;
}

function websiteFromRawSearch(rawSearch: string): string {
	const params = new URLSearchParams(rawSearch);
	const websites = params.getAll("website");
	if (websites.length !== 1) return "";
	return parseDiagnosticSearch({ website: websites[0] }).website;
}

export function consumeDiagnosticPrefillWebsite(serverWebsite?: string): string {
	if (typeof window === "undefined") return serverWebsite ?? "";
	const rawSearch = window[DIAGNOSTIC_PREFILL_SEARCH_GLOBAL];
	if (typeof rawSearch !== "string") return hydrationPrefill ?? serverWebsite ?? "";
	delete window[DIAGNOSTIC_PREFILL_SEARCH_GLOBAL];
	hydrationPrefill = websiteFromRawSearch(rawSearch) || serverWebsite || "";
	return hydrationPrefill;
}

export function clearDiagnosticPrefillWebsite(): void {
	hydrationPrefill = undefined;
}
