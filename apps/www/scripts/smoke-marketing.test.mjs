import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { ACCEPT_MATRIX, runMarketingSmoke } from "./smoke-marketing.mjs";

const REDIRECTS = new Map([
	["/platform", "/product"],
	["/features", "/product"],
	["/zh/platform", "/zh/product"],
	["/methodology", "/approach"],
	["/zh/methodology", "/zh/approach"],
	["/results", "/product"],
	["/zh/results", "/zh/product"],
	["/vision", "/company"],
	["/pricing", "/diagnostic"],
	["/off-site-aeo", "/geo"],
	["/agent/platform", "/agent/product"],
	["/agent/methodology", "/agent/approach"],
	["/agent/results", "/agent/product"],
]);

const CORE_PATHS = [
	"/",
	"/zh",
	"/product",
	"/zh/product",
	"/approach",
	"/zh/approach",
	"/company",
	"/zh/company",
	"/geo",
	"/zh/geo",
	"/diagnostic",
	"/zh/diagnostic",
];

const GOVERNED_HTML_PATHS = ["/privacy", "/zh/privacy"];
const HUMAN_HTML_PATHS = [...CORE_PATHS, ...GOVERNED_HTML_PATHS];

const HUMAN_MARKDOWN_PATHS = HUMAN_HTML_PATHS.map((path) => {
	const zh = path === "/zh" || path.startsWith("/zh/");
	const localePrefix = zh ? "/zh" : "";
	const topic = path === "/" || path === "/zh" ? "index" : path.split("/").at(-1);
	return `${localePrefix}/agent/${topic}.md`;
});

const ACCEPT_CASES = [
	{ accept: undefined, expectedStatus: 200, expectedType: "text/html" },
	{ accept: "*/*", expectedStatus: 200, expectedType: "text/html" },
	{ accept: "text/html", expectedStatus: 200, expectedType: "text/html" },
	{ accept: "text/markdown", expectedStatus: 200, expectedType: "text/markdown" },
	{ accept: "text/*", expectedStatus: 200, expectedType: "text/markdown" },
	{ accept: "text/html;q=0.8, text/markdown;q=0.8", expectedStatus: 200, expectedType: "text/html" },
	{ accept: "text/html;q=0.4, text/markdown;q=0.8", expectedStatus: 200, expectedType: "text/markdown" },
	{ accept: "text/markdown;q=0", expectedStatus: 406 },
	{ accept: "application/json", expectedStatus: 406 },
	{ accept: "text/html;q=0, text/markdown;q=0", expectedStatus: 406 },
];

const TRAILING_ACCEPTS = ["text/html", "text/markdown", "application/json", "image/avif"];

const AGENT_HTML_PATHS = [
	"/agent",
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => `/agent/${topic}`),
	"/zh/agent",
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => `/zh/agent/${topic}`),
];

const AGENT_MARKDOWN_PATHS = [
	"/agent/index.md",
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => `/agent/${topic}.md`),
	"/zh/agent/index.md",
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map(
		(topic) => `/zh/agent/${topic}.md`,
	),
];

const CATALOG_PATHS = ["/agent/catalog.json", "/zh/agent/catalog.json"];

const HTML_PATHS = [...HUMAN_HTML_PATHS, ...AGENT_HTML_PATHS];

const MACHINE_PATHS = [
	...AGENT_MARKDOWN_PATHS,
	...CATALOG_PATHS,
	"/llms.txt",
	"/llms-full.txt",
	"/robots.txt",
	"/sitemap.xml",
	"/api/plausible/js/script",
	"/og.png",
];

