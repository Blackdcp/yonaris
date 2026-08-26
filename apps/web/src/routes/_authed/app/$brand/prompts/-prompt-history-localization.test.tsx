import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const rawPrompt = "Which AI IDE works in 中国?";
const rawAnswer = "Model answer 原文 with https://answer.example/raw?q=CN";
const rawQuery = "best AI IDE 中国 2026";

const mocks = vi.hoisted(() => ({
	stateCall: 0,
	promptMeta: null as unknown,
	statsError: false,
	runsError: false,
	runs: [] as unknown[],
	activeTab: "responses",
	fanoutData: null as unknown,
	redirect: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		useState: <T,>(initial: T | (() => T)) => {
			const state = actual.useState(initial);
			mocks.stateCall += 1;
			if (mocks.stateCall === 3) return [mocks.promptMeta, state[1]] as typeof state;
			if (mocks.stateCall === 4) return [false, state[1]] as typeof state;
			return state;
		},
	};
});

function hrefFor(to: string, params?: Record<string, string>, search?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	const query = new URLSearchParams(search).toString();
	return query ? `${href}?${query}` : href;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => ({ brand: "brand-raw-id", promptId: "prompt-raw-id" }),
		useSearch: ({ select }: { select: (value: Record<string, string>) => unknown }) => select({ tab: mocks.activeTab }),
		useNavigate: () => vi.fn(),
	}),
	Link: ({
		children,
		to,
		params,
		search,
	}: {
		children: ReactNode;
		to: string;
		params?: Record<string, string>;
		search?: Record<string, string>;
	}) => <a href={hrefFor(to, params, search)}>{children}</a>,
	redirect: (...args: unknown[]) => {
		mocks.redirect(...args);
		return new Error("redirect");
	},
	useSearch: ({ select }: { select: (value: Record<string, string>) => unknown }) =>
		select({ scope: "scope-cn-literal" }),
}));
vi.mock("@/components/citations-display", () => ({ CitationsDisplay: () => <div /> }));
vi.mock("@/components/lookback-selector", () => ({
	LookbackSelector: () => <button type="button">lookback</button>,
	useLookbackPeriod: () => "1m",
}));
vi.mock("@/components/progress-bar-chart", () => ({ ProgressBarChart: () => <div /> }));
vi.mock("@/hooks/use-brand-access", () => ({ useBrandAccess: () => ({ canManageBrand: true }) }));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: { id: "brand-raw-id", name: "StepFun 原名" } }),
}));
vi.mock("@/hooks/use-prompt-runs-only", () => ({
	usePromptRunsOnly: () => ({
		runs: mocks.runs,
		pagination: { limit: 15, total: mocks.runs.length, totalPages: 1 },
		isLoading: false,
		isError: mocks.runsError,
	}),
}));
vi.mock("@/hooks/use-prompt-stats", () => ({
	usePromptStats: () => ({
		isLoading: false,
		isError: mocks.statsError,
		aggregations: { totalRuns: mocks.runs.length, mentionStats: [], citationStats: undefined },
	}),
}));
vi.mock("@/hooks/use-query-fanout", () => ({
	useQueryFanout: () => ({ data: mocks.fanoutData, isLoading: false, isError: false }),
}));
vi.mock("@/server/prompts", () => ({ getPromptMetadataFn: vi.fn() }));

import { Route as PromptHistoryRoute } from "./$promptId";
import { Route as PromptRedirectRoute } from "./index";

type TestRoute = {
	component: React.ComponentType;
	head?: (input: unknown) => { meta: Array<{ title?: string; name?: string; content?: string }> };
	validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
	beforeLoad?: (input: { params: { brand: string } }) => unknown;
};

