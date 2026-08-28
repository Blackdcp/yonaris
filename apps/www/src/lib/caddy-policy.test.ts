import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SITE_MANIFEST, SITE_REDIRECTS } from "./site-manifest";

const caddyDirectory = fileURLToPath(new URL("../../../../deploy/las/caddy/", import.meta.url));
const activePath = `${caddyDirectory}/yonaris-marketing.caddy`;
const predecessorPath = `${caddyDirectory}/yonaris-marketing-v2.caddy`;
const rangesPath = `${caddyDirectory}/cloudflare-ip-ranges.json`;

const activeFragment = readFileSync(activePath, "utf8");

function readOptional(path: string): string {
	return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function namedMatcher(name: string): string {
	const lines = activeFragment.split(/\r?\n/u);
	const start = lines.findIndex((line) => line.trim() === `@${name} {`);
	if (start === -1) return "";

	let depth = 0;
	for (let index = start; index < lines.length; index += 1) {
		for (const character of lines[index] ?? "") {
			if (character === "{") depth += 1;
			if (character === "}") depth -= 1;
		}
		if (index > start && depth === 0) return lines.slice(start + 1, index).join("\n");
	}
	return "";
}

function proxyBlock(name: string): string {
	const lines = activeFragment.split(/\r?\n/u);
	const start = lines.findIndex((line) => line.trim().startsWith(`reverse_proxy @${name} `));
	if (start === -1) return "";
	if (!lines[start]?.includes("{")) return lines[start] ?? "";

	let depth = 0;
	for (let index = start; index < lines.length; index += 1) {
		for (const character of lines[index] ?? "") {
			if (character === "{") depth += 1;
			if (character === "}") depth -= 1;
		}
		if (depth === 0) return lines.slice(start, index + 1).join("\n");
	}
	return "";
}

function directiveTokens(block: string, directive: string): string[] {
	return block
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter((line) => line.startsWith(`${directive} `))
		.flatMap((line) => line.slice(directive.length + 1).split(/\s+/u));
}

const exactCloudflareRanges = {
	ipv4: [
		"173.245.48.0/20",
		"103.21.244.0/22",
		"103.22.200.0/22",
		"103.31.4.0/22",
		"141.101.64.0/18",
		"108.162.192.0/18",
		"190.93.240.0/20",
		"188.114.96.0/20",
		"197.234.240.0/22",
		"198.41.128.0/17",
		"162.158.0.0/15",
		"104.16.0.0/13",
		"104.24.0.0/14",
		"172.64.0.0/13",
		"131.0.72.0/22",
	],
	ipv6: [
		"2400:cb00::/32",
		"2606:4700::/32",
		"2803:f800::/32",
		"2405:b500::/32",
		"2405:8100::/32",
		"2a06:98c0::/29",
		"2c0f:f248::/32",
	],
};

describe("the production apex Caddy policy", () => {
	test("preserves the reviewed v2 predecessor byte-for-byte", () => {
		const predecessor = readOptional(predecessorPath);
		expect(predecessor).not.toBe("");
		expect(createHash("sha256").update(predecessor).digest("hex").toUpperCase()).toBe(
			"6F1F6DD9F3CE91318D037F0E0328EAC4C41BDD90FB942835204408CA669F09C4",
		);
	});

	test("uses the exact reviewed Cloudflare address snapshot", () => {
		const snapshotText = readOptional(rangesPath);
		expect(snapshotText).not.toBe("");
		const snapshot = snapshotText ? JSON.parse(snapshotText) : {};
		expect(snapshot).toMatchObject({
			source: {
				ipv4: "https://www.cloudflare.com/ips-v4",
				ipv6: "https://www.cloudflare.com/ips-v6",
			},
			reviewedAt: "2026-08-22",
			...exactCloudflareRanges,
		});
		expect(directiveTokens(namedMatcher("diagnosticCloudflare"), "remote_ip")).toEqual([
			...exactCloudflareRanges.ipv4,
			...exactCloudflareRanges.ipv6,
		]);
	});

	test("proxies the manifest-derived GET and HEAD surface without broad private matchers", () => {
		const excludedManifestKeys = new Set(["api", "markdownInternal"]);
		const expectedPaths = new Set<string>();
		for (const route of SITE_MANIFEST) {
			if (excludedManifestKeys.has(route.key)) continue;
			for (const canonical of Object.values(route.canonicals)) expectedPaths.add(canonical);
			for (const pattern of "patterns" in route ? (route.patterns ?? []) : []) expectedPaths.add(pattern);
		}
		for (const redirect of SITE_REDIRECTS) expectedPaths.add(redirect.from);
		for (const path of [
			"/zh/",
			"/product/",
			"/zh/product/",
			"/approach/",
			"/zh/approach/",
			"/company/",
			"/zh/company/",
			"/geo/",
			"/zh/geo/",
			"/diagnostic/",
			"/zh/diagnostic/",
			"/privacy/",
			"/zh/privacy/",
		]) {
			expectedPaths.add(path);
		}
		for (const path of [
			"/assets/*",
			"/brand/logos/yonaris-wordmark-navy.png",
			"/brand/logos/yonaris-wordmark-white.png",
			"/brand/site-06/*",
			"/icons/*",
			"/apple-touch-icon.png",
			"/favicon.ico",
			"/site.webmanifest",
		]) {
			expectedPaths.add(path);
		}

		expect(new Set(directiveTokens(namedMatcher("publicGetHead"), "path"))).toEqual(expectedPaths);
		expect(directiveTokens(namedMatcher("publicGetHead"), "method")).toEqual(["GET", "HEAD"]);
		expect(activeFragment).not.toMatch(/(?:^|\s)\/api\/\*(?:\s|$)/u);
		expect(activeFragment).not.toMatch(/(?:^|\s)\/zh\/\*(?:\s|$)/u);
		expect(activeFragment).not.toMatch(/(?:^|\s)\/diagnostic\/\*(?:\s|$)/u);
		expect(activeFragment).not.toMatch(/(?:^|\s)\/brand\/\*(?:\s|$)/u);
		expect(activeFragment).not.toContain("trusted_proxies");
	});

	test("keeps every public API matcher method-specific and fail-closed", () => {
		expect(directiveTokens(namedMatcher("diagnosticCloudflare"), "method")).toEqual(["POST"]);
		expect(directiveTokens(namedMatcher("diagnosticCloudflare"), "path")).toEqual(["/api/diagnostic"]);
		expect(directiveTokens(namedMatcher("diagnosticDirect"), "method")).toEqual(["POST"]);
		expect(directiveTokens(namedMatcher("diagnosticDirect"), "path")).toEqual(["/api/diagnostic"]);
		expect(directiveTokens(namedMatcher("diagnosticDirect"), "remote_ip")).toEqual([]);
		expect(directiveTokens(namedMatcher("diagnosticDirect"), "header")).toEqual([]);
		expect(directiveTokens(namedMatcher("publicApiGetHead"), "method")).toEqual(["GET", "HEAD"]);
		expect(directiveTokens(namedMatcher("publicApiGetHead"), "path")).toEqual(["/api/plausible/js/script"]);
		expect(directiveTokens(namedMatcher("plausibleEvent"), "method")).toEqual(["POST"]);
		expect(directiveTokens(namedMatcher("plausibleEvent"), "path")).toEqual(["/api/plausible/event"]);
		const proxyMatchers = [...activeFragment.matchAll(/^\s*reverse_proxy\s+@(\S+)\s+/gmu)].map((match) => match[1]);
		expect(proxyMatchers).toEqual([
			"diagnosticCloudflare",
			"diagnosticDirect",
			"publicApiGetHead",
			"plausibleEvent",
			"publicGetHead",
		]);
		expect(activeFragment.match(/^\s*respond 404\s*$/gmu)).toHaveLength(1);
		expect(activeFragment.trimEnd()).toMatch(/\n\s*respond 404\n\s*\}\n\}$/u);
	});

	test("rebuilds diagnostic identity and strips identity from every other upstream", () => {
		const trusted = proxyBlock("diagnosticCloudflare");
		const direct = proxyBlock("diagnosticDirect");
		const publicApi = proxyBlock("publicApiGetHead");
		const plausible = proxyBlock("plausibleEvent");
		const publicGet = proxyBlock("publicGetHead");

		expect(trusted).toContain("header_up X-Yonaris-Client-IP {http.request.header.CF-Connecting-IP}");
		expect(trusted).not.toContain("header_up -X-Yonaris-Client-IP");
		expect(trusted).toContain("header_up -CF-Connecting-IP");
		expect(direct).toContain("header_up X-Yonaris-Client-IP {http.request.remote.host}");
		expect(direct).not.toContain("header_up -X-Yonaris-Client-IP");
		expect(direct).toContain("header_up -CF-Connecting-IP");
		for (const block of [publicApi, plausible, publicGet]) {
			expect(block).toContain("header_up -X-Yonaris-Client-IP");
			expect(block).toContain("header_up -CF-Connecting-IP");
			expect(block).not.toMatch(/header_up X-Yonaris-Client-IP\s/u);
		}

		const order = [
			"reverse_proxy @diagnosticCloudflare",
			"reverse_proxy @diagnosticDirect",
			"reverse_proxy @publicApiGetHead",
			"reverse_proxy @plausibleEvent",
			"reverse_proxy @publicGetHead",
			"respond 404",
		].map((needle) => activeFragment.indexOf(needle));
		expect(order.every((position) => position >= 0)).toBe(true);
		expect(order).toEqual([...order].sort((left, right) => left - right));
	});
});
