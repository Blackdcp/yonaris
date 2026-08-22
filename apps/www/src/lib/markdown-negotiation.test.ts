import { describe, expect, test } from "vitest";

type MarkdownNegotiationModule = typeof import("./markdown-negotiation");

async function loadSubject(): Promise<MarkdownNegotiationModule | undefined> {
	try {
		return (await import("./markdown-negotiation")) as MarkdownNegotiationModule;
	} catch {
		return undefined;
	}
}

const subject = await loadSubject();

function requireSubject(): MarkdownNegotiationModule | undefined {
	expect(subject, "the core Markdown negotiation resolver must load").toBeDefined();
	return subject;
}

const canonicalCases = [
	["/", "/llms.mdx/site/en/home"],
	["/zh", "/llms.mdx/site/zh/home"],
	["/product", "/llms.mdx/site/en/product"],
	["/zh/product", "/llms.mdx/site/zh/product"],
	["/approach", "/llms.mdx/site/en/approach"],
	["/zh/approach", "/llms.mdx/site/zh/approach"],
	["/research", "/llms.mdx/site/en/research"],
	["/zh/research", "/llms.mdx/site/zh/research"],
	["/company", "/llms.mdx/site/en/company"],
	["/zh/company", "/llms.mdx/site/zh/company"],
	["/geo", "/llms.mdx/site/en/geo"],
	["/zh/geo", "/llms.mdx/site/zh/geo"],
	["/diagnostic", "/llms.mdx/site/en/diagnostic"],
	["/zh/diagnostic", "/llms.mdx/site/zh/diagnostic"],
] as const;

function request(path: string, accept: string, method = "GET"): Request {
	return new Request(`https://yonaris.test${path}`, { method, headers: { Accept: accept } });
}

describe("core Markdown negotiation", () => {
	test("maps Markdown-preferred safe retrievals for all fourteen exact canonicals", () => {
		const negotiation = requireSubject();
		if (!negotiation) return;

		for (const [path, targetPath] of canonicalCases) {
			expect(negotiation.resolveMarkdownRequest(request(path, "text/markdown"))).toEqual({
				targetPath,
				variesOnAccept: true,
			});
			expect(negotiation.resolveMarkdownRequest(request(path, "text/html"))).toEqual({ variesOnAccept: true });
		}

		expect(negotiation.resolveMarkdownRequest(request("/product", "text/markdown", "HEAD"))).toEqual({
			targetPath: "/llms.mdx/site/en/product",
			variesOnAccept: true,
		});
	});

	test("honors media preference instead of rewriting every Accept header containing Markdown", () => {
		const negotiation = requireSubject();
		if (!negotiation) return;

		expect(negotiation.resolveMarkdownRequest(request("/product", "text/markdown;q=0.5, text/html;q=0.9"))).toEqual({
			variesOnAccept: true,
		});
		expect(negotiation.resolveMarkdownRequest(request("/product", "text/html;q=0.5, text/markdown;q=0.9"))).toEqual({
			targetPath: "/llms.mdx/site/en/product",
			variesOnAccept: true,
		});
	});

	test("uses the most specific media range before its quality weight", () => {
		const negotiation = requireSubject();
		if (!negotiation) return;

		expect(
			negotiation.resolveMarkdownRequest(request("/product", "text/*;q=1, text/markdown;q=0, text/html;q=0.5")),
		).toEqual({ variesOnAccept: true });
		expect(
			negotiation.resolveMarkdownRequest(request("/product", "text/*;q=1, text/markdown;q=0.8, text/html;q=0.5")),
		).toEqual({ targetPath: "/llms.mdx/site/en/product", variesOnAccept: true });
	});

	test("does not negotiate aliases, internal paths, Docs routes, trailing variants, or unsafe methods", () => {
		const negotiation = requireSubject();
		if (!negotiation) return;

		for (const path of [
			"/platform",
			"/zh/results",
			"/agent/platform",
			"/llms.mdx/site/en/product",
			"/docs/getting-started",
			"/docs/getting-started.md",
			"/docs/getting-started.mdx",
			"/product/",
		]) {
			expect(negotiation.resolveMarkdownRequest(request(path, "text/markdown"))).toEqual({ variesOnAccept: false });
		}

		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			expect(negotiation.resolveMarkdownRequest(request("/product", "text/markdown", method))).toEqual({
				variesOnAccept: false,
			});
		}
	});

	test("preserves the original query and request headers during an internal rewrite", () => {
		const negotiation = requireSubject();
		if (!negotiation) return;

		const original = request("/zh/research?campaign=agent&view=full", "text/markdown");
		const rewritten = negotiation.rewriteMarkdownRequest(original, "/llms.mdx/site/zh/research");
		expect(rewritten.url).toBe("https://yonaris.test/llms.mdx/site/zh/research?campaign=agent&view=full");
		expect(rewritten.headers.get("accept")).toBe("text/markdown");
		expect(original.url).toBe("https://yonaris.test/zh/research?campaign=agent&view=full");
	});
});
