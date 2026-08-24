import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { runMarketingSmoke } from "./smoke-marketing.mjs";

const REDIRECTS = new Map([
	["/platform", "/product"],
	["/features", "/product"],
	["/zh/platform", "/zh/product"],
	["/methodology", "/approach"],
	["/zh/methodology", "/zh/approach"],
	["/results", "/research"],
	["/zh/results", "/zh/research"],
	["/vision", "/company"],
	["/pricing", "/diagnostic"],
	["/off-site-aeo", "/geo"],
	["/agent/platform", "/agent/product"],
	["/agent/methodology", "/agent/approach"],
	["/agent/results", "/agent/research"],
]);

const CORE_PATHS = [
	"/",
	"/zh",
	"/product",
	"/zh/product",
	"/approach",
	"/zh/approach",
	"/research",
	"/zh/research",
	"/company",
	"/zh/company",
	"/geo",
	"/zh/geo",
	"/diagnostic",
	"/zh/diagnostic",
];

const AGENT_HTML_PATHS = [
	"/agent",
	...["product", "approach", "research", "company", "geo", "diagnostic"].map((topic) => `/agent/${topic}`),
	"/zh/agent",
	...["product", "approach", "research", "company", "geo", "diagnostic", "privacy"].map(
		(topic) => `/zh/agent/${topic}`,
	),
];

const HTML_PATHS = [...CORE_PATHS, "/privacy", "/zh/privacy", ...AGENT_HTML_PATHS];

const MACHINE_PATHS = [
	"/llms.txt",
	"/llms-full.txt",
	"/robots.txt",
	"/sitemap.xml",
	"/api/plausible/js/script",
	"/og.png",
];

const HIDDEN_PATHS = [
	"/resources",
	"/brand",
	"/status",
	"/og/status.png",
	"/recordranks-logo.svg",
	"/brand/architecture.svg",
	"/brand/banners/linkedin-banner.png",
	"/brand/banners/twitter-banner.png",
	"/blog",
	"/blog/ai-brand-sentiment",
	"/blog/rss.xml",
	"/glossary",
	"/glossary/answer-presence",
	"/docs",
	"/docs/getting-started",
	"/changelog",
	"/roadmap",
	"/ai-search",
	"/ai-search/chatgpt",
	"/aeo-for",
	"/aeo-for/agencies",
	"/answer-presence-tools",
	"/answer-presence-tools/retired-record",
	"/api/openapi.json",
	"/api/search",
	"/repo-activity.svg",
	"/api",
	"/api/private",
	"/api/repo-activity/refresh",
	"/llms.mdx/docs",
	"/llms.mdx/docs/intro",
	"/llms.mdx/site/company",
];

const ALL_COPY = [
	"AI is already answering questions about your brand.",
	"Move from uncertainty to a reviewable next test.",
	"Evidence needs a scope, denominator, and boundary.",
	"Evidence before conclusion.",
	"Request a focused AI market diagnostic.",
	"See where your brand enters an AI answer.",
	"Know what the request form sends—and why.",
	"客户正在先问 AI，再认识你的品牌。",
	"把 AI 对品牌的回答，变成可以看、可以判断、可以行动的证据。",
	"先把问题说清楚，再开始观察；先把依据看明白，再决定行动。",
	"一个结论是否可信，先看它的范围、分母和证据边界。",
	"理解中国市场，也按目标市场服务中国企业的全球业务。",
	"品牌能否进入 AI 的答案，只是第一步。",
	"先告诉我们怎么联系你，具体问题由人来一起判断。",
	"表单只提交三项联系信息，并由服务端完成邮件传递。",
	"Make AI market answers observable.",
	"PUBLIC FACT INTERFACE",
	"中国区域 · 公开事实界面",
	"Yonaris",
	"Current scope",
	"User-agent:",
	"https://yonaris.com",
].join(" ");

function responseType(pathname) {
	if (pathname === "/llms.txt" || pathname === "/llms-full.txt" || pathname === "/robots.txt") return "text/plain";
	if (pathname.endsWith(".xml")) return "application/xml";
	if (pathname.endsWith(".svg")) return "image/svg+xml";
	if (pathname.endsWith(".png")) return "image/png";
	return "text/html";
}

