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
import { useI18n } from "@/i18n/provider";

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
	const { t } = useI18n();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	// Reports are disabled entirely in cloud; hide the nav entry there.
	const reportsEnabled = context.clientConfig?.features.reportGeneration ?? true;

	const showAdminSection = adminOnly && (isAdmin || (hasReportAccess && reportsEnabled));

	const groups: NavGroup[] = [];

	// Dashboard section - only show if we have a brand context and not admin-only
	if (!adminOnly) {
		const dashboardItems = [
			{
				title: t("navigation.overview"),
				url: "/",
				icon: IconDashboard,
			},
		];

		// Only show Visibility and Citations if the brand is onboarded
		if (brand?.onboarded) {
			dashboardItems.push(
				{
					title: t("navigation.programs"),
					url: "/programs",
					icon: IconFolders,
				},
				{
					title: t("navigation.visibility"),
					url: "/visibility",
					icon: IconChartBar,
				},
				{
					title: t("navigation.shareOfVoice"),
					url: "/share-of-voice",
					icon: IconSpeakerphone,
				},
				{
					title: t("navigation.queryFanOut"),
					url: "/query-fan-out",
					icon: IconSitemap,
				},
				{
					title: t("navigation.citations"),
					url: "/citations",
					icon: IconLink,
				},
				{
					title: t("navigation.opportunities"),
					url: "/opportunities",
					icon: IconTarget,
				},
			);
		}

		groups.push({
			label: t("navigation.dashboard"),
			items: dashboardItems,
		});

		// Settings section - only show if onboarded
		if (brand?.onboarded && canManageBrand) {
			groups.push({
				label: t("navigation.settings"),
				items: [
					{
						title: t("navigation.brand"),
						url: "/settings/brand",
						icon: IconBuilding,
					},
					{
						title: t("navigation.competitors"),
						url: "/settings/competitors",
						icon: IconBuildings,
					},
					{
						title: t("navigation.prompts"),
						url: "/settings/prompts",
						icon: IconListDetails,
					},
					...(context.clientConfig?.features.teamInvites
						? [{ title: t("navigation.team"), url: "/settings/members", icon: IconUsers }]
						: []),
				],
			});
		}
	}

	// Admin section
	if (showAdminSection) {
		const reportsItem = {
			title: t("navigation.reports"),
			url: "/reports",
			icon: IconReport,
			absolute: true,
		};
		const adminItems = isAdmin
			? [
					{
						title: t("navigation.customers"),
						url: "/admin",
						icon: IconTable,
						absolute: true,
					},
					{
						title: t("navigation.customerAccess"),
						url: "/admin/access",
						icon: IconBuildingCommunity,
						absolute: true,
					},
					...(reportsEnabled ? [reportsItem] : []),
					{
						title: t("navigation.automation"),
						url: "/admin/workflows",
						icon: IconTimeline,
						absolute: true,
					},
					{
						title: t("navigation.samplingOperations"),
						url: "/admin/sampling",
						icon: IconClipboardCheck,
						absolute: true,
					},
					{
						title: t("navigation.providerTools"),
						url: "/admin/tools",
						icon: IconTool,
						absolute: true,
					},
				]
			: [reportsItem];

		groups.push({
			label: t("navigation.platformAdministration"),
			items: adminItems,
		});
	}

	return (
		<Sidebar
			variant="inset"
			{...props}
			mobileTitle={t("accessibility.sidebarTitle")}
			mobileDescription={t("accessibility.sidebarDescription")}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link
								to={adminOnly ? (isAdmin ? "/admin" : "/reports") : "/app"}
								aria-label={
									adminOnly
										? isAdmin
											? t("navigation.openPlatformAdministration")
											: t("navigation.openReportOperations")
										: t("navigation.openCustomerWorkspace")
								}
								onClick={() => setOpenMobile(false)}
							>
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
