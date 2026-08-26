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
	queryResults: new Map<string, Record<string, unknown>>(),
}));

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react");
	return {
		...actual,
		useState<T>(initial: T | (() => T)) {
			const state = actual.useState(initial);
			if (mocks.stateValues.length > 0) return [mocks.stateValues.shift() as T, state[1]] as const;
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
}));

vi.mock("@workspace/ui/components/select", () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/server/browser-runner-devices", () => ({
	createBrowserRunnerPairingFn: vi.fn(),
	listBrowserRunnerDevicesFn: vi.fn(),
	revokeBrowserRunnerDeviceFn: vi.fn(),
}));
vi.mock("@/server/overseas-run-now", () => ({
	listOverseasRunCohortsFn: vi.fn(),
	runOverseasNowFn: vi.fn(),
}));
vi.mock("@/server/sampling", () => ({
	cancelSamplingBatchFn: vi.fn(),
	claimSamplingTaskFn: vi.fn(),
	createSamplingBatchFn: vi.fn(),
	failSamplingTaskFn: vi.fn(),
	finalizeSamplingBatchNeedsHumanFn: vi.fn(),
	getSamplingContextFn: vi.fn(),
	getSamplingTaskFn: vi.fn(),
	heartbeatSamplingTaskFn: vi.fn(),
	listSamplingBatchesFn: vi.fn(),
	listSamplingEvidenceArtifactsFn: vi.fn(),
	provisionSamplingScopeFn: vi.fn(),
	releaseSamplingTaskFn: vi.fn(),
	runSamplingNowFn: vi.fn(),
	startSamplingBatchAutomationFn: vi.fn(),
	submitSamplingTaskFn: vi.fn(),
}));

import { Route as TaskRoute } from "./$taskId";
import { Route as DevicesRoute } from "./devices";
import { Route as SamplingRoute } from "./index";

type TestRoute = {
	component: React.ComponentType;
	head: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
};