async function startFixture({ diagnosticStatus = 400, redirectStatus = 308 } = {}) {
	const requests = [];
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", "http://fixture.test");
		const bodyChunks = [];
		for await (const chunk of request) bodyChunks.push(chunk);
		const body = Buffer.concat(bodyChunks).toString("utf8");
		requests.push({
			method: request.method,
			pathname: url.pathname,
			search: url.search,
			headers: request.headers,
			body,
		});

		if (request.method === "POST" && url.pathname === "/api/diagnostic") {
			let validEnvelope = false;
			try {
				const lead = JSON.parse(body);
				validEnvelope =
					lead.locale === "en" &&
					lead.name === "Release Smoke" &&
					lead.email === "release-smoke@example.com" &&
					lead.company === "Example Company" &&
					lead.companyUrl === "https://honeypot.invalid";
			} catch {
				validEnvelope = false;
			}
			if (!validEnvelope) {
				response.writeHead(422, { "Content-Type": "application/json" }).end('{"ok":false,"code":"fixture_invalid"}');
				return;
			}
			response
				.writeHead(diagnosticStatus, { "Content-Type": "application/json" })
				.end(
					diagnosticStatus === 400
						? '{"ok":false,"code":"invalid_request"}'
						: '{"ok":false,"code":"forbidden_request"}',
				);
			return;
		}

		const redirect = REDIRECTS.get(url.pathname);
		if (redirect) {
			response.writeHead(redirectStatus, { Location: `${redirect}${url.search}` }).end();
			return;
		}

		if (HIDDEN_PATHS.includes(url.pathname)) {
			response.writeHead(404, { "Content-Type": "text/plain" }).end("hidden");
			return;
		}

		if (url.pathname === "/assets/site.css") {
			response.writeHead(200, { "Content-Type": "text/css" }).end('@font-face { src: url("/assets/site.woff2"); }');
			return;
		}
		if (url.pathname === "/assets/site.woff2") {
			response.writeHead(200, { "Content-Type": "font/woff2" }).end("font");
			return;
		}

		if (
			request.headers.accept?.includes("text/markdown") &&
			[...CORE_PATHS, ...AGENT_HTML_PATHS].includes(url.pathname)
		) {
			response
				.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" })
				.end(`Human canonical: https://yonaris.com${url.pathname.replace(/\/agent(?=\/|$)/u, "")}\n${ALL_COPY}`);
			return;
		}

		if (url.pathname === "/api/plausible/js/script") {
			response.writeHead(404, { "Content-Type": "text/plain" }).end("Analytics is not configured");
			return;
		}
		if (url.pathname === "/sitemap.xml") {
			response
				.writeHead(200, { "Content-Type": "application/xml" })
				.end(
					'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>https://yonaris.com/</loc><xhtml:link rel="alternate" hreflang="zh" href="https://yonaris.com/zh"/></url></urlset>',
				);
			return;
		}

		if (![...HTML_PATHS, ...MACHINE_PATHS].includes(url.pathname)) {
			response.writeHead(404).end("missing");
			return;
		}

		const contentType = responseType(url.pathname);
		if (contentType === "image/png") {
			response.writeHead(200, { "Content-Type": contentType }).end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
			return;
		}
		if (contentType === "image/svg+xml") {
			response.writeHead(200, { "Content-Type": contentType }).end('<svg xmlns="http://www.w3.org/2000/svg"/>');
			return;
		}
		if (contentType === "application/json") {
			response.writeHead(200, { "Content-Type": contentType }).end("{}");
			return;
		}
		if (contentType === "application/xml") {
			response.writeHead(200, { "Content-Type": contentType }).end('<rss version="2.0"/>');
			return;
		}

		const robots =
			url.pathname === "/roadmap" ||
			url.pathname === "/agent" ||
			url.pathname.startsWith("/agent/") ||
			url.pathname === "/zh/agent" ||
			url.pathname.startsWith("/zh/agent/") ||
			["/blog", "/glossary", "/ai-search", "/aeo-for", "/answer-presence-tools"].some(
				(prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
			)
				? '<meta name="robots" content="noindex,follow">'
				: "";
		response
			.writeHead(200, { "Content-Type": contentType })
			.end(
				`<html><head>${robots}<link rel="stylesheet" href="/assets/site.css"></head><body>${ALL_COPY}</body></html>`,
			);
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.equal(typeof address, "object");
	return {
		requests,
		url: `http://127.0.0.1:${address.port}/`,
		close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
	};
}

test("direct-image smoke covers every governed route without asserting Caddy-only hidden paths", async () => {
	const fixture = await startFixture();
	try {
		await runMarketingSmoke(fixture.url);
		const observed = new Set(fixture.requests.map(({ method, pathname }) => `${method} ${pathname}`));
		for (const path of [...HTML_PATHS, ...MACHINE_PATHS]) assert.ok(observed.has(`GET ${path}`), `missing GET ${path}`);
		for (const path of CORE_PATHS) assert.ok(observed.has(`GET ${path}`), `missing negotiated Markdown GET ${path}`);
		for (const path of AGENT_HTML_PATHS) {
			assert.ok(
				fixture.requests.some(
					(request) => request.pathname === path && request.headers.accept?.includes("text/markdown"),
				),
				`missing negotiated Agent Markdown GET ${path}`,
			);
		}
		for (const path of REDIRECTS.keys()) assert.ok(observed.has(`GET ${path}`), `missing manual redirect GET ${path}`);
		for (const path of HIDDEN_PATHS)
			assert.ok(!observed.has(`GET ${path}`), `direct smoke asserted Caddy-only ${path}`);
		for (const path of REDIRECTS.keys()) {
			assert.ok(
				fixture.requests.some((request) => request.pathname === path && request.search === "?utm_source=release"),
				`redirect query probe missing for ${path}`,
			);
		}
		assert.ok(observed.has("POST /api/diagnostic"), "missing diagnostic honeypot POST");
		assert.ok(observed.has("GET /assets/site.woff2"), "missing CSS dependency closure");
	} finally {
		await fixture.close();
	}
});

test("Caddy smoke mode requires the hidden and internal route boundary", async () => {
	const fixture = await startFixture();
	try {
		await runMarketingSmoke(fixture.url, { policy: "caddy" });
		const observed = new Set(fixture.requests.map(({ method, pathname }) => `${method} ${pathname}`));
		for (const path of HIDDEN_PATHS) assert.ok(observed.has(`GET ${path}`), `missing Caddy hidden-path GET ${path}`);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects any redirect that is not a manual 308", async () => {
	const fixture = await startFixture({ redirectStatus: 302 });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /REDIRECT \/platform: expected 308, received 302/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke requires the exact honeypot 400 response instead of a generic proxy failure", async () => {
	const fixture = await startFixture({ diagnosticStatus: 403 });
	try {
		await assert.rejects(
			() => runMarketingSmoke(fixture.url),
			/DIAGNOSTIC: expected 400 \{"ok":false,"code":"invalid_request"\}, received 403/u,
		);
	} finally {
		await fixture.close();
	}
});
