import { describe, expect, it } from "vitest";
import * as subject from "./diagnostic-request-intent";

const { validateDiagnosticRouteSearch } = subject;

describe("diagnostic request intent", () => {
	it("preserves only the exact privacy route query and defaults every other value", () => {
		expect(validateDiagnosticRouteSearch({ intent: "privacy" })).toEqual({ intent: "privacy" });
		for (const search of [{}, { intent: "deletion" }, { intent: "PRIVACY" }, { intent: ["privacy"] }]) {
			expect(validateDiagnosticRouteSearch(search)).toEqual({});
		}
	});

	it("recovers one validated privacy intent from SSR search or queryless browser history state", () => {
		const recover = (subject as typeof subject & {
			diagnosticRequestTypeFromRoute?: (
				search: Record<string, unknown>,
				state: Record<string, unknown> | null,
			) => "consultation" | "privacy";
		}).diagnosticRequestTypeFromRoute;
		expect(recover).toBeDefined();
		if (!recover) return;
		expect(recover({ intent: "privacy" }, null)).toBe("privacy");
		expect(recover({}, { __yonarisDiagnosticIntent: "privacy" })).toBe("privacy");
		for (const [search, state] of [
			[{}, null],
			[{ intent: "deletion" }, { __yonarisDiagnosticIntent: "deletion" }],
			[{ intent: ["privacy"] }, { __yonarisDiagnosticIntent: ["privacy"] }],
		] as const) {
			expect(recover(search, state)).toBe("consultation");
		}
	});
});
