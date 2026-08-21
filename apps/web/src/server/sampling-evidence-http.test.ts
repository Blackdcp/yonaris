import { describe, expect, it } from "vitest";
import {
	attachmentContentDisposition,
	parseSamplingEvidenceUploadHeaders,
	readRequestBodyWithinLimit,
	requireExplicitSameOrigin,
	SAMPLING_EVIDENCE_HEADERS,
	SamplingEvidenceHttpError,
	samplingEvidenceErrorResponse,
} from "./sampling-evidence-http";

const CLAIM_HEADERS = {
	[SAMPLING_EVIDENCE_HEADERS.brandId]: "brand-1",
	[SAMPLING_EVIDENCE_HEADERS.taskId]: "10000000-0000-4000-8000-000000000001",
	[SAMPLING_EVIDENCE_HEADERS.leaseToken]: "lease-token-that-is-at-least-32-bytes",
	[SAMPLING_EVIDENCE_HEADERS.leaseGeneration]: "2",
	[SAMPLING_EVIDENCE_HEADERS.kind]: "screenshot",
	[SAMPLING_EVIDENCE_HEADERS.fileName]: encodeURIComponent("运行证据.png"),
	[SAMPLING_EVIDENCE_HEADERS.runnerSessionId]: "runner-session-1",
	[SAMPLING_EVIDENCE_HEADERS.adapterVersion]: "doubao-web-20260821-localpc-v11",
};

function request(headers: HeadersInit, body?: BodyInit): Request {
	return new Request("https://portal.example.test/api/admin/sampling/evidence", {
		method: "POST",
		headers,
		body,
	});
}

describe("sampling evidence HTTP contract", () => {
	it("parses the lease claim and URI-encoded filename headers", () => {
		expect(parseSamplingEvidenceUploadHeaders(request(CLAIM_HEADERS, "content"))).toEqual({
			brandId: "brand-1",
			taskId: "10000000-0000-4000-8000-000000000001",
			leaseToken: "lease-token-that-is-at-least-32-bytes",
			leaseGeneration: 2,
			kind: "screenshot",
			fileName: "运行证据.png",
			runnerSessionId: "runner-session-1",
			adapterVersion: "doubao-web-20260821-localpc-v11",
		});
	});

	it("accepts the Browser Runner HTML page-snapshot header contract", () => {
		expect(
			parseSamplingEvidenceUploadHeaders(
				request({
					...CLAIM_HEADERS,
					[SAMPLING_EVIDENCE_HEADERS.kind]: "page_snapshot",
					[SAMPLING_EVIDENCE_HEADERS.fileName]: encodeURIComponent("page.html"),
					"Content-Type": "text/html; charset=utf-8",
				}),
			),
		).toMatchObject({ kind: "page_snapshot", fileName: "page.html" });
	});

	it("requires an explicit configured same-origin request", () => {
		const valid = request({ ...CLAIM_HEADERS, Origin: "https://portal.example.test", "Sec-Fetch-Site": "same-origin" });
		expect(() => requireExplicitSameOrigin(valid, "https://portal.example.test")).not.toThrow();

		const missingOrigin = request(CLAIM_HEADERS);
		expect(() => requireExplicitSameOrigin(missingOrigin, "https://portal.example.test")).toThrow(
			SamplingEvidenceHttpError,
		);

		const crossOrigin = request({ ...CLAIM_HEADERS, Origin: "https://attacker.example" });
		expect(() => requireExplicitSameOrigin(crossOrigin, "https://portal.example.test")).toThrow(
			"Cross-origin evidence requests are forbidden",
		);
	});

	it("enforces both declared and streamed byte limits", async () => {
		await expect(
			readRequestBodyWithinLimit(request({ ...CLAIM_HEADERS, "Content-Length": "9" }, new Uint8Array(9)), 8),
		).rejects.toMatchObject({ status: 413 });

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4]));
				controller.enqueue(new Uint8Array([5, 6, 7, 8, 9]));
				controller.close();
			},
		});
		const streamedRequest = new Request("https://portal.example.test/api/admin/sampling/evidence", {
			method: "POST",
			headers: CLAIM_HEADERS,
			body: stream,
			duplex: "half",
		} as RequestInit & { duplex: "half" });
		await expect(readRequestBodyWithinLimit(streamedRequest, 8)).rejects.toMatchObject({ status: 413 });
	});

	it("builds an attachment disposition without trusting raw filename syntax", () => {
		const disposition = attachmentContentDisposition("证据\"O'Brien.png");
		expect(disposition).toContain('filename="___O\'Brien.png"');
		expect(disposition).toContain("filename*=UTF-8''");
		expect(disposition).toContain("O%27Brien.png");
		expect(disposition).not.toContain('filename="证据');
	});

	it("returns an explicit HTTP error without exposing unknown failures", async () => {
		const tooLarge = samplingEvidenceErrorResponse(new SamplingEvidenceHttpError(413, "Evidence is too large"));
		expect(tooLarge.status).toBe(413);
		expect(await tooLarge.json()).toEqual({
			error: "SamplingEvidenceHttpError",
			message: "Evidence is too large",
		});

		const originalConsoleError = console.error;
		console.error = () => undefined;
		try {
			const unknown = samplingEvidenceErrorResponse(new Error("database password should stay private"));
			expect(unknown.status).toBe(500);
			expect(await unknown.text()).not.toContain("database password");
		} finally {
			console.error = originalConsoleError;
		}
	});
});
