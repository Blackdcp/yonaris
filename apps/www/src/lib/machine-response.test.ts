import { describe, expect, test } from "vitest";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";

type MachineResponseModule = typeof import("./machine-response");

async function loadSubject(): Promise<MachineResponseModule | undefined> {
	try {
		return (await import("./machine-response")) as MachineResponseModule;
	} catch {
		return undefined;
	}
}

const subject = await loadSubject();

function requireSubject(): MachineResponseModule | undefined {
	expect(subject, "the machine-response helper must load").toBeDefined();
	return subject;
}

function humanPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/agent" : `/agent/${key}`;
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

function request(path: string, accept: string | undefined, method: "GET" | "HEAD"): Request {
	const headers = new Headers();
	if (accept !== undefined) headers.set("Accept", accept);
	return new Request(`https://yonaris.test${path}`, { method, headers });
}

describe("machine responses", () => {
	test("executes the complete readable request matrix without a 5xx and keeps HEAD bodies empty", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;
		const negotiatedResponse = (
			responseHelpers as Partial<{
				negotiatedResponse(
					request: Request,
					fetchHandler: (request: Request) => Promise<Response>,
				): Promise<Response>;
			}>
		).negotiatedResponse;
		expect(negotiatedResponse, "the executable negotiation helper must be exported").toBeTypeOf("function");
		if (!negotiatedResponse) return;

		const matrix = [
			{ accept: undefined, status: 200 },
			{ accept: "*/*", status: 200 },
			{ accept: "text/html", status: 200 },
			{ accept: "text/markdown", status: 200 },
			{ accept: "text/*", status: 200 },
			{ accept: "text/markdown;q=0", status: 406 },
			{ accept: "text/markdown;q=0.4,text/html;q=0.8", status: 200 },
			{ accept: "text/html;q=0.4,text/markdown;q=0.8", status: 200 },
			{ accept: "application/json", status: 406 },
			{ accept: "text/html;q=0,text/markdown;q=0", status: 406 },
		] as const;
		const fetchHandler = async (routedRequest: Request) =>
			new Response(routedRequest.method === "HEAD" ? null : "ok", { status: 200 });

		for (const method of ["GET", "HEAD"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				for (const locale of ["en", "zh"] as const) {
					for (const path of [humanPath(key, locale), agentPath(key, locale)]) {
						for (const { accept, status } of matrix) {
							const response = await negotiatedResponse(request(path, accept, method), fetchHandler);
							expect(response.status, `${method} ${path} Accept: ${accept ?? "<missing>"}`).toBe(status);
							expect(response.status).toBeLessThan(500);
							if (method === "HEAD") expect(await response.text()).toBe("");
							expect(response.headers.get("vary")).toBe("Accept");
						}

						if (path !== "/") {
							const response = await negotiatedResponse(request(`${path}/`, "application/json", method), fetchHandler);
							expect(response.status).toBe(307);
							expect(response.status).toBeLessThan(500);
							expect(response.headers.get("location")).toBe(path);
							if (method === "HEAD") expect(await response.text()).toBe("");
						}
					}
				}
			}
		}
	});

	test("marks English and Chinese documents as cacheable noindex machine content", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		for (const [language, expected] of [
			["en", "en"],
			["zh", "zh-CN"],
		] as const) {
			const response = responseHelpers.machineDocumentResponse("# Facts", { language });
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("# Facts");
			expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
			expect(response.headers.get("content-language")).toBe(expected);
			expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
			expect(response.headers.get("cache-control")).toBe("public, max-age=300, stale-while-revalidate=3600");
			expect(response.headers.get("vary")).toBe("Accept");
		}
	});

	test("publishes stable document metadata and every required discovery relation", () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const links = [
			{ href: "/product", rel: "alternate", type: "text/html" },
			{ href: "/agent/product.md", rel: "canonical", type: "text/markdown" },
			{ href: "/agent/catalog.json", rel: "alternate", type: "application/ld+json" },
			{ href: "/zh/agent/product.md", rel: "alternate", type: "text/markdown", hrefLang: "zh-CN" },
			{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
		] as const;
		const response = responseHelpers.machineDocumentResponse("# Product", {
			language: "en",
			contentLocation: "/agent/product.md",
			links,
			status: 203,
		});

		expect(response.status).toBe(203);
		expect(response.headers.get("content-location")).toBe("/agent/product.md");
		expect(response.headers.get("link")).toBe(
			'</product>; rel="alternate"; type="text/html", </agent/product.md>; rel="canonical"; type="text/markdown", </agent/catalog.json>; rel="alternate"; type="application/ld+json", </zh/agent/product.md>; rel="alternate"; type="text/markdown"; hreflang="zh-CN", </llms.txt>; rel="describedby"; type="text/plain"',
		);
	});

	test("serves valid JSON-LD and returns an empty 406 response for unsupported representations", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const jsonResponse = responseHelpers.machineDocumentResponse('{"@context":"https://schema.org"}', {
			language: "zh",
			contentType: "application/ld+json; charset=utf-8",
			contentLocation: "/zh/agent/catalog.json",
		});
		expect(jsonResponse.status).toBeLessThan(500);
		expect(jsonResponse.headers.get("content-type")).toBe("application/ld+json; charset=utf-8");
		expect(jsonResponse.headers.get("content-language")).toBe("zh-CN");

		const notAcceptableResponse = (responseHelpers as Partial<{ notAcceptableResponse(): Response }>).notAcceptableResponse;
		expect(notAcceptableResponse, "the 406 response helper must be exported").toBeTypeOf("function");
		if (!notAcceptableResponse) return;
		const response = notAcceptableResponse();
		expect(response.status).toBe(406);
		expect(response.status).toBeLessThan(500);
		expect(await response.text()).toBe("");
		expect(response.headers.get("vary")).toBe("Accept");
	});

	test("keeps every machine HEAD response body empty and below 500", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		for (const [language, contentLocation, contentType] of [
			["en", "/agent/index.md", "text/markdown; charset=utf-8"],
			["zh", "/zh/agent/index.md", "text/markdown; charset=utf-8"],
			["en", "/agent/catalog.json", "application/ld+json; charset=utf-8"],
			["zh", "/zh/agent/catalog.json", "application/ld+json; charset=utf-8"],
		] as const) {
			const response = responseHelpers.machineDocumentResponse(null, {
				language,
				contentLocation,
				contentType,
			});
			expect(response.status).toBeLessThan(500);
			expect(await response.text()).toBe("");
		}
	});

	test("identifies a bilingual aggregate with both represented languages", () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const response = responseHelpers.machineDocumentResponse("# English\n\n# 中文", {
			language: ["en", "zh"],
			contentType: "text/plain; charset=utf-8",
		});
		expect(response.headers.get("content-language")).toBe("en, zh-CN");
	});

	test("merges Accept into Vary without discarding or duplicating existing dimensions", () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const headers = new Headers({ Vary: "RSC, Accept-Encoding, accept" });
		responseHelpers.appendVary(headers, "Accept");
		expect(headers.get("vary")).toBe("RSC, Accept-Encoding, accept");

		responseHelpers.appendVary(headers, "Next-Router-State-Tree");
		expect(headers.get("vary")).toBe("RSC, Accept-Encoding, accept, Next-Router-State-Tree");
	});

	test("restores every application Vary dimension after Nitro prepares its own", () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const response = new Response("ok", { headers: { Vary: "RSC, Accept" } });
		responseHelpers.preserveApplicationVary(response);
		response.headers.set("Vary", "Accept-Encoding");
		responseHelpers.restoreApplicationVary(response);

		expect(response.headers.get("vary")).toBe("Accept-Encoding, RSC, Accept");
		expect(response.headers.has("x-yonaris-application-vary")).toBe(false);
	});

	test("preserves Vary from a direct stable machine route through Nitro finalization", async () => {
		const responseHelpers = requireSubject();
		if (!responseHelpers) return;

		const response = await responseHelpers.negotiatedResponse(
			new Request("https://yonaris.test/agent/product.md", { headers: { Accept: "*/*" } }),
			async () =>
				responseHelpers.machineDocumentResponse("# Product", {
					contentLocation: "/agent/product.md",
				}),
		);
		response.headers.set("Vary", "Accept-Encoding");
		responseHelpers.restoreApplicationVary(response);

		expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
	});
});
