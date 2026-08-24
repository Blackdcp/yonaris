#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const CORE_ROUTES = [
	{ path: "/", copy: ["Know how AI represents your brand—and what to do next."] },
	{ path: "/zh", copy: ["看清 AI 如何塑造你的市场", "重构 MarTech", "同时面向人，也面向智能体"] },
	{ path: "/product", copy: ["Make AI market answers observable."] },
	{ path: "/zh/product", copy: [] },
	{ path: "/approach", copy: ["Move from uncertainty to a reviewable next test."] },
	{ path: "/zh/approach", copy: [] },
	{ path: "/research", copy: ["Evidence needs a scope, denominator, and boundary."] },
	{ path: "/zh/research", copy: [] },
	{ path: "/company", copy: ["Evidence before conclusion."] },
	{ path: "/zh/company", copy: [] },
	{ path: "/geo", copy: [] },
	{ path: "/zh/geo", copy: [] },
	{ path: "/diagnostic", copy: ["Request a focused AI market diagnostic."] },
	{ path: "/zh/diagnostic", copy: [] },
];

export const GOVERNED_HTML_ROUTES = [{ path: "/privacy", copy: [] }];

export const MANUAL_REDIRECTS = [
	{ from: "/platform", to: "/product" },
	{ from: "/features", to: "/product" },
	{ from: "/zh/platform", to: "/zh/product" },
	{ from: "/methodology", to: "/approach" },
	{ from: "/zh/methodology", to: "/zh/approach" },
	{ from: "/results", to: "/research" },
	{ from: "/zh/results", to: "/zh/research" },
	{ from: "/vision", to: "/company" },
	{ from: "/pricing", to: "/diagnostic" },
	{ from: "/off-site-aeo", to: "/geo" },
	{ from: "/agent/platform", to: "/agent/product" },
	{ from: "/agent/methodology", to: "/agent/approach" },
	{ from: "/agent/results", to: "/agent/research" },
];

export const HIDDEN_ROUTES = [
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
	"/glossary/ai-visibility",
	"/docs",
	"/docs/getting-started",
	"/changelog",
	"/roadmap",
	"/ai-search",
	"/ai-search/chatgpt",
	"/aeo-for",
	"/aeo-for/agencies",
	"/ai-visibility-tools",
	"/ai-visibility-tools/retired-record",
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
	{ path: "/agent", contentType: "text/markdown", copy: ["# Yonaris agent index", "Current scope"] },
	{ path: "/agent/product", contentType: "text/markdown", copy: ["Current scope"] },
	{ path: "/agent/approach", contentType: "text/markdown", copy: ["Current scope"] },
	{ path: "/agent/research", contentType: "text/markdown", copy: ["Current scope"] },
	{ path: "/agent/company", contentType: "text/markdown", copy: ["Evidence before conclusion.", "Current scope"] },
	{ path: "/agent/geo", contentType: "text/markdown", copy: ["Current scope"] },
	{ path: "/agent/diagnostic", contentType: "text/markdown", copy: ["Current scope"] },
	{ path: "/llms.txt", contentType: "text/plain", copy: ["Know how AI represents your brand"] },
	{ path: "/llms-full.txt", contentType: "text/plain", copy: ["Current scope"] },
	{ path: "/robots.txt", contentType: "text/plain", copy: ["User-agent:"] },
	{ path: "/sitemap.xml", contentType: "xml", copy: ["http://www.sitemaps.org/schemas/sitemap/0.9"] },
	{ path: "/og.png", contentType: "image/png", copy: [] },
];

export const HONEYPOT_LEAD = {
	locale: "en",
	website: "https://example.com",
	brand: "Example",
	market: "Enterprise software",
	question: "How does the market compare Example with its alternatives?",
	competitors: "Alternative One",
	name: "Release Smoke",
	email: "release-smoke@example.com",
	consent: true,
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
		collectHtmlAssets(body, routeUrl, baseUrl, assetUrls);
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

	for (const route of [...CORE_ROUTES, ...GOVERNED_HTML_ROUTES])
		await checkReadableRoute(route, baseUrl, failures, assetUrls);
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
			if (response.status !== 200 || !contentType.startsWith("text/markdown") || !body.includes("Current scope")) {
				failures.push(`MARKDOWN ${route.path}: expected 200 text/markdown with Current scope`);
			}
		} catch (error) {
			failures.push(`ERR MARKDOWN ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
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
	const routeCount = CORE_ROUTES.length + GOVERNED_HTML_ROUTES.length + MACHINE_ROUTES.length;
	console.log(
		`${routeCount} routes, ${MANUAL_REDIRECTS.length} redirects, and ${assetUrls.size} same-origin assets passed.`,
	);
	return { routes: routeCount, redirects: MANUAL_REDIRECTS.length, assets: assetUrls.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runMarketingSmoke(process.argv[2], { policy: process.argv.includes("--caddy") ? "caddy" : "direct" });
}
