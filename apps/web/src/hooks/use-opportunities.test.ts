import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getOpportunitiesFn: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));
vi.mock("@tanstack/react-router", () => ({ useParams: () => ({}) }));
vi.mock("@/server/opportunities", () => ({ getOpportunitiesFn: mocks.getOpportunitiesFn }));

import { opportunitiesCachePolicy, opportunitiesKeys, useOpportunities } from "./use-opportunities";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.useQuery.mockReturnValue({
		data: undefined,
		isLoading: false,
		isFetching: false,
		error: null,
		refetch: vi.fn(),
	});
});

describe("opportunitiesKeys", () => {
	it("keeps reports for different measurement scopes in separate cache entries", () => {
		expect(opportunitiesKeys.detail("ppio", "scope-china", "en")).not.toEqual(
			opportunitiesKeys.detail("ppio", "scope-global", "en"),
		);
	});

	it("keeps English and Simplified Chinese variants in separate cache entries", () => {
		expect(opportunitiesKeys.detail("brand", "scope", "en")).not.toEqual(
			opportunitiesKeys.detail("brand", "scope", "zh-CN"),
		);
		expect(opportunitiesKeys.detail("brand", "scope", "en")).toEqual([
			"opportunities-report",
			"brand",
			"scope",
			"en",
		]);
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

describe("useOpportunities", () => {
	it("uses an explicitly selected English cache entry and request", async () => {
		useOpportunities("brand", "scope", "en");

		const options = mocks.useQuery.mock.calls[0]?.[0];
		expect(options.queryKey).toEqual(["opportunities-report", "brand", "scope", "en"]);
		expect(options.enabled).toBe(true);
		await options.queryFn();
		expect(mocks.getOpportunitiesFn).toHaveBeenCalledWith({
			data: { brandId: "brand", scopeId: "scope", outputLanguage: "en" },
		});
	});

	it("keeps the query function dormant when the selection is unresolved", () => {
		useOpportunities("brand", "scope", "zh-CN", false);

		const options = mocks.useQuery.mock.calls[0]?.[0];
		expect(options.queryKey).toEqual(["opportunities-report", "brand", "scope", "zh-CN"]);
		expect(options.enabled).toBe(false);
		expect(mocks.getOpportunitiesFn).not.toHaveBeenCalled();
	});
});
