export const DIAGNOSTIC_API_PATH = "/api/diagnostic";
export const DIAGNOSTIC_IDEMPOTENCY_HEADER = "Idempotency-Key";

export type DiagnosticApiErrorCode =
	| "invalid_request"
	| "invalid_idempotency_key"
	| "forbidden_request"
	| "unsupported_media_type"
	| "payload_too_large"
	| "rate_limited"
	| "service_unavailable"
	| "delivery_unconfirmed";

export type DiagnosticApiResponse = { ok: true } | { ok: false; code: DiagnosticApiErrorCode };

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function parseDiagnosticIdempotencyKey(
	value: string | null,
): { success: true; data: string } | { success: false } {
	if (value === null || !CANONICAL_UUID.test(value)) return { success: false };
	return { success: true, data: value };
}

export function toResendIdempotencyKey(uuid: string): `diagnostic/${string}` {
	return `diagnostic/${uuid}`;
}