const HIDDEN_PATHS = [
	"/resources",
	"/zh/resources",
	"/research",
	"/zh/research",
	"/agent/research",
	"/zh/agent/research",
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
	"Your next customer may never search. They’ll ask.",
	"See how AI answers your market’s buying questions.",
	"Start with the buying question that matters.",
	"Built for the shift from search results to AI answers.",
	"Start with the question that matters.",
	"See how the same brand appears across markets.",
	"Your details take one short route.",
	"客户开始问 AI，品牌的第一解释权还在你手里吗？",
	"品牌为什么没进客户的候选池？",
	"先做品牌体检，再定 GEO 打法。",
	"不卖玄学排名，先把 AI 怎么说你查清楚",
	"先有中国市场基线，再谈出海本地化",
	"第一次沟通只确认摸底范围",
	"姓名、电话、公司，只用于回复这次咨询",
	"Agent fact interface",
	"Agent 事实入口",
	"Yonaris",
	"public facts",
	"User-agent:",
	"https://yonaris.com",
	...AGENT_MARKDOWN_PATHS.map((path) => `https://yonaris.com${path}`),
].join(" ");

function responseType(pathname) {
	if (pathname.endsWith(".md")) return "text/markdown";
	if (pathname.endsWith("catalog.json")) return "application/ld+json";
	if (pathname === "/llms.txt" || pathname === "/llms-full.txt" || pathname === "/robots.txt") return "text/plain";
	if (pathname.endsWith(".xml")) return "application/xml";
	if (pathname.endsWith(".svg")) return "image/svg+xml";
	if (pathname.endsWith(".png")) return "image/png";
	return "text/html";
}

function humanPaths(pathname) {
	const zh = pathname === "/zh" || pathname.startsWith("/zh/");
	const localePrefix = zh ? "/zh" : "";
	const topic = pathname === "/" || pathname === "/zh" ? "index" : pathname.split("/").at(-1);
	const suffix = topic === "index" ? "" : `/${topic}`;
	return {
		locale: zh ? "zh-CN" : "en",
		canonicalPath: pathname,
		peerPath: zh ? (pathname === "/zh" ? "/" : pathname.replace(/^\/zh/u, "")) : pathname === "/" ? "/zh" : `/zh${pathname}`,
		markdownPath: `${localePrefix}/agent/${topic}.md`,
		catalogPath: `${localePrefix}/agent/catalog.json`,
		agentPath: `${localePrefix}/agent${suffix}`,
	};
}

