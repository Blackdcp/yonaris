#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const REQUIRED_ROUTES = [
	{ path: "/", copy: ["MarTech, rebuilt.", "For humans and agents."], contentType: "text/html" },
	{ path: "/zh", copy: ["重构 MarTech", "同时面向人，也面向智能体"], contentType: "text/html" },
	{ path: "/platform", copy: ["Market understanding, made observable."], contentType: "text/html" },
	{ path: "/diagnostic", copy: ["Start with one question that matters."], contentType: "text/html" },
	{ path: "/agent", copy: ["One set of facts.", "Two readable surfaces."], contentType: "text/html" },
	{ path: "/agent/company", copy: ["AI-native MarTech", "Current scope"], contentType: "text/markdown" },
	{ path: "/llms.txt", copy: ["For humans and agents"], contentType: "text/plain" },
];

async function fetchWithTimeout(url, attempts = 1) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
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
	if (!normalizedReference || normalizedReference.startsWith("data:") || normalizedReference.startsWith("blob:")) return undefined;
	const assetUrl = new URL(normalizedReference, parentUrl);
	assetUrl.hash = "";
	return assetUrl.origin === baseUrl.origin ? assetUrl : undefined;
}

function collectHtmlAssets(html, parentUrl, baseUrl, assetUrls) {
	for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
		const assetUrl = sameOriginAsset(match[1], baseUrl, parentUrl);
		if (assetUrl && !assetUrl.pathname.endsWith(".html") && !assetUrl.pathname.endsWith("/")) assetUrls.set(assetUrl.href, assetUrl);
	}
}

export async function runMarketingSmoke(inputUrl = "http://127.0.0.1:3000/") {
	const baseUrl = new URL(inputUrl);
	const failures = [];
	const assetUrls = new Map();

	for (const route of REQUIRED_ROUTES) {
		const routeUrl = new URL(route.path, baseUrl);
		try {
			const response = await fetchWithTimeout(routeUrl, route.path === "/" ? 30 : 1);
			if (!response.ok) {
				failures.push(`${response.status} ${route.path}`);
				continue;
			}
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.startsWith(route.contentType)) failures.push(`TYPE ${route.path}: expected ${route.contentType}, received ${contentType || "none"}`);
			const body = await response.text();
			for (const copy of route.copy) if (!body.includes(copy)) failures.push(`COPY ${route.path}: ${copy}`);
			if (route.contentType === "text/html") collectHtmlAssets(body, routeUrl, baseUrl, assetUrls);
			console.log(`${response.status} ${route.path}`);
		} catch (error) {
			failures.push(`ERR ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	if (![...assetUrls.values()].some((url) => url.pathname.endsWith(".css"))) failures.push("Homepage does not reference a stylesheet");

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
		for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
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

	if (failures.length > 0) throw new Error(`Marketing smoke failed:\n${failures.join("\n")}`);
	console.log(`${REQUIRED_ROUTES.length} routes and ${assetUrls.size} same-origin assets passed.`);
	return { routes: REQUIRED_ROUTES.length, assets: assetUrls.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runMarketingSmoke(process.argv[2]);
}
