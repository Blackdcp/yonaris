import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

function asHtmlText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const mocks = vi.hoisted(() => ({
	stateValues: [] as unknown[],
	stateIndex: 0,
	stateWrites: new Map<number, unknown[]>(),
	buttons: [] as Array<{ onClick?: () => void | Promise<void> }>,
	queryResults: new Map<string, Record<string, unknown>>(),
	mutationPending: false,
	setQueryData: vi.fn(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useState<T>(initial: T | (() => T)) {
			const index = mocks.stateIndex++;
			const state = actual.useState(initial);
			if (mocks.stateValues.length > 0) {
				const value = mocks.stateValues.shift() as T;
				return [
					value,
					(next: T | ((previous: T) => T)) => {
						const resolved = typeof next === "function" ? (next as (previous: T) => T)(value) : next;
						const writes = mocks.stateWrites.get(index) ?? [];
						writes.push(resolved);
						mocks.stateWrites.set(index, writes);
					},
				] as const;
			}
			return state;
		},
	};
});

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useSearch: () => ({ brand: "brand-raw-stepfun" }),
		useParams: () => ({ taskId: "task-raw-0001" }),
	}),
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
	useNavigate: () => vi.fn(async () => undefined),
	useRouteContext: () => ({
		clientConfig: {
			defaultDelayHours: 24,
			branding: { name: "Evidence Portal" },
		},
	}),
}));

vi.mock("@workspace/ui/components/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
	}: {
		children: ReactNode;
		onClick?: () => void | Promise<void>;
		disabled?: boolean;
	}) => {
		mocks.buttons.push({ onClick });
		return (
			<button type="button" disabled={disabled}>
				{children}
			</button>
		);
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
		mocks.queryResults.get(JSON.stringify(queryKey)) ?? {
			data: undefined,
			isLoading: false,
			isPending: false,
			isError: false,
			error: null,
			refetch: vi.fn(async () => undefined),
		},
	useMutation: () => ({
		mutate: vi.fn(),
		isPending: mocks.mutationPending,
		error: null,
	}),
	useQueryClient: () => ({
		invalidateQueries: vi.fn(async () => undefined),
		setQueryData: mocks.setQueryData,
	}),
}));

vi.mock("@/hooks/use-artifact-language-selection", () => ({
	useArtifactLanguageSelection: () => ({
		outputLanguage: "zh-CN",
		isResolved: true,
		setOutputLanguage: vi.fn(),
	}),
}));

vi.mock("@workspace/ui/components/dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
	DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
	DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@workspace/ui/components/select", () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@workspace/ui/components/chart", () => ({
	ChartContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	ChartTooltip: () => null,
	ChartTooltipContent: () => null,
}));

vi.mock("recharts", () => {
	const Component = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
	const SvgComponent = ({ children }: { children?: ReactNode }) => (
		<svg>
			<title>Test chart</title>
			{children}
		</svg>
	);
	return {
		Area: Component,
		AreaChart: SvgComponent,
		Bar: Component,
		BarChart: SvgComponent,
		CartesianGrid: Component,
		ResponsiveContainer: Component,
		XAxis: Component,
		YAxis: Component,
	};
});

vi.mock("@/server/admin", () => ({
	adminAnalyzeBrandFn: vi.fn(),
	getAdminOpportunityScopesFn: vi.fn(),
	getAdminStatsFn: vi.fn(),
	getJobLogsFn: vi.fn(),
	getWorkflowDataFn: vi.fn(),
	retryJobFn: vi.fn(),
	updateDelayOverrideFn: vi.fn(),
}));
vi.mock("@/server/brands", () => ({ createBrandWithOrgFn: vi.fn() }));
vi.mock("@/server/customer-access", () => ({
	createCustomerAccessFn: vi.fn(),
	listCustomerAccessFn: vi.fn(),
	listCustomerWorkspacesFn: vi.fn(),
	resetCustomerAccessPasswordFn: vi.fn(),
}));
vi.mock("@/server/opportunities", () => ({ generateOpportunitiesFn: vi.fn() }));

import { retryJobFn } from "@/server/admin";
import { Route as AccessRoute } from "./access";
import { Route as AdminRoute } from "./index";
import { Route as ToolsRoute } from "./tools";
import { Route as WorkflowsRoute } from "./workflows";

