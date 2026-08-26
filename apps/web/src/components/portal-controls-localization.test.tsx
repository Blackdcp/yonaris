import type { UiLanguage } from "@workspace/config/language";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({
	pathname: "/app/brand-1",
	readOnly: true,
	search: { model: undefined, lookback: "1m", tags: undefined, q: "needle", scope: undefined } as Record<
		string,
		string | undefined
	>,
	brand: {
		earliestDataDate: null,
		prompts: [],
		measurementScopes: [
			{
				id: "scope-us",
				name: "US Search",
				market: "US",
				locale: "en-US",
				timezone: "America/New_York",
				deliveryMode: "live",
				lane: "scored",
				enabled: true,
				isDefault: true,
			},
			{
				id: "scope-uk",
				name: "UK Observation",
				market: "GB",
				locale: "en-GB",
				timezone: "Europe/London",
				deliveryMode: "live",
				lane: "observation",
				enabled: true,
				isDefault: false,
			},
		],
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: mocks.pathname }),
	useNavigate: () => vi.fn(),
	useParams: () => ({ brand: "brand-1" }),
	useRouteContext: () => ({ clientConfig: { features: { readOnly: mocks.readOnly } } }),
	useSearch: ({ select }: { select: (search: Record<string, string | undefined>) => unknown }) => select(mocks.search),
}));

vi.mock("@/hooks/use-brands", () => ({ useBrand: () => ({ brand: mocks.brand }) }));
vi.mock("@/hooks/use-list-filters", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-list-filters")>()),
	useFilterNavigate: () => vi.fn(),
}));

vi.mock("@workspace/ui/components/button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}));
vi.mock("@workspace/ui/components/input", () => ({
	Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@workspace/ui/components/checkbox", () => ({ Checkbox: () => <span data-checkbox="true" /> }));
vi.mock("@workspace/ui/components/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuRadioGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuRadioItem: ({ children, value }: { children: ReactNode; value: string }) => (
		<div data-value={value}>{children}</div>
	),
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@workspace/ui/components/popover", () => ({
	Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@workspace/ui/components/tooltip", () => ({
	Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	TooltipTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { DemoModePill } from "./demo-mode-pill";
import { FilterBar } from "./filter-bar";
import { ListPagination } from "./list-pagination";
import { MeasurementScopeSwitcher } from "./measurement-scope-switcher";
import { PageHeader } from "./page-header";

function renderWithLocale(locale: UiLanguage, children: ReactNode): string {
	return renderToStaticMarkup(<I18nProvider locale={locale}>{children}</I18nProvider>);
}

describe("portal control localization", () => {
	beforeEach(() => {
		mocks.search = { model: undefined, lookback: "1m", tags: undefined, q: "needle", scope: undefined };
		mocks.readOnly = true;
	});

	it("localizes filters, result grammar, search accessibility, and keeps filter values unchanged", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<FilterBar
				availableTags={[]}
				availableModels={["all", "gpt-5"]}
				showSearch
				showModelSelector
				resultCount={1234}
				resultTotal={2000}
			/>,
		);

		expect(markup).toContain("所有模型");
		expect(markup).toContain("标签");
		expect(markup).toContain("没有可用标签");
		expect(markup).toContain("最近 30 天");
		expect(markup).toContain("1,234 / 2,000 个结果");
		expect(markup).toContain('placeholder="搜索提示词…"');
		expect(markup).toContain('aria-label="清除搜索"');
		expect(markup).toContain('data-value="all"');
		expect(markup).toContain('data-value="1m"');
		expect(markup).not.toContain("All models");
	});

	it("localizes measurement lane copy without translating Program market, locale, timezone, or scope id", () => {
		const markup = renderWithLocale("zh-CN", <MeasurementScopeSwitcher />);

		expect(markup).toContain("US Search | US/en-US | 评分抽样");
		expect(markup).toContain("US / en-US / America/New_York / 评分抽样");
		expect(markup).toContain('data-value="scope-us"');
	});

	it("localizes demo, page-info accessibility, and pagination while preserving page values", () => {
		const markup = renderWithLocale(
			"zh-CN",
			<>
				<DemoModePill />
				<PageHeader title="可见度" subtitle="说明" infoContent="详情" />
				<ListPagination page={1} pageSize={10} totalItems={42} onPageChange={vi.fn()} />
			</>,
		);

		expect(markup).toContain("演示");
		expect(markup).toContain("这是只读演示，任何编辑都会失败。");
		expect(markup).toContain('aria-label="更多信息"');
		expect(markup).toContain("11–20 / 42");
		expect(markup).toContain("上一页");
		expect(markup).toContain("下一页");
	});
});
