import { Link, useLocation } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { DemoModePill } from "@/components/demo-mode-pill";
import { MeasurementScopeSwitcher } from "@/components/measurement-scope-switcher";
import { NavUser } from "@/components/nav-user";
import { useBrand } from "@/hooks/use-brands";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";

/** Map of page segments to display names */
const PAGE_NAME_IDS: Record<string, MessageId> = {
	programs: "navigation.programs",
	visibility: "navigation.visibility",
	"share-of-voice": "navigation.shareOfVoice",
	"query-fan-out": "navigation.queryFanOut",
	opportunities: "navigation.opportunities",
	prompts: "navigation.prompts",
	citations: "navigation.citations",
	brand: "navigation.brand",
	competitors: "navigation.competitors",
	settings: "navigation.settings",
	members: "navigation.members",
	llms: "navigation.llms",
	workflows: "navigation.automation",
	sampling: "navigation.samplingOperations",
	tools: "navigation.providerTools",
	access: "navigation.customerAccess",
};

function getPageDisplayName(segment: string, t: (id: MessageId) => string): string {
	const messageId = PAGE_NAME_IDS[segment];
	return messageId ? t(messageId) : segment.charAt(0).toUpperCase() + segment.slice(1);
}

function AdminBreadcrumbs({ pathname }: { pathname: string }) {
	const { t } = useI18n();
	const segments = pathname.split("/").filter(Boolean);
	// /admin -> ["admin"]
	// /admin/workflows -> ["admin", "workflows"]
	// /admin/tools -> ["admin", "tools"]
	// /reports -> ["reports"]

	if (segments[0] === "reports") {
		// /reports/render/[id] - keep existing behavior
		if (segments.length > 1) {
			return (
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink asChild>
							<Link to="/reports">{t("navigation.reports")}</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{t("navigation.viewReport")}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		}
		// /reports
		return (
			<>
				<BreadcrumbItem className="hidden md:block">
					<span className="text-muted-foreground">{t("navigation.platform")}</span>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="hidden md:block" />
				<BreadcrumbItem>
					<BreadcrumbPage>{t("navigation.reports")}</BreadcrumbPage>
				</BreadcrumbItem>
			</>
		);
	}

	// /admin - show Platform > Customers
	if (segments.length === 1) {
		return (
			<>
				<BreadcrumbItem className="hidden md:block">
					<span className="text-muted-foreground">{t("navigation.platform")}</span>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="hidden md:block" />
				<BreadcrumbItem>
					<BreadcrumbPage>{t("navigation.customers")}</BreadcrumbPage>
				</BreadcrumbItem>
			</>
		);
	}

	// /admin/workflows, /admin/tools, etc.
	const subPage = segments[1];
	return (
		<>
			<BreadcrumbItem className="hidden md:block">
				<span className="text-muted-foreground">{t("navigation.platform")}</span>
			</BreadcrumbItem>
			<BreadcrumbSeparator className="hidden md:block" />
			<BreadcrumbItem>
				<BreadcrumbPage>{getPageDisplayName(subPage, t)}</BreadcrumbPage>
			</BreadcrumbItem>
		</>
	);
}

function BrandBreadcrumbs({
	pathname,
	brandId,
	brandName,
}: {
	pathname: string;
	brandId: string | undefined;
	brandName: string;
}) {
	const { t } = useI18n();
	// Extract the page segment from the path (e.g., /app/foo/prompts -> prompts)
	const pathSegments = pathname.split("/");
	const brandIndex = pathSegments.indexOf("app");
	const pageSegment = brandIndex >= 0 && pathSegments[brandIndex + 2] ? pathSegments[brandIndex + 2] : "";
	const subSegment = brandIndex >= 0 && pathSegments[brandIndex + 3] ? pathSegments[brandIndex + 3] : "";

	// Check if we're on a specific prompt detail page (e.g., /app/foo/prompts/uuid)
	const isPromptDetailPage =
		pageSegment === "prompts" &&
		subSegment &&
		subSegment !== "edit" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subSegment);

	// Check if we're on an edit page
	const isEditPage = pathname.endsWith("/edit");

	// Settings sub-pages: /app/brandId/settings/brand, /app/brandId/settings/competitors, etc.
	const isSettingsSubPage = pageSegment === "settings" && subSegment;

	// Determine page name
	const pageName = pageSegment ? getPageDisplayName(pageSegment, t) : t("navigation.overview");

	return (
		<>
			<BreadcrumbItem className="hidden md:block">
				<BreadcrumbLink asChild>
					{brandId ? (
						<Link to="/app/$brand" params={{ brand: brandId }}>
							{brandName}
						</Link>
					) : (
						<span>{brandName}</span>
					)}
				</BreadcrumbLink>
			</BreadcrumbItem>
			<BreadcrumbSeparator className="hidden md:block" />
			{isPromptDetailPage ? (
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink asChild>
							{brandId ? (
								<Link to="/app/$brand/visibility" params={{ brand: brandId }}>
									{t("navigation.visibility")}
								</Link>
							) : (
								<span>{t("navigation.visibility")}</span>
							)}
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{t("navigation.promptHistory")}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			) : isSettingsSubPage ? (
				<>
					<BreadcrumbItem className="hidden md:block">
						<span className="text-muted-foreground">{t("navigation.settings")}</span>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{getPageDisplayName(subSegment, t)}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			) : isEditPage ? (
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink asChild>
							<Link to={pathname.slice(0, -5)}>{pageName}</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{t("navigation.edit")}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			) : (
				<BreadcrumbItem>
					<BreadcrumbPage>{pageName}</BreadcrumbPage>
				</BreadcrumbItem>
			)}
		</>
	);
}

interface SiteHeaderProps {
	isPlatformAdmin?: boolean;
}

export function SiteHeader({ isPlatformAdmin = false }: SiteHeaderProps) {
	const { t } = useI18n();
	const { brandId, brand } = useBrand();
	const { pathname } = useLocation();

	const isAdminPage = pathname.startsWith("/admin") || pathname.startsWith("/reports");
	const platformContextLabel =
		pathname.startsWith("/reports") && !isPlatformAdmin
			? t("navigation.reportOperations")
			: t("navigation.platformAdministration");

	return (
		<header
			data-slot="site-header"
			data-page-context={isAdminPage ? "admin" : "brand"}
			className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<div className="flex w-full items-center gap-3 px-4 lg:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-1 lg:gap-2">
					<SidebarTrigger className="-ml-1 cursor-pointer" label={t("accessibility.toggleSidebar")} />
					<Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
					<Breadcrumb label={t("accessibility.breadcrumb")} moreLabel={t("accessibility.more")}>
						<BreadcrumbList>
							{isAdminPage ? (
								<AdminBreadcrumbs pathname={pathname} />
							) : (
								<BrandBreadcrumbs
									pathname={pathname}
									brandId={brandId}
									brandName={brand?.name || t("navigation.dashboard")}
								/>
							)}
						</BreadcrumbList>
					</Breadcrumb>
					<Badge variant="outline" className="ml-2 hidden shrink-0 lg:inline-flex">
						{isAdminPage ? platformContextLabel : t("navigation.customerWorkspace")}
					</Badge>
				</div>
				<div data-slot="site-header-actions" className="ml-auto flex shrink-0 items-center gap-2">
					{!isAdminPage && <MeasurementScopeSwitcher />}
					<DemoModePill />
					<NavUser />
				</div>
			</div>
		</header>
	);
}
