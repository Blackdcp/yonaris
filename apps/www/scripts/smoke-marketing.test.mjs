import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { runMarketingSmoke } from "./smoke-marketing.mjs";

test("release smoke rejects a stylesheet referenced by HTML when it returns 404", async () => {
	const server = createServer((request, response) => {
		if (request.url === "/assets/site.css") {
			response.writeHead(404).end("missing");
			return;
		}
		const bodies = {
			"/": '<html><head><link rel="stylesheet" href="/assets/site.css"></head><body>MarTech, rebuilt. For humans and agents.</body></html>',
			"/zh": "重构 MarTech 同时面向人，也面向智能体",
			"/platform": "Market understanding, made observable.",
			"/diagnostic": "Start with one question that matters.",
			"/agent": "One set of facts. Two readable surfaces.",
			"/agent/company": "AI-native MarTech",
			"/llms.txt": "For humans and agents",
		};
		const body = bodies[request.url];
		if (!body) {
			response.writeHead(404).end("missing");
			return;
		}
		response.writeHead(200, { "Content-Type": request.url.startsWith("/agent/") ? "text/markdown" : request.url === "/llms.txt" ? "text/plain" : "text/html" }).end(body);
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.equal(typeof address, "object");
	try {
		await assert.rejects(() => runMarketingSmoke(`http://127.0.0.1:${address.port}/`), /404 \/assets\/site\.css/);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
});
