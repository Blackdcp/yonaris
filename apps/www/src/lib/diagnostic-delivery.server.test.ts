import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createDiagnosticLeadHandler,
	type DeliverDiagnosticLead,
	DiagnosticDeliveryError,
	readJsonBodyLimited,
	sendLeadWithResend,
} from "./diagnostic-delivery.server";
import type { DiagnosticLead } from "./diagnostic-schema";

const UUID = "018f47a2-4b6e-7d8c-9a10-12b3c4d5e6f7";
const ORIGIN = "https://yonaris.com";
const validLead: DiagnosticLead = {
	locale: "en",
	website: "https://acme.example",
	brand: "Acme",
	market: "Enterprise software",
	question: "Which platform should a global team choose?",
	competitors: "Northwind, Contoso",
	name: "Ava Chen",
	email: "ava@acme.example",
	consent: true,
	companyUrl: "",
};
const validEnv = {
	RESEND_API_KEY: "re_test_secret",
	RESEND_FROM_EMAIL: "Yonaris <diagnostic@yonaris.com>",
	MARKETING_LEAD_RECIPIENT: "black.dcp@outlook.com",
} as const;

function request(input: { body?: BodyInit | null; headers?: Record<string, string>; url?: string } = {}): Request {
	const body = input.body === undefined ? JSON.stringify(validLead) : input.body;
	const init: RequestInit & { duplex?: "half" } = {
		method: "POST",
		headers: {
			Origin: ORIGIN,
			"Sec-Fetch-Site": "same-origin",
			"Content-Type": "application/json",
			"Idempotency-Key": UUID,
			"X-Yonaris-Client-IP": "203.0.113.42",
			...input.headers,
		},
		body,
	};
	if (body instanceof ReadableStream) init.duplex = "half";
	return new Request(input.url ?? `${ORIGIN}/api/diagnostic`, init);
}

function handler(
	input: {
		deliver?: ReturnType<typeof vi.fn<DeliverDiagnosticLead>>;
		env?: Record<string, string | undefined>;
		now?: () => number;
	} = {},
) {
	const deliver = input.deliver ?? vi.fn<DeliverDiagnosticLead>().mockResolvedValue(undefined);
	return {
		deliver,
		handle: createDiagnosticLeadHandler({
			getEnv: () => input.env ?? validEnv,
			deliver,
			now: input.now ?? (() => 1_750_000_000_000),
		}),
	};
}

async function expectJsonError(response: Response, status: number, code: string) {
	expect(response.status).toBe(status);
	expect(await response.json()).toEqual({ ok: false, code });
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(response.headers.get("access-control-allow-origin")).toBeNull();
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("bounded JSON body reader", () => {
	it("parses a chunked UTF-8 JSON body at the byte limit", async () => {
		const bytes = new TextEncoder().encode('{"answer":"\u68ee\u6797"}');
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 7));
				controller.enqueue(bytes.slice(7));
				controller.close();
			},
		});
		const bodyRequest = new Request(`${ORIGIN}/api/diagnostic`, {
			method: "POST",
			body: stream,
			duplex: "half",
		} as RequestInit & { duplex: "half" });
		expect(await readJsonBodyLimited(bodyRequest, bytes.byteLength)).toEqual({ answer: "森林" });
	});

	it("rejects an actual chunked body one byte over the limit", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([123, 34, 97, 34]));
				controller.enqueue(new Uint8Array([58, 49, 125]));
				controller.close();
			},
		});
		const bodyRequest = new Request(`${ORIGIN}/api/diagnostic`, {
			method: "POST",
			body: stream,
			duplex: "half",
		} as RequestInit & { duplex: "half" });
		await expect(readJsonBodyLimited(bodyRequest, 6)).rejects.toMatchObject({ code: "payload_too_large" });
	});

	it("rejects invalid UTF-8 without accepting replacement characters", async () => {
		const bodyRequest = new Request(`${ORIGIN}/api/diagnostic`, {
			method: "POST",
			body: new Uint8Array([123, 34, 97, 34, 58, 34, 0xc3, 0x28, 34, 125]),
		});
		await expect(readJsonBodyLimited(bodyRequest)).rejects.toMatchObject({ code: "invalid_request" });
	});
});

