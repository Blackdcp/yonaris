import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const rawPrompt = "Prompt RAW::中国 & Singapore?";
const rawCitationUrl = "https://rival.example/raw?q=CN&model=gpt-5.6";

type CapturedOutputLanguageSelect = {
	onChange?: (event: { target: { value: string } }) => void;
};

const mocks = vi.hoisted(() => ({
	selection: {
		outputLanguage: "en" as "en" | "zh-CN",
		isResolved: true,
		setOutputLanguage: vi.fn(),
	},
	query: { data: undefined as unknown, isLoading: false, isError: false },
	queryCalls: [] as unknown[][],
	outputLanguageSelects: [] as CapturedOutputLanguageSelect[],
}));

vi.mock("react/jsx-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
	type JsxFactory = typeof actual.jsx;
	const capture = (factory: JsxFactory): JsxFactory =>
		((type, props, key) => {
			if (
				type === "select" &&
				typeof props === "object" &&
				props !== null &&
				"id" in props &&
				props.id === "opportunities-output-language"
			) {
				mocks.outputLanguageSelects.push(props as CapturedOutputLanguageSelect);
			}
			return factory(type, props, key);
		}) as JsxFactory;
	return { ...actual, jsx: capture(actual.jsx), jsxs: capture(actual.jsxs) };
});

vi.mock("react/jsx-dev-runtime", async () => {
	const actual = await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
	const jsxDEV: typeof actual.jsxDEV = (type, props, key, isStaticChildren, source, self) => {
		if (
			type === "select" &&
			typeof props === "object" &&
			props !== null &&
			"id" in props &&
			props.id === "opportunities-output-language"
		) {
			mocks.outputLanguageSelects.push(props as CapturedOutputLanguageSelect);
		}
		return actual.jsxDEV(type, props, key, isStaticChildren, source, self);
	};
	return { ...actual, jsxDEV };
});

function hrefFor(to: string, params?: Record<string, string>) {
	let href = to;
	for (const [key, value] of Object.entries(params ?? {})) href = href.replace(`$${key}`, value);
	return href;
}

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: Record<string, unknown>) => ({
		...options,
		options,
		useParams: () => ({ brand: "brand-raw-id" }),
	}),
	Link: ({ children, to, params }: { children: ReactNode; to: string; params?: Record<string, string> }) => (
		<a href={hrefFor(to, params)}>{children}</a>
	),
}));

vi.mock("@/components/page-header", () => ({
	PageHeader: ({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) => (
		<main data-slot="page-chrome">
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</main>
	),
}));

vi.mock("@/hooks/use-artifact-language-selection", () => ({
	useArtifactLanguageSelection: () => mocks.selection,
}));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: { id: "brand-raw-id", name: "Brand 原名" } }),
}));
vi.mock("@/hooks/use-list-filters", () => ({
	useListFilters: () => ({ scopeId: "scope-raw-id", isScopeResolving: false }),
}));
vi.mock("@/hooks/use-opportunities", () => ({
	useOpportunities: (...args: unknown[]) => {
		mocks.queryCalls.push(args);
		return mocks.query;
	},
}));

import { Route } from "./opportunities";

const report = {
	summary: ["MODEL_SUMMARY_RAW::保持 unchanged"],
	opportunities: [
		{
			category: "creation" as const,
			title: "MODEL_TITLE_RAW::保持 unchanged",
			why: "MODEL_WHY_RAW::keep byte identity",
			relatedPrompts: [{ text: rawPrompt, promptId: "prompt-raw-id" }],
			yourCitations: [],
			competitorCitations: [{ title: "Rival Citation 原文", domain: "Rival 原名", url: rawCitationUrl }],
		},
	],
	risks: ["MODEL_RISK_RAW::保持 unchanged"],
};

function populatedData(outputLanguage: "en" | "zh-CN") {
	return {
		reason: null,
		generatedFor: { brandName: "Brand 原名" },
		lastEvaluatedAt: "2026-08-15T00:00:00.000Z",
		outputLanguage,
		report,
	};
}

type TestRoute = { component: React.ComponentType };

function renderRoute(locale: UiLanguage) {
	const Component = (Route as unknown as TestRoute).component;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<Component />
		</I18nProvider>,
	);
}

