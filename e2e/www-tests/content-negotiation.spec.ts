import { expect, test } from "@playwright/test";

const coreCases = [
	["/", "https://yonaris.com/", "English (en)"],
	["/zh", "https://yonaris.com/zh", "Simplified Chinese (zh-CN)"],
	["/product", "https://yonaris.com/product", "English (en)"],
	["/zh/product", "https://yonaris.com/zh/product", "Simplified Chinese (zh-CN)"],
	["/approach", "https://yonaris.com/approach", "English (en)"],
	["/zh/approach", "https://yonaris.com/zh/approach", "Simplified Chinese (zh-CN)"],
	["/research", "https://yonaris.com/research", "English (en)"],
	["/zh/research", "https://yonaris.com/zh/research", "Simplified Chinese (zh-CN)"],
	["/company", "https://yonaris.com/company", "English (en)"],
	["/zh/company", "https://yonaris.com/zh/company", "Simplified Chinese (zh-CN)"],
	["/geo", "https://yonaris.com/geo", "English (en)"],
	["/zh/geo", "https://yonaris.com/zh/geo", "Simplified Chinese (zh-CN)"],
	["/diagnostic", "https://yonaris.com/diagnostic", "English (en)"],
	["/zh/diagnostic", "https://yonaris.com/zh/diagnostic", "Simplified Chinese (zh-CN)"],
] as const;

test.describe("human and machine content negotiation", () => {
	for (const [path, canonical, language] of coreCases) {
		test(`${path} serves HTML by default and shared facts as Markdown when preferred`, async ({ request }) => {
			const html = await request.get(path, { headers: { Accept: "text/html" } });
			expect(html.status()).toBe(200);
			expect(html.headers()["content-type"]).toContain("text/html");
			expect(html.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept");
			expect(html.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept-encoding");

			const markdown = await request.get(`${path}?source=content-negotiation`, {
				headers: { Accept: "text/markdown" },
			});
			expect(markdown.status()).toBe(200);
			expect(markdown.headers()["content-type"]).toContain("text/markdown");
			expect(markdown.headers()["content-language"]).toBe(language === "English (en)" ? "en" : "zh-CN");
			expect(markdown.headers()["x-robots-tag"]).toBe("noindex, follow");
			expect(markdown.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept");
			expect(markdown.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept-encoding");
			expect(await markdown.text()).toContain(`Human canonical: ${canonical}`);
			expect(await (await request.get(path, { headers: { Accept: "text/markdown" } })).text()).toContain(
				`Language: ${language}`,
			);
		});
	}

	test("keeps old human aliases out of Markdown negotiation", async ({ request }) => {
		for (const path of ["/platform", "/zh/results"]) {
			const response = await request.get(path, { headers: { Accept: "text/markdown" }, maxRedirects: 0 });
			expect(response.headers()["content-type"] ?? "").not.toContain("text/markdown");
			expect(response.headers().location ?? "").not.toContain("llms.mdx");
		}
	});

	test("serves all six Agent documents and permanently redirects old Agent names with their query", async ({ request }) => {
		for (const path of ["company", "product", "approach", "research", "geo", "diagnostic"]) {
			const response = await request.get(`/agent/${path}`);
			expect(response.status()).toBe(200);
			expect(response.headers()["content-type"]).toContain("text/markdown");
			expect(response.headers()["content-language"]).toBe("en");
			expect(response.headers()["cache-control"]).toBe("public, max-age=300");
			expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
			expect(await response.text()).toContain(`Human canonical: https://yonaris.com/${path}`);
		}

		for (const [from, to] of [
			["platform", "product"],
			["methodology", "approach"],
			["results", "research"],
		] as const) {
			const response = await request.get(`/agent/${from}?source=legacy`, { maxRedirects: 0 });
			expect(response.status()).toBe(308);
			expect(response.headers().location).toBe(`/agent/${to}?source=legacy`);
			expect(await response.body()).toHaveLength(0);
		}
	});

	test("publishes complete Agent and llms indexes with machine response policy", async ({ request }) => {
		for (const [path, contentType, language] of [
			["/agent", "text/markdown", "en"],
			["/llms.txt", "text/plain", "en"],
			["/llms-full.txt", "text/plain", "en, zh-CN"],
		] as const) {
			const response = await request.get(path);
			expect(response.status()).toBe(200);
			expect(response.headers()["content-type"]).toContain(contentType);
			expect(response.headers()["content-language"]).toBe(language);
			expect(response.headers()["cache-control"]).toBe("public, max-age=300");
			expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");

			const body = await response.text();
			for (const [humanPath] of coreCases) {
				expect(body).toContain(`https://yonaris.com${humanPath}`);
			}
			for (const agentPath of ["company", "product", "approach", "research", "geo", "diagnostic"]) {
				expect(body).toContain(`https://yonaris.com/agent/${agentPath}`);
			}
		}

		const full = await request.get("/llms-full.txt");
		const fullBody = await full.text();
		expect(fullBody.match(/^Human canonical:/gm)).toHaveLength(14);
		for (const retired of [
			"93.3%",
			"four intelligence",
			"Product Truth Graph",
			"Commercial Feedback",
			"automatic optimization",
		]) {
			expect(fullBody).not.toContain(retired);
		}
	});

	test("keeps the internal core Markdown route scoped and handles safe retrieval only", async ({ request }) => {
		const internal = await request.get("/llms.mdx/site/zh/product");
		expect(internal.status()).toBe(200);
		expect(internal.headers()["content-type"]).toContain("text/markdown");
		expect(internal.headers()["content-language"]).toBe("zh-CN");
		expect(internal.headers()["x-robots-tag"]).toBe("noindex, follow");

		for (const path of ["/llms.mdx/site/en/not-a-page", "/llms.mdx/site/en/product/extra"]) {
			expect((await request.get(path)).status()).toBe(404);
		}

		const head = await request.head("/product?method=head", { headers: { Accept: "text/markdown" } });
		expect(head.status()).toBe(200);
		expect(head.headers()["content-type"]).toContain("text/markdown");
		expect(await head.body()).toHaveLength(0);

		const unsafe = await request.post("/product", { headers: { Accept: "text/markdown" } });
		expect(unsafe.headers()["content-type"] ?? "").not.toContain("text/markdown");
	});

	test("preserves the existing Docs suffix and Accept negotiation behavior", async ({ request }) => {
		for (const path of [
			"/docs/getting-started.md",
			"/docs/getting-started.mdx",
			"/docs/getting-started",
		]) {
			const response = await request.get(path, { headers: { Accept: "text/markdown" } });
			expect(response.status()).toBe(200);
			expect(response.headers()["content-type"]).toContain("text/markdown");
			expect(response.headers()["content-language"]).toBe("en");
			expect(response.headers()["cache-control"]).toBe("public, max-age=300");
			expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");
			expect(await response.text()).toContain("# Quick Start");
		}

		const html = await request.get("/docs/getting-started", { headers: { Accept: "text/html" } });
		expect(html.status()).toBe(200);
		expect(html.headers()["content-type"]).toContain("text/html");
		for (const response of [html, await request.get("/docs/getting-started", { headers: { Accept: "text/markdown" } })]) {
			const vary = response.headers().vary?.toLowerCase().split(/\s*,\s*/);
			expect(vary).toContain("accept");
			expect(vary).toContain("accept-encoding");
			expect(response.headers()["x-yonaris-application-vary"]).toBeUndefined();
		}

		expect((await request.get("/llms.mdx/docs/not-a-page")).status()).toBe(404);
	});
});
