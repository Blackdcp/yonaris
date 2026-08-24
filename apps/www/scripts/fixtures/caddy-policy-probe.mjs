import assert from "node:assert/strict";

const [mode, origin, firstIdentity, secondIdentity, expectedDirectIdentity] = process.argv.slice(2);
assert.ok(["trusted-v4", "trusted-v6", "direct"].includes(mode), `unsupported probe mode: ${mode}`);
assert.ok(origin, "missing probe origin");

async function request(path, { method = "GET", headers = {} } = {}) {
	return fetch(new URL(path, origin), {
		method,
		redirect: "manual",
		headers,
		signal: AbortSignal.timeout(10_000),
	});
}

async function diagnostic(headers) {
	const response = await request("/api/diagnostic", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...headers },
	});
	assert.equal(response.status, 200);
	return response.json();
}

if (mode.startsWith("trusted")) {
	const first = await diagnostic({ "CF-Connecting-IP": firstIdentity, "X-Yonaris-Client-IP": "203.0.113.250" });
	const second = await diagnostic({ "CF-Connecting-IP": secondIdentity, "X-Yonaris-Client-IP": "203.0.113.251" });
	assert.equal(first.clientIp, firstIdentity);
	assert.equal(second.clientIp, secondIdentity);
	assert.notEqual(first.clientIp, second.clientIp);
	assert.equal(first.cloudflareIp, null);
	assert.equal(second.cloudflareIp, null);
} else {
	const first = await diagnostic({ "CF-Connecting-IP": firstIdentity, "X-Yonaris-Client-IP": secondIdentity });
	const second = await diagnostic({ "CF-Connecting-IP": secondIdentity, "X-Yonaris-Client-IP": firstIdentity });
	assert.equal(first.clientIp, expectedDirectIdentity);
	assert.equal(second.clientIp, expectedDirectIdentity);
	assert.equal(first.cloudflareIp, null);
	assert.equal(second.cloudflareIp, null);

	const allowed = [
		["GET", "/"],
		["HEAD", "/zh/product"],
		["GET", "/company"],
		["GET", "/status"],
		["GET", "/agent/product"],
		["GET", "/og/status.png"],
		["GET", "/api/plausible/js/script"],
		["POST", "/api/plausible/event"],
	];
	for (const [method, path] of allowed) {
		const response = await request(path, { method });
		assert.equal(response.status, 200, `${method} ${path} should reach the upstream`);
	}

	const denied = [
		["GET", "/api/diagnostic"],
		["POST", "/api/openapi.json"],
		["GET", "/api/plausible/event"],
		["POST", "/product"],
		["GET", "/api"],
		["GET", "/api/private"],
		["GET", "/api/openapi.json"],
		["HEAD", "/api/search"],
		["GET", "/api/repo-activity/refresh"],
		["GET", "/blog/probe"],
		["GET", "/docs/probe"],
		["GET", "/answer-presence-tools/probe"],
		["GET", "/authors/probe.png"],
		["GET", "/llms.mdx/docs/intro"],
		["GET", "/llms.mdx/site/company"],
		["GET", "/zh/not-a-public-route"],
		["GET", "/diagnostic/not-a-public-route"],
	];
	for (const [method, path] of denied) {
		const response = await request(path, { method });
		assert.equal(response.status, 404, `${method} ${path} should be rejected directly by Caddy`);
	}
}
