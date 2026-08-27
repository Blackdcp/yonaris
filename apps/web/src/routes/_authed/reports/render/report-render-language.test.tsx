import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const rawBrand = "原样品牌 Brand Ω";
const rawCompetitor = "原始竞品 / Raw Rival";
const rawPrompt = "RAW Prompt 原样 #42";
const rawAnswer = "RAW Answer 原样，保持字节不变";
const rawQuery = "SITE:Raw.Example 原始 Query #42";
const rawCitationTitle = "RAW Citation Title 原样";
const rawCitationUrl = "https://raw.example/evidence?q=42&lang=source";

type NativeSelectProps = {
	className?: string;
	id?: string;
	onChange?: (event: { target: { value: string } }) => void;
	value?: string;
};

type ChartBoundaryProps = {
	brand: { name: string };
	competitors: Array<{ name: string }>;
	outputLanguage?: OutputLanguage;
	promptName: string;
	promptRuns: Array<{
		rawOutput: unknown;
		textContent?: string;
		webQueries: string[];
	}>;
};

const mocks = vi.hoisted(() => ({
	chartProps: [] as ChartBoundaryProps[],
	navigate: vi.fn(),
	report: undefined as unknown,
	search: {} as Record<string, unknown>,
	selectProps: [] as NativeSelectProps[],
}));

vi.mock("react/jsx-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
	type JsxFactory = typeof actual.jsx;
	const capture = (factory: JsxFactory): JsxFactory =>
		((type, props, key) => {
			if (type === "select" && (props as { id?: unknown } | null)?.id === "report-render-output-language") {
				mocks.selectProps.push(props as NativeSelectProps);
			}
			return factory(type, props, key);
		}) as JsxFactory;
	return { ...actual, jsx: capture(actual.jsx), jsxs: capture(actual.jsxs) };
});

vi.mock("react/jsx-dev-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
	const jsxDEV: typeof actual.jsxDEV = (type, props, key, isStaticChildren, source, self) => {
		if (type === "select" && (props as { id?: unknown } | null)?.id === "report-render-output-language") {
			mocks.selectProps.push(props as NativeSelectProps);
		}
		return actual.jsxDEV(type, props, key, isStaticChildren, source, self);
	};
	return { ...actual, jsxDEV };
});

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useLoaderData: () => ({ report: mocks.report }),
		useNavigate: () => mocks.navigate,
		useSearch: () => mocks.search,
	}),
	notFound: () => new Error("not found"),
	useRouteContext: () => ({
		clientConfig: { branding: { name: "Yonaris", url: "https://yonaris.example" } },
	}),
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => {
		const builder = {
			validator: () => builder,
			handler: () => vi.fn(),
		};
		return builder;
	},
}));

vi.mock("@/components/logo", () => ({
	Logo: () => <span>Yonaris</span>,
}));

vi.mock("@/components/prompt-chart-print", () => ({
	PromptChartPrint: (props: ChartBoundaryProps) => {
		mocks.chartProps.push(props);
		return <section data-chart-language={props.outputLanguage}>{props.promptName}</section>;
	},
}));

vi.mock("@/server/reports", () => ({
	getReportByIdFn: vi.fn(),
}));

import { Route } from "./$reportId";

function completedReport(outputLanguage: OutputLanguage) {
	return {
		id: "72000000-0000-4000-8000-000000000001",
		brandName: rawBrand,
		brandWebsite: "https://brand.example",
		status: "completed",
		outputLanguage,
		createdAt: new Date("2026-08-20T12:00:00.000Z"),
		rawOutput: {
			competitors: [{ name: rawCompetitor, domain: "raw-rival.example" }],
			prompts: [{ value: rawPrompt }],
			promptRuns: [
				{
					promptValue: rawPrompt,
					runs: [
						{
							model: "raw-model",
							version: "raw-version",
							webSearchEnabled: true,
							rawOutput: {
								citations: [{ title: rawCitationTitle, url: rawCitationUrl }],
							},
							webQueries: [rawQuery],
							textContent: rawAnswer,
							brandMentioned: true,
							competitorsMentioned: [rawCompetitor],
						},
					],
				},
			],
		},
	};
}

type TestRoute = {
	component: React.ComponentType;
	head: (input: {
		loaderData: { report: ReturnType<typeof completedReport> };
		match: { search: Record<string, unknown> };
	}) => { meta: Array<{ title?: string; name?: string; content?: string }> };
	validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
};

function renderRoute({
	persisted,
	override,
	uiLanguage,
}: {
	persisted: OutputLanguage;
	override?: unknown;
	uiLanguage: UiLanguage;
}) {
	mocks.report = completedReport(persisted);
	mocks.search = override === undefined ? {} : { outputLanguage: override };
	const Component = (Route as unknown as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={uiLanguage}>
			<Component />
		</I18nProvider>,
	);
}

