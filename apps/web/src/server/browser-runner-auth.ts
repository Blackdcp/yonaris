import { createHash, timingSafeEqual } from "node:crypto";
import type { z } from "zod";

export interface BrowserRunnerPrincipal {
	id: string;
	market: "CN";
	locale: "zh-CN";
	timezone: "Asia/Shanghai";
}

export class BrowserRunnerHttpError extends Error {
	constructor(
		public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 503,
		message: string,
	) {
		super(message);
		this.name = "BrowserRunnerHttpError";
	}
}

export function browserRunnerEnabled(): boolean {
	if (process.env.BROWSER_RUNNER_ENABLED?.trim().toLowerCase() !== "true") return false;
	const configured = process.env.BROWSER_RUNNER_API_TOKEN?.trim();
	const runnerId = process.env.BROWSER_RUNNER_ID?.trim();
	if (!configured || configured.length < 32 || !validRunnerId(runnerId)) return false;
	if (
		process.env.BROWSER_RUNNER_MARKET?.trim() !== "CN" ||
		process.env.BROWSER_RUNNER_LOCALE?.trim() !== "zh-CN" ||
		process.env.BROWSER_RUNNER_TIMEZONE?.trim() !== "Asia/Shanghai"
	) {
		return false;
	}
	return !(process.env.ADMIN_API_KEYS ?? "")
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean)
		.some((token) => equalToken(token, configured));
}

export function requireBrowserRunner(request: Request): BrowserRunnerPrincipal {
	if (!browserRunnerEnabled()) throw new BrowserRunnerHttpError(503, "Browser Runner is disabled or not ready");
	const configured = process.env.BROWSER_RUNNER_API_TOKEN?.trim();
	if (!configured || configured.length < 32) {
		throw new BrowserRunnerHttpError(503, "Browser Runner credentials are not configured");
	}
	const runnerId = process.env.BROWSER_RUNNER_ID?.trim();
	if (!validRunnerId(runnerId)) {
		throw new BrowserRunnerHttpError(503, "Browser Runner principal is not configured");
	}
	const adminTokens = (process.env.ADMIN_API_KEYS ?? "")
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);
	if (adminTokens.some((token) => equalToken(token, configured))) {
		throw new BrowserRunnerHttpError(503, "Browser Runner credential must not be an admin credential");
	}
	const authorization = request.headers.get("Authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(authorization);
	if (!match?.[1] || !equalToken(match[1].trim(), configured)) {
		throw new BrowserRunnerHttpError(401, "Valid Browser Runner bearer token required");
	}
	return { id: runnerId, market: "CN", locale: "zh-CN", timezone: "Asia/Shanghai" };
}

export async function parseBrowserRunnerJson<T>(
	request: Request,
	schema: z.ZodType<T>,
	options: { maxBytes?: number } = {},
): Promise<T> {
	const maxBytes = options.maxBytes ?? 1024 * 1024;
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 6 * 1024 * 1024) {
		throw new Error("Browser Runner JSON maxBytes must be between 1 byte and 6 MiB");
	}
	const rawLength = request.headers.get("Content-Length");
	if (rawLength && (!/^\d+$/.test(rawLength) || Number(rawLength) > maxBytes)) {
		throw new BrowserRunnerHttpError(413, `JSON request body exceeds ${maxBytes} bytes`);
	}
	const encoding = request.headers.get("Content-Encoding")?.trim().toLowerCase();
	if (encoding && encoding !== "identity") {
		throw new BrowserRunnerHttpError(415, "Compressed JSON request bodies are not supported");
	}
	if (!request.body) throw new BrowserRunnerHttpError(400, "Request body is required");
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			byteLength += value.byteLength;
			if (byteLength > maxBytes) {
				await reader.cancel("JSON body too large").catch(() => undefined);
				throw new BrowserRunnerHttpError(413, `JSON request body exceeds ${maxBytes} bytes`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	} catch (error) {
		if (error instanceof BrowserRunnerHttpError) throw error;
		throw new BrowserRunnerHttpError(400, "Request body must be valid JSON");
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
		throw new BrowserRunnerHttpError(400, message);
	}
	return parsed.data as T;
}

function validRunnerId(value: string | undefined): value is string {
	return Boolean(value && value.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(value));
}

export function browserRunnerErrorResponse(error: unknown): Response {
	if (error instanceof BrowserRunnerHttpError) {
		return Response.json(
			{ error: error.name, message: error.message },
			{ status: error.status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
		);
	}
	const name = error instanceof Error ? error.name : "BrowserRunnerError";
	if (name === "BrowserRunnerStateError" || name === "DeliveryTaskLeaseError") {
		return Response.json(
			{ error: name, message: error instanceof Error ? error.message : "Browser Runner state conflict" },
			{ status: 409, headers: { "Cache-Control": "no-store" } },
		);
	}
	console.error("Browser Runner request failed:", error);
	return Response.json(
		{ error: "BrowserRunnerError", message: "The Browser Runner request could not be completed" },
		{ status: 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
	);
}

function equalToken(left: string, right: string): boolean {
	const leftDigest = createHash("sha256").update(left).digest();
	const rightDigest = createHash("sha256").update(right).digest();
	return timingSafeEqual(leftDigest, rightDigest);
}