function agentPaths(pathname) {
	const zh = pathname === "/zh/agent" || pathname.startsWith("/zh/agent/");
	const localePrefix = zh ? "/zh" : "";
	const suffix = pathname.replace(`${localePrefix}/agent`, "");
	const topic = suffix.replace(/^\//u, "") || "index";
	return {
		locale: zh ? "zh-CN" : "en",
		humanPath: topic === "index" ? localePrefix || "/" : `${localePrefix}/${topic}`,
		markdownPath: `${localePrefix}/agent/${topic}.md`,
		catalogPath: `${localePrefix}/agent/catalog.json`,
		claimId: `${topic === "index" ? "home" : topic}.fixture-claim`,
	};
}

function fixtureNegotiation(accept = "*/*") {
	if (accept === "text/*" || accept === "text/markdown" || accept.includes("text/markdown;q=0.8")) {
		if (accept.includes("text/html;q=0.8")) return "html";
		return "markdown";
	}
	if (accept === "application/json" || accept.includes("text/markdown;q=0")) return "not-acceptable";
	return "html";
}

function fixtureCatalog(locale) {
	const zh = locale === "zh-CN";
	const localePrefix = zh ? "/zh" : "";
	const keys = ["index", "product", "approach", "company", "geo", "diagnostic", "privacy"];
	const graph = [
		{
			"@type": "Organization",
			"@id": "https://yonaris.com/#organization",
			name: "Yonaris",
			url: "https://yonaris.com/",
		},
		{
			"@type": "WebSite",
			"@id": "https://yonaris.com/#website",
			publisher: { "@id": "https://yonaris.com/#organization" },
		},
	];
	for (const key of keys) {
		const topic = key === "index" ? "home" : key;
		const humanPath = key === "index" ? localePrefix || "/" : `${localePrefix}/${key}`;
		const agentPath = key === "index" ? `${localePrefix}/agent` : `${localePrefix}/agent/${key}`;
		const itemListId = `https://yonaris.com${agentPath}#facts`;
		graph.push(
			{
				"@type": "WebPage",
				"@id": `https://yonaris.com${humanPath === "/" ? "/" : humanPath}#webpage`,
				isPartOf: { "@id": "https://yonaris.com/#website" },
				about: { "@id": "https://yonaris.com/#organization" },
				mainEntity: { "@id": itemListId },
			},
			{
				"@type": "ItemList",
				"@id": itemListId,
				itemListElement: [{ "@type": "ListItem", identifier: `${topic}.fixture-claim` }],
			},
		);
	}
	return { "@context": "https://schema.org", "@graph": graph };
}

async function startFixture({
	diagnosticStatus = 400,
	redirectStatus = 308,
	humanMetadata = true,
	agentContract = true,
	catalogGraph = true,
	catalogFanIn = false,
	formContract = true,
	extraVisibleControl = false,
	publicLeak = "",
} = {}) {
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

		const canonicalTrailingPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/u, "") : url.pathname;
		if (
			canonicalTrailingPath !== url.pathname &&
			[...HUMAN_HTML_PATHS, ...AGENT_HTML_PATHS, ...AGENT_MARKDOWN_PATHS, ...CATALOG_PATHS].includes(
				canonicalTrailingPath,
			)
		) {
			response.writeHead(307, { Location: `${canonicalTrailingPath}${url.search}` }).end();
			return;
		}

		if ([...HUMAN_HTML_PATHS, ...AGENT_HTML_PATHS].includes(url.pathname)) {
			const representation = fixtureNegotiation(request.headers.accept);
			if (representation === "not-acceptable") {
				response.writeHead(406, { Vary: "Accept", "Content-Type": "text/plain; charset=utf-8" }).end(
					"Not acceptable",
				);
				return;
			}
			if (representation === "markdown") {
				const paths = url.pathname.includes("/agent") ? agentPaths(url.pathname) : humanPaths(url.pathname);
				const humanPath = "humanPath" in paths ? paths.humanPath : paths.canonicalPath;
				response
					.writeHead(200, {
						"Content-Type": "text/markdown; charset=utf-8",
						"Content-Language": paths.locale,
						Vary: "Accept",
					})
					.end(`Human canonical: https://yonaris.com${humanPath}\n${ALL_COPY}`);
				return;
			}
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

		if (AGENT_MARKDOWN_PATHS.includes(url.pathname)) {
			const locale = url.pathname.startsWith("/zh/") ? "zh-CN" : "en";
			const peerPath = locale === "en" ? `/zh${url.pathname}` : url.pathname.replace(/^\/zh/u, "");
			const humanPath = url.pathname
				.replace(/^\/zh\/agent\/index\.md$/u, "/zh")
				.replace(/^\/agent\/index\.md$/u, "/")
				.replace(/\/agent\/(.+)\.md$/u, "/$1");
			response
				.writeHead(200, {
					"Content-Type": "text/markdown; charset=utf-8",
					"Content-Language": locale,
					"Content-Location": url.pathname,
					"Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
					Vary: "Accept",
					"X-Robots-Tag": "noindex, follow",
					Link: `<${url.pathname}>; rel="canonical"; type="text/markdown", <${humanPath}>; rel="alternate"; type="text/html", <${peerPath}>; rel="alternate"; type="text/markdown"; hreflang="${locale === "en" ? "zh-CN" : "en"}", </llms.txt>; rel="describedby"; type="text/plain"`,
				})
				.end(`# Facts\n\n- [fixture.claim] ${ALL_COPY}`);
			return;
		}

		if (CATALOG_PATHS.includes(url.pathname)) {
			const locale = url.pathname.startsWith("/zh/") ? "zh-CN" : "en";
			const peerPath = locale === "en" ? "/zh/agent/catalog.json" : "/agent/catalog.json";
			const humanPath = locale === "en" ? "/" : "/zh";
			const catalogue = fixtureCatalog(locale);
			if (catalogFanIn) {
				const sharedItemList = catalogue["@graph"].find((node) => node["@type"] === "ItemList")?.["@id"];
				for (const node of catalogue["@graph"]) {
					if (node["@type"] === "WebPage") node.mainEntity = { "@id": sharedItemList };
				}
			}
			response
				.writeHead(200, {
					"Content-Type": "application/ld+json; charset=utf-8",
					"Content-Language": locale,
					"Content-Location": url.pathname,
					"Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
					Vary: "Accept",
					"X-Robots-Tag": "noindex, follow",
					Link: `<${url.pathname}>; rel="canonical"; type="application/ld+json", <${humanPath}>; rel="alternate"; type="text/html", <${peerPath}>; rel="alternate"; type="application/ld+json"; hreflang="${locale === "en" ? "zh-CN" : "en"}", </llms.txt>; rel="describedby"; type="text/plain"`,
				})
				.end(
					JSON.stringify(
						catalogGraph
							? catalogue
							: { "@context": "https://schema.org", "@graph": [{ "@type": "ListItem", identifier: "fixture.claim" }] },
					),
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

		const isAgent = AGENT_HTML_PATHS.includes(url.pathname);
		const robots = isAgent ? '<meta name="robots" content="noindex,follow">' : "";
		const agentDiscovery = AGENT_HTML_PATHS.includes(url.pathname)
			? `<link rel="canonical" href="${url.pathname.replace(/\/agent(?=\/|$)/u, "") || "/"}"><link rel="alternate" type="text/markdown" href="${url.pathname.replace(/\/$/u, "")}${url.pathname.endsWith("/agent") ? "/index.md" : ".md"}"><link rel="alternate" type="application/ld+json" href="${url.pathname.startsWith("/zh/") ? "/zh" : ""}/agent/catalog.json"><link rel="describedby" type="text/plain" href="/llms.txt">`
			: "";
		const human = HUMAN_HTML_PATHS.includes(url.pathname) ? humanPaths(url.pathname) : undefined;
		const humanDiscovery =
			human && humanMetadata
				? `<link rel="canonical" href="${human.canonicalPath}"><link rel="alternate" hreflang="${human.locale}" href="${human.canonicalPath}"><link rel="alternate" hreflang="${human.locale === "en" ? "zh-CN" : "en"}" href="${human.peerPath}"><link rel="alternate" hreflang="x-default" href="${human.locale === "en" ? human.canonicalPath : human.peerPath}"><link rel="alternate" type="text/markdown" href="${human.markdownPath}"><link rel="alternate" type="application/ld+json" href="${human.catalogPath}"><link rel="describedby" type="text/plain" href="/llms.txt">`
				: "";
		const agentBody =
			isAgent && agentContract
				? (() => {
						const paths = agentPaths(url.pathname);
						return `<div data-agent-surface="true"><article><dl><div class="agent-experience__metadata-wide"><dt>${paths.locale === "en" ? "Scope" : "范围"}</dt><dd>Selected market, language, buyer question, and comparison frame.</dd></div></dl><section data-fact-group="fixture.group"><ul><li data-claim-id="${paths.claimId}">Observable public fact</li></ul></section><section class="agent-experience__limitations"><h2>${paths.locale === "en" ? "Limitations" : "限制"}</h2><ul><li>Bounded to the selected scope and review time.</li></ul></section></article></div>`;
					})()
				: "";
		const extraControl = extraVisibleControl ? '<input name="role" required>' : "";
		const formBody =
			url.pathname === "/diagnostic" || url.pathname === "/zh/diagnostic"
				? formContract
					? url.pathname.startsWith("/zh")
						? `<form data-lead-state="idle"><div data-lead-field="name"><input name="name" required></div><div data-lead-field="contact"><input name="phone" type="tel" required></div><div data-lead-field="company"><input name="company" required></div>${extraControl}<div class="lead-trap"><input name="companyUrl" tabindex="-1"></div></form>`
						: `<form data-lead-state="idle"><div data-lead-field="name"><input name="name" required></div><div data-lead-field="contact"><input name="email" type="email" required></div><div data-lead-field="company"><input name="company" required></div>${extraControl}<div class="lead-trap"><input name="companyUrl" tabindex="-1"></div></form>`
					: '<form data-lead-state="idle"><input name="name"><input name="email"><input name="phone"><input name="company"></form>'
				: "";
		response
			.writeHead(200, { "Content-Type": contentType })
			.end(
				`<html><head>${robots}${agentDiscovery}${humanDiscovery}<link rel="stylesheet" href="/assets/site.css"></head><body>${ALL_COPY}${agentBody}${formBody}${publicLeak}</body></html>`,
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

test("the release matrix includes a request that omits the Accept header", () => {
	assert.ok(ACCEPT_MATRIX.some((entry) => !("accept" in entry)), "missing omitted Accept case");
});

test("direct-image smoke covers every governed route without asserting Caddy-only hidden paths", async () => {
	const fixture = await startFixture();
	try {
		const result = await runMarketingSmoke(fixture.url);
		assert.equal(result.negotiationCases, 904);
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
		for (const path of [...AGENT_MARKDOWN_PATHS, ...CATALOG_PATHS]) {
			assert.ok(observed.has(`GET ${path}`), `missing stable machine GET ${path}`);
		}
		for (const path of [...HUMAN_HTML_PATHS, ...AGENT_HTML_PATHS]) {
			for (const method of ["GET", "HEAD"]) {
				for (const { accept } of ACCEPT_CASES) {
					assert.ok(
						fixture.requests.some(
							(request) =>
								request.method === method &&
								request.pathname === path &&
								request.headers.accept === (accept ?? "*/*"),
						),
						`missing ${method} ${path} Accept=${accept}`,
					);
				}
				for (const accept of path === "/" ? [] : TRAILING_ACCEPTS) {
					const trailingPath = `${path}/`.replace(/^\/\//u, "/");
					assert.ok(
						fixture.requests.some(
							(request) =>
								request.method === method &&
								request.pathname === trailingPath &&
								request.headers.accept === accept,
						),
						`missing trailing ${method} ${trailingPath} Accept=${accept}`,
					);
				}
			}
		}
		for (const path of [...AGENT_MARKDOWN_PATHS, ...CATALOG_PATHS]) {
			for (const method of ["GET", "HEAD"]) {
				for (const accept of TRAILING_ACCEPTS) {
					assert.ok(
						fixture.requests.some(
							(request) =>
								request.method === method &&
								request.pathname === `${path}/` &&
								request.headers.accept === accept,
						),
						`missing stable trailing ${method} ${path}/ Accept=${accept}`,
					);
				}
			}
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

test("release smoke rejects a Human page without self-canonical, hreflang, and machine discovery", async () => {
	const fixture = await startFixture({ humanMetadata: false });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /HUMAN CANONICAL \/:/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects Agent HTML without stable facts, scope, and limitations", async () => {
	const fixture = await startFixture({ agentContract: false });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /AGENT CONTRACT \/agent/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects a disconnected locale catalogue", async () => {
	const fixture = await startFixture({ catalogGraph: false });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /GRAPH \/agent\/catalog\.json/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects catalogues whose pages all point at one ItemList", async () => {
	const fixture = await startFixture({ catalogFanIn: true });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /GRAPH \/agent\/catalog\.json/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects a regional form whose three visible fields drift", async () => {
	const fixture = await startFixture({ formContract: false });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /FORM \/diagnostic/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects an extra visible control outside the three field wrappers", async () => {
	const fixture = await startFixture({ extraVisibleControl: true });
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /FORM \/diagnostic/u);
	} finally {
		await fixture.close();
	}
});

test("release smoke rejects forbidden ancestry or licensing language in public output", async () => {
	const fixture = await startFixture({
		publicLeak: String.fromCodePoint(
			69,
			108,
			109,
			111,
			32,
			111,
			112,
			101,
			110,
			45,
			115,
			111,
			117,
			114,
			99,
			101,
			32,
			24_320,
			28_304,
		),
	});
	try {
		await assert.rejects(() => runMarketingSmoke(fixture.url), /PUBLIC OUTPUT \/:/u);
	} finally {
		await fixture.close();
	}
});
