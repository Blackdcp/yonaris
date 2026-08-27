import type { OutputLanguage, UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const harness = vi.hoisted(() => ({
	selection: {
		outputLanguage: "zh-CN" as OutputLanguage,
		isResolved: true,
		setOutputLanguage: vi.fn(),
	},
	selectionCalls: [] as unknown[][],
	listProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: ReactNode }) => <a href="/raw">{children}</a>,
	useSearch: ({ select }: { select: (value: Record<string, unknown>) => unknown }) => select({}),
}));
vi.mock("@/components/filter-bar", () => ({
	ALL_MODELS_VALUE: "all",
	getAvailableModels: (models: string[]) => models,
}));
vi.mock("@/components/filtered-list-shell", () => ({
	FilteredListShell: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
vi.mock("@/components/page-header", () => ({
	PageHeader: ({ title, children }: { title: string; children: ReactNode }) => (
		<main>
			<h1>{title}</h1>
			{children}
		</main>
	),
}));
vi.mock("@/components/prompt-order-dropdown", () => ({ PromptOrderDropdown: () => null }));
vi.mock("@/components/visibility-bar-section", () => ({ VisibilityBarSection: () => null }));
vi.mock("@/components/virtualized-prompt-list", () => ({
	VirtualizedPromptList: (props: Record<string, unknown>) => {
		harness.listProps.push(props);
		return <div data-slot="virtualized-prompt-list" />;
	},
}));
vi.mock("@/contexts/chart-data-context", () => ({
	ChartDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/use-artifact-language-selection", () => ({
	useArtifactLanguageSelection: (...args: unknown[]) => {
		harness.selectionCalls.push(args);
		return harness.selection;
	},
}));
vi.mock("@/hooks/use-batch-chart-data", () => ({
	useBatchChartData: () => ({
		isLoading: false,
		batchChartData: {
			brand: { id: "brand/raw-id", name: "Brand 原名" },
			competitors: [{ id: "competitor/raw-id", name: "原始竞品 / Raw Rival" }],
			chartData: {},
			dateRange: { fromDate: "2026-08-20T00:00:00.000Z", toDate: "2026-08-21T00:00:00.000Z" },
		},
	}),
}));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brand: { id: "brand/raw-id", name: "Brand 原名" } }),
}));
vi.mock("@/hooks/use-list-filters", () => ({
	useListFilters: () => ({
		scopeId: "scope/CN-id",
		model: "all",
		lookback: "1m",
		tags: [],
		search: "",
		isScopeResolving: false,
	}),
}));
vi.mock("@/hooks/use-prompts-summary", () => ({
	usePromptsSummary: () => ({
		isLoading: false,
		isError: false,
		promptsSummary: {
			availableTags: [],
			prompts: [{ id: "prompt/raw-id", value: "RAW Prompt 原样 #42", firstEvaluatedAt: null }],
		},
	}),
}));
vi.mock("@/hooks/use-scope-models", () => ({
	useScopeModels: () => ({ models: ["model/raw"], isResolved: true }),
}));

import { PromptsDisplay } from "./prompts-display";

function renderPage(uiLanguage: UiLanguage): string {
	return renderToStaticMarkup(
		<I18nProvider locale={uiLanguage}>
			<PromptsDisplay
				exportLanguageSurface="visibility-chart-export"
				pageTitle={uiLanguage === "en" ? "Visibility" : "可见度"}
				pageDescription="raw description"
			/>
		</I18nProvider>,
	);
}

describe("dashboard chart export-language propagation", () => {
	beforeEach(() => {
		harness.selectionCalls.length = 0;
		harness.listProps.length = 0;
		harness.selection.outputLanguage = "zh-CN";
		harness.selection.isResolved = true;
		harness.selection.setOutputLanguage.mockClear();
	});

	it.each([
		{ uiLanguage: "en", outputLanguage: "zh-CN" },
		{ uiLanguage: "zh-CN", outputLanguage: "en" },
	] as const)(
		"uses UI $uiLanguage only as the seed while passing stored $outputLanguage through the chart list",
		({ uiLanguage, outputLanguage }) => {
			harness.selection.outputLanguage = outputLanguage;
			const markup = renderPage(uiLanguage);

			expect(markup).toContain(uiLanguage === "en" ? "Visibility" : "可见度");
			expect(harness.selectionCalls.at(-1)).toEqual([
				"visibility-chart-export",
				"brand/raw-id",
				"scope/CN-id",
				uiLanguage,
			]);
			expect(harness.listProps.at(-1)).toMatchObject({
				brandId: "brand/raw-id",
				outputLanguage,
				outputLanguageResolved: true,
				onOutputLanguageChange: harness.selection.setOutputLanguage,
				prompts: [{ id: "prompt/raw-id", value: "RAW Prompt 原样 #42", firstEvaluatedAt: null }],
			});
		},
	);
});
