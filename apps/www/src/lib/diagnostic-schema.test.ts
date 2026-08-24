import { describe, expect, it } from "vitest";
import { parseDiagnosticLead, parseDiagnosticSearch } from "./diagnostic-schema";

const globalLead = {
	locale: "en",
	name: "Ava Chen",
	email: "ava@acme.example",
	company: "Acme",
	companyUrl: "",
} as const;

const chinaLead = {
	locale: "zh",
	name: "陈晓",
	phone: "+86 138 0013 8000",
	company: "示例科技",
	companyUrl: "",
} as const;

describe("regional diagnostic lead schema", () => {
	it("accepts exactly name, work email, and company for the global form", () => {
		expect(parseDiagnosticLead(globalLead)).toMatchObject({ success: true, data: globalLead });
		expect(parseDiagnosticLead({ ...globalLead, phone: "13800138000" }).success).toBe(false);
		expect(parseDiagnosticLead({ ...globalLead, email: "not-an-email" }).success).toBe(false);
	});

	it("accepts exactly name, phone, and company for the China form", () => {
		expect(parseDiagnosticLead(chinaLead)).toMatchObject({ success: true, data: chinaLead });
		expect(parseDiagnosticLead({ ...chinaLead, email: "chen@example.com" }).success).toBe(false);
		for (const phone of ["abc", "123", "13800138000\nBcc:test@example.com"]) {
			expect(parseDiagnosticLead({ ...chinaLead, phone }).success, phone).toBe(false);
		}
	});

	it("trims submitted fields and rejects unknown fields or a filled honeypot", () => {
		expect(parseDiagnosticLead({ ...globalLead, name: " Ava Chen ", company: " Acme " })).toMatchObject({
			success: true,
			data: { name: "Ava Chen", company: "Acme" },
		});
		expect(parseDiagnosticLead({ ...globalLead, website: "https://acme.example" }).success).toBe(false);
		expect(parseDiagnosticLead({ ...globalLead, companyUrl: "https://bot.example" }).success).toBe(false);
	});
});

describe("diagnostic search compatibility", () => {
	it("keeps only a validated absolute website prefill during the transition", () => {
		expect(parseDiagnosticSearch({ website: " https://acme.example " })).toEqual({ website: "https://acme.example" });
		expect(parseDiagnosticSearch({ website: "acme.example" })).toEqual({ website: "" });
	});
});
