import {
	IconBuilding,
	IconBuildingCommunity,
	IconBuildings,
	IconChartBar,
	IconClipboardCheck,
	IconDashboard,
	IconFolders,
	IconLink,
	IconListDetails,
	IconReport,
	IconSitemap,
	IconSpeakerphone,
	IconTable,
	IconTarget,
	IconTimeline,
	IconTool,
	IconUsers,
} from "@tabler/icons-react";
import { Link, useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";

import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@workspace/ui/components/sidebar";
import type * as React from "react";
import { Logo } from "@/components/logo";
import { type NavGroup, NavMain } from "@/components/nav-main";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	isAdmin?: boolean;
	hasReportAccess?: boolean;
	/** Whether this user may change the current brand's configuration. */
	canManageBrand?: boolean;
	/** When true, only show admin section (no brand-specific nav) */
	adminOnly?: boolean;
	/** Brand data from route loader — avoids a separate client-side fetch */
	brand?: { id: string; name: string; onboarded: boolean } | null;
}

export function AppSidebar({
	isAdmin = false,
	hasReportAccess = false,
	canManageBrand = true,
	adminOnly = false,
	brand,
	...props
}: AppSidebarProps) {
	const { setOpenMobile } = useSidebar();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	// Reports are disabled entirely in cloud; hide the nav entry there.
	const reportsEnabled = context.clientConfig?.features.reportGeneration ?? true;

	const showAdminSection = adminOnly && (isAdmin || (hasReportAccess && reportsEnabled));

	const groups: NavGroup[] = [];

	// Dashboard section - only show if we have a brand context and not admin-only
	if (!adminOnly) {
		const dashboardItems = [
			{
				title: "Overview",
				url: "/",
				icon: IconDashboard,
			},
		];

		// Only show Visibility and Citations if the brand is onboarded
		if (brand?.onboarded) {
			dashboardItems.push(
				{
					title: "Programs",
					url: "/programs",
					icon: IconFolders,
				},
				{
					title: "Visibility",
					url: "/visibility",
					icon: IconChartBar,
				},
				{
					title: "Share of Voice",
					url: "/share-of-voice",
					icon: IconSpeakerphone,
				},
				{
					title: "Query Fan-Out",
					url: "/query-fan-out",
					icon: IconSitemap,
				},
				{
					title: "Citations",
					url: "/citations",
					icon: IconLink,
				},
				{
					title: "Opportunities",
					url: "/opportunities",
					icon: IconTarget,
				},
			);
		}

		groups.push({
			label: "Dashboard",
			items: dashboardItems,
		});

		// Settings section - only show if onboarded
		if (brand?.onboarded && canManageBrand) {
			groups.push({
				label: "Settings",
				items: [
					{
						title: "Brand",
						url: "/settings/brand",
						icon: IconBuilding,
					},
					{
						title: "Competitors",
						url: "/settings/competitors",
						icon: IconBuildings,
					},
					{
						title: "Prompts",
						url: "/settings/prompts",
						icon: IconListDetails,
					},
					...(context.clientConfig?.features.teamInvites
						? [{ title: "Team", url: "/settings/members", icon: IconUsers }]
						: []),
				],
			});
		}
	}

	// Admin section
	if (showAdminSection) {
		const reportsItem = {
			title: "Reports",
			url: "/reports",
			icon: IconReport,
			absolute: true,
		};
		const adminItems = isAdmin
			? [
					{
						title: "Customers",
						url: "/admin",
						icon: IconTable,
						absolute: true,
					},
					{
						title: "Customer access",
						url: "/admin/access",
						icon: IconBuildingCommunity,
						absolute: true,
					},
					...(reportsEnabled ? [reportsItem] : []),
					{
						title: "Automation",
						url: "/admin/workflows",
						icon: IconTimeline,
						absolute: true,
					},
					{
						title: "Sampling operations",
						url: "/admin/sampling",
						icon: IconClipboardCheck,
						absolute: true,
					},
					{
						title: "Provider tools",
						url: "/admin/tools",
						icon: IconTool,
						absolute: true,
					},
				]
			: [reportsItem];

		groups.push({
			label: "Platform administration",
			items: adminItems,
		});
	}

	return (
		<Sidebar variant="inset" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to={adminOnly ? (isAdmin ? "/admin" : "/reports") : "/app"} onClick={() => setOpenMobile(false)}>
								<Logo iconClassName="!size-5" />
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={groups} />
			</SidebarContent>
		</Sidebar>
	);
}
