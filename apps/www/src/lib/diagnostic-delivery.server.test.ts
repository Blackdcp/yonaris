import { describe, expect, it, vi } from "vitest";
import { createDiagnosticLeadHandler, sendLeadWithResend } from "./diagnostic-delivery.server";
import type { DiagnosticLead } from "./diagnostic-schema";

const idempotencyKey = "0198ef3d-34e1-7f14-a74d-e09b66d14b11";
const env = {
	RESEND_API_KEY: "re_test",
	RESEND_FROM_EMAIL: "Yonaris <leads@yonaris.com>",
	MARKETING_LEAD_RECIPIENT: "team@yonaris.com",
};
const globalLead: DiagnosticLead = { locale: "en", name: "Ava Chen", email: "ava@acme.example", company: "Acme", companyUrl: "" };
const chinaLead: DiagnosticLead = { locale: "zh", name: "陈晓", phone: "13800138000", company: "示例科技", companyUrl: "" };

function request(body: unknown, headers: Record<string, string> = {}): Request {
	return new Request("https://www.yonaris.com/api/diagnostic", {
		method: "POST",
		headers: {
			Origin: "https://www.yonaris.com",
			"Sec-Fetch-Site": "same-origin",
			"Content-Type": "application/json",
			"Idempotency-Key": idempotencyKey,
			...headers,
		},
		body: JSON.stringify(body),
	});
}

describe("regional lead handler", () => {
	it("accepts a strict lead only after provider delivery resolves", async () => {
		const deliver = vi.fn(async () => undefined);
		const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver, now: () => 1_700_000_000_000 });
		const response = await handler(request(globalLead));
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true });
		expect(deliver).toHaveBeenCalledWith({ lead: globalLead, env, idempotencyKey });
	});

	it("rejects cross-origin and non-contract payloads before delivery", async () => {
		const deliver = vi.fn(async () => undefined);
		const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver, now: () => 1_700_000_000_000 });
		expect((await handler(request(globalLead, { Origin: "https://attacker.example" }))).status).toBe(403);
		expect((await handler(request({ ...globalLead, website: "https://acme.example" }))).status).toBe(400);
		expect(deliver).not.toHaveBeenCalled();
	});

	it("fails closed when delivery configuration is absent", async () => {
		const handler = createDiagnosticLeadHandler({ getEnv: () => ({}), deliver: vi.fn(), now: () => 1_700_000_000_000 });
		expect((await handler(request(chinaLead))).status).toBe(503);
	});
});

describe("Resend regional delivery", () => {
	it("sends global email as reply-to and keeps all approved fields", async () => {
		let payload: Record<string, unknown> | undefined;
		const fetchImpl: typeof fetch = async (_input, init) => {
			payload = JSON.parse(String(init?.body));
			return new Response('{"id":"email_1"}', { status: 200 });
		};
		await sendLeadWithResend({ lead: globalLead, env, idempotencyKey }, fetchImpl);
		expect(payload).toMatchObject({
			to: ["team@yonaris.com"],
			reply_to: "ava@acme.example",
			subject: "Yonaris global website lead / Acme",
		});
		expect(String(payload?.text)).toContain("Name: Ava Chen");
		expect(String(payload?.text)).toContain("Work email: ava@acme.example");
		expect(String(payload?.text)).toContain("Company: Acme");
	});

	it("sends China phone leads without inventing a reply-to address", async () => {
		let payload: Record<string, unknown> | undefined;
		const fetchImpl: typeof fetch = async (_input, init) => {
			payload = JSON.parse(String(init?.body));
			return new Response('{"id":"email_2"}', { status: 200 });
		};
		await sendLeadWithResend({ lead: chinaLead, env, idempotencyKey }, fetchImpl);
		expect(payload).not.toHaveProperty("reply_to");
		expect(payload?.subject).toBe("Yonaris 中国官网留资 / 示例科技");
		expect(String(payload?.text)).toContain("电话：13800138000");
	});
});
