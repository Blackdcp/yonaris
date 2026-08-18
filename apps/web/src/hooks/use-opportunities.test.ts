import { describe, expect, it } from "vitest";
import { opportunitiesCachePolicy, opportunitiesKeys } from "./use-opportunities";

describe("opportunitiesKeys", () => {
	it("keeps reports for different measurement scopes in separate cache entries", () => {
		expect(opportunitiesKeys.detail("ppio", "scope-china")).not.toEqual(
			opportunitiesKeys.detail("ppio", "scope-global"),
		);
	});
});

describe("opportunitiesCachePolicy", () => {
	it("polls and refetches on focus while an admin report is not generated", () => {
		expect(opportunitiesCachePolicy("not_generated")).toEqual({
			staleTime: 30_000,
			refetchInterval: 30_000,
			refetchOnWindowFocus: true,
		});
	});

	it("keeps an existing report cached for the session", () => {
		expect(opportunitiesCachePolicy(null)).toEqual({
			staleTime: Number.POSITIVE_INFINITY,
			refetchInterval: false,
			refetchOnWindowFocus: false,
		});
	});
});
