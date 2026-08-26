import { expect, test } from "@playwright/test";

const coreCases = [
	["/", "https://yonaris.com/", "en"],
	["/zh", "https://yonaris.com/zh", "zh-CN"],
	["/product", "https://yonaris.com/product", "en"],
	["/zh/product", "https://yonaris.com/zh/product", "zh-CN"],
	["/approach", "https://yonaris.com/approach", "en"],
	["/zh/approach", "https://yonaris.com/zh/approach", "zh-CN"],
	["/privacy", "https://yonaris.com/privacy", "en"],
	["/zh/privacy", "https://yonaris.com/zh/privacy", "zh-CN"],
	["/company", "https://yonaris.com/company", "en"],
	["/zh/company", "https://yonaris.com/zh/company", "zh-CN"],
	["/geo", "https://yonaris.com/geo", "en"],
	["/zh/geo", "https://yonaris.com/zh/geo", "zh-CN"],
	["/diagnostic", "https://yonaris.com/diagnostic", "en"],
	["/zh/diagnostic", "https://yonaris.com/zh/diagnostic", "zh-CN"],
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
			expect(markdown.headers()["content-language"]).toBe(language);
			expect(markdown.headers()["x-robots-tag"]).toBe("noindex, follow");
			expect(markdown.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept");
			expect(markdown.headers().vary?.toLowerCase().split(/\s*,\s*/)).toContain("accept-encoding");
			const body = await markdown.text();
			expect(body).toContain(canonical);
			expect(body).toContain(`Language: ${language}`);
		});
	}

	test("keeps old human aliases out of Markdown negotiation", async ({ request }) => {
		for (const path of ["/platform", "/zh/results"]) {
			const response = await request.get(path, { headers: { Accept: "text/markdown" }, maxRedirects: 0 });
			expect(response.headers()["content-type"] ?? "").not.toContain("text/markdown");
			expect(response.headers().location ?? "").not.toContain("llms.mdx");
		}
	});

	test("serves branded regional Agent HTML and paired Markdown facts", async ({ request }) => {
		for (const regional of [
			{ agentPrefix: "/agent", humanPrefix: "", language: "en", topics: ["company", "product", "approach", "geo", "diagnostic", "privacy"] },
			{ agentPrefix: "/zh/agent", humanPrefix: "/zh", language: "zh-CN", topics: ["company", "product", "approach", "geo", "diagnostic", "privacy"] },
		] as const) {
			for (const path of regional.topics) {
				const html = await request.get(`${regional.agentPrefix}/${path}`, { headers: { Accept: "text/html" } });
				expect(html.status()).toBe(200);
				expect(html.headers()["content-type"]).toContain("text/html");

				const markdown = await request.get(`${regional.agentPrefix}/${path}`, { headers: { Accept: "text/markdown" } });
				expect(markdown.status()).toBe(200);
				expect(markdown.headers()["content-type"]).toContain("text/markdown");
				expect(markdown.headers()["content-language"]).toBe(regional.language);
				expect(markdown.headers()["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=3600");
				expect(markdown.headers()["x-robots-tag"]).toBe("noindex, follow");
				expect(await markdown.text()).toContain(`https://yonaris.com${regional.humanPrefix}/${path}`);
			}
		}

		for (const [from, to] of [
			["platform", "product"],
			["methodology", "approach"],
			["results", "product"],
		] as const) {
			const response = await request.get(`/agent/${from}?source=legacy`, { maxRedirects: 0 });
			expect(response.status()).toBe(308);
			expect(response.headers().location).toBe(`/agent/${to}?source=legacy`);
			expect(await response.body()).toHaveLength(0);
		}
	});

	test("publishes complete Agent and llms indexes with machine response policy", async ({ request }) => {
		for (const [path, language] of [["/agent", "en"], ["/zh/agent", "zh-CN"]] as const) {
			const html = await request.get(path, { headers: { Accept: "text/html" } });
			expect(html.status()).toBe(200);
			expect(html.headers()["content-type"]).toContain("text/html");

			const markdown = await request.get(path, { headers: { Accept: "text/markdown" } });
			expect(markdown.status()).toBe(200);
			expect(markdown.headers()["content-type"]).toContain("text/markdown");
			expect(markdown.headers()["content-language"]).toBe(language);
			expect(markdown.headers()["x-robots-tag"]).toBe("noindex, follow");
		}

		for (const [path, contentType, language] of [
			["/llms.txt", "text/plain", "en, zh-CN"],
			["/llms-full.txt", "text/plain", "en, zh-CN"],
		] as const) {
			const response = await request.get(path);
			expect(response.status()).toBe(200);
			expect(response.headers()["content-type"]).toContain(contentType);
			expect(response.headers()["content-language"]).toBe(language);
			expect(response.headers()["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=3600");
			expect(response.headers()["x-robots-tag"]).toBe("noindex, follow");

			const body = await response.text();
			for (const agentPath of ["company", "product", "approach", "geo", "diagnostic", "privacy"]) {
				expect(body).toContain(`https://yonaris.com/agent/${agentPath}`);
			}
		}

		const full = await request.get("/llms-full.txt");
		const fullBody = await full.text();
		for (const [humanPath] of coreCases) expect(fullBody).toContain(`https://yonaris.com${humanPath}`);
		expect(fullBody.match(/^(?:Human canonical|官网对应页面):/gm)).toHaveLength(14);
		for (const retired of [
			"93.3%",
			"four intelligence",
			"Product Evidence Graph",
			"Market Learning",
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

});
