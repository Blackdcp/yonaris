import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiagnosticForm } from "./diagnostic-form";

describe("DiagnosticForm", () => {
	it("renders exactly the three approved global lead fields", () => {
		const markup = renderToStaticMarkup(<DiagnosticForm locale="en" />);
		expect(markup).toContain('name="name"');
		expect(markup).toContain('name="email"');
		expect(markup).toContain('name="company"');
		expect(markup).not.toContain('name="phone"');
		expect(markup).not.toContain('name="website"');
		expect(markup).not.toContain('name="consent"');
		expect(markup).not.toContain("mailto:");
		expect(markup).toContain('href="/privacy"');
	});

	it("renders exactly the three approved China lead fields", () => {
		const markup = renderToStaticMarkup(<DiagnosticForm locale="zh" />);
		expect(markup).toContain('name="name"');
		expect(markup).toContain('name="phone"');
		expect(markup).toContain('name="company"');
		expect(markup).not.toContain('name="email"');
		expect(markup).not.toContain('name="website"');
		expect(markup).not.toContain('name="consent"');
		expect(markup).toContain("提交后，我们会通过你留下的联系方式沟通需求");
		expect(markup).toContain('href="/zh/privacy"');
	});
});
