#!/usr/bin/env node

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:3000/");
const requiredCopy = ["Product Truth", "black.dcp@outlook.com"];

async function fetchWithTimeout(url, attempts = 1) {
	let lastError;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10_000),
			});

			if (response.ok || attempt === attempts) {
				return response;
			}

			lastError = new Error(`${response.status} ${response.statusText}`);
		} catch (error) {
			lastError = error;
		}

		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}

	throw lastError;
}

function sameOriginAsset(reference, parentUrl = baseUrl) {
	const normalizedReference = reference?.trim();

	if (!normalizedReference || normalizedReference.startsWith("data:") || normalizedReference.startsWith("blob:")) {
		return undefined;
	}

	const assetUrl = new URL(normalizedReference, parentUrl);
	assetUrl.hash = "";

	return assetUrl.origin === baseUrl.origin ? assetUrl : undefined;
}

const homeResponse = await fetchWithTimeout(baseUrl, 30);

if (!homeResponse.ok) {
	throw new Error(`Homepage returned ${homeResponse.status} ${homeResponse.statusText}`);
}

const html = await homeResponse.text();

for (const copy of requiredCopy) {
	if (!html.includes(copy)) {
		throw new Error(`Homepage is missing required copy: ${copy}`);
	}
}

const assetUrls = new Map();

for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
	const assetUrl = sameOriginAsset(match[1]);
	if (assetUrl) assetUrls.set(assetUrl.href, assetUrl);
}

if (![...assetUrls.values()].some((url) => url.pathname.endsWith(".css"))) {
	throw new Error("Homepage does not reference a stylesheet");
}

const failures = [];
const stylesheets = [];

for (const assetUrl of assetUrls.values()) {
	try {
		const response = await fetchWithTimeout(assetUrl);
		if (!response.ok) {
			failures.push(`${response.status} ${assetUrl.pathname}`);
			continue;
		}

		if (assetUrl.pathname.endsWith(".css")) {
			stylesheets.push({ url: assetUrl, css: await response.text() });
		} else {
			await response.arrayBuffer();
		}

		console.log(`${response.status} ${assetUrl.pathname}`);
	} catch (error) {
		failures.push(`ERR ${assetUrl.pathname}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

for (const { url, css } of stylesheets) {
	for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
		const assetUrl = sameOriginAsset(match[1], url);
		if (!assetUrl || assetUrls.has(assetUrl.href)) continue;

		assetUrls.set(assetUrl.href, assetUrl);

		try {
			const response = await fetchWithTimeout(assetUrl);
			if (!response.ok) {
				failures.push(`${response.status} ${assetUrl.pathname}`);
				continue;
			}

			await response.arrayBuffer();
			console.log(`${response.status} ${assetUrl.pathname}`);
		} catch (error) {
			failures.push(`ERR ${assetUrl.pathname}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

if (failures.length > 0) {
	throw new Error(`Marketing asset smoke failed:\n${failures.join("\n")}`);
}

console.log(`Homepage and ${assetUrls.size} same-origin assets passed.`);