describe("diagnostic request handler", () => {
	it.each([
		[{}, 403, "forbidden_request"],
		[{ Origin: "https://attacker.example" }, 403, "forbidden_request"],
		[{ "Sec-Fetch-Site": "cross-site" }, 403, "forbidden_request"],
		[{ "Content-Type": "text/plain" }, 415, "unsupported_media_type"],
		[{ "Content-Encoding": "gzip" }, 415, "unsupported_media_type"],
		[{ "Idempotency-Key": "invalid" }, 400, "invalid_idempotency_key"],
	] as const)("rejects request metadata before delivery", async (headers, status, code) => {
		const { handle, deliver } = handler();
		const defaultHeaders = !("Origin" in headers) && Object.keys(headers).length === 0 ? { Origin: "" } : headers;
		await expectJsonError(await handle(request({ headers: defaultHeaders })), status, code);
		expect(deliver).not.toHaveBeenCalled();
	});

	it("enforces the declared and streamed 20 KiB limits", async () => {
		const declared = handler();
		await expectJsonError(
			await declared.handle(request({ headers: { "Content-Length": "20481" } })),
			413,
			"payload_too_large",
		);
		expect(declared.deliver).not.toHaveBeenCalled();

		const streamed = handler();
		const oversized = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(20_000).fill(32));
				controller.enqueue(new Uint8Array(481).fill(32));
				controller.close();
			},
		});
		await expectJsonError(await streamed.handle(request({ body: oversized })), 413, "payload_too_large");
		expect(streamed.deliver).not.toHaveBeenCalled();
	});

	it.each([
		["{", "malformed JSON"],
		[JSON.stringify({ ...validLead, extra: "not allowed" }), "unknown schema field"],
		[JSON.stringify({ ...validLead, companyUrl: "https://bot.example" }), "filled honeypot"],
	])("rejects %s as an invalid request", async (body) => {
		const { handle, deliver } = handler();
		await expectJsonError(await handle(request({ body })), 400, "invalid_request");
		expect(deliver).not.toHaveBeenCalled();
	});

	it("uses only the trusted internal IP header for rate limiting", async () => {
		let now = 1_750_000_000_000;
		const { handle, deliver } = handler({ now: () => now });
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const response = await handle(
				request({
					body: "{",
					headers: {
						"X-Yonaris-Client-IP": "not-an-ip",
						"CF-Connecting-IP": `203.0.113.${attempt + 1}`,
						"X-Forwarded-For": `198.51.100.${attempt + 1}`,
					},
				}),
			);
			expect(response.status).toBe(400);
		}
		now += 200_000;
		const limited = await handle(request({ body: "{", headers: { "X-Yonaris-Client-IP": "not-an-ip" } }));
		await expectJsonError(limited, 429, "rate_limited");
		expect(limited.headers.get("retry-after")).toBe("400");
		expect(deliver).not.toHaveBeenCalled();
	});

	it("resets fixed windows and evicts the oldest bucket above the 10,000-IP cap", async () => {
		let now = 1_750_000_000_000;
		const { handle } = handler({ now: () => now });
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect((await handle(request({ body: "{" }))).status).toBe(400);
		}
		expect((await handle(request({ body: "{" }))).status).toBe(429);
		now += 600_000;
		expect((await handle(request({ body: "{" }))).status).toBe(400);

		for (let index = 0; index < 10_001; index += 1) {
			await handle(request({ body: "{", headers: { "X-Yonaris-Client-IP": `2001:db8::${index.toString(16)}` } }));
		}
		for (let attempt = 0; attempt < 5; attempt += 1) {
			expect((await handle(request({ body: "{", headers: { "X-Yonaris-Client-IP": "2001:db8::0" } }))).status).toBe(
				400,
			);
		}
		expect((await handle(request({ body: "{", headers: { "X-Yonaris-Client-IP": "2001:db8::0" } }))).status).toBe(429);
	});

	it("returns service unavailable before delivery when configuration is blank", async () => {
		const { handle, deliver } = handler({ env: { ...validEnv, RESEND_API_KEY: "   " } });
		await expectJsonError(await handle(request()), 503, "service_unavailable");
		expect(deliver).not.toHaveBeenCalled();
	});

	it("applies the documented request-gate order", async () => {
		const first = handler();
		await expectJsonError(
			await first.handle(
				request({
					headers: {
						Origin: "https://attacker.example",
						"Sec-Fetch-Site": "cross-site",
						"Content-Type": "text/plain",
						"Content-Length": "30000",
						"Idempotency-Key": "invalid",
					},
				}),
			),
			403,
			"forbidden_request",
		);
		const second = handler();
		await expectJsonError(
			await second.handle(
				request({
					headers: { "Content-Type": "text/plain", "Content-Length": "30000", "Idempotency-Key": "invalid" },
				}),
			),
			415,
			"unsupported_media_type",
		);
		const third = handler();
		await expectJsonError(
			await third.handle(request({ headers: { "Content-Length": "30000", "Idempotency-Key": "invalid" } })),
			413,
			"payload_too_large",
		);
	});

	it("returns 202 only after delivery resolves and forwards the normalized contract", async () => {
		let resolveDelivery: (() => void) | undefined;
		const deliver = vi.fn<DeliverDiagnosticLead>(
			() =>
				new Promise<void>((resolve) => {
					resolveDelivery = resolve;
				}),
		);
		const { handle } = handler({ deliver });
		let settled = false;
		const responsePromise = handle(
			request({ body: JSON.stringify({ ...validLead, brand: "  Acme  ", competitors: undefined }) }),
		).then((response) => {
			settled = true;
			return response;
		});
		await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
		expect(settled).toBe(false);
		expect(deliver).toHaveBeenCalledWith({
			lead: { ...validLead, brand: "Acme", competitors: "" },
			env: validEnv,
			idempotencyKey: UUID,
		});
		resolveDelivery?.();
		const response = await responsePromise;
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true });
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
	});

	it.each([
		[new DiagnosticDeliveryError("service_unavailable"), "service_unavailable"],
		[new DiagnosticDeliveryError("delivery_unconfirmed"), "delivery_unconfirmed"],
		[new Error("ambiguous"), "delivery_unconfirmed"],
	] as const)("maps delivery errors without reflecting details", async (error, code) => {
		const { handle } = handler({ deliver: vi.fn<DeliverDiagnosticLead>().mockRejectedValue(error) });
		const response = await handle(request());
		const responseText = await response.clone().text();
		await expectJsonError(response, 503, code);
		expect(responseText).not.toContain("ambiguous");
	});

	it("does not log lead values, secrets, or upstream ambiguity", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const { handle } = handler({
			deliver: vi.fn<DeliverDiagnosticLead>().mockRejectedValue(new Error("ava@acme.example re_test_secret")),
		});
		await handle(request());
		expect(consoleError).not.toHaveBeenCalled();
		expect(consoleLog).not.toHaveBeenCalled();
	});
});

