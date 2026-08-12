import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
	useRouteContext: () => ({ clientConfig: { features: { reportGeneration: true } } }),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
	Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
	SidebarContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	useSidebar: () => ({ setOpenMobile: vi.fn() }),
}));

vi.mock("@/components/logo", () => ({ Logo: () => <span>Yonaris</span> }));
vi.mock("@/components/nav-main", () => ({
	NavMain: ({ groups }: { groups: { label: string; items: { title: string }[] }[] }) => (
		<nav>
			{groups.map((group) => (
				<section key={group.label}>
					<h2>{group.label}</h2>
					{group.items.map((item) => (
						<span key={item.title}>{item.title}</span>
					))}
				</section>
			))}
		</nav>
	),
}));

import { AppSidebar } from "./app-sidebar";

const onboardedBrand = { id: "brand-1", name: "Acme", onboarded: true };

describe("AppSidebar workspace separation", () => {
	it("shows only customer navigation inside a brand workspace, even for a platform admin", () => {
		const markup = renderToStaticMarkup(<AppSidebar isAdmin hasReportAccess canManageBrand brand={onboardedBrand} />);

		expect(markup).toContain("Dashboard");
		expect(markup).toContain("Programs");
		expect(markup).toContain("Settings");
		expect(markup).not.toContain("Platform administration");
		expect(markup).not.toContain("Sampling");
		expect(markup).not.toContain("Workflows");
		expect(markup).toContain('href="/app"');
	});

	it("shows only platform navigation inside the platform administration shell", () => {
		const markup = renderToStaticMarkup(<AppSidebar isAdmin hasReportAccess adminOnly brand={onboardedBrand} />);

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
		const markup = renderToStaticMarkup(
			<AppSidebar isAdmin={false} hasReportAccess adminOnly brand={onboardedBrand} />,
		);

		expect(markup).toContain("Platform administration");
		expect(markup).toContain("Reports");
		expect(markup).not.toContain("Customers");
		expect(markup).not.toContain("Customer access");
		expect(markup).not.toContain("Sampling");
		expect(markup).not.toContain("Programs");
	});
});
