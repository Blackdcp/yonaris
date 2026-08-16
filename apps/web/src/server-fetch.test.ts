import { describe, expect, it, vi } from "vitest";
import { fetchApplicationResponse } from "./server-fetch";

const OPTIONS = {
	strictTransportSecurity: "max-age=63072000; includeSubDomains",
	posthogOrigin: undefined,
};

describe("fetchApplicationResponse", () => {
	it("preserves immutable response snapshot assets byte-for-byte", async () => {
		const archivedHtml = "<!doctype html><html><head></head><body>Archived answer.</body></html>";
		const directFetch = vi.fn(
			async () =>
				new Response(archivedHtml, {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						"Content-Length": String(new TextEncoder().encode(archivedHtml).byteLength),
						"Content-Security-Policy":
							"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'",
					},
				}),
		);
		const instrumentedFetch = vi.fn(
			async () => new Response(archivedHtml.replace("<head>", '<head><meta name="sentry-trace" content="mutated">')),
		);

		const response = await fetchApplicationResponse({
			request: new Request(
				"https://portal.example/api/app/response-snapshots/00000000-0000-0000-0000-610000000001?asset=html&download=0",
			),
			directFetch,
			instrumentedFetch,
			securityHeaderOptions: OPTIONS,
		});

		expect(await response.text()).toBe(archivedHtml);
		expect(response.headers.get("content-length")).toBe(String(new TextEncoder().encode(archivedHtml).byteLength));
		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(directFetch).toHaveBeenCalledOnce();
		expect(instrumentedFetch).not.toHaveBeenCalled();
	});

	it("keeps ordinary application pages instrumented", async () => {
		const directFetch = vi.fn(async () => new Response("ordinary"));
		const instrumentedFetch = vi.fn(async () => new Response("instrumented"));

		const response = await fetchApplicationResponse({
			request: new Request("https://portal.example/app/stepfun"),
			directFetch,
			instrumentedFetch,
			securityHeaderOptions: OPTIONS,
		});

		expect(await response.text()).toBe("instrumented");
		expect(instrumentedFetch).toHaveBeenCalledOnce();
		expect(directFetch).not.toHaveBeenCalled();
	});
});
