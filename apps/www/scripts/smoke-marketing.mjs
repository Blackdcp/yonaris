#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const CORE_ROUTES = [
	{
		path: "/",
		h1: "See what buyers are being told before the first conversation.",
		copy: ["See what buyers are being told before the first conversation."],
	},
	{
		path: "/zh",
		h1: "AI 正在替客户认识你、比较你，也可能误解你。",
		copy: ["AI 正在替客户认识你、比较你，也可能误解你。"],
	},
	{ path: "/product", h1: "See what shaped the shortlist.", copy: ["See what shaped the shortlist."] },
	{
		path: "/zh/product",
		h1: "不是再做一层内容，而是重建品牌被理解的基础设施。",
		copy: ["不是再做一层内容，而是重建品牌被理解的基础设施。"],
	},
	{
		path: "/approach",
		h1: "Proof should be something your team can review.",
		copy: ["Proof should be something your team can review."],
	},
	{
		path: "/zh/approach",
		h1: "从一句 AI 答案，追到真正影响选择的那个断点。",
		copy: ["从一句 AI 答案，追到真正影响选择的那个断点。"],
	},
	{
		path: "/company",
		h1: "The same company should remain clear to people and agents.",
		copy: ["The same company should remain clear to people and agents."],
	},
	{
		path: "/zh/company",
		h1: "同一家公司，应该让人和 Agent 都读得清楚。",
		copy: ["同一家公司，应该让人和 Agent 都读得清楚。"],
	},
	{
		path: "/geo",
		h1: "Markets change the conditions around the decision.",
		copy: ["Markets change the conditions around the decision."],
	},
	{
		path: "/zh/geo",
		h1: "换一个市场，先换判断条件，不是只换语言。",
		copy: ["换一个市场，先换判断条件，不是只换语言。"],
	},
	{
		path: "/diagnostic",
		h1: "Tell us who to contact. We’ll begin with the buying decision.",
		copy: ["Tell us who to contact. We’ll begin with the buying decision."],
	},
	{
		path: "/zh/diagnostic",
		h1: "带一道你最不想让 AI 答错的问题来。",
		copy: ["带一道你最不想让 AI 答错的问题来。"],
	},
];

export const GOVERNED_HTML_ROUTES = [
	{
		path: "/privacy",
		h1: "Your contact request takes one short route.",
		copy: ["Your contact request takes one short route."],
	},
	{
		path: "/zh/privacy",
		h1: "姓名、电话、公司，只用于回复这次咨询。",
		copy: ["姓名、电话、公司，只用于回复这次咨询。"],
	},
];

export const HUMAN_HTML_ROUTES = [...CORE_ROUTES, ...GOVERNED_HTML_ROUTES];

export const AGENT_HTML_ROUTES = [
	{ path: "/agent", copy: ["Public facts"], noindex: true },
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => ({
		path: `/agent/${topic}`,
		copy: ["Public facts"],
		noindex: true,
	})),
	{ path: "/zh/agent", copy: ["公开事实"], noindex: true },
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => ({
		path: `/zh/agent/${topic}`,
		copy: ["公开事实"],
		noindex: true,
	})),
];