describe("Resend diagnostic adapter", () => {
	it("sends deterministic plain text with a scoped idempotency key and no timestamp", async () => {
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
			requests.push({ url: String(url), init: init ?? {} });
			return new Response('{"id":"email_123"}', { status: 200, headers: { "Content-Type": "application/json" } });
		}) as unknown as typeof fetch;

		await sendLeadWithResend({ lead: validLead, env: validEnv, idempotencyKey: UUID }, fetchImpl);
		await sendLeadWithResend({ lead: validLead, env: validEnv, idempotencyKey: UUID }, fetchImpl);

		expect(requests).toHaveLength(2);
		for (const sent of requests) {
			expect(sent.url).toBe("https://api.resend.com/emails");
			expect(sent.init.method).toBe("POST");
			expect(sent.init.headers).toEqual({
				Authorization: "Bearer re_test_secret",
				"Content-Type": "application/json",
				Accept: "application/json",
				"User-Agent": "Yonaris-Diagnostic/1",
				"Idempotency-Key": `diagnostic/${UUID}`,
			});
			const payload = JSON.parse(String(sent.init.body));
			expect(payload).toEqual({
				from: "Yonaris <diagnostic@yonaris.com>",
				to: ["black.dcp@outlook.com"],
				reply_to: "ava@acme.example",
				subject: "Yonaris diagnostic request / Acme",
				text: [
					"Locale: en",
					"Website: https://acme.example",
					"Brand: Acme",
					"Market or category: Enterprise software",
					"Market question: Which platform should a global team choose?",
					"Competitors to include: Northwind, Contoso",
					"Name: Ava Chen",
					"Email: ava@acme.example",
					"Consent: yes",
				].join("\n"),
			});
			expect(String(sent.init.body)).not.toMatch(/companyUrl|timestamp|createdAt/i);
		}
		expect(requests[0]?.init.body).toBe(requests[1]?.init.body);
	});

	it("sanitizes CR/LF from the subject while retaining stable body order", async () => {
		let payload: Record<string, unknown> | undefined;
		const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			payload = JSON.parse(String(init?.body));
			return new Response(null, { status: 202 });
		}) as unknown as typeof fetch;
		await sendLeadWithResend(
			{ lead: { ...validLead, brand: "Acme\r\nBcc: injected@example.com" }, env: validEnv, idempotencyKey: UUID },
			fetchImpl,
		);
		expect(payload?.subject).toBe("Yonaris diagnostic request / Acme Bcc: injected@example.com");
		expect(payload?.subject).not.toMatch(/[\r\n]/);
	});

	it("classifies explicit upstream rejection without reading its body", async () => {
		let bodyRead = false;
		const response = new Response("contains upstream details", { status: 429 });
		const originalText = response.text.bind(response);
		response.text = async () => {
			bodyRead = true;
			return originalText();
		};
		const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
		await expect(
			sendLeadWithResend({ lead: validLead, env: validEnv, idempotencyKey: UUID }, fetchImpl),
		).rejects.toMatchObject({
			code: "service_unavailable",
			message: "service_unavailable",
		});
		expect(bodyRead).toBe(false);
	});

	it("classifies network ambiguity without exposing its message", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("socket failed for ava@acme.example using re_test_secret");
		}) as unknown as typeof fetch;
		await expect(
			sendLeadWithResend({ lead: validLead, env: validEnv, idempotencyKey: UUID }, fetchImpl),
		).rejects.toMatchObject({
			code: "delivery_unconfirmed",
			message: "delivery_unconfirmed",
		});
	});

	it("aborts after ten seconds and classifies the outcome as unconfirmed", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		const fetchImpl = vi.fn(
			async (_url: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					signal = init?.signal ?? undefined;
					signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
				}),
		) as unknown as typeof fetch;
		const delivery = sendLeadWithResend({ lead: validLead, env: validEnv, idempotencyKey: UUID }, fetchImpl);
		const rejection = expect(delivery).rejects.toMatchObject({
			code: "delivery_unconfirmed",
			message: "delivery_unconfirmed",
		});
		await vi.advanceTimersByTimeAsync(10_000);
		await rejection;
		expect(signal?.aborted).toBe(true);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});
