import { describe, expect, test } from "vitest";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import * as negotiationModule from "./markdown-negotiation";

type RepresentationResolution =
	| { kind: "html"; variesOnAccept: true }
	| { kind: "markdown"; targetPath: string; variesOnAccept: true }
	| { kind: "redirect"; location: string; variesOnAccept: true }
	| { kind: "not-acceptable"; variesOnAccept: true }
	| { kind: "pass"; variesOnAccept: false };

const resolveRepresentation = (
	negotiationModule as Partial<{
		resolveRepresentation(request: Request): RepresentationResolution;
	}>
).resolveRepresentation;

function humanPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/agent" : `/agent/${key}`;
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

function request(path: string, accept?: string, method = "GET"): Request {
	const headers = new Headers();
	if (accept !== undefined) headers.set("Accept", accept);
	return new Request(`https://yonaris.test${path}`, { method, headers });
}

function requireResolver(): NonNullable<typeof resolveRepresentation> {
	expect(resolveRepresentation, "the explicit representation resolver must be exported").toBeTypeOf("function");
	return resolveRepresentation as NonNullable<typeof resolveRepresentation>;
}

describe("representation negotiation", () => {
	test("resolves the complete GET and HEAD Accept matrix for every Human and Agent canonical path", () => {
		const resolve = requireResolver();
		const acceptMatrix = [
			{ accept: undefined, kind: "html" },
			{ accept: "*/*", kind: "html" },
			{ accept: "text/html", kind: "html" },
			{ accept: "text/markdown", kind: "markdown" },
			{ accept: "text/*", kind: "markdown" },
			{ accept: "text/markdown;q=0", kind: "not-acceptable" },
			{ accept: "text/markdown;q=0.4, text/html;q=0.8", kind: "html" },
			{ accept: "text/html;q=0.4, text/markdown;q=0.8", kind: "markdown" },
			{ accept: "text/markdown;q=0.8, text/html;q=0.8", kind: "html" },
			{ accept: "application/json", kind: "not-acceptable" },
			{ accept: "text/html;q=0,text/markdown;q=0", kind: "not-acceptable" },
		] as const;

		for (const method of ["GET", "HEAD"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				for (const locale of ["en", "zh"] as const) {
					const paths = [
						{
							path: humanPath(key, locale),
							targetPath: `/llms.mdx/site/${locale}/${key}`,
						},
						{
							path: agentPath(key, locale),
							targetPath: `/llms.mdx/${locale === "en" ? "agent" : "zh-agent"}/${key === "home" ? "index" : key}`,
						},
					] as const;

					for (const { path, targetPath } of paths) {
						for (const { accept, kind } of acceptMatrix) {
							const resolution = resolve(request(path, accept, method));
							if (kind === "markdown") {
								expect(resolution, `${method} ${path} Accept: ${accept}`).toEqual({
									kind,
									targetPath,
									variesOnAccept: true,
								});
							} else {
								expect(resolution, `${method} ${path} Accept: ${accept ?? "<missing>"}`).toEqual({
									kind,
									variesOnAccept: true,
								});
							}
						}
					}
				}
			}
		}
	});

	test("redirects mapped trailing slashes before representation selection", () => {
		const resolve = requireResolver();
		for (const method of ["GET", "HEAD"] as const) {
			for (const key of HUMAN_PAGE_KEYS) {
				for (const locale of ["en", "zh"] as const) {
					for (const canonicalPath of [humanPath(key, locale), agentPath(key, locale)]) {
						if (canonicalPath === "/") continue;
						for (const accept of ["text/markdown", "application/json", "text/html;q=0,text/markdown;q=0"]) {
							expect(resolve(request(`${canonicalPath}/`, accept, method))).toEqual({
								kind: "redirect",
								location: canonicalPath,
								variesOnAccept: true,
							});
						}
					}
				}
			}
		}
	});

	test("passes through removed, unsafe, and non-readable requests", () => {
		const resolve = requireResolver();
		for (const path of ["/research", "/zh/research", "/resources", "/platform", "/agent/product.md"]) {
			expect(resolve(request(path, "text/markdown"))).toEqual({ kind: "pass", variesOnAccept: false });
		}
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			expect(resolve(request("/product", "text/markdown", method))).toEqual({ kind: "pass", variesOnAccept: false });
		}
	});

	test("preserves the query and headers when rewriting Markdown", () => {
		const original = request("/zh/product?campaign=agent", "text/markdown");
		const rewritten = negotiationModule.rewriteMarkdownRequest(original, "/llms.mdx/site/zh/product");
		expect(rewritten.url).toBe("https://yonaris.test/llms.mdx/site/zh/product?campaign=agent");
		expect(rewritten.headers.get("accept")).toBe("text/markdown");
	});
});
