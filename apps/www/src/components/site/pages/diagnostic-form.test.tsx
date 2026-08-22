import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiagnosticForm } from "./diagnostic-form";

describe("DiagnosticForm", () => {
	it.each([
		{
			locale: "en" as const,
			scope: "1 / Scope",
			contact: "2 / Contact",
			privacy: "How we handle diagnostic request data",
		},
		{ locale: "zh" as const, scope: "1 / 范围", contact: "2 / 联系", privacy: "我们如何处理诊断申请信息" },
	])("renders the authored $locale stages and request contract", ({ locale, scope, contact, privacy }) => {
		const markup = renderToStaticMarkup(<DiagnosticForm locale={locale} initialWebsite="https://acme.example" />);

		expect(markup).toContain(scope);
		expect(markup).toContain(contact);
		expect(markup).toContain('aria-current="step"');
		expect(markup).toContain('name="companyUrl"');
		expect(markup).toContain('href="/privacy"');
		expect(markup).toContain(privacy);
		expect(markup).toContain('value="https://acme.example"');
		expect(markup).not.toContain("Opening a draft sends nothing");
		expect(markup).not.toContain("打开草稿不会发送任何信息");
	});
});
