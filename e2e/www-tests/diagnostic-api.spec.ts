import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const UUID = "018f47a2-4b6e-7d8c-9a10-12b3c4d5e6f7";

async function post(
	request: APIRequestContext,
	baseURL: string | undefined,
	input: { data?: string; headers?: Record<string, string> } = {},
): Promise<APIResponse> {
	if (!baseURL) throw new Error("Playwright baseURL is required for same-origin API tests");
	return request.post("/api/diagnostic", {
		data: input.data ?? "{",
		failOnStatusCode: false,
		headers: {
			Origin: new URL(baseURL).origin,
			"Sec-Fetch-Site": "same-origin",
			"Content-Type": "application/json",
			"Idempotency-Key": UUID,
			...input.headers,
		},
		maxRedirects: 0,
	});
}

async function expectDirectError(response: APIResponse, status: number, code: string): Promise<void> {
	expect(response.status()).toBe(status);
	expect(response.headers()["content-type"]).toMatch(/^application\/json/);
	expect(await response.json()).toEqual({ ok: false, code });
	expect(response.headers()["cache-control"]).toBe("no-store");
	expect(response.headers()["x-content-type-options"]).toBe("nosniff");
	expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
}

test("diagnostic API rejects cross-origin requests directly", async ({ request, baseURL }) => {
	await expectDirectError(
		await post(request, baseURL, { headers: { Origin: "https://attacker.example" } }),
		403,
		"forbidden_request",
	);
});

test("diagnostic API requires same-origin Fetch Metadata", async ({ request, baseURL }) => {
	await expectDirectError(
		await post(request, baseURL, { headers: { "Sec-Fetch-Site": "cross-site" } }),
		403,
		"forbidden_request",
	);
});

test("diagnostic API rejects non-JSON and compressed bodies before parsing", async ({ request, baseURL }) => {
	await expectDirectError(
		await post(request, baseURL, { headers: { "Content-Type": "text/plain" } }),
		415,
		"unsupported_media_type",
	);
	await expectDirectError(
		await post(request, baseURL, { headers: { "Content-Encoding": "gzip" } }),
		415,
		"unsupported_media_type",
	);
});

test("diagnostic API rejects malformed JSON without attempting delivery", async ({ request, baseURL }) => {
	await expectDirectError(await post(request, baseURL), 400, "invalid_request");
});

test("diagnostic API requires one canonical client idempotency key", async ({ request, baseURL }) => {
	await expectDirectError(
		await post(request, baseURL, { headers: { "Idempotency-Key": "not-a-uuid" } }),
		400,
		"invalid_idempotency_key",
	);
});
