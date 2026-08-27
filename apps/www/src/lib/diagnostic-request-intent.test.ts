import { describe, expect, it } from "vitest";
import { diagnosticRequestTypeFromSearch, validateDiagnosticRouteSearch } from "./diagnostic-request-intent";

describe("diagnostic request intent", () => {
	it("preserves only the exact privacy route query and defaults every other value", () => {
		expect(validateDiagnosticRouteSearch({ intent: "privacy" })).toEqual({ intent: "privacy" });
		for (const search of [{}, { intent: "deletion" }, { intent: "PRIVACY" }, { intent: ["privacy"] }]) {
			expect(validateDiagnosticRouteSearch(search)).toEqual({});
		}
		expect(diagnosticRequestTypeFromSearch("?intent=privacy")).toBe("privacy");
		expect(diagnosticRequestTypeFromSearch("?intent=deletion")).toBe("consultation");
		expect(diagnosticRequestTypeFromSearch("?intent=privacy&intent=privacy")).toBe("consultation");
	});
});
