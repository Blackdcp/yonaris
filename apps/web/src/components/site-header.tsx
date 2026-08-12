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

/** Map of page segments to display names */
const PAGE_NAMES: Record<string, string> = {
	visibility: "Visibility",
	"share-of-voice": "Share of Voice",
	"query-fan-out": "Query Fan-Out",
	opportunities: "Opportunities",
	prompts: "Prompts",
	citations: "Citations",
	brand: "Brand",
	competitors: "Competitors",
	llms: "LLMs",
	workflows: "Automation",
	sampling: "Sampling Operations",
	tools: "Provider Tools",
	access: "Customer Access",
};

function getPageDisplayName(segment: string): string {
	return PAGE_NAMES[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
}

function AdminBreadcrumbs({ pathname }: { pathname: string }) {
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
							<Link to="/reports">Reports</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>View Report</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		}
		// /reports
		return (
			<>
				<BreadcrumbItem className="hidden md:block">
					<span className="text-muted-foreground">Platform</span>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="hidden md:block" />
				<BreadcrumbItem>
					<BreadcrumbPage>Reports</BreadcrumbPage>
				</BreadcrumbItem>
			</>
		);
	}

	// /admin - show Platform > Customers
	if (segments.length === 1) {
		return (
			<>
				<BreadcrumbItem className="hidden md:block">
					<span className="text-muted-foreground">Platform</span>
				</BreadcrumbItem>
				<BreadcrumbSeparator className="hidden md:block" />
				<BreadcrumbItem>
					<BreadcrumbPage>Customers</BreadcrumbPage>
				</BreadcrumbItem>
			</>
		);
	}

	// /admin/workflows, /admin/tools, etc.
	const subPage = segments[1];
	return (
		<>
			<BreadcrumbItem className="hidden md:block">
				<span className="text-muted-foreground">Platform</span>
			</BreadcrumbItem>
			<BreadcrumbSeparator className="hidden md:block" />
			<BreadcrumbItem>
				<BreadcrumbPage>{getPageDisplayName(subPage)}</BreadcrumbPage>
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
	const pageName = pageSegment ? getPageDisplayName(pageSegment) : "Overview";

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
									Visibility
								</Link>
							) : (
								<span>Visibility</span>
							)}
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Prompt History</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			) : isSettingsSubPage ? (
				<>
					<BreadcrumbItem className="hidden md:block">
						<span className="text-muted-foreground">Settings</span>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{getPageDisplayName(subSegment)}</BreadcrumbPage>
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
						<BreadcrumbPage>Edit</BreadcrumbPage>
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
	const { brandId, brand } = useBrand();
	const { pathname } = useLocation();

	const isAdminPage = pathname.startsWith("/admin") || pathname.startsWith("/reports");
	const platformContextLabel =
		pathname.startsWith("/reports") && !isPlatformAdmin ? "Report operations" : "Platform administration";

	return (
		<header
			data-slot="site-header"
			data-page-context={isAdminPage ? "admin" : "brand"}
			className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
		>
			<div className="flex w-full items-center gap-3 px-4 lg:px-6">
				<div className="flex min-w-0 flex-1 items-center gap-1 lg:gap-2">
					<SidebarTrigger className="-ml-1 cursor-pointer" />
					<Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
					<Breadcrumb>
						<BreadcrumbList>
							{isAdminPage ? (
								<AdminBreadcrumbs pathname={pathname} />
							) : (
								<BrandBreadcrumbs pathname={pathname} brandId={brandId} brandName={brand?.name || "Dashboard"} />
							)}
						</BreadcrumbList>
					</Breadcrumb>
					<Badge variant="outline" className="ml-2 hidden shrink-0 lg:inline-flex">
						{isAdminPage ? platformContextLabel : "Customer workspace"}
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
