const SENSITIVE_PROPERTY_KEYS = new Set([
	"website",
	"brand",
	"market",
	"question",
	"competitors",
	"name",
	"email",
	"phone",
	"company",
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

export function buildDiagnosticAnalyticsBootstrapScript(): string {
	return '(()=>{const p=location.pathname;if((p==="/diagnostic"||p==="/zh/diagnostic")&&location.search)history.replaceState(history.state,"",location.pathname+location.hash)})();';
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
