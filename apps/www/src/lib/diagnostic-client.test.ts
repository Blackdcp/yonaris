import { describe, expect, it } from "vitest";
import { diagnosticLeadFingerprint, resolveDiagnosticRequestIdentity, submitDiagnosticRequest } from "./diagnostic-client";
import type { DiagnosticLead } from "./diagnostic-schema";

const lead: DiagnosticLead = {
	locale: "en",
	name: "Ava Chen",
	email: "ava@acme.example",
	company: "Acme",
	companyUrl: "",
	requestType: "consultation",
};

describe("submitDiagnosticRequest", () => {
	it("posts the exact regional lead and confirms only an accepted provider response", async () => {
		let captured: RequestInit | undefined;
		const fetchImpl: typeof fetch = async (_input, init) => {
			captured = init;
			return new Response('{"ok":true}', { status: 202 });
		};
		await expect(submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", { fetchImpl })).resolves.toEqual({ status: "confirmed" });
		expect(JSON.parse(String(captured?.body))).toEqual(lead);
		expect(new Headers(captured?.headers).get("Idempotency-Key")).toBe("0198ef3d-34e1-7f14-a74d-e09b66d14b11");
	});

	it.each([200, 400, 503])("keeps a %s response unconfirmed", async (status) => {
		const fetchImpl: typeof fetch = async () => new Response('{"ok":true}', { status });
		await expect(submitDiagnosticRequest(lead, "0198ef3d-34e1-7f14-a74d-e09b66d14b11", { fetchImpl })).resolves.toEqual({ status: "unconfirmed" });
	});
});

describe("diagnostic request identity", () => {
	it("fingerprints normalized regional fields and reuses an idempotency key", () => {
		const fingerprint = diagnosticLeadFingerprint(lead);
		expect(fingerprint).toBe(
			'{"locale":"en","name":"Ava Chen","email":"ava@acme.example","company":"Acme","companyUrl":"","requestType":"consultation"}',
		);
		expect(diagnosticLeadFingerprint({ ...lead, name: " Ava Chen " })).toBe(fingerprint);
		expect(diagnosticLeadFingerprint({ ...lead, requestType: "privacy" })).not.toBe(fingerprint);
		const first = resolveDiagnosticRequestIdentity(null, lead, () => "0198ef3d-34e1-7f14-a74d-e09b66d14b11");
		const retry = resolveDiagnosticRequestIdentity(first, { ...lead, company: " Acme " }, () => "unexpected");
		expect(retry).toEqual(first);
	});
});
