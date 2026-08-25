import { describe, expect, test } from "vitest";

type PermanentRedirectModule = typeof import("./permanent-redirect");

async function loadSubject(): Promise<PermanentRedirectModule | undefined> {
	try {
		return (await import("./permanent-redirect")) as PermanentRedirectModule;
	} catch {
		return undefined;
	}
}

const subject = await loadSubject();

function requireSubject(): PermanentRedirectModule | undefined {
	expect(subject, "the permanent-redirect response helper must load").toBeDefined();
	return subject;
}

describe("permanent redirects", () => {
	test("returns a bodyless 308 and preserves the original query string", async () => {
		const redirects = requireSubject();
		if (!redirects) return;

		const response = redirects.permanentRedirectResponse(
			new Request("https://yonaris.test/agent/platform?source=old&lang=en"),
			"/agent/product",
		);
		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("/agent/product?source=old&lang=en");
		expect(await response.text()).toBe("");
	});

	test("does not copy a fragment or origin from the requested URL", () => {
		const redirects = requireSubject();
		if (!redirects) return;

		const response = redirects.permanentRedirectResponse(
			new Request("https://malicious.example/agent/results?ref=legacy#ignored"),
			"/agent/product",
		);
		expect(response.headers.get("location")).toBe("/agent/product?ref=legacy");
	});

	test("preserves repeated, empty, and percent-encoded query values byte for byte", async () => {
		const redirects = requireSubject();
		if (!redirects) return;

		const response = redirects.permanentRedirectResponse(
			new Request("https://yonaris.test/platform?tag=one&tag=two&encoded=a%2Fb%3Fc&empty=#ignored"),
			"/product",
		);
		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe("/product?tag=one&tag=two&encoded=a%2Fb%3Fc&empty=");
		expect(response.headers.get("content-type")).toBeNull();
		expect(await response.text()).toBe("");
	});
});
