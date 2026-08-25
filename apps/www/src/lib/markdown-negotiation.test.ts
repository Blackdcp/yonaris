import { describe, expect, test } from "vitest";
import { HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { resolveMarkdownRequest, rewriteMarkdownRequest } from "./markdown-negotiation";

function humanPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(key: HumanPageKey, locale: "en" | "zh"): string {
	if (locale === "en") return key === "home" ? "/agent" : `/agent/${key}`;
	return key === "home" ? "/zh/agent" : `/zh/agent/${key}`;
}

function request(path: string, accept: string, method = "GET"): Request {
	return new Request(`https://yonaris.test${path}`, { method, headers: { Accept: accept } });
}

describe("Markdown negotiation", () => {
	test("maps Markdown-preferred requests for every current Human and Agent topic", () => {
		for (const key of HUMAN_PAGE_KEYS) {
			for (const locale of ["en", "zh"] as const) {
				const humanTarget = `/llms.mdx/site/${locale}/${key}`;
				const agentTarget = `/llms.mdx/${locale === "en" ? "agent" : "zh-agent"}/${key === "home" ? "index" : key}`;
				expect(resolveMarkdownRequest(request(humanPath(key, locale), "text/markdown"))).toEqual({
					targetPath: humanTarget,
					variesOnAccept: true,
				});
				expect(resolveMarkdownRequest(request(agentPath(key, locale), "text/markdown"))).toEqual({
					targetPath: agentTarget,
					variesOnAccept: true,
				});
				expect(resolveMarkdownRequest(request(humanPath(key, locale), "text/html"))).toEqual({ variesOnAccept: true });
			}
		}
	});

	test("does not negotiate removed or unsafe paths", () => {
		for (const path of ["/research", "/zh/research", "/resources", "/platform", "/product/"]) {
			expect(resolveMarkdownRequest(request(path, "text/markdown"))).toEqual({ variesOnAccept: false });
		}
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			expect(resolveMarkdownRequest(request("/product", "text/markdown", method))).toEqual({ variesOnAccept: false });
		}
	});

	test("honors media preference and preserves rewrites", () => {
		expect(resolveMarkdownRequest(request("/product", "text/markdown;q=0.5, text/html;q=0.9"))).toEqual({
			variesOnAccept: true,
		});
		const original = request("/zh/product?campaign=agent", "text/markdown");
		const rewritten = rewriteMarkdownRequest(original, "/llms.mdx/site/zh/product");
		expect(rewritten.url).toBe("https://yonaris.test/llms.mdx/site/zh/product?campaign=agent");
		expect(rewritten.headers.get("accept")).toBe("text/markdown");
	});
});
