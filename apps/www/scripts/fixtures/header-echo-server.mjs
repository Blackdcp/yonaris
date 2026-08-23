import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);

createServer((request, response) => {
	response
		.writeHead(200, {
			"Cache-Control": "no-store",
			"Content-Type": "application/json; charset=utf-8",
		})
		.end(
			JSON.stringify({
				method: request.method,
				path: request.url,
				clientIp: request.headers["x-yonaris-client-ip"] ?? null,
				cloudflareIp: request.headers["cf-connecting-ip"] ?? null,
			}),
		);
}).listen(port, "0.0.0.0");
