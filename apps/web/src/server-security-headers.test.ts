import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./server-security-headers";

const OPTIONS = {
	strictTransportSecurity: "max-age=63072000; includeSubDomains",
	posthogOrigin: undefined,
};

describe("applySecurityHeaders", () => {
	it("keeps ordinary responses unavailable to frames", () => {
		const response = applySecurityHeaders(
			new Request("https://portal.example/app/stepfun"),
			new Response("portal"),
			OPTIONS,
		);

		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
	});

	it("preserves the stricter sanitized snapshot policy while allowing same-origin framing", () => {
		const response = applySecurityHeaders(
			new Request(
				"https://portal.example/api/app/response-snapshots/00000000-0000-0000-0000-610000000001?asset=html&download=0",
			),
			new Response("<p>archived answer</p>", {
				status: 200,
				headers: {
					"Content-Type": "text/html; charset=utf-8",
					"Content-Security-Policy":
						"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
				},
			}),
			OPTIONS,
		);

		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(response.headers.get("content-security-policy")).toBe(
			"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
		);
	});

	it.each([
		"https://portal.example/api/app/response-snapshots/00000000-0000-0000-0000-610000000001?asset=html&download=1",
		"https://portal.example/api/app/response-snapshots/00000000-0000-0000-0000-610000000001?asset=json&download=0",
		"https://portal.example/api/app/response-snapshots/not-a-guid?asset=html&download=0",
	])("does not widen framing for non-preview requests: %s", (url) => {
		const response = applySecurityHeaders(new Request(url), new Response("body"), OPTIONS);

		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
	});
});
