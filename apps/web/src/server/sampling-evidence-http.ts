const HEADER_PREFIX = "X-Yonaris-";

export const SAMPLING_EVIDENCE_HEADERS = {
	brandId: `${HEADER_PREFIX}Brand-Id`,
	taskId: `${HEADER_PREFIX}Task-Id`,
	leaseToken: `${HEADER_PREFIX}Lease-Token`,
	leaseGeneration: `${HEADER_PREFIX}Lease-Generation`,
	kind: `${HEADER_PREFIX}Evidence-Kind`,
	fileName: `${HEADER_PREFIX}Filename`,
	runnerSessionId: `${HEADER_PREFIX}Runner-Session-Id`,
	adapterVersion: `${HEADER_PREFIX}Adapter-Version`,
} as const;

export const SAMPLING_EVIDENCE_KINDS = ["screenshot", "page_snapshot"] as const;

export type SamplingEvidenceKind = (typeof SAMPLING_EVIDENCE_KINDS)[number];

export interface SamplingEvidenceClaimHeaders {
	brandId: string;
	taskId: string;
	leaseToken: string;
	leaseGeneration: number;
}

export interface SamplingEvidenceUploadHeaders extends SamplingEvidenceClaimHeaders {
	kind: SamplingEvidenceKind;
	fileName: string;
	runnerSessionId?: string;
	adapterVersion?: string;
}

export class SamplingEvidenceHttpError extends Error {
	constructor(
		public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415,
		message: string,
	) {
		super(message);
		this.name = "SamplingEvidenceHttpError";
	}
}

function requiredHeader(request: Request, name: string, maxLength: number): string {
	const value = request.headers.get(name)?.trim();
	if (!value) throw new SamplingEvidenceHttpError(400, `${name} header is required`);
	if (value.length > maxLength) throw new SamplingEvidenceHttpError(400, `${name} header is too long`);
	return value;
}

function optionalHeader(request: Request, name: string, maxLength: number): string | undefined {
	const value = request.headers.get(name)?.trim();
	if (!value) return undefined;
	if (value.length > maxLength) throw new SamplingEvidenceHttpError(400, `${name} header is too long`);
	return value;
}

function parseGuid(value: string, headerName: string): string {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
		throw new SamplingEvidenceHttpError(400, `${headerName} must be a GUID`);
	}
	return value;
}

function decodeFileName(value: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		throw new SamplingEvidenceHttpError(400, `${SAMPLING_EVIDENCE_HEADERS.fileName} must be URI encoded`);
	}
	const fileName = decoded.trim();
	if (!fileName || fileName.length > 255) {
		throw new SamplingEvidenceHttpError(400, "Evidence filename must contain between 1 and 255 characters");
	}
	const hasUnsupportedCharacter = Array.from(fileName).some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint <= 0x1f || codePoint === 0x7f || character === "/" || character === "\\";
	});
	if (fileName === "." || fileName === ".." || hasUnsupportedCharacter) {
		throw new SamplingEvidenceHttpError(400, "Evidence filename contains unsupported characters");
	}
	return fileName;
}

export function requireExplicitSameOrigin(request: Request, configuredAppUrl = process.env.APP_URL): void {
	const origin = request.headers.get("Origin");
	if (!origin) throw new SamplingEvidenceHttpError(403, "Origin header is required");

	let expectedOrigin: string;
	try {
		expectedOrigin = new URL(configuredAppUrl || request.url).origin;
	} catch {
		throw new Error("APP_URL must be a valid absolute URL");
	}
	if (origin !== expectedOrigin)
		throw new SamplingEvidenceHttpError(403, "Cross-origin evidence requests are forbidden");

	const fetchSite = request.headers.get("Sec-Fetch-Site");
	if (fetchSite && fetchSite !== "same-origin") {
		throw new SamplingEvidenceHttpError(403, "Cross-site evidence requests are forbidden");
	}
}