function agentMachinePaths(agentPath) {
	const zh = agentPath.startsWith("/zh/");
	const localePrefix = zh ? "/zh" : "";
	const topic = agentPath.replace(`${localePrefix}/agent`, "").replace(/^\//u, "") || "index";
	const humanPath = topic === "index" ? localePrefix || "/" : `${localePrefix}/${topic}`;
	const markdownPath = `${localePrefix}/agent/${topic}.md`;
	const peerPath = `${zh ? "" : "/zh"}/agent/${topic}.md`;
	return {
		locale: zh ? "zh-CN" : "en",
		humanPath,
		markdownPath,
		catalogPath: `${localePrefix}/agent/catalog.json`,
		peerPath,
		peerLanguage: zh ? "en" : "zh-CN",
	};
}

function humanMachinePaths(humanPath) {
	const zh = humanPath === "/zh" || humanPath.startsWith("/zh/");
	const localePrefix = zh ? "/zh" : "";
	const topic = humanPath === "/" || humanPath === "/zh" ? "index" : humanPath.split("/").at(-1);
	const peerHumanPath = zh
		? humanPath === "/zh"
			? "/"
			: humanPath.replace(/^\/zh/u, "")
		: humanPath === "/"
			? "/zh"
			: `/zh${humanPath}`;
	return {
		locale: zh ? "zh-CN" : "en",
		canonicalPath: humanPath,
		peerHumanPath,
		peerLanguage: zh ? "en" : "zh-CN",
		defaultPath: zh ? peerHumanPath : humanPath,
		markdownPath: `${localePrefix}/agent/${topic}.md`,
		catalogPath: `${localePrefix}/agent/catalog.json`,
	};
}

export const ACCEPT_MATRIX = [
	{ status: 200, contentType: "text/html" },
	{ accept: "*/*", status: 200, contentType: "text/html" },
	{ accept: "text/html", status: 200, contentType: "text/html" },
	{ accept: "text/markdown", status: 200, contentType: "text/markdown" },
	{ accept: "text/*", status: 200, contentType: "text/markdown" },
	{ accept: "text/html;q=0.8, text/markdown;q=0.8", status: 200, contentType: "text/html" },
	{ accept: "text/html;q=0.4, text/markdown;q=0.8", status: 200, contentType: "text/markdown" },
	{ accept: "text/markdown;q=0", status: 406 },
	{ accept: "application/json", status: 406 },
	{ accept: "text/html;q=0, text/markdown;q=0", status: 406 },
];

export const TRAILING_SLASH_ACCEPTS = ["text/html", "text/markdown", "application/json", "image/avif"];

const AGENT_MARKDOWN_ROUTES = AGENT_HTML_ROUTES.map(({ path }) => ({
	path: agentMachinePaths(path).markdownPath,
	...agentMachinePaths(path),
}));

const AGENT_CATALOG_ROUTES = [
	{
		path: "/agent/catalog.json",
		locale: "en",
		humanPath: "/",
		peerPath: "/zh/agent/catalog.json",
		peerLanguage: "zh-CN",
	},
	{
		path: "/zh/agent/catalog.json",
		locale: "zh-CN",
		humanPath: "/zh",
		peerPath: "/agent/catalog.json",
		peerLanguage: "en",
	},
];

export const MANUAL_REDIRECTS = [
	{ from: "/platform", to: "/product" },
	{ from: "/features", to: "/product" },
	{ from: "/zh/platform", to: "/zh/product" },
	{ from: "/methodology", to: "/approach" },
	{ from: "/zh/methodology", to: "/zh/approach" },
	{ from: "/results", to: "/product" },
	{ from: "/zh/results", to: "/zh/product" },
	{ from: "/vision", to: "/company" },
	{ from: "/pricing", to: "/diagnostic" },
	{ from: "/off-site-aeo", to: "/geo" },
	{ from: "/agent/platform", to: "/agent/product" },
	{ from: "/agent/methodology", to: "/agent/approach" },
	{ from: "/agent/results", to: "/agent/product" },
];

export const HIDDEN_ROUTES = [
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

const MACHINE_ROUTES = [
	{
		path: "/llms.txt",
		contentType: "text/plain",
		copy: ["Yonaris", ...AGENT_MARKDOWN_ROUTES.map(({ path }) => `https://yonaris.com${path}`)],
	},
	{ path: "/llms-full.txt", contentType: "text/plain", copy: ["public facts"] },
	{ path: "/robots.txt", contentType: "text/plain", copy: ["User-agent:"] },
	{ path: "/sitemap.xml", contentType: "xml", copy: ["http://www.sitemaps.org/schemas/sitemap/0.9"] },
	{ path: "/og.png", contentType: "image/png", copy: [] },
];

export const HONEYPOT_LEAD = {
	locale: "en",
	name: "Release Smoke",
	email: "release-smoke@example.com",
	company: "Example Company",
	companyUrl: "https://honeypot.invalid",
};

async function fetchWithTimeout(url, options = {}, attempts = 1) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
			if (response.ok || attempt === attempts) return response;
			lastError = new Error(`${response.status} ${response.statusText}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}
	throw lastError;
}

function sameOriginAsset(reference, baseUrl, parentUrl = baseUrl) {
	const normalizedReference = reference?.trim();
	if (!normalizedReference || normalizedReference.startsWith("data:") || normalizedReference.startsWith("blob:"))
		return undefined;
	const assetUrl = new URL(normalizedReference, parentUrl);
	assetUrl.hash = "";
	if (assetUrl.origin !== baseUrl.origin) return undefined;
	const pathname = assetUrl.pathname;
	const isAssetFamily = ["/assets/", "/brand/", "/icons/", "/authors/"].some((prefix) => pathname.startsWith(prefix));
	const isAssetFile = /\.(?:css|woff2?|png|svg|ico|webmanifest)$/u.test(pathname);
	return isAssetFamily || isAssetFile ? assetUrl : undefined;
}

function collectHtmlAssets(html, parentUrl, baseUrl, assetUrls) {
	for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gu)) {
		const assetUrl = sameOriginAsset(match[1], baseUrl, parentUrl);
		if (assetUrl) assetUrls.set(assetUrl.href, assetUrl);
	}
}

function typeMatches(actual, expected) {
	if (expected === "xml") return actual.includes("xml");
	return actual.startsWith(expected);
}

function parsedHtmlTags(html, tagName) {
	return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "giu"))].map(([tag]) =>
		Object.fromEntries(
			[...tag.matchAll(/([\w-]+)(?:=["']([^"']*)["'])?/gu)].map((match) => [match[1].toLowerCase(), match[2] ?? ""]),
		),
	);
}

function parsedHtmlLinks(html) {
	return parsedHtmlTags(html, "link");
}

function normalizeExpectedOrigin(input) {
	let url;
	try {
		url = new URL(input);
	} catch {
		throw new Error(`Invalid expected production origin: ${JSON.stringify(input)}`);
	}
	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error(
			`Expected production origin must contain only scheme, host, and optional port: ${JSON.stringify(input)}`,
		);
	}
	return url.origin;
}

function matchingLinks(links, { rel, type, hrefLang }) {
	return links.filter((link) => link.rel === rel && link.type === type && link.hreflang === hrefLang);
}

function hasExactHtmlLink(links, { rel, path, type, hrefLang }, expectedOrigin) {
	const candidates = matchingLinks(links, { rel, type, hrefLang });
	return candidates.length === 1 && candidates[0].href === new URL(path, `${expectedOrigin}/`).href;
}

function parsedHttpLinks(header) {
	return [...header.matchAll(/<([^>]+)>\s*((?:;\s*[^,]+)*)/gu)].map((match) => {
		const parameters = Object.fromEntries(
			[...match[2].matchAll(/;\s*([\w-]+)="([^"]*)"/gu)].map((parameter) => [parameter[1].toLowerCase(), parameter[2]]),
		);
		return { href: match[1], ...parameters };
	});
}

function hasExactHttpLink(links, { rel, path, type, hrefLang }) {
	const candidates = matchingLinks(links, { rel, type, hrefLang });
	return candidates.length === 1 && candidates[0].href === path;
}

const decodedPublicTerm = (...codePoints) => String.fromCodePoint(...codePoints);

const PUBLIC_OUTPUT_GUARDS = [
	{ label: "prohibited origin term", pattern: new RegExp(decodedPublicTerm(101, 108, 109, 111), "iu") },
	{
		label: "prohibited licensing term",
		pattern: new RegExp(
			`${decodedPublicTerm(111, 112, 101, 110)}[\\s-]?${decodedPublicTerm(115, 111, 117, 114, 99, 101)}`,
			"iu",
		),
	},
	{ label: "prohibited Chinese licensing term", pattern: new RegExp(decodedPublicTerm(24_320, 28_304), "u") },
	{
		label: "implementation commentary",
		pattern: new RegExp(["implementation", "\\s+", "commentary"].join(""), "iu"),
	},
];

function checkPublicOutput(path, body, failures) {
	for (const guard of PUBLIC_OUTPUT_GUARDS) {
		if (guard.pattern.test(body)) failures.push(`PUBLIC OUTPUT ${path}: ${guard.label}`);
	}
}

function checkHumanDocument(route, body, failures, expectedOrigin) {
	const discovery = humanMachinePaths(route.path);
	const links = parsedHtmlLinks(body);
	const html = parsedHtmlTags(body, "html")[0];
	if (html?.lang !== discovery.locale)
		failures.push(`HUMAN LANG ${route.path}: expected ${discovery.locale}, received ${html?.lang || "none"}`);
	const headings = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) =>
		match[1]
			.replace(/<[^>]+>/gu, " ")
			.replace(/&(?:#39|apos);/giu, "'")
			.replace(/&quot;/giu, '"')
			.replace(/&amp;/giu, "&")
			.replace(/&lt;/giu, "<")
			.replace(/&gt;/giu, ">")
			.replace(/\s+/gu, " ")
			.trim(),
	);
	if (headings.length !== 1 || headings[0] !== route.h1)
		failures.push(
			`HUMAN H1 ${route.path}: expected exactly ${JSON.stringify(route.h1)}, received ${JSON.stringify(headings)}`,
		);
	const structuredData = [
		...body.matchAll(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/giu),
	];
	if (structuredData.length === 0) failures.push(`HUMAN JSON-LD ${route.path}: missing application/ld+json script`);
	for (const script of structuredData) {
		try {
			JSON.parse(script[1]);
		} catch {
			failures.push(`HUMAN JSON-LD ${route.path}: malformed application/ld+json script`);
		}
	}
	if (/[↗→↳]/u.test(body) || />\s*0[1-9]\s*</u.test(body))
		failures.push(`HUMAN TEMPLATE ${route.path}: rejected arrow or numbered-template glyph`);
	const robots = parsedHtmlTags(body, "meta").find((meta) => meta.name?.toLowerCase() === "robots")?.content ?? "";
	if (/noindex/iu.test(robots)) failures.push(`HUMAN ROBOTS ${route.path}: must remain indexable`);
	if (!hasExactHtmlLink(links, { rel: "canonical", path: discovery.canonicalPath }, expectedOrigin))
		failures.push(`HUMAN CANONICAL ${route.path}: expected ${discovery.canonicalPath}`);
	if (
		!hasExactHtmlLink(
			links,
			{
				rel: "alternate",
				path: discovery.canonicalPath,
				hrefLang: discovery.locale,
			},
			expectedOrigin,
		)
	)
		failures.push(`HUMAN HREFLANG ${route.path}: missing ${discovery.locale} self alternate`);
	if (
		!hasExactHtmlLink(
			links,
			{
				rel: "alternate",
				path: discovery.peerHumanPath,
				hrefLang: discovery.peerLanguage,
			},
			expectedOrigin,
		)
	)
		failures.push(`HUMAN HREFLANG ${route.path}: missing ${discovery.peerLanguage} peer`);
	if (
		!hasExactHtmlLink(links, { rel: "alternate", path: discovery.defaultPath, hrefLang: "x-default" }, expectedOrigin)
	)
		failures.push(`HUMAN HREFLANG ${route.path}: missing x-default`);
	if (
		!hasExactHtmlLink(links, { rel: "alternate", path: discovery.markdownPath, type: "text/markdown" }, expectedOrigin)
	)
		failures.push(`HUMAN DISCOVERY ${route.path}: missing Markdown alternate`);
	if (
		!hasExactHtmlLink(
			links,
			{ rel: "alternate", path: discovery.catalogPath, type: "application/ld+json" },
			expectedOrigin,
		)
	)
		failures.push(`HUMAN DISCOVERY ${route.path}: missing JSON-LD alternate`);
	if (!hasExactHtmlLink(links, { rel: "describedby", path: "/llms.txt", type: "text/plain" }, expectedOrigin))
		failures.push(`HUMAN DISCOVERY ${route.path}: missing llms.txt relation`);
}

function checkAgentDocument(route, body, failures) {
	const hasSurface = /data-agent-surface=["']true["']/u.test(body);
	const hasArticle = /<article\b/iu.test(body);
	const hasGroup = /data-fact-group=["'][a-z0-9.-]+["']/u.test(body);
	const hasClaim = /data-claim-id=["'][a-z0-9.-]+["']/u.test(body);
	const hasDirectory = /agent-experience__fact-index/u.test(body);
	const hasMetadata = /agent-experience__record-meta/u.test(body);
	const hasHumanCanonical = /data-human-canonical=["']true["']/u.test(body);
	const hasLimitations = /agent-experience__limitations/u.test(body);
	if (
		!(
			hasSurface &&
			hasArticle &&
			hasGroup &&
			hasClaim &&
			hasDirectory &&
			hasMetadata &&
			hasHumanCanonical &&
			hasLimitations
		)
	)
		failures.push(
			`AGENT CONTRACT ${route.path}: expected Human return, fact directory, stable facts, metadata, and limitations`,
		);
}

function checkLeadForm(path, body, failures) {
	const expected =
		path === "/zh/diagnostic"
			? [
					["name", "name", undefined],
					["contact", "phone", "tel"],
					["company", "company", undefined],
				]
			: [
					["name", "name", undefined],
					["contact", "email", "email"],
					["company", "company", undefined],
				];
	const fields = [...body.matchAll(/<div\b[^>]*data-lead-field=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/giu)];
	const form = body.match(/<form\b[^>]*data-lead-state=["'][^"']+["'][^>]*>[\s\S]*?<\/form>/iu)?.[0] ?? "";
	const visibleControls = [
		...parsedHtmlTags(form, "input").filter((input) => input.type !== "hidden" && input.name !== "companyUrl"),
		...parsedHtmlTags(form, "select"),
		...parsedHtmlTags(form, "textarea"),
	];
	if (fields.length !== expected.length) {
		failures.push(`FORM ${path}: expected exactly three visible fields`);
		return;
	}
	if (visibleControls.length !== expected.length) {
		failures.push(`FORM ${path}: expected exactly three visible controls`);
		return;
	}
	for (const [field, name, type] of expected) {
		const block = fields.find((match) => match[1] === field)?.[2] ?? "";
		const input = parsedHtmlTags(block, "input")[0];
		if (!input || input.name !== name || (type !== undefined && input.type !== type) || !("required" in input)) {
			failures.push(`FORM ${path}: invalid ${field} field contract`);
		}
	}
}

function checkCatalogueGraph(route, graph, failures) {
	if (graph?.["@context"] !== "https://schema.org" || !Array.isArray(graph?.["@graph"])) {
		failures.push(`GRAPH ${route.path}: invalid JSON-LD envelope`);
		return;
	}
	const nodes = graph["@graph"];
	const organizations = nodes.filter((node) => node?.["@type"] === "Organization");
	const websites = nodes.filter((node) => node?.["@type"] === "WebSite");
	const pages = nodes.filter((node) => node?.["@type"] === "WebPage");
	const lists = nodes.filter((node) => node?.["@type"] === "ItemList");
	const ids = new Set(nodes.map((node) => node?.["@id"]).filter(Boolean));
	const organizationId = organizations[0]?.["@id"];
	const websiteId = websites[0]?.["@id"];
	if (
		organizations.length !== 1 ||
		websites.length !== 1 ||
		pages.length !== 7 ||
		lists.length !== 7 ||
		ids.size !== nodes.length ||
		!String(organizationId).endsWith("/#organization") ||
		!String(websiteId).endsWith("/#website") ||
		websites[0]?.publisher?.["@id"] !== organizationId
	) {
		failures.push(`GRAPH ${route.path}: expected stable Organization, WebSite, seven WebPage and seven ItemList nodes`);
		return;
	}
	const itemListIds = new Set(lists.map((list) => list?.["@id"]));
	const mainEntityIds = new Set(pages.map((page) => page?.mainEntity?.["@id"]));
	if (
		mainEntityIds.size !== itemListIds.size ||
		[...mainEntityIds].some((id) => !itemListIds.has(id)) ||
		[...itemListIds].some((id) => !mainEntityIds.has(id))
	) {
		failures.push(`GRAPH ${route.path}: every ItemList must be referenced by exactly one page identity`);
	}
	for (const page of pages) {
		if (
			page?.isPartOf?.["@id"] !== websiteId ||
			page?.about?.["@id"] !== organizationId ||
			!ids.has(page?.mainEntity?.["@id"])
		) {
			failures.push(`GRAPH ${route.path}: disconnected WebPage ${page?.["@id"] ?? "without id"}`);
		}
	}
	for (const list of lists) {
		const claims = list?.itemListElement;
		if (
			!Array.isArray(claims) ||
			claims.length === 0 ||
			claims.some((claim) => !/^[a-z0-9.-]+$/u.test(claim?.identifier))
		)
			failures.push(`GRAPH ${route.path}: ItemList ${list?.["@id"] ?? "without id"} has unstable claims`);
	}
}

async function checkReadableRoute(route, baseUrl, failures, assetUrls, expectedOrigin) {
	const routeUrl = new URL(route.path, baseUrl);
	try {
		const response = await fetchWithTimeout(routeUrl, {}, route.path === "/" ? 30 : 1);
		if (!response.ok) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		const contentType = response.headers.get("content-type") ?? "";
		if (!typeMatches(contentType, "text/html"))
			failures.push(`TYPE ${route.path}: expected text/html, received ${contentType || "none"}`);
		const body = await response.text();
		for (const copy of route.copy) if (!body.includes(copy)) failures.push(`COPY ${route.path}: ${copy}`);
		checkPublicOutput(route.path, body, failures);
		if (route.noindex && !body.includes("noindex,follow"))
			failures.push(`ROBOTS ${route.path}: expected noindex,follow`);
		if (route.noindex) {
			const discovery = agentMachinePaths(route.path);
			const links = parsedHtmlLinks(body);
			if (!hasExactHtmlLink(links, { rel: "canonical", path: discovery.humanPath }, expectedOrigin))
				failures.push(`CANONICAL ${route.path}: expected ${discovery.humanPath}`);
			if (
				!hasExactHtmlLink(
					links,
					{ rel: "alternate", path: discovery.markdownPath, type: "text/markdown" },
					expectedOrigin,
				)
			)
				failures.push(`DISCOVERY ${route.path}: missing Markdown alternate`);
			if (
				!hasExactHtmlLink(
					links,
					{ rel: "alternate", path: discovery.catalogPath, type: "application/ld+json" },
					expectedOrigin,
				)
			)
				failures.push(`DISCOVERY ${route.path}: missing JSON-LD alternate`);
			if (!hasExactHtmlLink(links, { rel: "describedby", path: "/llms.txt", type: "text/plain" }, expectedOrigin))
				failures.push(`DISCOVERY ${route.path}: missing llms.txt relation`);
			checkAgentDocument(route, body, failures);
		} else {
			checkHumanDocument(route, body, failures, expectedOrigin);
		}
		if (route.path === "/diagnostic" || route.path === "/zh/diagnostic") checkLeadForm(route.path, body, failures);
		collectHtmlAssets(body, routeUrl, baseUrl, assetUrls);
		console.log(`${response.status} ${route.path}`);
	} catch (error) {
		failures.push(`ERR ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function checkMachineHeaders(route, response, failures, contentType) {
	const actualType = response.headers.get("content-type") ?? "";
	if (!typeMatches(actualType, contentType))
		failures.push(`TYPE ${route.path}: expected ${contentType}, received ${actualType || "none"}`);
	if (response.headers.get("content-language") !== route.locale)
		failures.push(`LANGUAGE ${route.path}: expected ${route.locale}`);
	if (response.headers.get("content-location") !== route.path)
		failures.push(`LOCATION ${route.path}: expected ${route.path}`);
	if (!(response.headers.get("cache-control") ?? "").includes("stale-while-revalidate=3600"))
		failures.push(`CACHE ${route.path}: missing stale-while-revalidate`);
	if (!(response.headers.get("vary") ?? "").split(/\s*,\s*/u).some((value) => value.toLowerCase() === "accept"))
		failures.push(`VARY ${route.path}: missing Accept`);
	if (response.headers.get("x-robots-tag") !== "noindex, follow")
		failures.push(`ROBOTS ${route.path}: expected noindex, follow`);

	const links = parsedHttpLinks(response.headers.get("link") ?? "");
	if (!hasExactHttpLink(links, { rel: "canonical", path: route.path, type: contentType }))
		failures.push(`LINK ${route.path}: missing canonical`);
	if (route.humanPath && !hasExactHttpLink(links, { rel: "alternate", path: route.humanPath, type: "text/html" }))
		failures.push(`LINK ${route.path}: missing Human alternate`);
	if (
		route.catalogPath &&
		!hasExactHttpLink(links, {
			rel: "alternate",
			path: route.catalogPath,
			type: "application/ld+json",
		})
	)
		failures.push(`LINK ${route.path}: invalid catalog alternate`);
	if (
		!hasExactHttpLink(links, {
			rel: "alternate",
			path: route.peerPath,
			type: contentType,
			hrefLang: route.peerLanguage,
		})
	)
		failures.push(`LINK ${route.path}: missing locale peer`);
	if (!hasExactHttpLink(links, { rel: "describedby", path: "/llms.txt", type: "text/plain" }))
		failures.push(`LINK ${route.path}: missing llms.txt relation`);
}

async function checkAgentMarkdownRoute(route, baseUrl, failures) {
	try {
		const response = await fetchWithTimeout(new URL(route.path, baseUrl));
		if (response.status >= 500) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		if (!response.ok) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		checkMachineHeaders(route, response, failures, "text/markdown");
		const body = await response.text();
		checkPublicOutput(route.path, body, failures);
		if (!/^Stable ID: [a-z0-9.-]+$/mu.test(body) && !/^稳定 ID：[a-z0-9.-]+$/mu.test(body))
			failures.push(`CLAIM ${route.path}: missing stable claim ID`);
		console.log(`${response.status} ${route.path}`);
	} catch (error) {
		failures.push(`ERR ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function checkAgentCatalogRoute(route, baseUrl, failures) {
	try {
		const response = await fetchWithTimeout(new URL(route.path, baseUrl));
		if (response.status >= 500) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		if (!response.ok) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		checkMachineHeaders(route, response, failures, "application/ld+json");
		const body = await response.text();
		checkPublicOutput(route.path, body, failures);
		try {
			const parsed = JSON.parse(body);
			checkCatalogueGraph(route, parsed, failures);
			if (!/"identifier":"[a-z0-9.-]+"/u.test(JSON.stringify(parsed)))
				failures.push(`CLAIM ${route.path}: missing stable claim ID`);
		} catch {
			failures.push(`JSON ${route.path}: malformed JSON`);
		}
		console.log(`${response.status} ${route.path}`);
	} catch (error) {
		failures.push(`ERR ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function checkMachineRoute(route, baseUrl, failures) {
	const routeUrl = new URL(route.path, baseUrl);
	try {
		const response = await fetchWithTimeout(routeUrl);
		if (!response.ok) {
			failures.push(`${response.status} ${route.path}`);
			return;
		}
		const contentType = response.headers.get("content-type") ?? "";
		if (!typeMatches(contentType, route.contentType)) {
			failures.push(`TYPE ${route.path}: expected ${route.contentType}, received ${contentType || "none"}`);
		}
		const body = await response.text();
		if (!contentType.startsWith("image/")) checkPublicOutput(route.path, body, failures);
		for (const copy of route.copy) if (!body.includes(copy)) failures.push(`COPY ${route.path}: ${copy}`);
		console.log(`${response.status} ${route.path}`);
	} catch (error) {
		failures.push(`ERR ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function checkAssets(baseUrl, failures, assetUrls) {
	if (![...assetUrls.values()].some((url) => url.pathname.endsWith(".css")))
		failures.push("HTML does not reference a stylesheet");
	const stylesheets = [];
	for (const assetUrl of assetUrls.values()) {
		try {
			const response = await fetchWithTimeout(assetUrl);
			if (!response.ok) {
				failures.push(`${response.status} ${assetUrl.pathname}`);
				continue;
			}
			if (assetUrl.pathname.endsWith(".css")) stylesheets.push({ url: assetUrl, css: await response.text() });
			else await response.arrayBuffer();
			console.log(`${response.status} ${assetUrl.pathname}`);
		} catch (error) {
			failures.push(`ERR ${assetUrl.pathname}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	for (const { url, css } of stylesheets) {
		for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gu)) {
			const assetUrl = sameOriginAsset(match[1], baseUrl, url);
			if (!assetUrl || assetUrls.has(assetUrl.href)) continue;
			assetUrls.set(assetUrl.href, assetUrl);
			try {
				const response = await fetchWithTimeout(assetUrl);
				if (!response.ok) failures.push(`${response.status} ${assetUrl.pathname}`);
				else await response.arrayBuffer();
				console.log(`${response.status} ${assetUrl.pathname}`);
			} catch (error) {
				failures.push(`ERR ${assetUrl.pathname}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
}

async function checkNegotiationMatrix(baseUrl, failures) {
	const routes = [...HUMAN_HTML_ROUTES, ...AGENT_HTML_ROUTES];
	let cases = 0;
	for (const route of routes) {
		for (const method of ["GET", "HEAD"]) {
			for (const expected of ACCEPT_MATRIX) {
				cases += 1;
				const acceptLabel = expected.accept ?? "(absent)";
				try {
					const headers = expected.accept === undefined ? {} : { Accept: expected.accept };
					const response = await fetchWithTimeout(new URL(route.path, baseUrl), {
						method,
						redirect: "manual",
						headers,
					});
					const body = await response.text();
					if (response.status >= 500)
						failures.push(`NEGOTIATION ${method} ${route.path} ${acceptLabel}: ${response.status}`);
					if (response.status !== expected.status)
						failures.push(
							`NEGOTIATION ${method} ${route.path} ${acceptLabel}: expected ${expected.status}, received ${response.status}`,
						);
					const contentType = response.headers.get("content-type") ?? "";
					if (expected.contentType && !contentType.startsWith(expected.contentType))
						failures.push(
							`NEGOTIATION TYPE ${method} ${route.path} ${acceptLabel}: expected ${expected.contentType}, received ${contentType || "none"}`,
						);
					if (method === "HEAD" && body.length > 0)
						failures.push(`NEGOTIATION HEAD ${route.path} ${acceptLabel}: response body must be empty`);
				} catch (error) {
					failures.push(
						`ERR NEGOTIATION ${method} ${route.path} ${acceptLabel}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			if (route.path === "/") continue;
			for (const accept of TRAILING_SLASH_ACCEPTS) {
				cases += 1;
				try {
					const trailingUrl = new URL(`${route.path}/?utm_source=release`, baseUrl);
					const response = await fetchWithTimeout(trailingUrl, {
						method,
						redirect: "manual",
						headers: { Accept: accept },
					});
					const body = await response.text();
					const location = response.headers.get("location");
					const resolved = location ? new URL(location, baseUrl) : undefined;
					if (response.status >= 500) failures.push(`TRAILING ${method} ${route.path}/ ${accept}: ${response.status}`);
					if (response.status !== 307)
						failures.push(`TRAILING ${method} ${route.path}/ ${accept}: expected 307, received ${response.status}`);
					if (`${resolved?.pathname ?? ""}${resolved?.search ?? ""}` !== `${route.path}?utm_source=release`)
						failures.push(`TRAILING ${method} ${route.path}/ ${accept}: query-preserving location missing`);
					if (method === "HEAD" && body.length > 0)
						failures.push(`TRAILING HEAD ${route.path}/ ${accept}: response body must be empty`);
				} catch (error) {
					failures.push(
						`ERR TRAILING ${method} ${route.path}/ ${accept}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}
	}

	for (const route of [...AGENT_MARKDOWN_ROUTES, ...AGENT_CATALOG_ROUTES]) {
		for (const method of ["GET", "HEAD"]) {
			for (const accept of TRAILING_SLASH_ACCEPTS) {
				cases += 1;
				try {
					const trailingUrl = new URL(`${route.path}/?utm_source=release`, baseUrl);
					const response = await fetchWithTimeout(trailingUrl, {
						method,
						redirect: "manual",
						headers: { Accept: accept },
					});
					const body = await response.text();
					const location = response.headers.get("location");
					const resolved = location ? new URL(location, baseUrl) : undefined;
					if (response.status >= 500)
						failures.push(`STABLE TRAILING ${method} ${route.path}/ ${accept}: ${response.status}`);
					if (response.status !== 307)
						failures.push(
							`STABLE TRAILING ${method} ${route.path}/ ${accept}: expected 307, received ${response.status}`,
						);
					if (`${resolved?.pathname ?? ""}${resolved?.search ?? ""}` !== `${route.path}?utm_source=release`)
						failures.push(`STABLE TRAILING ${method} ${route.path}/ ${accept}: query-preserving location missing`);
					if (method === "HEAD" && body.length > 0)
						failures.push(`STABLE TRAILING HEAD ${route.path}/ ${accept}: response body must be empty`);
				} catch (error) {
					failures.push(
						`ERR STABLE TRAILING ${method} ${route.path}/ ${accept}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}
	}
	console.log(`${cases} Accept and trailing-slash cases checked.`);
	return cases;
}

export async function runMarketingSmoke(inputUrl = "http://127.0.0.1:3000/", options = {}) {
	const baseUrl = new URL(inputUrl);
	const expectedOrigin = normalizeExpectedOrigin(
		options.expectedOrigin ?? process.env.VITE_SITE_URL ?? "https://yonaris.com",
	);
	const failures = [];
	const assetUrls = new Map();

	for (const route of [...HUMAN_HTML_ROUTES, ...AGENT_HTML_ROUTES])
		await checkReadableRoute(route, baseUrl, failures, assetUrls, expectedOrigin);
	for (const route of AGENT_MARKDOWN_ROUTES) await checkAgentMarkdownRoute(route, baseUrl, failures);
	for (const route of AGENT_CATALOG_ROUTES) await checkAgentCatalogRoute(route, baseUrl, failures);
	for (const route of MACHINE_ROUTES) await checkMachineRoute(route, baseUrl, failures);
	const negotiationCases = await checkNegotiationMatrix(baseUrl, failures);

	const plausibleUrl = new URL("/api/plausible/js/script", baseUrl);
	try {
		const response = await fetchWithTimeout(plausibleUrl);
		const body = await response.text();
		if (!(response.ok || (response.status === 404 && body === "Analytics is not configured"))) {
			failures.push(`PLAUSIBLE: unexpected ${response.status} response`);
		}
		console.log(`${response.status} /api/plausible/js/script`);
	} catch (error) {
		failures.push(`ERR /api/plausible/js/script: ${error instanceof Error ? error.message : String(error)}`);
	}

	for (const route of HUMAN_HTML_ROUTES) {
		try {
			const response = await fetchWithTimeout(new URL(route.path, baseUrl), { headers: { Accept: "text/markdown" } });
			const contentType = response.headers.get("content-type") ?? "";
			const body = await response.text();
			if (response.status !== 200 || !contentType.startsWith("text/markdown") || !body.includes("yonaris.com")) {
				failures.push(`MARKDOWN ${route.path}: expected 200 text/markdown with a Human canonical`);
			}
		} catch (error) {
			failures.push(`ERR MARKDOWN ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	for (const route of AGENT_HTML_ROUTES) {
		try {
			const response = await fetchWithTimeout(new URL(route.path, baseUrl), { headers: { Accept: "text/markdown" } });
			const contentType = response.headers.get("content-type") ?? "";
			const body = await response.text();
			if (response.status !== 200 || !contentType.startsWith("text/markdown") || !body.includes("yonaris.com")) {
				failures.push(`AGENT MARKDOWN ${route.path}: expected paired Markdown facts`);
			}
		} catch (error) {
			failures.push(`ERR AGENT MARKDOWN ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	for (const redirect of MANUAL_REDIRECTS) {
		try {
			const redirectUrl = new URL(redirect.from, baseUrl);
			redirectUrl.searchParams.set("utm_source", "release");
			const response = await fetchWithTimeout(redirectUrl, { redirect: "manual" });
			const location = response.headers.get("location");
			if (response.status !== 308)
				failures.push(`REDIRECT ${redirect.from}: expected 308, received ${response.status}`);
			else if (location !== `${redirect.to}?utm_source=release`) {
				failures.push(
					`REDIRECT ${redirect.from}: expected ${redirect.to}?utm_source=release, received ${location ?? "none"}`,
				);
			}
		} catch (error) {
			failures.push(`ERR REDIRECT ${redirect.from}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	if (options.policy === "caddy") {
		for (const path of HIDDEN_ROUTES) {
			try {
				const response = await fetchWithTimeout(new URL(path, baseUrl));
				if (response.status !== 404) failures.push(`HIDDEN ${path}: expected 404, received ${response.status}`);
			} catch (error) {
				failures.push(`ERR HIDDEN ${path}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	try {
		const response = await fetchWithTimeout(new URL("/api/diagnostic", baseUrl), {
			method: "POST",
			redirect: "manual",
			headers: {
				Origin: baseUrl.origin,
				"Sec-Fetch-Site": "same-origin",
				"Content-Type": "application/json",
				"Content-Encoding": "identity",
				"Idempotency-Key": "00000000-0000-4000-8000-000000000006",
			},
			body: JSON.stringify(HONEYPOT_LEAD),
		});
		const body = await response.text();
		let parsed;
		try {
			parsed = JSON.parse(body);
		} catch {
			parsed = null;
		}
		if (
			response.status !== 400 ||
			parsed?.ok !== false ||
			parsed?.code !== "invalid_request" ||
			Object.keys(parsed).length !== 2
		) {
			failures.push(
				`DIAGNOSTIC: expected 400 {"ok":false,"code":"invalid_request"}, received ${response.status} ${body}`,
			);
		}
	} catch (error) {
		failures.push(`ERR DIAGNOSTIC: ${error instanceof Error ? error.message : String(error)}`);
	}

	await checkAssets(baseUrl, failures, assetUrls);

	if (failures.length > 0) throw new Error(`Marketing smoke failed:\n${failures.join("\n")}`);
	const routeCount =
		HUMAN_HTML_ROUTES.length +
		AGENT_HTML_ROUTES.length +
		AGENT_MARKDOWN_ROUTES.length +
		AGENT_CATALOG_ROUTES.length +
		MACHINE_ROUTES.length;
	console.log(
		`${routeCount} routes, ${MANUAL_REDIRECTS.length} redirects, and ${assetUrls.size} same-origin assets passed.`,
	);
	return { routes: routeCount, redirects: MANUAL_REDIRECTS.length, assets: assetUrls.size, negotiationCases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runMarketingSmoke(process.argv[2], { policy: process.argv.includes("--caddy") ? "caddy" : "direct" });
}
