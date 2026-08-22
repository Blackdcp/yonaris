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

	it("renders independently authored validation and honest mailto-only copy without raw Zod messages", () => {
		const english = renderToStaticMarkup(<DiagnosticForm locale="en" />);
		const chinese = renderToStaticMarkup(<DiagnosticForm locale="zh" />);

		expect(english).toContain("Enter the full website URL, including http:// or https://.");
		expect(english).toContain("Open email draft");
		expect(english).toContain("Opening a draft sends nothing until you send it from your email client.");
		expect(english).toContain("How we handle diagnostic request data");
		expect(english).not.toContain("Request the diagnostic");
		expect(english).not.toContain("Submitting requests a Yonaris team scope review");
		expect(chinese).toContain("请输入完整网址，包括 http:// 或 https://。");
		expect(chinese).toContain("打开邮件草稿");
		expect(chinese).toContain("打开草稿不会发送任何信息；只有你在邮件客户端中主动发送后，邮件才会发出。");
		expect(chinese).toContain("我们如何处理诊断申请信息");
		expect(chinese).not.toContain("提交后将由 Yonaris 团队审核范围");
		for (const markup of [english, chinese]) {
			expect(markup).not.toMatch(/Invalid input|Too small|Invalid URL|Invalid email|invalid_website/);
			expect(markup).not.toContain("#9f290f");
			const websiteErrorClass = markup.match(/id="diagnostic-website-error" class="([^"]+)"/)?.[1];
			expect(websiteErrorClass).toContain("border-[var(--yonaris-signal)]");
			expect(websiteErrorClass).toContain("text-[var(--yonaris-ink)]");
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
