import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const mocks = vi.hoisted(() => ({ pathname: "/app/brand-1", brandName: "Acme" as string | undefined }));

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
	SidebarTrigger: ({ label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) => (
		<button type="button" aria-label={label} {...props} />
	),
}));
vi.mock("@/components/demo-mode-pill", () => ({ DemoModePill: () => null }));
vi.mock("@/components/measurement-scope-switcher", () => ({ MeasurementScopeSwitcher: () => null }));
vi.mock("@/components/nav-user", () => ({ NavUser: () => null }));
vi.mock("@/hooks/use-brands", () => ({
	useBrand: () => ({ brandId: "brand-1", brand: mocks.brandName ? { name: mocks.brandName } : undefined }),
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
		mocks.brandName = "Acme";
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

	it.each([
		["/app/brand-1/programs", "项目"],
		["/app/brand-1/settings", "设置"],
		["/app/brand-1/settings/members", "成员"],
	])("localizes the reachable %s breadcrumb", (pathname, expected) => {
		const markup = renderHeader("zh-CN", pathname);

		expect(markup).toContain(expected);
		expect(markup).not.toContain(
			pathname
				.split("/")
				.at(-1)
				?.replace(/^./, (letter) => letter.toUpperCase()),
		);
	});

	it("uses a localized brand-name fallback while brand data is unavailable", () => {
		mocks.brandName = undefined;

		const markup = renderHeader("zh-CN", "/app/brand-1");

		expect(markup).toContain("控制台");
		expect(markup).not.toContain("Dashboard");
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
