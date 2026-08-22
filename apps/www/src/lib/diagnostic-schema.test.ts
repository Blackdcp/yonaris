import { describe, expect, it } from "vitest";
import {
	buildDiagnosticMailto,
	DIAGNOSTIC_CONTACT_FIELDS,
	DIAGNOSTIC_FALLBACK_RECIPIENT,
	DIAGNOSTIC_LEAD_FIELDS,
	DIAGNOSTIC_SCOPE_FIELDS,
	parseDiagnosticLead,
	parseDiagnosticScope,
	parseDiagnosticSearch,
} from "./diagnostic-schema";

const validScope = {
	website: "https://acme.example",
	brand: "Acme",
	market: "Enterprise software",
	question: "Which platform should a global team choose?",
} as const;

const validLead = {
	locale: "en",
	...validScope,
	competitors: "Northwind, Contoso",
	name: "Ava Chen",
	email: "ava@acme.example",
	consent: true,
	companyUrl: "",
} as const;

function expectFieldFailure(input: Record<string, unknown>, field: string) {
	const result = parseDiagnosticLead(input);
	expect(result.success).toBe(false);
	if (result.success) return;
	expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
}

describe("diagnostic request schema", () => {
	it("publishes the canonical scope and contact field order", () => {
		expect(DIAGNOSTIC_SCOPE_FIELDS).toEqual(["website", "brand", "market", "question"]);
		expect(DIAGNOSTIC_CONTACT_FIELDS).toEqual(["competitors", "name", "email", "consent"]);
		expect(DIAGNOSTIC_LEAD_FIELDS).toEqual([
			"website",
			"brand",
			"market",
			"question",
			"competitors",
			"name",
			"email",
			"consent",
		]);
	});

	it("trims a valid scope and rejects fields outside the four-field contract", () => {
		expect(
			parseDiagnosticScope({
				website: "  https://acme.example/path  ",
				brand: "  Acme  ",
				market: "  Enterprise software  ",
				question: "  Which platform fits this team?  ",
			}),
		).toMatchObject({
			success: true,
			data: {
				website: "https://acme.example/path",
				brand: "Acme",
				market: "Enterprise software",
				question: "Which platform fits this team?",
			},
		});
		expect(parseDiagnosticScope({ ...validScope, extra: "not allowed" }).success).toBe(false);
		expect(parseDiagnosticScope({ ...validScope, locale: "en" }).success).toBe(false);
	});

	it("rejects unknown lead fields and requires locale, identity, scope, contact, and literal consent", () => {
		expect(parseDiagnosticLead(validLead).success).toBe(true);
		for (const field of ["locale", "website", "brand", "market", "question", "name", "email", "consent"] as const) {
			const { [field]: _removed, ...input } = validLead;
			expectFieldFailure(input, field);
		}
		expect(parseDiagnosticLead({ ...validLead, consent: false }).success).toBe(false);
		expect(parseDiagnosticLead({ ...validLead, extra: "not allowed" }).success).toBe(false);
	});

	it("normalizes omitted optional strings but rejects null and non-string values", () => {
		const { competitors: _competitors, companyUrl: _companyUrl, ...required } = validLead;
		expect(parseDiagnosticLead(required)).toMatchObject({
			success: true,
			data: { competitors: "", companyUrl: "" },
		});
		for (const [field, value] of [
			["competitors", null],
			["competitors", ["Northwind"]],
			["companyUrl", null],
			["companyUrl", 42],
		] as const) {
			expectFieldFailure({ ...validLead, [field]: value }, field);
		}
	});

	it("accepts absolute HTTP(S) websites and rejects credentials, malformed values, and other protocols", () => {
		for (const website of [
			"http://acme.example",
			"https://acme.example/path?market=global",
			"https://acme.example/%20market",
		]) {
			expect(parseDiagnosticScope({ ...validScope, website }).success).toBe(true);
		}
		for (const website of [
			"acme.example",
			"/relative",
			"https:acme.example",
			"https:/acme.example",
			"HTTP://acme.example",
			"https://acme.example/market research",
			"https://acme.example/market\nresearch",
			"https://acme.example/market\tresearch",
			"https://acme.example/market\u0000research",
			"ftp://acme.example",
			"mailto:hello@acme.example",
			"https://user@acme.example",
			"https://user:secret@acme.example",
		]) {
			expect(parseDiagnosticScope({ ...validScope, website }).success, website).toBe(false);
		}
	});

	it("enforces every string boundary after trimming", () => {
		const email254 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
		const website300 = "https://e.test/".padEnd(300, "a");
		const accepted = {
			...validLead,
			website: website300,
			brand: "b".repeat(120),
			market: "m".repeat(160),
			question: "q".repeat(2000),
			competitors: "c".repeat(600),
			name: "n".repeat(120),
			email: email254,
		};
		expect(parseDiagnosticLead(accepted).success).toBe(true);

		for (const [field, value] of [
			["website", "https://e.test/".padEnd(301, "a")],
			["brand", "b".repeat(121)],
			["market", "m".repeat(161)],
			["question", "q".repeat(9)],
			["question", "q".repeat(2001)],
			["competitors", "c".repeat(601)],
			["name", "n".repeat(121)],
			["email", `${email254}x`],
			["companyUrl", "https://bot.example"],
		] as const) {
			expectFieldFailure({ ...validLead, [field]: value }, field);
		}
	});
});

