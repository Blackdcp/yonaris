import assert from "node:assert/strict";
import test from "node:test";
import {
	isPublicAddress,
	type ProxyResolver,
	parseApprovedProxyAuthority,
	parseProxyHostList,
	parseProxyRequestHead,
	resolveApprovedProxyTarget,
} from "./egress-proxy.js";

const APPROVED = new Set(["www.doubao.com", "lf-flow-web-cdn.doubao.com"]);
const CONTROL = new Set(["portal.yonaris.com"]);

test("accepts an approved HTTPS CONNECT authority and preserves the hostname", () => {
	assert.deepEqual(parseApprovedProxyAuthority("www.doubao.com:443", APPROVED), {
		hostname: "www.doubao.com",
		port: 443,
	});
});

test("rejects non-approved hosts, IP literals, credentials, and non-HTTPS ports", () => {
	for (const authority of [
		"example.com:443",
		"127.0.0.1:443",
		"[::1]:443",
		"user@www.doubao.com:443",
		"www.doubao.com:80",
	]) {
		assert.throws(() => parseApprovedProxyAuthority(authority, APPROVED));
	}
});

test("resolves approved CDN hostnames at request time instead of freezing startup addresses", async () => {
	let addresses = ["36.151.17.10"];
	const resolver: ProxyResolver = async (hostname) =>
		hostname === "portal.yonaris.com" ? ["149.71.241.139"] : addresses;
	assert.equal(
		(await resolveApprovedProxyTarget("lf-flow-web-cdn.doubao.com:443", APPROVED, CONTROL, resolver)).address,
		"36.151.17.10",
	);
	addresses = ["223.113.138.135"];
	assert.equal(
		(await resolveApprovedProxyTarget("lf-flow-web-cdn.doubao.com:443", APPROVED, CONTROL, resolver)).address,
		"223.113.138.135",
	);
});

test("rejects an approved hostname when DNS resolves to private, metadata, reserved, or control-plane space", async () => {
	for (const address of [
		"127.0.0.1",
		"10.0.0.1",
		"100.64.0.1",
		"169.254.169.254",
		"192.168.1.1",
		"::1",
		"fd00::1",
		"fe80::1",
		"149.71.241.139",
	]) {
		const resolver: ProxyResolver = async (hostname) =>
			hostname === "portal.yonaris.com" ? ["149.71.241.139"] : [address];
		await assert.rejects(
			resolveApprovedProxyTarget("www.doubao.com:443", APPROVED, CONTROL, resolver),
			/public|control/i,
		);
	}
});

test("rejects mixed public and unsafe DNS answers rather than selecting the public subset", async () => {
	const resolver: ProxyResolver = async () => ["36.152.70.141", "169.254.169.254"];
	await assert.rejects(resolveApprovedProxyTarget("www.doubao.com:443", APPROVED, CONTROL, resolver), /public/i);
});

test("fails closed when a configured control-plane hostname cannot be resolved", async () => {
	const resolver: ProxyResolver = async (hostname) => {
		if (hostname === "portal.yonaris.com") throw new Error("dns unavailable");
		return ["36.152.70.141"];
	};
	await assert.rejects(
		resolveApprovedProxyTarget("www.doubao.com:443", APPROVED, CONTROL, resolver),
		/dns unavailable/,
	);
});

test("accepts only a bounded HTTP CONNECT request without proxy credentials", () => {
	assert.equal(
		parseProxyRequestHead("CONNECT www.doubao.com:443 HTTP/1.1\r\nHost: www.doubao.com:443\r\n\r\n"),
		"www.doubao.com:443",
	);
	for (const request of [
		"GET https://www.doubao.com/ HTTP/1.1\r\n\r\n",
		"CONNECT www.doubao.com:443 HTTP/1.0\r\n\r\n",
		"CONNECT www.doubao.com:443 HTTP/1.1\r\nProxy-Authorization: Basic abc\r\n\r\n",
		`CONNECT www.doubao.com:443 HTTP/1.1\r\nX-Pad: ${"x".repeat(8_192)}\r\n\r\n`,
	]) {
		assert.throws(() => parseProxyRequestHead(request));
	}
});

test("loads exact hostname allowlists and rejects wildcard or malformed entries", () => {
	assert.deepEqual(
		[...parseProxyHostList("# Doubao\nwww.doubao.com\nLF-FLOW-WEB-CDN.DOUBAO.COM\n\n", false)],
		["www.doubao.com", "lf-flow-web-cdn.doubao.com"],
	);
	assert.deepEqual(
		[...parseProxyHostList("portal.yonaris.com\n149.71.241.139\n", true)],
		["portal.yonaris.com", "149.71.241.139"],
	);
	for (const content of ["*.doubao.com\n", "https://www.doubao.com\n", "127.0.0.1\n"]) {
		assert.throws(() => parseProxyHostList(content, false));
	}
});

test("IPv4 documentation ranges are rejected without blocking adjacent public addresses", () => {
	assert.equal(isPublicAddress("198.51.100.1"), false);
	assert.equal(isPublicAddress("203.0.113.1"), false);
	assert.equal(isPublicAddress("192.0.0.1"), false);
	assert.equal(isPublicAddress("198.51.99.1"), true);
	assert.equal(isPublicAddress("203.0.114.1"), true);
	assert.equal(isPublicAddress("192.0.1.1"), true);
});
