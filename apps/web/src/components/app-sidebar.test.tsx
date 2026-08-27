import type { UiLanguage } from "@workspace/config/language";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const sharedUi = vi.hoisted(() => ({ sidebarProps: [] as Array<Record<string, unknown>> }));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useLocation: () => ({ pathname: "/app/brand-1" }),
	useParams: () => ({ brand: "brand-1" }),
	useRouteContext: () => ({ clientConfig: { features: { reportGeneration: true } } }),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
	Sidebar: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
		sharedUi.sidebarProps.push(props);
		return <aside>{children}</aside>;
	},
	SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	SidebarGroup: ({ children }: { children: ReactNode }) => <section>{children}</section>,
	SidebarGroupLabel: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	useSidebar: () => ({ setOpenMobile: vi.fn() }),
}));

vi.mock("@/components/logo", () => ({ Logo: () => <span>Yonaris</span> }));

import { AppSidebar } from "./app-sidebar";

const onboardedBrand = { id: "brand-1", name: "Acme", onboarded: true };

function renderSidebar(props: React.ComponentProps<typeof AppSidebar>, locale: UiLanguage = "en"): string {
	return renderToStaticMarkup(
		<I18nProvider locale={locale}>
			<AppSidebar {...props} />
		</I18nProvider>,
	);
}

describe("AppSidebar workspace separation", () => {
	beforeEach(() => {
		sharedUi.sidebarProps.length = 0;
	});

	it("shows only customer navigation inside a brand workspace, even for a platform admin", () => {
		const markup = renderSidebar({ isAdmin: true, hasReportAccess: true, canManageBrand: true, brand: onboardedBrand });

		expect(markup).toContain("Dashboard");
		expect(markup).toContain("Programs");
		expect(markup).toContain("Settings");
		expect(markup).not.toContain("Platform administration");
		expect(markup).not.toContain("Sampling");
		expect(markup).not.toContain("Workflows");
		expect(markup).toContain('href="/app"');
	});

	it("shows only platform navigation inside the platform administration shell", () => {
		const markup = renderSidebar({ isAdmin: true, hasReportAccess: true, adminOnly: true, brand: onboardedBrand });

		expect(markup).toContain("Platform administration");
		expect(markup).toContain("Customers");
		expect(markup).toContain("Customer access");
		expect(markup).toContain("Reports");
		expect(markup).toContain("Sampling");
		expect(markup).not.toContain("Dashboard");
		expect(markup).not.toContain("Programs");
		expect(markup).not.toContain("Settings");
		expect(markup).toContain('href="/admin"');
	});

	it("keeps report-only access in the platform shell without exposing other platform tools", () => {
		const markup = renderSidebar({ isAdmin: false, hasReportAccess: true, adminOnly: true, brand: onboardedBrand });

		expect(markup).toContain("Platform administration");
		expect(markup).toContain("Reports");
		expect(markup).not.toContain("Customers");
		expect(markup).not.toContain("Customer access");
		expect(markup).not.toContain("Sampling");
		expect(markup).not.toContain("Programs");
	});

	it("localizes customer navigation labels and the workspace link without changing its destination", () => {
		const markup = renderSidebar({ brand: onboardedBrand }, "zh-CN");

		expect(markup).toContain("控制台");
		expect(markup).toContain("概览");
		expect(markup).toContain("项目");
		expect(markup).toContain("AI 检索脉络");
		expect(markup).toContain("竞争对手");
		expect(markup).toContain('href="/app"');
		expect(markup).toContain('href="/app/brand-1/programs"');
		expect(markup).toContain('aria-label="打开客户工作区"');
		expect(markup).not.toContain("Programs");
		expect(markup).not.toContain("Query Fan-Out");
	});

	it("renders the English overview and programs destinations unchanged", () => {
		const markup = renderSidebar({ brand: onboardedBrand }, "en");

		expect(markup).toContain("Overview");
		expect(markup).toContain("Programs");
		expect(markup).toContain('href="/app/brand-1/"');
		expect(markup).toContain('href="/app/brand-1/programs"');
	});

	it.each([
		["en", "Sidebar", "Displays the mobile sidebar."],
		["zh-CN", "侧边栏", "显示移动端侧边栏。"],
	] as const)("passes localized %s mobile accessibility props to Sidebar", (locale, title, description) => {
		renderSidebar({ brand: onboardedBrand }, locale);

		expect(sharedUi.sidebarProps.at(-1)).toMatchObject({
			mobileTitle: title,
			mobileDescription: description,
		});
	});

	it("localizes the complete platform navigation while preserving access gates", () => {
		const markup = renderSidebar(
			{ isAdmin: true, hasReportAccess: true, adminOnly: true, brand: onboardedBrand },
			"zh-CN",
		);

		expect(markup).toContain("平台管理");
		expect(markup).toContain("客户访问");
		expect(markup).toContain("抽样运营");
		expect(markup).toContain("供应商工具");
		expect(markup).toContain('href="/admin"');
		expect(markup).not.toContain("Customer access");
	});

	it("keeps every Chinese administration tool admin-only while report-only access gains nothing", () => {
		const adminMarkup = renderSidebar(
			{ isAdmin: true, hasReportAccess: true, adminOnly: true, brand: onboardedBrand },
			"zh-CN",
		);
		const reportOnlyMarkup = renderSidebar(
			{ isAdmin: false, hasReportAccess: true, adminOnly: true, brand: onboardedBrand },
			"zh-CN",
		);

		for (const label of ["客户", "客户访问", "自动化", "抽样运营", "供应商工具"]) {
			expect(adminMarkup).toContain(label);
			expect(reportOnlyMarkup).not.toContain(label);
		}
		expect(reportOnlyMarkup).toContain("报表");
		expect(reportOnlyMarkup).not.toContain('href="/admin/sampling"');
		expect(reportOnlyMarkup).not.toContain('href="/admin/tools"');
	});
});
