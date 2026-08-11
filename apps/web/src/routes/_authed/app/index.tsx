/**
 * /app - Brand switcher page
 *
 * In single-org mode (local/demo): redirects to the default org
 * In multi-org mode (whitelabel): shows brand switcher
 */

import { createFileRoute, Link, redirect, useRouteContext } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_APP_NAME } from "@workspace/config/constants";
import type { ClientConfig } from "@workspace/config/types";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { syncAuth0UserById } from "@workspace/whitelabel/auth-hooks";
import { ArrowRight, Plus } from "lucide-react";
import FullPageCard from "@/components/full-page-card";
import { checkAnyOrgWriteAccess, listUserOrganizations, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";

const getOrganizations = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		organizations: { id: string; name: string }[];
		supportsMultiOrg: boolean;
		canCreateBrands: boolean;
	}> => {
		const session = await requireAuthSession();
		const deployment = getDeployment();

		if (deployment.mode === "whitelabel") {
			// Keep /app usable during Auth0 Management API incidents; background sync will reconcile memberships later.
			try {
				await syncAuth0UserById(session.user.id);
			} catch (error) {
				console.error("[auth0-sync] Failed to sync user on /app load; continuing with cached memberships", error);
			}
		}

		const organizations = await listUserOrganizations(session.user.id);
		const canCreateBrands =
			deployment.features.canCreateBrands &&
			(deployment.mode !== "local" || (await checkAnyOrgWriteAccess(session.user.id)));
		return {
			organizations,
			supportsMultiOrg: deployment.features.supportsMultiOrg,
			canCreateBrands,
		};
	},
);

function OrgSwitcherSkeleton() {
	return (
		<FullPageCard className="w-full max-w-[34rem]">
			<div className="w-full space-y-6">
				<div className="space-y-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-9 w-56" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<div className="space-y-3 border-t pt-6">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-11 w-full" />
				</div>
			</div>
		</FullPageCard>
	);
}

export const Route = createFileRoute("/_authed/app/")({
	pendingComponent: OrgSwitcherSkeleton,
	loader: async () => {
		const result = await getOrganizations();

		// Single-org mode: redirect to the user's one org (created on signup).
		if (!result.supportsMultiOrg && result.organizations.length > 0) {
			throw redirect({ to: "/app/$brand", params: { brand: result.organizations[0].id } });
		}
		if (result.organizations.length === 1 && !result.canCreateBrands) {
			throw redirect({ to: "/app/$brand", params: { brand: result.organizations[0].id } });
		}

		return result;
	},
	component: BrandSwitcherPage,
});

function BrandSwitcherPage() {
	const { organizations, canCreateBrands } = Route.useLoaderData();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const brandName = context.clientConfig?.branding?.name || DEFAULT_APP_NAME;
	const isYonaris = brandName === DEFAULT_APP_NAME;

	return (
		<FullPageCard className="w-full max-w-[34rem]">
			<section data-yonaris-slot="brand-switcher" className="w-full">
				<header className="mb-7">
					<p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{isYonaris ? "Yonaris · 市场情报系统" : `${brandName} Workspace`}
					</p>
					<h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground">
						{isYonaris ? "选择品牌空间" : "Choose a brand workspace"}
					</h1>
					<p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
						{isYonaris
							? "进入一个品牌，查看它的市场认知、关键机会与商业反馈。"
							: "Select a brand to open its intelligence workspace."}
					</p>
				</header>

				<div className="space-y-3 border-t border-border/80 pt-6">
					{organizations.length > 0 ? (
						organizations.map((org: { id: string; name: string }) => (
							<Button
								key={org.id}
								asChild
								variant="outline"
								className="group h-auto min-h-16 w-full justify-between bg-card px-4 py-3 text-left hover:border-[var(--yonaris-signal)] hover:bg-card"
							>
								<Link to="/app/$brand" params={{ brand: org.id }}>
									<span className="flex min-w-0 items-center gap-3">
										<span className="flex size-9 shrink-0 items-center justify-center rounded-[0.25rem] bg-[var(--yonaris-ink)] text-sm font-semibold text-[var(--yonaris-paper)]">
											{org.name.trim().charAt(0).toUpperCase() || "B"}
										</span>
										<span className="min-w-0">
											<span className="block truncate text-sm font-semibold text-foreground">{org.name}</span>
											<span className="mt-0.5 block text-xs font-normal text-muted-foreground">
												{isYonaris ? "品牌情报空间" : "Brand intelligence workspace"}
											</span>
										</span>
									</span>
									<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--yonaris-signal-strong)]" />
								</Link>
							</Button>
						))
					) : (
						<div className="border border-dashed border-border px-4 py-8 text-center">
							<p className="text-sm font-medium text-foreground">
								{isYonaris ? "还没有可用的品牌空间" : "No brands available"}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{isYonaris ? "新建一个品牌，开始建立市场情报。" : "Create a brand to get started."}
							</p>
						</div>
					)}
					{canCreateBrands && (
						<Button
							asChild
							variant="ghost"
							className="h-11 w-full justify-start px-3 text-[var(--yonaris-signal-strong)] hover:bg-[rgb(255_106_0_/_7%)] hover:text-[var(--yonaris-signal-strong)]"
						>
							<Link to="/app/new">
								<Plus className="size-4" />
								{isYonaris ? "新建品牌空间" : "Create new brand"}
							</Link>
						</Button>
					)}
				</div>
			</section>
		</FullPageCard>
	);
}
