/**
 * Stories for <AppSidebar /> across deployment environments.
 *
 * Six stories matching the real deployment scenarios:
 *  - Local (self-hosted, no auth)
 *  - Demo (read-only preview)
 *  - Whitelabel
 *  - Whitelabel Admin (admin section visible)
 *  - Whitelabel Report-only (limited admin access)
 *  - Whitelabel Onboarding (brand not yet onboarded)
 */
import type { Meta } from "@storybook/react";
import { DEFAULT_CHART_COLORS } from "@workspace/config/constants";
import type { BrandWithPrompts } from "@workspace/lib/db/schema";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { type ClientConfig, setMockClientConfig } from "./_mocks/config-client";
import { setMockRouteContext } from "./_mocks/tanstack-router";
import { setMockAuth } from "./_mocks/use-auth";
import { setMockBrand } from "./_mocks/use-brands";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const CHART_COLORS = DEFAULT_CHART_COLORS.slice(0, 8);

const onboardedBrand: BrandWithPrompts = {
	id: "brand-1",
	name: "Acme Corp",
	website: "https://acme.com",
	additionalDomains: [],
	aliases: [],
	enabled: true,
	onboarded: true,
	delayOverrideHours: null,
	enabledModels: null,
	organizationId: "brand-1",
	createdAt: new Date(),
	updatedAt: new Date(),
	prompts: [],
	competitors: [],
};

const newBrand: BrandWithPrompts = {
	...onboardedBrand,
	id: "brand-2",
	name: "NewStartup",
	website: "https://newstartup.io",
	onboarded: false,
	organizationId: "brand-2",
};

// ---------------------------------------------------------------------------
// Configs per deployment mode
// ---------------------------------------------------------------------------

const localConfig: ClientConfig = {
	mode: "local",
	features: {
		readOnly: false,
		showOptimizeButton: false,
		supportsMultiOrg: true,
		canCreateBrands: true,
	},
	branding: {
		name: "Yonaris",
		icon: "/icons/yonaris-icon.svg",
		wordmark: "/brand/yonaris-wordmark-navy.png",
		wordmarkOnDark: "/brand/yonaris-wordmark-white.png",
		chartColors: CHART_COLORS,
	},
	analytics: {},
};

const demoConfig: ClientConfig = {
	mode: "demo",
	features: {
		readOnly: true,
		showOptimizeButton: false,
		supportsMultiOrg: true,
		canCreateBrands: false,
	},
	branding: {
		name: "Yonaris",
		icon: "/icons/yonaris-icon.svg",
		wordmark: "/brand/yonaris-wordmark-navy.png",
		wordmarkOnDark: "/brand/yonaris-wordmark-white.png",
		chartColors: CHART_COLORS,
	},
	analytics: {},
};

const whitelabelConfig: ClientConfig = {
	mode: "whitelabel",
	features: {
		readOnly: false,
		showOptimizeButton: true,
		supportsMultiOrg: true,
		canCreateBrands: false,
	},
	branding: {
		name: "Northstar Analytics",
		icon: "/icons/example-client-icon.svg",
		parentName: "AgencyCo",
		parentUrl: "https://agency.example.com",
		optimizationUrlTemplate: "https://agency.example.com/optimize?prompt={{promptId}}",
		chartColors: CHART_COLORS,
	},
	analytics: {},
};