function renderPrompt(locale: UiLanguage = "zh-CN") {
	mocks.stateCall = 0;
	const Component = (PromptHistoryRoute as unknown as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

function textFromMarkup(markup: string): string {
	return markup.replace(/<[^>]+>/g, "");
}

function infoTipAccessibleNames(markup: string): Array<string | null> {
	const buttons = markup.match(/<button\b[^>]*cursor-help[^>]*>/g) ?? [];
	return buttons.map((button) => button.match(/aria-label="([^"]+)"/)?.[1] ?? null);
}

const readySnapshot = {
	id: "11111111-1111-4111-8111-111111111111",
	status: "ready",
	schemaVersion: "response-snapshot.v2",
	contentSource: "rendered_from_structured_response",
	createdAt: "2026-08-15T00:00:00.000Z",
	expiresAt: "2026-11-13T00:00:00.000Z",
	htmlSha256: "a".repeat(64),
	jsonSha256: "b".repeat(64),
	visualEvidence: null,
};

describe("Prompt history localization", () => {
	beforeEach(() => {
		mocks.stateCall = 0;
		mocks.promptMeta = {
			id: "prompt-raw-id",
			brandId: "brand-raw-id",
			scopeId: "scope-cn-literal",
			value: rawPrompt,
			enabled: true,
			tags: ["RawTag"],
			systemTags: ["SystemRaw"],
			nextRunAt: "2026-08-27T00:00:00.000Z",
		};
		mocks.statsError = false;
		mocks.runsError = false;
		mocks.activeTab = "responses";
		mocks.fanoutData = null;
		mocks.runs = [
			{
				id: "run-raw-id",
				model: "gpt-5.6",
				version: "provider-version-raw",
				observedAt: "2026-08-15T00:00:00.000Z",
				webQueries: [rawQuery],
				brandMentioned: true,
				competitorsMentioned: ["DeepSeek 原名"],
				answerText: rawAnswer,
				snapshot: readySnapshot,
			},
		];
		mocks.redirect.mockClear();
	});

	it("renders binding Query Fan-Out terminology through the real Prompt-detail fan-out child", () => {
		mocks.activeTab = "web-queries";
		mocks.fanoutData = {
			totalQueries: 2,
			uniqueQueries: 2,
			topQueries: [{ query: rawQuery, count: 2 }],
			byModel: [
				{
					model: "gpt-5.6",
					runs: 2,
					totalQueries: 2,
					topQueries: [{ query: rawQuery, count: 2 }],
				},
			],
			terms: [],
			wordChanges: { added: [], preserved: [], dropped: [] },
		};

		const markup = renderPrompt();
		const englishMarkup = renderPrompt("en");

		expect(markup).toContain("AI 检索脉络");
		expect(markup).toContain("检索路径");
		expect(markup).toContain("衍生检索词");
		expect(markup).toContain("查看 AI 为回答当前问题而展开的实际联网搜索词。");
		expect(textFromMarkup(markup)).toContain("2 个不同的衍生检索词。");
		expect(textFromMarkup(englishMarkup)).toContain("2 distinct derived queries.");
		expect(infoTipAccessibleNames(markup)).toEqual(["查看 AI 为回答当前问题而展开的实际联网搜索词。"]);
		expect(infoTipAccessibleNames(englishMarkup)).toEqual([
			"Every distinct derived query used while answering this prompt, with prompt keywords emphasized.",
		]);
		expect(textFromMarkup(markup)).toContain(rawQuery);
		expect(markup).not.toContain("联网检索词");
		expect(markup).not.toContain("提示词检索扩展");
		expect(markup).not.toContain("检索词用词");
	});

	it("renders populated Prompt history in Chinese while preserving all observed evidence", () => {
		const markup = renderPrompt();

		expect(markup).toContain("活跃");
		expect(markup).toContain("下次运行");
		expect(markup).toContain("标签");
		expect(markup).toContain("提及情况");
		expect(markup).toContain("AI 检索脉络");
		expect(markup).toContain("衍生检索词");
		expect(markup).toContain("大模型回答");
		expect(markup).toContain("单次提示词运行记录");
		expect(markup).toContain(rawPrompt);
		expect(markup).toContain(rawAnswer);
		expect(markup).toContain(rawQuery);
		expect(markup).toContain("gpt-5.6");
		expect(markup).toContain("provider-version-raw");
		expect(markup).toContain("DeepSeek 原名");
		expect(markup).toContain("RawTag");
		expect(markup).toContain("SystemRaw");
		expect(markup).not.toContain("Individual Prompt Runs");
	});

	it("renders a safe localized Prompt error state", () => {
		mocks.statsError = true;
		const markup = renderPrompt();

		expect(markup).toContain("提示词详情");
		expect(markup).toContain("无法加载提示词数据，请重试");
		expect(markup).not.toContain("Failed to load prompt data");
	});

	it("preserves tab validation and the Prompt redirect route identity", () => {
		const detail = PromptHistoryRoute as unknown as TestRoute;
		const redirect = PromptRedirectRoute as unknown as TestRoute;

		expect(detail.validateSearch?.({ tab: "responses" })).toEqual({ tab: "responses" });
		expect(() => redirect.beforeLoad?.({ params: { brand: "brand-raw-id" } })).toThrow("redirect");
		expect(mocks.redirect).toHaveBeenCalledWith({
			to: "/app/$brand/visibility",
			params: { brand: "brand-raw-id" },
		});
	});

	it("localizes detail and redirect metadata from route context without changing names", () => {
		for (const [route, expectedTitle] of [
			[PromptHistoryRoute, "提示词详情"],
			[PromptRedirectRoute, "提示词"],
		] as const) {
			const head = (route as unknown as TestRoute).head;
			expect(head).toBeTypeOf("function");
			const result = head?.({
				match: { context: { uiLanguage: "zh-CN", clientConfig: { branding: { name: "Evidence Portal" } } } },
				matches: [{ loaderData: { brandName: "StepFun 原名" } }],
			});
			expect(JSON.stringify(result?.meta)).toContain(`${expectedTitle} | StepFun 原名 · Evidence Portal`);
		}
	});
});
