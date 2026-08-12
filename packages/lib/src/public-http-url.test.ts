import { describe, expect, it, vi } from "vitest";
import {
	isPublicIpAddress,
	type PublicUrlResolver,
	type SafeFetchInit,
	type SafeHttpResponse,
	safeFetchPublicHttpUrl,
	UnsafeUrlError,
	validatePublicHttpUrl,
} from "./public-http-url";

const publicResolver: PublicUrlResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function response(status: number, location?: string): SafeHttpResponse {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: (name) => (name.toLowerCase() === "location" ? (location ?? null) : null) },
		body: { cancel: async () => {} },
		text: async () => "",
	};
}

describe("public HTTP URL validation", () => {
	it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("recognizes public address %s", (address) => {
		expect(isPublicIpAddress(address)).toBe(true);
	});

	it.each([
		"0.0.0.0",
		"10.0.0.1",
		"100.64.0.1",
		"127.0.0.1",
		"169.254.169.254",
		"172.16.0.1",
		"192.168.1.1",
		"198.18.0.1",
		"224.0.0.1",
		"::",
		"::1",
		"::ffff:127.0.0.1",
		"fc00::1",
		"fe80::1",
		"2001:db8::1",
	])("rejects non-public address %s", (address) => {
		expect(isPublicIpAddress(address)).toBe(false);
	});

	it.each([
		"file:///etc/passwd",
		"ftp://example.com/file",
		"http://user:password@example.com",
		"http://localhost",
		"http://service.internal",
		"http://metadata.google.internal/computeMetadata/v1/",
		"http://127.0.0.1",
		"http://[::1]",
	])("rejects unsafe URL %s", async (url) => {
		await expect(validatePublicHttpUrl(url, publicResolver)).rejects.toBeInstanceOf(UnsafeUrlError);
	});

	it("rejects a hostname when any A or AAAA answer is non-public", async () => {
		await expect(
			validatePublicHttpUrl("https://example.com", async () => [
				{ address: "93.184.216.34", family: 4 },
				{ address: "10.0.0.7", family: 4 },
			]),
		).rejects.toThrow("exclusively to public addresses");
	});

	it("accepts an ordinary public hostname", async () => {
		await expect(validatePublicHttpUrl("https://example.com/path", publicResolver)).resolves.toMatchObject({
			hostname: "example.com",
			pathname: "/path",
		});
	});
});

describe("safe public HTTP fetch", () => {
	it("validates and follows a bounded public redirect manually", async () => {
		const resolveHostname = vi.fn(publicResolver);
		const fetchMock = vi
			.fn<(input: string, init: SafeFetchInit) => Promise<SafeHttpResponse>>()
			.mockResolvedValueOnce(response(302, "https://cdn.example.net/article"))
			.mockResolvedValueOnce(response(200));

		const result = await safeFetchPublicHttpUrl("https://example.com/start", {}, { resolveHostname, fetch: fetchMock });

		expect(result.status).toBe(200);
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			"https://example.com/start",
			"https://cdn.example.net/article",
		]);
		expect(resolveHostname.mock.calls.map(([hostname]) => hostname)).toEqual(["example.com", "cdn.example.net"]);
	});

	it("refuses a redirect to a local or metadata destination before the next request", async () => {
		const fetchMock = vi
			.fn<(input: string, init: SafeFetchInit) => Promise<SafeHttpResponse>>()
			.mockResolvedValueOnce(response(302, "http://169.254.169.254/latest/meta-data"));

		await expect(
			safeFetchPublicHttpUrl("https://example.com", {}, { resolveHostname: publicResolver, fetch: fetchMock }),
		).rejects.toThrow("IP-address URLs are not allowed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not forward authorization or cookies across origins", async () => {
		const fetchMock = vi
			.fn<(input: string, init: SafeFetchInit) => Promise<SafeHttpResponse>>()
			.mockResolvedValueOnce(response(302, "https://cdn.example.net/final"))
			.mockResolvedValueOnce(response(200));

		await safeFetchPublicHttpUrl(
			"https://example.com",
			{ headers: { Authorization: "Bearer secret", Cookie: "session=secret", Accept: "text/plain" } },
			{ resolveHostname: publicResolver, fetch: fetchMock },
		);

		expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({
			Authorization: "Bearer secret",
			Cookie: "session=secret",
		});
		expect(fetchMock.mock.calls[1]?.[1].headers).toEqual({ Accept: "text/plain" });
	});

	it("stops after five redirects", async () => {
		const fetchMock = vi.fn<(input: string, init: SafeFetchInit) => Promise<SafeHttpResponse>>(async () =>
			response(302, "/again"),
		);

		await expect(
			safeFetchPublicHttpUrl("https://example.com", {}, { resolveHostname: publicResolver, fetch: fetchMock }),
		).rejects.toThrow("redirected too many times");
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});
});