const whitelabelAdminConfig: ClientConfig = {
	...whitelabelConfig,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function configureMocks(config: ClientConfig, brand: BrandWithPrompts, auth?: Parameters<typeof setMockAuth>[0]) {
	setMockClientConfig(config);
	setMockBrand(brand);
	setMockRouteContext({ clientConfig: config });
	if (auth) setMockAuth(auth);
}

const authedUser = (name: string, email: string, seed: string) => ({
	user: {
		name,
		email,
		picture: `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`,
		given_name: name.split(" ")[0],
		family_name: name.split(" ")[1] ?? "",
	},
	isLoading: false,
	isAuthenticated: true,
	loginUrl: "/auth/login",
	logoutUrl: "/auth/logout",
});

/**
 * Wrapper that contains the sidebar within a bounded box.
 *
 * The shadcn Sidebar uses `position: fixed` and `h-svh` / `min-h-svh` which
 * would otherwise break out of the story frame and overlap Ladle's own UI.
 *
 * The fix is two-fold:
 *  1. `transform: translate(0)` on the outer div creates a new CSS containing
 *     block so that `position: fixed` children are positioned relative to this
 *     container instead of the viewport.
 *  2. Scoped style overrides swap `h-svh` / `min-h-svh` for `h-full` /
 *     `min-h-full` so the sidebar fits the container's height.
 */
function SidebarFrame({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<div
			className="sidebar-story-container relative h-[780px] w-full max-w-[1200px] border rounded-lg overflow-hidden bg-background"
			style={{ transform: "translate(0)" }}
		>
			<style>{`
				.sidebar-story-container [data-slot="sidebar-wrapper"] {
					min-height: 100% !important;
					height: 100% !important;
				}
				.sidebar-story-container [data-slot="sidebar-container"] {
					position: absolute !important;
					height: 100% !important;
				}
			`}</style>
			<SidebarProvider>
				{children}
				<SidebarInset>
					<SiteHeader />
					<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">{label}</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export default {
	title: "Dev Preview/Product Shell",
} satisfies Meta;

/** Local (self-hosted) — all nav visible, admin access, self-registered user */
export const Local = () => {
	configureMocks(localConfig, onboardedBrand, authedUser("Local Admin", "admin@localhost", "local-admin"));

	return (
		<SidebarFrame label="Local — Self-hosted, full admin">
			<AppSidebar isAdmin={true} hasReportAccess={true} brand={onboardedBrand} />
		</SidebarFrame>
	);
};

/** Demo — read-only preview, seeded user, no admin */
export const Demo = () => {
	const demoUser = authedUser("Demo User", "demo@example.com", "demo");
	demoUser.user.picture = "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Adrian";
	configureMocks(demoConfig, onboardedBrand, demoUser);

	return (
		<SidebarFrame label="Demo — Read-only, seeded user">
			<AppSidebar isAdmin={false} hasReportAccess={false} brand={onboardedBrand} />
		</SidebarFrame>
	);
};

/** Whitelabel — regular authenticated user, full dashboard + settings */
export const Whitelabel = () => {
	configureMocks(whitelabelConfig, onboardedBrand, authedUser("Alice Partner", "alice@agency.com", "alice"));

	return (
		<SidebarFrame label="Whitelabel — Regular user, no admin section">
			<AppSidebar isAdmin={false} hasReportAccess={false} brand={onboardedBrand} />
		</SidebarFrame>
	);
};

/** Whitelabel (Admin) — admin section with Brands, Reports, Workflows, Tools */
export const WhitelabelAdmin = () => {
	configureMocks(whitelabelAdminConfig, onboardedBrand, authedUser("Jane Admin", "jane@agency.com", "jane"));

	return (
		<SidebarFrame label="Whitelabel Admin — Full admin section visible">
			<AppSidebar isAdmin={true} hasReportAccess={true} brand={onboardedBrand} />
		</SidebarFrame>
	);
};

/** Whitelabel (Report-only) — limited admin access, only reports visible */
export const WhitelabelReportOnly = () => {
	configureMocks(whitelabelAdminConfig, onboardedBrand, authedUser("Report Viewer", "reports@client.com", "reports"));

	return (
		<SidebarFrame label="Whitelabel Report-only — Dashboard + Reports admin section">
			<AppSidebar isAdmin={false} hasReportAccess={true} brand={onboardedBrand} />
		</SidebarFrame>
	);
};

/** Whitelabel (Onboarding) — brand not yet onboarded, reduced nav */
export const WhitelabelOnboarding = () => {
	configureMocks(whitelabelConfig, newBrand, authedUser("New User", "new@agency.com", "newuser"));

	return (
		<SidebarFrame label="Whitelabel Onboarding — Brand not onboarded, minimal nav">
			<AppSidebar isAdmin={false} hasReportAccess={false} brand={newBrand} />
		</SidebarFrame>
	);
};
