import { describe, expect, it } from "vitest";
import {
	DIAGNOSTIC_API_PATH,
	DIAGNOSTIC_IDEMPOTENCY_HEADER,
	parseDiagnosticIdempotencyKey,
	toResendIdempotencyKey,
} from "./diagnostic-api-protocol";

const UUID = "018f47a2-4b6e-7d8c-9a10-12b3c4d5e6f7";

describe("diagnostic API protocol", () => {
	it("publishes one shared endpoint and idempotency header", () => {
		expect(DIAGNOSTIC_API_PATH).toBe("/api/diagnostic");
		expect(DIAGNOSTIC_IDEMPOTENCY_HEADER).toBe("Idempotency-Key");
	});

	it("accepts one canonical UUID and derives the exact Resend key", () => {
		expect(parseDiagnosticIdempotencyKey(UUID)).toEqual({ success: true, data: UUID });
		expect(toResendIdempotencyKey(UUID)).toBe(`diagnostic/${UUID}`);
	});

	it.each([
		null,
		"",
		"not-a-uuid",
		` ${UUID}`,
		`${UUID} `,
		`${UUID},${UUID}`,
		"018F47A2-4B6E-7D8C-9A10-12B3C4D5E6F7",
		"018f47a24b6e7d8c9a1012b3c4d5e6f7",
		"018f47a2-4b6e-0d8c-9a10-12b3c4d5e6f7",
		"018f47a2-4b6e-7d8c-7a10-12b3c4d5e6f7",
	])("rejects a missing, ambiguous, or non-canonical key: %s", (value) => {
		expect(parseDiagnosticIdempotencyKey(value)).toEqual({ success: false });
	});
});