export function parseSamplingEvidenceClaimHeaders(request: Request): SamplingEvidenceClaimHeaders {
	const brandId = requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.brandId, 300);
	const taskId = parseGuid(
		requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.taskId, 64),
		SAMPLING_EVIDENCE_HEADERS.taskId,
	);
	const leaseToken = requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.leaseToken, 500);
	if (leaseToken.length < 32) {
		throw new SamplingEvidenceHttpError(400, `${SAMPLING_EVIDENCE_HEADERS.leaseToken} is invalid`);
	}
	const rawGeneration = requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.leaseGeneration, 20);
	if (!/^\d+$/.test(rawGeneration)) {
		throw new SamplingEvidenceHttpError(400, `${SAMPLING_EVIDENCE_HEADERS.leaseGeneration} must be a positive integer`);
	}
	const leaseGeneration = Number(rawGeneration);
	if (!Number.isSafeInteger(leaseGeneration) || leaseGeneration <= 0) {
		throw new SamplingEvidenceHttpError(400, `${SAMPLING_EVIDENCE_HEADERS.leaseGeneration} must be a positive integer`);
	}
	return { brandId, taskId, leaseToken, leaseGeneration };
}

export function parseSamplingEvidenceUploadHeaders(request: Request): SamplingEvidenceUploadHeaders {
	const claim = parseSamplingEvidenceClaimHeaders(request);
	const kind = requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.kind, 50);
	if (!SAMPLING_EVIDENCE_KINDS.includes(kind as SamplingEvidenceKind)) {
		throw new SamplingEvidenceHttpError(400, `${SAMPLING_EVIDENCE_HEADERS.kind} is not supported`);
	}
	const fileName = decodeFileName(requiredHeader(request, SAMPLING_EVIDENCE_HEADERS.fileName, 1_000));
	const runnerSessionId = optionalHeader(request, SAMPLING_EVIDENCE_HEADERS.runnerSessionId, 300);
	const adapterVersion = optionalHeader(request, SAMPLING_EVIDENCE_HEADERS.adapterVersion, 100);
	return { ...claim, kind: kind as SamplingEvidenceKind, fileName, runnerSessionId, adapterVersion };
}

export async function readRequestBodyWithinLimit(request: Request, maxBytes: number): Promise<Uint8Array> {
	if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("maxBytes must be a positive integer");

	const contentEncoding = request.headers.get("Content-Encoding")?.trim().toLowerCase();
	if (contentEncoding && contentEncoding !== "identity") {
		throw new SamplingEvidenceHttpError(415, "Compressed evidence request bodies are not supported");
	}

	const rawContentLength = request.headers.get("Content-Length");
	if (rawContentLength !== null) {
		if (!/^\d+$/.test(rawContentLength)) {
			throw new SamplingEvidenceHttpError(400, "Content-Length must be a non-negative integer");
		}
		const declaredLength = Number(rawContentLength);
		if (!Number.isSafeInteger(declaredLength)) {
			throw new SamplingEvidenceHttpError(400, "Content-Length is invalid");
		}
		if (declaredLength > maxBytes)
			throw new SamplingEvidenceHttpError(413, `Evidence exceeds the ${maxBytes} byte limit`);
	}

	if (!request.body) throw new SamplingEvidenceHttpError(400, "Evidence request body is required");
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			totalBytes += value.byteLength;
			if (totalBytes > maxBytes) {
				await reader.cancel("Evidence body too large").catch(() => undefined);
				throw new SamplingEvidenceHttpError(413, `Evidence exceeds the ${maxBytes} byte limit`);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	if (totalBytes === 0) throw new SamplingEvidenceHttpError(400, "Evidence request body must not be empty");
	const content = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		content.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return content;
}

function asciiFileName(fileName: string): string {
	const fallback = fileName
		.replace(/[^\x20-\x7e]/g, "_")
		.replace(/["\\]/g, "_")
		.trim();
	return fallback || "evidence";
}

function encodeRfc5987Value(value: string): string {
	return encodeURIComponent(value).replace(
		/['()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

export function attachmentContentDisposition(fileName: string): string {
	return `attachment; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${encodeRfc5987Value(fileName)}`;
}

export function samplingEvidenceErrorResponse(error: unknown): Response {
	if (error instanceof SamplingEvidenceHttpError) {
		return Response.json(
			{ error: error.name, message: error.message },
			{
				status: error.status,
				headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
			},
		);
	}
	console.error("Sampling evidence request failed:", error);
	return Response.json(
		{ error: "SamplingEvidenceError", message: "The evidence request could not be completed" },
		{
			status: 500,
			headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
		},
	);
}
