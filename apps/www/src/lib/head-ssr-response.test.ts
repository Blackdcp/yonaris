import { describe, expect, test, vi } from "vitest";
import { finalizeHeadSsrResult } from "./head-ssr-response";

describe("HEAD SSR response ownership", () => {
	test("disposes the framework-owned SSR stream before returning a bodyless HEAD response", async () => {
		const dispose = vi.fn(async () => undefined);
		const result = {
			response: new Response("streamed html", {
				status: 203,
				statusText: "Non-Authoritative Information",
				headers: { "Content-Type": "text/html; charset=utf-8", "X-Review": "head" },
			}),
			serverSsrCleanup: "stream" as const,
			dispose,
		};

		const finalized = await finalizeHeadSsrResult(
			new Request("https://yonaris.test/product", { method: "HEAD" }),
			result,
		);

		expect(dispose).toHaveBeenCalledTimes(1);
		expect(dispose).toHaveBeenCalledWith("HEAD document body stripped");
		expect(finalized.serverSsrCleanup).toBe("none");
		expect(finalized.response.status).toBe(203);
		expect(finalized.response.statusText).toBe("Non-Authoritative Information");
		expect(finalized.response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(finalized.response.headers.get("x-review")).toBe("head");
		expect(finalized.response.body).toBeNull();
	});

	test("leaves GET stream ownership untouched", async () => {
		const dispose = vi.fn(async () => undefined);
		const result = {
			response: new Response("streamed html"),
			serverSsrCleanup: "stream" as const,
			dispose,
		};

		const finalized = await finalizeHeadSsrResult(new Request("https://yonaris.test/product"), result);

		expect(finalized).toBe(result);
		expect(dispose).not.toHaveBeenCalled();
		expect(await finalized.response.text()).toBe("streamed html");
	});
});