type TestRoute = {
	component: React.ComponentType;
	head?: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
};

function renderRoute(route: TestRoute, locale: UiLanguage = "zh-CN") {
	const Component = route.component;
	mocks.stateIndex = 0;
	mocks.buttons.length = 0;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function setQuery(queryKey: unknown[], result: Record<string, unknown>) {
	mocks.queryResults.set(JSON.stringify(queryKey), {
		data: undefined,
		isLoading: false,
		isPending: false,
		isError: false,
		error: null,
		refetch: vi.fn(async () => undefined),
		...result,
	});
}

function adminState(error: string | null = null) {
	return [
		[
			{
				id: "brand-raw-stepfun",
				name: "StepFun 原名",
				website: "https://stepfun.example.cn/raw?q=CN",
				enabled: true,
				onboarded: true,
				delayOverrideHours: null,
				createdAt: "2026-08-01T00:00:00.000Z",
				updatedAt: "2026-08-01T00:00:00.000Z",
				totalPrompts: 38,
				activePrompts: 36,
				promptRuns7Days: 252,
				promptRuns30Days: 1080,
				lastPromptRunAt: null,
				promptsAddedLast7Days: 1,
				promptsRemovedLast7Days: 0,
				promptsAddedLast30Days: 2,
				promptsRemovedLast30Days: 1,
			},
		],
		[{ date: "2026-08-26", count: 1 }],
		[{ date: "2026-08-26", count: 1 }],
		[{ date: "2026-08-26", enabled: 36, disabled: 2 }],
		[{ date: "2026-08-26", count: 252 }],
		false,
		error,
	];
}

const workflowData = {
	summary: {
		totalBrands: 1,
		totalPrompts: 1,
		totalEnabled: 1,
		totalOverdue: 1,
		totalOnSchedule: 0,
		percentOnSchedule: 0,
	},
	queue: { name: "prompt", created: 1, active: 0, retry: 1, completed: 9, failed: 1, totalPending: 2 },
	recentJobs: [
		{
			id: "job-raw-0001",
			name: "prompt-runner.raw",
			data: { promptId: "prompt-raw-0001" },
			status: "failed",
			failedReason: 'RAW_JOB_FAILURE::{"provider":"openai/raw-v1"}',
			attemptsMade: 2,
			timestamp: 1_777_000_000_000,
			processedOn: 1_777_000_000_000,
			finishedOn: 1_777_000_001_000,
		},
	],
	brands: [
		{
			brandId: "brand-raw-stepfun",
			brandName: "StepFun 原名",
			website: "https://stepfun.example.cn/raw?q=CN",
			enabled: true,
			totalPrompts: 1,
			enabledPrompts: 1,
			runFrequencyMs: 3_600_000,
			overduePrompts: 1,
			onSchedulePrompts: 0,
			schedulerCoverage: { scheduled: 1, total: 1 },
			prompts: [
				{
					promptId: "prompt-raw-0001",
					promptValue: "Which AI IDE works in 中国?",
					brandId: "brand-raw-stepfun",
					brandName: "StepFun 原名",
					enabled: true,
					runFrequencyMs: 3_600_000,
					lastRunsByModel: {
						"openai/raw-v1": { lastRunAt: null, isOverdue: true, overdueByMs: 3_600_000 },
					},
					schedulerInfo: { exists: true, nextRunAt: null, cadenceHours: 1 },
					recentFailures: 1,
					jobStatus: "none",
				},
			],
		},
	],
};

describe("platform administration localization", () => {
	beforeEach(() => {
		mocks.stateValues.length = 0;
		mocks.stateIndex = 0;
		mocks.stateWrites.clear();
		mocks.buttons.length = 0;
		mocks.queryResults.clear();
		mocks.mutationPending = false;
		mocks.setQueryData.mockReset();
	});

	it("renders the customer operations list and delay controls in Chinese without rewriting customer data", () => {
		mocks.stateValues.push(...adminState());

		const markup = renderRoute(AdminRoute as unknown as TestRoute);

		expect(markup).toContain("平台运营");
		expect(markup).toContain("品牌统计");
		expect(markup).toContain("配置 StepFun 原名 的任务延迟");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("https://stepfun.example.cn/raw?q=CN");
		expect(markup).toContain("从未运行");
		expect(markup).toContain("默认");
		expect(markup).not.toContain("Platform operations");
	});

	it("localizes customer-list loading and error states while keeping raw diagnostics exact", () => {
		mocks.stateValues.push([], [], [], [], [], true, null);
		const loadingMarkup = renderRoute(AdminRoute as unknown as TestRoute);
		expect(loadingMarkup).toContain("正在加载平台运营数据…");

		const rawError = 'ADMIN_STATS_RAW::{"traceId":"trace-raw-01"}';
		mocks.stateValues.push(...adminState(rawError));
		const errorMarkup = renderRoute(AdminRoute as unknown as TestRoute);
		expect(errorMarkup).toContain("无法加载平台运营数据");
		expect(errorMarkup).toContain("原始错误详情");
		expect(errorMarkup).toContain(asHtmlText(rawError));
	});

	it("renders customer access forms, roles, boundaries, and empty/error states in Chinese", () => {
		setQuery(["platform", "customer-workspaces"], {
			data: [{ id: "workspace-raw-001", name: "StepFun 原工作区" }],
		});
		setQuery(["platform", "customer-access", "workspace-raw-001"], {
			data: {
				accounts: [
					{
						membershipId: "membership-raw-001",
						userId: "user-raw-001",
						name: "客户用户 原名",
						email: "raw.user+cn@example.test",
						workspaceRole: "viewer",
						isCustomerAccount: true,
					},
				],
			},
		});

		const markup = renderRoute(AccessRoute as unknown as TestRoute);

		expect(markup).toContain("客户访问");
		expect(markup).toContain("创建客户工作区");
		expect(markup).toContain("创建客户账户");
		expect(markup).toContain("客户用户 原名");
		expect(markup).toContain("raw.user+cn@example.test");
		expect(markup).toContain("查看者");
		expect(markup).toContain("仅限客户");
		expect(markup).toContain('data-value="workspace-raw-001"');
		expect(markup).not.toContain("Customer access");

		const rawError = 'CUSTOMER_ACCESS_RAW::{"workspaceId":"workspace-raw-001"}';
		setQuery(["platform", "customer-access", "workspace-raw-001"], {
			data: { accounts: [] },
			isError: true,
			error: new Error(rawError),
		});
		const emptyErrorMarkup = renderRoute(AccessRoute as unknown as TestRoute);
		expect(emptyErrorMarkup).toContain("尚无客户账户。");
		expect(emptyErrorMarkup).toContain("无法加载客户访问权限");
		expect(emptyErrorMarkup).toContain("原始错误详情");
		expect(emptyErrorMarkup).toContain(asHtmlText(rawError));
	});

	it("localizes customer access pending operations", () => {
		mocks.mutationPending = true;
		setQuery(["platform", "customer-workspaces"], { data: [] });

		const markup = renderRoute(AccessRoute as unknown as TestRoute);

		expect(markup).toContain("正在创建工作区…");
		expect(markup).toContain("正在创建账户…");
	});

	it("renders workflow data and explicit statuses in Chinese while separating raw job details", () => {
		mocks.stateValues.push(workflowData, false, null, new Set(["brand-raw-stepfun"]), false);

		const markup = renderRoute(WorkflowsRoute as unknown as TestRoute);

		expect(markup).toContain("自动化工作流");
		expect(markup).toContain("计划健康度");
		expect(markup).toContain("提示词队列");
		expect(markup).toContain("1 条逾期");
		expect(markup).toContain("查看日志");
		expect(markup).toContain("失败任务详情");
		expect(markup).toContain("原始错误详情");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("Which AI IDE works in 中国?");
		expect(markup).toContain("openai/raw-v1");
		expect(markup).toContain("prompt-raw-0001");
		expect(markup).toContain("job-raw-0001");
		expect(markup).toContain(asHtmlText('RAW_JOB_FAILURE::{"provider":"openai/raw-v1"}'));
		expect(markup).not.toContain("View Logs");
	});

	it("localizes workflow loading, empty, and error states without rewriting the raw diagnostic", () => {
		mocks.stateValues.push(null, true, null, new Set(), false);
		expect(renderRoute(WorkflowsRoute as unknown as TestRoute)).toContain("正在加载自动化工作流…");

		mocks.stateValues.push({ ...workflowData, brands: [], recentJobs: [] }, false, null, new Set(), false);
		expect(renderRoute(WorkflowsRoute as unknown as TestRoute)).toContain("暂无品牌工作流。");

		const rawError = 'WORKFLOW_RAW::{"queue":"prompt"}';
		mocks.stateValues.push(null, false, rawError, new Set(), false);
		const errorMarkup = renderRoute(WorkflowsRoute as unknown as TestRoute);
		expect(errorMarkup).toContain("无法加载自动化工作流");
		expect(errorMarkup).toContain("原始错误详情");
		expect(errorMarkup).toContain(asHtmlText(rawError));
	});

	it("renders a generic retry failure for a non-Error rejection without a fabricated raw detail", () => {
		const dataWithoutJobDetail = { ...workflowData, recentJobs: [] };
		mocks.stateValues.push(
			dataWithoutJobDetail,
			false,
			null,
			new Set(["brand-raw-stepfun"]),
			false,
			false,
			true,
			false,
		);

		const markup = renderRoute(WorkflowsRoute as unknown as TestRoute);

		expect(markup).toContain("无法重试此任务。");
		expect(markup).not.toContain("原始错误详情");
	});

	it("normalizes a non-Error workflow retry rejection to the generic error sentinel", async () => {
		vi.mocked(retryJobFn).mockRejectedValueOnce({ kind: "opaque-rejection" });
		mocks.stateValues.push(
			{ ...workflowData, recentJobs: [] },
			false,
			null,
			new Set(["brand-raw-stepfun"]),
			false,
			false,
			null,
			false,
		);
		renderRoute(WorkflowsRoute as unknown as TestRoute);

		const retry = mocks.buttons.at(-1)?.onClick;
		expect(retry).toBeTypeOf("function");
		await retry?.();

		expect(mocks.stateWrites.get(6)?.at(-1)).toBe(true);
	});

	it("renders provider tools and opportunity operations in Chinese while preserving raw API and scope identity", () => {
		setQuery(["admin-opportunity-scopes"], {
			data: [
				{
					id: "brand-provider-raw",
					name: "StepFun 原名",
					scopes: [
						{
							id: "scope-provider-raw",
							name: "China scored 原始",
							market: "CN",
							locale: "zh-CN",
							promptCount: 38,
						},
					],
				},
			],
		});
		mocks.stateValues.push(
			false,
			"",
			"",
			false,
			null,
			null,
			false,
			"brand-provider-raw",
			"scope-provider-raw",
			true,
			null,
		);

		const markup = renderRoute(ToolsRoute as unknown as TestRoute);

		expect(markup).toContain("供应商工具");
		expect(markup).toContain("品牌分析");
		expect(markup).toContain("分析品牌");
		expect(markup).toContain("生成优化机会报表");
		expect(markup).toContain("正在生成报表…");
		expect(markup).toContain("POST /api/v1/tools/analyze");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("China scored 原始 · CN · zh-CN · 38 条已启用提示词");
		expect(markup).toContain('value="brand-provider-raw"');
		expect(markup).toContain('value="scope-provider-raw"');
		expect(markup).not.toContain("Brand analysis");
	});

	it("uses the route language for all four administration heads", () => {
		const input = {
			match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
		};
		const routes = [AdminRoute, AccessRoute, WorkflowsRoute, ToolsRoute] as unknown as TestRoute[];
		for (const route of routes) expect(route.head).toBeTypeOf("function");

		const metadata = routes.map((route) => JSON.stringify(route.head?.(input).meta ?? [])).join("\n");
		expect(metadata).toContain("平台运营 · Evidence Portal");
		expect(metadata).toContain("客户访问 · Evidence Portal");
		expect(metadata).toContain("自动化工作流 · Evidence Portal");
		expect(metadata).toContain("供应商工具 · Evidence Portal");
		expect(metadata).toContain("管理客户、自动化和平台运营");
	});
});