describe("diagnostic search prefill", () => {
	it("returns one validated website and rejects ambiguous or unsafe search values", () => {
		expect(parseDiagnosticSearch({ website: "  https://acme.example/path  " })).toEqual({
			website: "https://acme.example/path",
		});
		for (const website of [
			undefined,
			["https://acme.example"],
			"acme.example",
			"https:acme.example",
			"https:/acme.example",
			"https://acme.example/market\nresearch",
			"ftp://acme.example",
			"https://user:secret@acme.example",
		]) {
			expect(parseDiagnosticSearch(website === undefined ? {} : { website })).toEqual({ website: "" });
		}
	});
});

describe("diagnostic email fallback", () => {
	it("revalidates the lead and refuses malformed or bot-filled input", () => {
		expect(buildDiagnosticMailto({ ...validLead, website: "acme.example" })).toBeNull();
		expect(buildDiagnosticMailto({ ...validLead, companyUrl: "https://bot.example" })).toBeNull();
		expect(buildDiagnosticMailto({ ...validLead, extra: "not allowed" })).toBeNull();
	});

	it("creates only an encoded fallback-recipient draft with every visible field", () => {
		const mailto = buildDiagnosticMailto({
			...validLead,
			brand: "Acme\r\nBcc: injected@example.com",
		});
		expect(mailto).not.toBeNull();
		if (!mailto) return;

		const parsed = new URL(mailto);
		expect(parsed.protocol).toBe("mailto:");
		expect(decodeURIComponent(parsed.pathname)).toBe(DIAGNOSTIC_FALLBACK_RECIPIENT);
		const subject = parsed.searchParams.get("subject");
		const body = parsed.searchParams.get("body");
		expect(subject).toBe("Yonaris free diagnostic / Acme Bcc: injected@example.com");
		expect(subject).not.toMatch(/[\r\n]/);
		expect(body).toContain("Locale: en");
		expect(body).toContain("Website: https://acme.example");
		expect(body).toContain("Brand: Acme Bcc: injected@example.com");
		expect(body).toContain("Market or category: Enterprise software");
		expect(body).toContain("Market question: Which platform should a global team choose?");
		expect(body).toContain("Competitors to include: Northwind, Contoso");
		expect(body).toContain("Name: Ava Chen");
		expect(body).toContain("Email: ava@acme.example");
		expect(body).toContain("Consent: yes");
		expect(body).not.toContain("companyUrl");
	});
});