function renderRoute(route: TestRoute, locale: UiLanguage = "zh-CN") {
	const Component = route.component;
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

const context = {
	brands: [{ id: "brand-raw-stepfun", name: "StepFun 原名" }],
	browserRunnerEnabled: false,
	overseasRunNow: { googleAiOverviewReady: false },
	selectedBrand: {
		id: "brand-raw-stepfun",
		name: "StepFun 原名",
		scopes: [
			{
				id: "scope-raw-cn-01",
				key: "cn-zh-scored-raw",
				name: "China scored 原始",
				market: "CN",
				locale: "zh-CN",
				timezone: "Asia/Shanghai",
				enabled: true,
				manualOnly: true,
				samplingEvaluationRole: "scored",
			},
		],
		prompts: [
			{
				id: "prompt-raw-01",
				scopeId: "scope-raw-cn-01",
				value: "阶跃星辰 StepFun 是一家什么公司？",
				tags: ["raw-tag"],
				enabled: true,
			},
		],
	},
	targets: [],
};

const coverage = {
	planned: 0,
	available: 0,
	claimed: 0,
	succeeded: 1,
	failed: 0,
	cancelled: 0,
	total: 1,
	attempted: 1,
	resolved: 1,
	successCoverage: 1,
	completionCoverage: 1,
};

function setSamplingQueries() {
	setQuery(["admin", "sampling", "context", "brand-raw-stepfun"], { data: context });
	setQuery(["admin", "sampling", "batches", "brand-raw-stepfun", undefined, undefined, 1], {
		data: {
			batches: [
				{
					id: "batch-raw-0001",
					brandId: "brand-raw-stepfun",
					scopeId: "scope-raw-cn-01",
					name: "StepFun batch 原始",
					status: "completed",
					plannedTaskCount: 1,
					claimableTaskCount: 0,
					manifestHash: "manifest-hash-byte-identical",
					createdAt: "2026-08-26T00:00:00.000Z",
					frozenAt: "2026-08-26T00:00:00.000Z",
					startedAt: "2026-08-26T00:01:00.000Z",
					completedAt: "2026-08-26T00:02:00.000Z",
					cancelledAt: null,
					coverage: {
						overall: coverage,
						byEvaluationRole: { scored: coverage, observation: { ...coverage, total: 0 } },
					},
					executionMode: "browser_runner",
					browserRunnerEnabled: true,
					automationStatus: "settled",
					automationProgress: { total: 1, completed: 1, running: 0, needsHuman: 0 },
					needsHumanCount: 0,
					resultStatus: "final",
				},
			],
			limit: 20,
			total: 1,
		},
	});
	setQuery(["admin", "sampling", "browser-runner-devices"], { data: [] });
	setQuery(["admin", "sampling", "overseas-runs", "brand-raw-stepfun"], { data: { cohorts: [] } });
}

describe("sampling route localization", () => {
	beforeEach(() => {
		mocks.stateValues.length = 0;
		mocks.queryResults.clear();
	});

	it("renders the Chinese batch queue, filters, and summaries without rewriting search or Program values", () => {
		setSamplingQueries();

		const markup = renderRoute(SamplingRoute as unknown as TestRoute);

		expect(markup).toContain("抽样任务");
		expect(markup).toContain("本地设备");
		expect(markup).toContain("自动完成（本页）");
		expect(markup).toContain("全部状态");
		expect(markup).toContain("已完成");
		expect(markup).toContain("最终");
		expect(markup).toContain("StepFun 原名");
		expect(markup).toContain("StepFun batch 原始");
		expect(markup).toContain("China scored 原始");
		expect(markup).toContain("CN/zh-CN · Asia/Shanghai");
		expect(markup).toContain('data-value="brand-raw-stepfun"');
		expect(markup).toContain('data-value="scope-raw-cn-01"');
		expect(markup).not.toContain("Sampling Tasks");
	});

	it("localizes queue pending and error states while preserving the raw error detail", () => {
		setSamplingQueries();
		setQuery(["admin", "sampling", "context", "brand-raw-stepfun"], { data: context, isLoading: true });
		expect(renderRoute(SamplingRoute as unknown as TestRoute)).toContain("正在加载抽样批次…");

		const rawError = 'SAMPLING_QUEUE_RAW::{"scope":"scope-raw-cn-01"}';
		setQuery(["admin", "sampling", "context", "brand-raw-stepfun"], {
			data: undefined,
			isError: true,
			error: new Error(rawError),
		});
		const errorMarkup = renderRoute(SamplingRoute as unknown as TestRoute);
		expect(errorMarkup).toContain("无法加载抽样工作");
		expect(errorMarkup).toContain("原始错误详情");
		expect(errorMarkup).toContain(asHtmlText(rawError));
	});

	it("renders the Chinese device route and its raw loading error separately", () => {
		setQuery(["admin", "sampling", "context", "device-management"], { data: context });
		setQuery(["admin", "sampling", "browser-runner-devices"], { data: [] });
		const markup = renderRoute(DevicesRoute as unknown as TestRoute);
		expect(markup).toContain("本地浏览器设备");
		expect(markup).toContain("抽样运营");
		expect(markup).toContain("尚未配对任何本地 Chrome 设备。");

		const rawError = 'DEVICE_LIST_RAW::{"deviceId":"device-raw-01"}';
		setQuery(["admin", "sampling", "browser-runner-devices"], {
			data: undefined,
			isError: true,
			error: new Error(rawError),
		});
		const errorMarkup = renderRoute(DevicesRoute as unknown as TestRoute);
		expect(errorMarkup).toContain("无法加载本地设备");
		expect(errorMarkup).toContain("原始错误详情");
		expect(errorMarkup).toContain(asHtmlText(rawError));
	});

	it("localizes the missing-claim task state without placing the task or claim token in a URL", () => {
		mocks.stateValues.push(null, true, null, false);
		setQuery(["admin", "sampling", "task", "brand-raw-stepfun", "task-raw-0001"], {
			data: { leaseGeneration: 2 },
		});

		const markup = renderRoute(TaskRoute as unknown as TestRoute);

		expect(markup).toContain("无法取得认领令牌");
		expect(markup).toContain("返回抽样队列");
		expect(markup).toContain('href="/admin/sampling"');
		expect(markup).not.toContain("task-raw-0001");
		expect(markup).not.toContain("lease-token");
	});

	it("uses the route language for all sampling heads", () => {
		const input = {
			match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
		};
		const metadata = [SamplingRoute, DevicesRoute, TaskRoute]
			.map((route) => JSON.stringify((route as unknown as TestRoute).head(input).meta))
			.join("\n");

		expect(metadata).toContain("抽样任务 · Evidence Portal");
		expect(metadata).toContain("本地浏览器设备 · Evidence Portal");
		expect(metadata).toContain("抽样工作台 · Evidence Portal");
		expect(metadata).toContain("创建并执行可审计的消费者界面抽样批次");
	});
});
