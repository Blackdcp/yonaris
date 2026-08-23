import { afterEach, describe, expect, it, vi } from "vitest";
import {
	diagnosticLeadFingerprint,
	resolveDiagnosticRequestIdentity,
	submitDiagnosticRequest,
} from "./diagnostic-client";
import type { DiagnosticLead } from "./diagnostic-schema";

const lead: DiagnosticLead = {
	locale: "en",
	website: "https://acme.example",
	brand: "Acme",
	market: "Enterprise software",
	question: "Which platform should a global team choose?",
	competitors: "Example Co",
	name: "Ava Chen",
	email: "ava@acme.example",
	consent: true,
	companyUrl: "",
};

afterEach(() => {
	vi.useRealTimers();
});

describe("submitDiagnosticRequest", () => {
	it("confirms only the shared endpoint's 202 accepted response", async () => {
		let captured: { input: RequestInfo | URL; init?: RequestInit } | undefined;
		const fetchImpl: typeof fetch = async (input, init) => {
			captured = { input, init };
			return new Response('{"ok":true}', {
				status: 202,
				headers: { "content-type": "application/json" },
			});
		};

		await expect(submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", { fetchImpl })).resolves.toEqual(
			{ status: "confirmed" },
		);
		expect(String(captured?.input)).toBe("/api/diagnostic");
		expect(captured?.init?.method).toBe("POST");
		expect(new Headers(captured?.init?.headers).get("Idempotency-Key")).toBe("0198ef3d-34e1-7f14-a74d-e09b66d14b11");
		expect(JSON.parse(String(captured?.init?.body))).toEqual(lead);
	});

	it.each([
		{ status: 200, body: '{"ok":true}' },
		{ status: 202, body: '{"ok":false,"code":"service_unavailable"}' },
		{ status: 202, body: "not json" },
		{ status: 503, body: '{"ok":false,"code":"delivery_unconfirmed"}' },
	])("keeps delivery unconfirmed for $status $body", async ({ status, body }) => {
		const fetchImpl: typeof fetch = async () => new Response(body, { status });
		await expect(submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", { fetchImpl })).resolves.toEqual(
			{ status: "unconfirmed" },
		);
	});

	it("keeps network failures and the client timeout unconfirmed", async () => {
		const failedFetch: typeof fetch = async () => {
			throw new TypeError("network down");
		};
		await expect(
			submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", { fetchImpl: failedFetch }),
		).resolves.toEqual({ status: "unconfirmed" });

		vi.useFakeTimers();
		const pendingFetch: typeof fetch = (_input, init) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
					once: true,
				});
			});
		const request = submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", {
			fetchImpl: pendingFetch,
			timeoutMs: 25,
		});
		await vi.advanceTimersByTimeAsync(25);
		await expect(request).resolves.toEqual({ status: "unconfirmed" });
	});
});

describe("diagnostic request identity", () => {
	it("uses the normalized lead as the stable fingerprint", () => {
		const first = diagnosticLeadFingerprint(lead);
		const trimOnly = diagnosticLeadFingerprint({
			...lead,
			brand: "  Acme  ",
			market: " Enterprise software ",
		});
		const changed = diagnosticLeadFingerprint({ ...lead, market: "Developer tools" });

		expect(first).toBe(
			'{"locale":"en","website":"https://acme.example","brand":"Acme","market":"Enterprise software","question":"Which platform should a global team choose?","competitors":"Example Co","name":"Ava Chen","email":"ava@acme.example","consent":true,"companyUrl":""}',
		);
		expect(trimOnly).toBe(first);
		expect(changed).not.toBe(first);
		expect(diagnosticLeadFingerprint({ ...lead, email: "not-an-email" })).toBeNull();
	});

	it("reuses one UUID for the same normalized lead and rotates only after a material change", () => {
		const generated = ["0198ef3d-34e1-7f14-a74d-e09b66d14b11", "0198ef3d-34e1-7f14-a74d-e09b66d14b12"];
		const createUuid = () => generated.shift() ?? "unexpected";

		const first = resolveDiagnosticRequestIdentity(null, lead, createUuid);
		const retry = resolveDiagnosticRequestIdentity(first, { ...lead, brand: " Acme " }, createUuid);
		const changed = resolveDiagnosticRequestIdentity(retry, { ...lead, market: "Developer tools" }, createUuid);

		expect(first?.idempotencyKey).toBe("0198ef3d-34e1-7f14-a74d-e09b66d14b11");
		expect(retry).toEqual(first);
		expect(changed?.idempotencyKey).toBe("0198ef3d-34e1-7f14-a74d-e09b66d14b12");
		expect(generated).toEqual([]);
	});
});
