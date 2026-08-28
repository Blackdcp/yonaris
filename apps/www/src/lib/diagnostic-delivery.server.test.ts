import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createDiagnosticLeadHandler, sendLeadWithResend } from "./diagnostic-delivery.server";
import type { DiagnosticLead } from "./diagnostic-schema";

const idempotencyKey = "0198ef3d-34e1-7f14-a74d-e09b66d14b11";
const env = {
	RESEND_API_KEY: "re_test",
	RESEND_FROM_EMAIL: "Yonaris <leads@yonaris.com>",
	MARKETING_LEAD_RECIPIENT: "team@yonaris.com",
};
const globalLead: DiagnosticLead = {
	locale: "en",
	name: "Ava Chen",
	email: "ava@acme.example",
	company: "Acme",
	companyUrl: "",
	requestType: "consultation",
};
const chinaLead: DiagnosticLead = {
	locale: "zh",
	name: "陈晓",
	phone: "13800138000",
	company: "示例科技",
	companyUrl: "",
	requestType: "consultation",
};
const { requestType: _requestType, ...globalLeadWithoutRequestType } = globalLead;

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
		const response = await handler(request(globalLeadWithoutRequestType));
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({ ok: true });
		expect(deliver).toHaveBeenCalledWith({ lead: { ...globalLead, requestType: "consultation" }, env, idempotencyKey });
	});

	it("accepts only the allowlisted privacy request type and defaults missing values to consultation", async () => {
		const deliver = vi.fn(async () => undefined);
		const handler = createDiagnosticLeadHandler({ getEnv: () => env, deliver, now: () => 1_700_000_000_000 });
		expect((await handler(request({ ...globalLead, requestType: "privacy" }))).status).toBe(202);
		expect(deliver).toHaveBeenLastCalledWith({
			lead: { ...globalLead, requestType: "privacy" },
			env,
			idempotencyKey,
		});
		expect((await handler(request({ ...globalLead, requestType: "deletion" }))).status).toBe(400);
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

	it("marks privacy requests clearly in the subject and body without changing normal consultation mail", async () => {
		const payloads: Record<string, unknown>[] = [];
		const fetchImpl: typeof fetch = async (_input, init) => {
			payloads.push(JSON.parse(String(init?.body)));
			return new Response('{"id":"email_privacy"}', { status: 200 });
		};
		await sendLeadWithResend({ lead: { ...globalLead, requestType: "consultation" }, env, idempotencyKey }, fetchImpl);
		await sendLeadWithResend({ lead: { ...globalLead, requestType: "privacy" }, env, idempotencyKey }, fetchImpl);
		await sendLeadWithResend({ lead: { ...chinaLead, requestType: "privacy" }, env, idempotencyKey }, fetchImpl);

		expect(payloads[0]?.subject).toBe("Yonaris global website lead / Acme");
		expect(String(payloads[0]?.text)).not.toMatch(/privacy request|manual privacy action/i);
		expect(payloads[1]?.subject).toBe("Yonaris privacy request / Acme");
		expect(String(payloads[1]?.text)).toContain("Request type: Privacy/deletion request");
		expect(String(payloads[1]?.text)).toContain("Manual privacy action requested");
		expect(payloads[2]?.subject).toBe("Yonaris 隐私请求 / 示例科技");
		expect(String(payloads[2]?.text)).toContain("请求类型：隐私/删除请求");
		expect(String(payloads[2]?.text)).toContain("需要人工处理隐私请求");
	});
});

describe("privacy request operations", () => {
	it("documents a manual, minimal-data workflow without an automated SLA promise", () => {
		const sop = readFileSync(
			new URL("../../../../docs/operations/marketing-privacy-request-sop.md", import.meta.url),
			"utf8",
		);
		expect(sop).toContain("submitted contact and company details");
		expect(sop).toContain("marketing recipient mailbox");
		expect(sop).toContain("Resend message records or logs");
		expect(sop).toContain("submitted contact channel");
		expect(sop).toContain("minimal completion record");
		expect(sop).toContain("does not promise a fixed completion time");
		expect(sop).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	});
});
