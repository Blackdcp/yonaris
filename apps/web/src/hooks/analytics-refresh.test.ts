import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	queryOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: Record<string, unknown>) => {
		mocks.queryOptions.push(options);
		return {
			data: undefined,
			isLoading: false,
			isFetching: false,
			error: null,
			refetch: vi.fn(),
		};
	},
}));

vi.mock("@tanstack/react-router", () => ({ useParams: () => ({ brand: "ppio" }) }));
vi.mock("@/server/analysis", () => ({ getShareOfVoiceFn: vi.fn() }));
vi.mock("@/server/query-fanout", () => ({ getQueryFanoutFn: vi.fn() }));

import { useQueryFanout } from "./use-query-fanout";
import { useShareOfVoice } from "./use-share-of-voice";

describe("live analytics refresh", () => {
	beforeEach(() => {
		mocks.queryOptions.length = 0;
	});

	it.each([
		["Share of Voice", () => useShareOfVoice("ppio", { scopeId: "china" })],
		["Query Fan-out", () => useQueryFanout("ppio", { scopeId: "china" })],
	])("refreshes %s after new sampling results arrive", (_name, useAnalytics) => {
		useAnalytics();

		expect(mocks.queryOptions).toHaveLength(1);
		expect(mocks.queryOptions[0]).toMatchObject({
			staleTime: 30_000,
			refetchInterval: 60_000,
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
		});
	});
});
