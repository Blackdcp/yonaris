import { describe, expect, it } from "vitest";
import {
	buildDiagnosticAnalyticsBootstrapScript,
	sanitizeAnalyticsProperties,
	sanitizeAnalyticsReferrer,
	sanitizeAnalyticsUrl,
} from "./diagnostic-analytics-privacy";

function runBootstrap(pathname: string, search: string, hash = "") {
	const windowObject: Record<string, unknown> = {};
	const calls: unknown[][] = [];
	const location = { pathname, search, hash };
	const history = {
		state: { route: pathname },
		replaceState: (...args: unknown[]) => calls.push(args),
	};
	const execute = new Function("window", "location", "history", buildDiagnosticAnalyticsBootstrapScript());
	execute(windowObject, location, history);
	return { calls, history, windowObject };
}

describe("diagnostic analytics bootstrap", () => {
	it.each(["/diagnostic", "/zh/diagnostic"])(
		"removes the raw query synchronously on %s without preserving legacy form values",
		(pathname) => {
			const raw = "?website=https%3A%2F%2Facme.example%2Fsecret&email=ava%40acme.example";
			const result = runBootstrap(pathname, raw, "#request");

			expect(result.windowObject).toEqual({});
			expect(result.calls).toEqual([[result.history.state, "", `${pathname}#request`]]);
		},
	);

	it("leaves every non-diagnostic route untouched", () => {
		const result = runBootstrap("/product", "?website=https%3A%2F%2Facme.example");
		expect(result.calls).toEqual([]);
		expect(result.windowObject).toEqual({});
	});
});

describe("analytics sanitization", () => {
	it("removes query data from page URLs and referrers", () => {
		expect(sanitizeAnalyticsUrl("https://yonaris.com/diagnostic?website=https%3A%2F%2Facme.example#request")).toBe(
			"https://yonaris.com/diagnostic#request",
		);
		expect(sanitizeAnalyticsUrl("/zh/diagnostic?website=https%3A%2F%2Facme.example")).toBe("/zh/diagnostic");
		expect(sanitizeAnalyticsReferrer("https://search.example/?q=private+question")).toBe("https://search.example/");
		expect(sanitizeAnalyticsUrl("not a valid url ?secret")).toBe("");
	});

	it("drops diagnostic lead, identity, response, and domain properties from custom events", () => {
		const sanitized = sanitizeAnalyticsProperties({
			button: "diagnostic-submit",
			website: "https://acme.example",
			brand: "Acme",
			market: "Enterprise software",
			question: "Which platform should a global team choose?",
			competitors: "Example Co",
			name: "Ava Chen",
			email: "ava@acme.example",
			phone: "+86 138 0013 8000",
			company: "Acme Confidential",
			consent: true,
			companyUrl: "bot.example",
			domain: "acme.example",
			uuid: "0198ef3d-34e1-7f14-a74d-e09b66d14b11",
			idempotencyKey: "0198ef3d-34e1-7f14-a74d-e09b66d14b11",
			response: { ok: true },
			payload: { lead: "secret" },
			$current_url: "https://yonaris.com/diagnostic?website=secret",
			$referrer: "https://search.example/?q=secret",
		});

		expect(sanitized).toEqual({
			button: "diagnostic-submit",
			$current_url: "https://yonaris.com/diagnostic",
			$referrer: "https://search.example/",
		});
	});
});
