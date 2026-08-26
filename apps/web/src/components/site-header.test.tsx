import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({ pathname: "/app/brand-1" }));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
	useLocation: () => ({ pathname: mocks.pathname }),
}));
vi.mock("@workspace/ui/components/badge", () => ({
	Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@workspace/ui/components/breadcrumb", () => ({
	Breadcrumb: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
	BreadcrumbItem: ({ children }: { children: ReactNode }) => <span>{children}</span>,
	BreadcrumbLink: ({ children }: { children: ReactNode }) => <span>{children}</span>,
	BreadcrumbList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	BreadcrumbPage: ({ children }: { children: ReactNode }) => <strong>{children}</strong>,
	BreadcrumbSeparator: () => <i>/</i>,
}));
vi.mock("@workspace/ui/components/separator", () => ({ Separator: () => <i>|</i> }));
vi.mock("@workspace/ui/components/sidebar", () => ({
	SidebarTrigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} />,
}));
vi.mock("@/components/demo-mode-pill", () => ({ DemoModePill: () => null }));
vi.mock("@/components/measurement-scope-switcher", () => ({ MeasurementScopeSwitcher: () => null }));
vi.mock("@/components/nav-user", () => ({ NavUser: () => null }));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brandId: "brand-1", brand: { name: "Acme" } }),
}));

import { SiteHeader } from "./site-header";

function renderHeader(locale: UiLanguage, pathname: string, isPlatformAdmin = false): string {
	mocks.pathname = pathname;
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<SiteHeader isPlatformAdmin={isPlatformAdmin} />
		</I18nProvider>,
	);
}

describe("SiteHeader localization", () => {
	beforeEach(() => {
		mocks.pathname = "/app/brand-1";
	});

	it("localizes brand breadcrumbs, context, and the sidebar control", () => {
		const markup = renderHeader("zh-CN", "/app/brand-1/query-fan-out");

		expect(markup).toContain("Acme");
		expect(markup).toContain("AI 检索脉络");
		expect(markup).toContain("客户工作区");
		expect(markup).toContain('aria-label="切换侧边栏"');
		expect(markup).not.toContain("Query Fan-Out");
	});

	it("localizes settings and prompt-history breadcrumb branches", () => {
		expect(renderHeader("zh-CN", "/app/brand-1/settings/competitors")).toContain("设置");
		const promptMarkup = renderHeader("zh-CN", "/app/brand-1/prompts/3cd7d3f0-2442-43ee-853a-63f62d593b03");
		expect(promptMarkup).toContain("可见度");
		expect(promptMarkup).toContain("提示词历史");
	});

	it("localizes platform and report-operation breadcrumb branches", () => {
		const adminMarkup = renderHeader("zh-CN", "/admin/sampling", true);
		expect(adminMarkup).toContain("平台");
		expect(adminMarkup).toContain("抽样运营");
		expect(adminMarkup).toContain("平台管理");

		const reportMarkup = renderHeader("zh-CN", "/reports/render/report-1");
		expect(reportMarkup).toContain("报表");
		expect(reportMarkup).toContain("查看报表");
		expect(reportMarkup).toContain("报表运营");
	});
});
