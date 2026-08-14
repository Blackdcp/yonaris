export const RESPONSE_SNAPSHOT_PREVIEW_CSP =
	"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'";

const SNAPSHOT_PREVIEW_PATH =
	/^\/api\/app\/response-snapshots\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type SecurityHeaderOptions = {
	strictTransportSecurity: string;
	posthogOrigin: string | undefined;
};

export function applySecurityHeaders(request: Request, response: Response, options: SecurityHeaderOptions): Response {
	const snapshotPreview = isSanitizedSnapshotPreview(request, response);
	const headers = buildSecurityHeaders(options);
	if (snapshotPreview) {
		headers["Content-Security-Policy"] = RESPONSE_SNAPSHOT_PREVIEW_CSP;
		headers["X-Frame-Options"] = "SAMEORIGIN";
	}
	for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
	return response;
}

function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
	return {
		"Content-Security-Policy": [
			"default-src 'self'",
			`script-src 'self' 'unsafe-inline' https://*.clarity.ms${options.posthogOrigin ? ` ${options.posthogOrigin}` : ""}`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: https: https://c.bing.com",
			"font-src 'self' data:",
			`connect-src 'self'${options.posthogOrigin ? ` ${options.posthogOrigin}` : ""} https://*.sentry.io https://*.clarity.ms https://c.bing.com`,
			"object-src 'none'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; "),
		"Strict-Transport-Security": options.strictTransportSecurity,
		"X-Frame-Options": "DENY",
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"Cross-Origin-Opener-Policy": "same-origin-allow-popups",
		"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
	};
}

function isSanitizedSnapshotPreview(request: Request, response: Response): boolean {
	if (request.method !== "GET" || response.status !== 200) return false;
	const url = new URL(request.url);
	if (!SNAPSHOT_PREVIEW_PATH.test(url.pathname)) return false;
	if (
		url.searchParams.getAll("asset").length !== 1 ||
		url.searchParams.get("asset") !== "html" ||
		url.searchParams.getAll("download").length !== 1 ||
		url.searchParams.get("download") !== "0" ||
		[...url.searchParams.keys()].some((key) => key !== "asset" && key !== "download")
	) {
		return false;
	}
	return (
		response.headers.get("content-type")?.toLowerCase().startsWith("text/html;") === true &&
		response.headers.get("content-security-policy") === RESPONSE_SNAPSHOT_PREVIEW_CSP
	);
}
