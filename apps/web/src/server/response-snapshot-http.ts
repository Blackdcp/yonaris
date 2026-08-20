import type { ResponseSnapshotAssetName } from "@workspace/lib/response-snapshots/storage";
import { RESPONSE_SNAPSHOT_PREVIEW_CSP } from "../server-security-headers";
import { ResponseSnapshotAccessError } from "./response-snapshots";

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,299}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export type ResponseSnapshotAppAssetName = ResponseSnapshotAssetName | "screenshot";

export class ResponseSnapshotHttpError extends Error {
	constructor(
		public readonly status: 400 | 401 | 403 | 404 | 409 | 410 | 500 | 503,
		message: string,
	) {
		super(message);
		this.name = "ResponseSnapshotHttpError";
	}
}

export function parseResponseSnapshotAssetSelector(url: URL): {
	asset: ResponseSnapshotAppAssetName;
	download: boolean;
} {
	const keys = [...url.searchParams.keys()];
	if (keys.some((key) => key !== "asset" && key !== "download")) {
		throw new ResponseSnapshotHttpError(400, "Unknown response snapshot query parameter");
	}
	if (url.searchParams.getAll("asset").length !== 1 || url.searchParams.getAll("download").length !== 1) {
		throw new ResponseSnapshotHttpError(400, "asset and download must each be provided exactly once");
	}
	const asset = url.searchParams.get("asset");
	const download = url.searchParams.get("download");
	if (asset !== "html" && asset !== "json" && asset !== "manifest" && asset !== "screenshot") {
		throw new ResponseSnapshotHttpError(400, "asset must be html, json, manifest, or screenshot");
	}
	if (download !== "0" && download !== "1") {
		throw new ResponseSnapshotHttpError(400, "download must be 0 or 1");
	}
	return { asset, download: download === "1" };
}

export function attachmentContentDisposition(fileName: string): string {
	if (!SAFE_FILE_NAME.test(fileName)) throw new ResponseSnapshotHttpError(500, "Unsafe response snapshot filename");
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function buildResponseSnapshotAssetHeaders(input: {
	asset: ResponseSnapshotAppAssetName;
	download: boolean;
	contentType: string;
	contentEncoding: "gzip" | null;
	sha256: string;
	storedBytes: number;
	fileName?: string;
}): Headers {
	if (!SHA256_PATTERN.test(input.sha256) || !Number.isSafeInteger(input.storedBytes) || input.storedBytes < 1) {
		throw new ResponseSnapshotHttpError(500, "Response snapshot metadata is invalid");
	}
	const headers = new Headers({
		"Cache-Control": "private, no-store",
		"Content-Length": String(input.storedBytes),
		"Content-Type": input.contentType,
		ETag: `"${input.sha256}"`,
		"X-Content-Type-Options": "nosniff",
		"X-Yonaris-SHA256": input.sha256,
	});
	if (input.contentEncoding) headers.set("Content-Encoding", input.contentEncoding);
	if (input.asset === "html" && !input.download) {
		headers.set("Content-Security-Policy", RESPONSE_SNAPSHOT_PREVIEW_CSP);
	}
	if (input.download) {
		if (!input.fileName) throw new ResponseSnapshotHttpError(500, "Response snapshot filename is required");
		headers.set("Content-Disposition", attachmentContentDisposition(input.fileName));
	}
	return headers;
}

export function responseSnapshotErrorResponse(error: unknown): Response {
	if (error instanceof ResponseSnapshotHttpError) {
		return jsonError(error.status, error.message);
	}
	if (error instanceof ResponseSnapshotAccessError) {
		const status = {
			unauthorized: 401,
			forbidden: 403,
			not_found: 404,
			pending: 409,
			expired: 410,
		}[error.code] as 401 | 403 | 404 | 409 | 410;
		return jsonError(status, error.message);
	}
	console.error("Response snapshot request failed:", error);
	return jsonError(500, "The response snapshot could not be served");
}

function jsonError(status: number, message: string): Response {
	return Response.json(
		{ error: "ResponseSnapshotError", message },
		{ status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
	);
}
