import { describe, expect, it, vi } from "vitest";

type ReportFormData = {
	brandName: string;
	brandWebsite: string;
	manualPrompts: string;
};

type MutationOptions = {
	mutationFn: (data: ReportFormData) => Promise<unknown>;
};

const mocks = vi.hoisted(() => ({
	createReportFn: vi.fn(),
	mutationOptions: undefined as MutationOptions | undefined,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return { ...actual, useState: <T>(initial: T) => [initial, vi.fn()] };
});
vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: MutationOptions) => {
		mocks.mutationOptions = options;
		return { mutate: vi.fn(), isPending: false };
	},
	useQuery: () => ({ data: [], error: null, isLoading: false }),
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => ({
		...(options as object),
		useRouteContext: () => ({ isAdmin: true, hasReportAccess: true }),
	}),
	Link: () => null,
	notFound: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (handler: unknown) => handler }),
}));
vi.mock("@/server/reports", () => ({
	createReportFn: mocks.createReportFn,
	getReportsFn: vi.fn(),
}));
vi.mock("@/i18n/provider", () => ({ useI18n: () => ({ t: (id: string) => id }) }));
vi.mock("@/lib/auth/helpers", () => ({
	hasReportAccess: vi.fn(),
	isAdmin: vi.fn(),
	requireAuthSession: vi.fn(),
}));
vi.mock("@/lib/config/server", () => ({ getDeployment: vi.fn() }));
vi.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/components/localized-raw-detail", () => ({ LocalizedRawDetail: () => null }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));

import { buildReportCreateInput, Route } from "./index";

describe("legacy Reports create language transition", () => {
	it("the actual mutation sends explicit English without inferring UI or Program locale", async () => {
		const input = {
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com",
			manualPrompts: "原始 Prompt / Raw Prompt",
			uiLanguage: "zh-CN",
			programLocale: "zh-SG",
		};

		expect(buildReportCreateInput(input as never)).toEqual({
			brandName: "StepFun",
			brandWebsite: "https://stepfun.com",
			manualPrompts: "原始 Prompt / Raw Prompt",
			outputLanguage: "en",
		});

		(Route as unknown as { component: () => unknown }).component();
		expect(mocks.mutationOptions).toBeDefined();
		await mocks.mutationOptions?.mutationFn(input as never);

		expect(mocks.createReportFn).toHaveBeenCalledWith({
			data: {
				brandName: "StepFun",
				brandWebsite: "https://stepfun.com",
				manualPrompts: "原始 Prompt / Raw Prompt",
				outputLanguage: "en",
			},
		});
	});
});