describe("printable report output language", () => {
	beforeEach(() => {
		mocks.chartProps.length = 0;
		mocks.navigate.mockReset();
		mocks.report = completedReport("en");
		mocks.search = {};
		mocks.selectProps.length = 0;
	});

	it.each([
		{ persisted: "en", override: undefined, uiLanguage: "zh-CN", lang: "en", title: "AI Share of Voice Report" },
		{ persisted: "zh-CN", override: undefined, uiLanguage: "en", lang: "zh-CN", title: "AI 声量份额报告" },
		{ persisted: "en", override: "zh-CN", uiLanguage: "en", lang: "zh-CN", title: "AI 声量份额报告" },
		{ persisted: "zh-CN", override: "en", uiLanguage: "zh-CN", lang: "en", title: "AI Share of Voice Report" },
	] as const)(
		"renders persisted $persisted with override $override independently from $uiLanguage UI",
		({ persisted, override, uiLanguage, lang, title }) => {
			const markup = renderRoute({ persisted, override, uiLanguage });

			expect(markup).toContain(`<main lang="${lang}"`);
			expect(markup).toContain(title);
			expect(markup).toContain(`data-chart-language="${lang}"`);
			expect(mocks.selectProps.at(-1)).toMatchObject({ value: lang });
		},
	);

	it("falls back from an invalid query token to the persisted report language", () => {
		const markup = renderRoute({ persisted: "zh-CN", override: "zh", uiLanguage: "en" });

		expect(markup).toContain('<main lang="zh-CN"');
		expect(markup).toContain("AI 声量份额报告");
		expect((Route as unknown as TestRoute).validateSearch({ outputLanguage: "zh" })).toEqual({});
		expect((Route as unknown as TestRoute).validateSearch({ outputLanguage: "en" })).toEqual({
			outputLanguage: "en",
		});
	});

	it("defaults a legacy report with no persisted language to English without consulting the Chinese UI language", () => {
		mocks.report = { ...completedReport("en"), outputLanguage: undefined };
		mocks.search = {};
		const Component = (Route as unknown as TestRoute).component;
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<Component />
			</I18nProvider>,
		);

		expect(markup).toContain('<main lang="en"');
		expect(markup).toContain("AI Share of Voice Report");
		expect(markup).not.toContain("AI 声量份额报告");
	});

	it("localizes a non-completed report status inside the selected artifact language", () => {
		mocks.report = { ...completedReport("zh-CN"), status: "processing" };
		mocks.search = {};
		const Component = (Route as unknown as TestRoute).component;
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<Component />
			</I18nProvider>,
		);

		expect(markup).toContain('<main lang="zh-CN"');
		expect(markup).toContain("报告状态");
		expect(markup).toContain("生成中");
		expect(mocks.chartProps).toHaveLength(0);
	});

	it("renders the compact control on screen, hides it for print, and writes only an exact render query override", () => {
		const markup = renderRoute({ persisted: "en", uiLanguage: "zh-CN" });
		const select = mocks.selectProps.at(-1);

		expect(markup).toContain('for="report-render-output-language" class="text-slate-600">输出语言');
		expect(markup).toContain("print:hidden");
		expect(markup).toContain('<option value="en" selected="">English</option>');
		expect(markup).toContain('<option value="zh-CN">简体中文</option>');
		expect(select?.onChange).toBeTypeOf("function");
		select?.onChange?.({ target: { value: "zh-CN" } });
		const navigation = mocks.navigate.mock.calls.at(-1)?.[0] as {
			search: (previous: Record<string, unknown>) => Record<string, unknown>;
		};
		expect(navigation.search({ keep: "raw" })).toEqual({ keep: "raw", outputLanguage: "zh-CN" });

		mocks.navigate.mockClear();
		select?.onChange?.({ target: { value: "zh" } });
		expect(mocks.navigate).not.toHaveBeenCalled();
	});

	it("localizes every route-owned report section and explicit date while retaining a Chinese artifact under English UI", () => {
		const markup = renderRoute({ persisted: "zh-CN", uiLanguage: "en" });

		for (const visibleCopy of [
			"2026年8月20日",
			"AI 引擎表现",
			"竞争格局",
			"提及表现",
			"提示词分析",
			"内容缺口",
			"AI 热门检索词",
			"声量增长空间",
			"下一步行动建议",
			"战略优化",
			"持续监测",
			"竞争优势",
		]) {
			expect(markup).toContain(visibleCopy);
		}
		for (const staleEnglish of [
			"AI Engine Performance",
			"Competitive Landscape",
			"Mention Rate",
			"Prompt Analysis (continued)",
			"Content Gaps",
			"Top AI Search Queries",
			"What Should I Do Next?",
			"Strategic Optimization",
		]) {
			expect(markup).not.toContain(staleEnglish);
		}
	});

	it.each(["en", "zh-CN"] as const)("passes raw evidence byte-for-byte through the %s render boundary", (lang) => {
		const markup = renderRoute({ persisted: lang, uiLanguage: lang === "en" ? "zh-CN" : "en" });

		const chart = mocks.chartProps.at(-1);
		expect(markup).toContain(rawQuery);
		expect(markup).not.toContain(rawQuery.toLowerCase());
		expect(chart?.outputLanguage).toBe(lang);
		expect(chart?.promptName).toBe(rawPrompt);
		expect(chart?.brand.name).toBe(rawBrand);
		expect(chart?.competitors.map((competitor) => competitor.name)).toContain(rawCompetitor);
		expect(chart?.promptRuns[0]?.textContent).toBe(rawAnswer);
		expect(chart?.promptRuns[0]?.webQueries[0]).toBe(rawQuery);
		expect(chart?.promptRuns[0]?.rawOutput).toEqual({
			citations: [{ title: rawCitationTitle, url: rawCitationUrl }],
		});
	});

	it("uses the selected artifact language for route metadata", () => {
		const route = Route as unknown as TestRoute;
		const report = completedReport("zh-CN");

		expect(route.head({ loaderData: { report }, match: { search: {} } }).meta[0]?.title).toBe("AI 声量份额报告");
		expect(route.head({ loaderData: { report }, match: { search: { outputLanguage: "en" } } }).meta[0]?.title).toBe(
			"AI Share of Voice Report",
		);
	});
});
