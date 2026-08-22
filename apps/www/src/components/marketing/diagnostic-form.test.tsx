import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiagnosticForm } from "./diagnostic-form";
import { Route as EnglishDiagnosticRoute } from "@/routes/diagnostic";
import { Route as ChineseDiagnosticRoute } from "@/routes/zh/diagnostic";

describe("DiagnosticForm", () => {
	it("renders the homepage website as the form's initial value", () => {
		const markup = renderToStaticMarkup(<DiagnosticForm locale="en" initialWebsite="https://acme.example" />);

		expect(markup).toContain('name="website"');
		expect(markup).toContain('value="https://acme.example"');
	});
});

describe("diagnostic route search", () => {
	it.each([EnglishDiagnosticRoute, ChineseDiagnosticRoute])("returns an empty website for absent, non-string, or malformed search values", (route) => {
		const validateSearch = route.options.validateSearch as (search: Record<string, unknown>) => { website: string };

		expect(validateSearch({})).toEqual({ website: "" });
		expect(validateSearch({ website: ["https://acme.example"] })).toEqual({ website: "" });
		expect(validateSearch({ website: "acme" })).toEqual({ website: "" });
		expect(validateSearch({ website: "https://acme.example" })).toEqual({ website: "https://acme.example" });
	});
});
