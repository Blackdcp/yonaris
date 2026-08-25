#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const CORE_ROUTES = [
	{ path: "/", copy: ["Your next customer may never search. They’ll ask."] },
	{ path: "/zh", copy: ["客户问 AI 时，你的品牌被怎么说？"] },
	{ path: "/product", copy: ["See how AI answers your market’s buying questions."] },
	{ path: "/zh/product", copy: ["客户怎么问，AI 怎么答，先看哪里"] },
	{ path: "/approach", copy: ["Start with the buying question that matters."] },
	{ path: "/zh/approach", copy: ["从最担心的品牌问题开始"] },
	{ path: "/company", copy: ["Built for the shift from search results to AI answers."] },
	{ path: "/zh/company", copy: ["让企业看清 AI 如何介绍自己的品牌"] },
	{ path: "/geo", copy: ["See how the same brand appears across markets."] },
	{ path: "/zh/geo", copy: ["服务中国市场，也支持企业进入海外目标市场"] },
	{ path: "/diagnostic", copy: ["Start with the question that matters."] },
	{ path: "/zh/diagnostic", copy: ["先聊清楚，你最想解决什么"] },
];

export const GOVERNED_HTML_ROUTES = [
	{ path: "/privacy", copy: ["Your details take one short route."] },
	{ path: "/zh/privacy", copy: ["三项信息，只用于回复咨询"] },
];

export const AGENT_HTML_ROUTES = [
	{ path: "/agent", copy: ["Agent fact interface"], noindex: true },
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => ({
		path: `/agent/${topic}`,
		copy: ["Agent fact interface"],
		noindex: true,
	})),
	{ path: "/zh/agent", copy: ["Agent 事实入口"], noindex: true },
	...["product", "approach", "company", "geo", "diagnostic", "privacy"].map((topic) => ({
		path: `/zh/agent/${topic}`,
		copy: ["Agent 事实入口"],
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

function parsedHtmlLinks(html) {
	return [...html.matchAll(/<link\b[^>]*>/giu)].map(([tag]) =>
		Object.fromEntries([...tag.matchAll(/([\w-]+)=["']([^"']*)["']/gu)].map((match) => [match[1].toLowerCase(), match[2]])),
	);
}

function linkPath(href) {
	try {
		return new URL(href, "https://yonaris.invalid").pathname;
	} catch {
		return "";
	}
}

function hasHtmlLink(links, { rel, path, type }) {
	return links.some(
		(link) =>
			link.rel === rel &&
			linkPath(link.href) === path &&
			(type === undefined || link.type === type),
	);
}

function parsedHttpLinks(header) {
	return [...header.matchAll(/<([^>]+)>\s*((?:;\s*[^,]+)*)/gu)].map((match) => {
		const parameters = Object.fromEntries(
			[...match[2].matchAll(/;\s*([\w-]+)="([^"]*)"/gu)].map((parameter) => [
				parameter[1].toLowerCase(),
				parameter[2],
			]),
		);
		return { href: match[1], ...parameters };
	});
}

function hasHttpLink(links, { rel, path, type, hrefLang }) {
	return links.some(
		(link) =>
			link.rel === rel &&
			linkPath(link.href) === path &&
			(type === undefined || link.type === type) &&
			(hrefLang === undefined || link.hreflang === hrefLang),
	);
}

async function checkReadableRoute(route, baseUrl, failures, assetUrls) {
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
		if (route.noindex && !body.includes("noindex,follow"))
			failures.push(`ROBOTS ${route.path}: expected noindex,follow`);
		if (route.noindex) {
			const discovery = agentMachinePaths(route.path);
			const links = parsedHtmlLinks(body);
			if (!hasHtmlLink(links, { rel: "canonical", path: discovery.humanPath }))
				failures.push(`CANONICAL ${route.path}: expected ${discovery.humanPath}`);
			if (!hasHtmlLink(links, { rel: "alternate", path: discovery.markdownPath, type: "text/markdown" }))
				failures.push(`DISCOVERY ${route.path}: missing Markdown alternate`);
			if (!hasHtmlLink(links, { rel: "alternate", path: discovery.catalogPath, type: "application/ld+json" }))
				failures.push(`DISCOVERY ${route.path}: missing JSON-LD alternate`);
			if (!hasHtmlLink(links, { rel: "describedby", path: "/llms.txt", type: "text/plain" }))
				failures.push(`DISCOVERY ${route.path}: missing llms.txt relation`);
		}
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
	if (!hasHttpLink(links, { rel: "canonical", path: route.path, type: contentType }))
		failures.push(`LINK ${route.path}: missing canonical`);
	if (route.humanPath && !hasHttpLink(links, { rel: "alternate", path: route.humanPath, type: "text/html" }))
		failures.push(`LINK ${route.path}: missing Human alternate`);
	if (
		!hasHttpLink(links, {
			rel: "alternate",
			path: route.peerPath,
			type: contentType,
			hrefLang: route.peerLanguage,
		})
	)
		failures.push(`LINK ${route.path}: missing locale peer`);
	if (!hasHttpLink(links, { rel: "describedby", path: "/llms.txt", type: "text/plain" }))
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
		if (!/- \[[a-z0-9.-]+\] /u.test(body)) failures.push(`CLAIM ${route.path}: missing stable claim ID`);
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
		try {
			const parsed = JSON.parse(body);
			if (parsed?.["@context"] !== "https://schema.org" || !Array.isArray(parsed?.["@graph"]))
				failures.push(`JSON ${route.path}: invalid JSON-LD graph`);
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

export async function runMarketingSmoke(inputUrl = "http://127.0.0.1:3000/", options = {}) {
	const baseUrl = new URL(inputUrl);
	const failures = [];
	const assetUrls = new Map();

	for (const route of [...CORE_ROUTES, ...GOVERNED_HTML_ROUTES, ...AGENT_HTML_ROUTES])
		await checkReadableRoute(route, baseUrl, failures, assetUrls);
	for (const route of AGENT_MARKDOWN_ROUTES) await checkAgentMarkdownRoute(route, baseUrl, failures);
	for (const route of AGENT_CATALOG_ROUTES) await checkAgentCatalogRoute(route, baseUrl, failures);
	for (const route of MACHINE_ROUTES) await checkMachineRoute(route, baseUrl, failures);

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

	for (const route of CORE_ROUTES) {
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
		CORE_ROUTES.length +
		GOVERNED_HTML_ROUTES.length +
		AGENT_HTML_ROUTES.length +
		AGENT_MARKDOWN_ROUTES.length +
		AGENT_CATALOG_ROUTES.length +
		MACHINE_ROUTES.length;
	console.log(
		`${routeCount} routes, ${MANUAL_REDIRECTS.length} redirects, and ${assetUrls.size} same-origin assets passed.`,
	);
	return { routes: routeCount, redirects: MANUAL_REDIRECTS.length, assets: assetUrls.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runMarketingSmoke(process.argv[2], { policy: process.argv.includes("--caddy") ? "caddy" : "direct" });
}
