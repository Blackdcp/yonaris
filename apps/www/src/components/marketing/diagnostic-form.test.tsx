import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Route as EnglishDiagnosticRoute } from "@/routes/diagnostic";
import { Route as ChineseDiagnosticRoute } from "@/routes/zh/diagnostic";
import { DiagnosticForm } from "./diagnostic-form";

describe("DiagnosticForm", () => {
	it("renders the canonical field order, homepage prefill, consent, honeypot, and separate Privacy link", () => {
		const markup = renderToStaticMarkup(<DiagnosticForm locale="en" initialWebsite="https://acme.example" />);

		expect(markup).toContain('value="https://acme.example"');
		const fieldOrder = ["website", "brand", "market", "question", "competitors", "name", "email", "consent"];
		let previousIndex = -1;
		for (const field of fieldOrder) {
			const index = markup.indexOf(`name="${field}"`);
			expect(index, `${field} must be rendered`).toBeGreaterThan(previousIndex);
			previousIndex = index;
		}
		expect(markup).toContain('name="companyUrl"');
		expect(markup).toContain('value=""');
		expect(markup).toContain('href="/privacy"');

		const consentInput = markup.indexOf('name="consent"');
		const consentLabelClose = markup.indexOf("</label>", consentInput);
		const privacyLink = markup.indexOf('href="/privacy"');
		expect(privacyLink).toBeGreaterThan(consentLabelClose);
	});

	it("renders independently authored validation and submission copy without raw Zod messages", () => {
		const english = renderToStaticMarkup(<DiagnosticForm locale="en" />);
		const chinese = renderToStaticMarkup(<DiagnosticForm locale="zh" />);

		expect(english).toContain("Enter an absolute http or https website.");
		expect(english).toContain("Request a free diagnostic");
		expect(english).toContain("How we handle diagnostic request data");
		expect(chinese).toContain("请输入以 http 或 https 开头的完整网址。");
		expect(chinese).toContain("申请免费诊断");
		expect(chinese).toContain("我们如何处理诊断申请信息");
		for (const markup of [english, chinese]) {
			expect(markup).not.toMatch(/Invalid input|Too small|Invalid URL|Invalid email|invalid_website/);
		}
	});
});

describe("diagnostic route search", () => {
	it.each([EnglishDiagnosticRoute, ChineseDiagnosticRoute])(
		"returns an empty website for absent, non-string, or malformed search values",
		(route) => {
			const validateSearch = route.options.validateSearch as (search: Record<string, unknown>) => { website: string };

			expect(validateSearch({})).toEqual({ website: "" });
			expect(validateSearch({ website: ["https://acme.example"] })).toEqual({ website: "" });
			expect(validateSearch({ website: "acme" })).toEqual({ website: "" });
			expect(validateSearch({ website: "https://user:secret@acme.example" })).toEqual({ website: "" });
			expect(validateSearch({ website: "https://acme.example" })).toEqual({ website: "https://acme.example" });
		},
	);
});