describe("customer Opportunity output-language selection", () => {
	beforeEach(() => {
		mocks.selection.outputLanguage = "en";
		mocks.selection.isResolved = true;
		mocks.selection.setOutputLanguage.mockReset();
		mocks.query = { data: undefined, isLoading: false, isError: false };
		mocks.queryCalls.length = 0;
		mocks.outputLanguageSelects.length = 0;
	});

	it("gates the customer query until the tab-scoped selection resolves", () => {
		mocks.selection.outputLanguage = "zh-CN";
		mocks.selection.isResolved = false;
		mocks.query = { data: populatedData("zh-CN"), isLoading: false, isError: false };

		const markup = renderRoute("en");

		expect(mocks.queryCalls).toEqual([["brand-raw-id", "scope-raw-id", "zh-CN", false]]);
		expect(markup).toContain("Analyzing your citation landscape and drafting your opportunities…");
		expect(markup).not.toContain("Last evaluated");
		expect(markup).not.toContain("MODEL_TITLE_RAW");
	});

	it("keeps English page chrome while rendering the loaded Chinese artifact as the response truth", () => {
		mocks.selection.outputLanguage = "en";
		mocks.query = { data: populatedData("zh-CN"), isLoading: false, isError: false };

		const markup = renderRoute("en");

		expect(markup).toContain('data-slot="page-chrome"');
		expect(markup).toContain("<h1>Opportunities</h1>");
		expect(markup).toContain('for="opportunities-output-language">Output language');
		expect(markup).toContain(
			"This only sets the report content language. It does not change the Portal interface language.",
		);
		expect(markup).toContain('lang="zh-CN"');
		expect(markup).toContain('data-slot="opportunities-report"');
		expect(markup).toContain("摘要");
		expect(markup).toContain("内容创作");
		expect(markup).not.toContain("Content Creation");
		expect(mocks.queryCalls).toEqual([["brand-raw-id", "scope-raw-id", "en", true]]);
	});

	it("keeps Chinese page chrome while rendering the loaded English artifact as the response truth", () => {
		mocks.selection.outputLanguage = "zh-CN";
		mocks.query = { data: populatedData("en"), isLoading: false, isError: false };

		const markup = renderRoute("zh-CN");

		expect(markup).toContain("<h1>优化机会</h1>");
		expect(markup).toContain('for="opportunities-output-language">输出语言');
		expect(markup).toContain("仅决定本报告的内容语言，不会改变 Portal 界面语言。");
		expect(markup).toContain('lang="en"');
		expect(markup).toContain('data-slot="opportunities-report"');
		expect(markup).toContain("Summary");
		expect(markup).toContain("Content Creation");
		expect(markup).not.toContain("内容创作");
		expect(mocks.queryCalls).toEqual([["brand-raw-id", "scope-raw-id", "zh-CN", true]]);
	});

	it.each(["en", "zh-CN"] as const)(
		"preserves raw model, Prompt, citation, URL, brand, and competitor bytes in %s",
		(output) => {
			mocks.selection.outputLanguage = output;
			mocks.query = { data: populatedData(output), isLoading: false, isError: false };

			const markup = renderRoute(output === "en" ? "zh-CN" : "en");

			for (const raw of [
				"MODEL_SUMMARY_RAW::保持 unchanged",
				"MODEL_TITLE_RAW::保持 unchanged",
				"MODEL_WHY_RAW::keep byte identity",
				"MODEL_RISK_RAW::保持 unchanged",
				rawPrompt,
				"Rival Citation 原文",
				"Rival 原名",
			]) {
				expect(markup).toContain(raw.replaceAll("&", "&amp;"));
			}
			expect(markup).toContain(`href="${rawCitationUrl.replaceAll("&", "&amp;")}"`);
		},
	);

	it("changes the independent selection, gates the transition, then reads only the missing Chinese variant", () => {
		mocks.selection.outputLanguage = "en";
		mocks.query = {
			data: {
				reason: "not_generated",
				generatedFor: null,
				lastEvaluatedAt: null,
				outputLanguage: "en",
				report: null,
			},
			isLoading: false,
			isError: false,
		};

		renderRoute("zh-CN");
		const select = mocks.outputLanguageSelects.at(-1);
		expect(select?.onChange).toBeTypeOf("function");
		select?.onChange?.({ target: { value: "zh-CN" } });
		expect(mocks.selection.setOutputLanguage).toHaveBeenCalledWith("zh-CN");

		mocks.queryCalls.length = 0;
		mocks.outputLanguageSelects.length = 0;
		mocks.selection.outputLanguage = "zh-CN";
		mocks.selection.isResolved = false;
		renderRoute("zh-CN");
		expect(mocks.queryCalls).toEqual([["brand-raw-id", "scope-raw-id", "zh-CN", false]]);

		mocks.queryCalls.length = 0;
		mocks.selection.isResolved = true;
		mocks.query = {
			data: {
				reason: "not_generated",
				generatedFor: null,
				lastEvaluatedAt: null,
				outputLanguage: "zh-CN",
				report: null,
			},
			isLoading: false,
			isError: false,
		};

		const markup = renderRoute("zh-CN");

		expect(mocks.queryCalls).toEqual([["brand-raw-id", "scope-raw-id", "zh-CN", true]]);
		expect(markup).toContain("管理员尚未为此项目生成优化机会");
	});
});
