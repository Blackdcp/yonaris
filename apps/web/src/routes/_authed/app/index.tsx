/**
 * /app - Brand switcher page
 *
 * In single-org mode (local/demo): redirects to the default org
 * In multi-org mode (whitelabel): shows brand switcher
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { syncAuth0UserById } from "@workspace/whitelabel/auth-hooks";
import FullPageCard from "@/components/full-page-card";
import { isAdmin, isPlatformIdentity, listUserCustomerWorkspaces, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";

const getOrganizations = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		organizations: { id: string; name: string }[];
		supportsMultiOrg: boolean;
		canCreateBrands: boolean;
		platformDestination: "/admin" | "/reports" | null;
	}> => {
		const session = await requireAuthSession();
		const deployment = getDeployment();
		const platformDestination = isAdmin(session) ? "/admin" : isPlatformIdentity(session) ? "/reports" : null;
		if (platformDestination) {
			return {
				organizations: [],
				supportsMultiOrg: deployment.features.supportsMultiOrg,
				canCreateBrands: false,
				platformDestination,
			};
		}

		if (deployment.mode === "whitelabel") {
			// Keep /app usable during Auth0 Management API incidents; background sync will reconcile memberships later.
			try {
				await syncAuth0UserById(session.user.id);
			} catch (error) {
				console.error("[auth0-sync] Failed to sync user on /app load; continuing with cached memberships", error);
			}
		}

		// Customer links use brand ids. Organization ids are authorization
		// boundaries and are only exposed as a pre-brand onboarding target.
		const organizations = await listUserCustomerWorkspaces(session.user.id);
		// Tenant creation is a platform operation. Customer workspace roles may
		// configure an assigned brand, but never create another customer tenant.
		return {
			organizations,
			supportsMultiOrg: deployment.features.supportsMultiOrg,
			canCreateBrands: false,
			platformDestination: null,
		};
	},
);

function OrgSwitcherSkeleton() {
	return (
		<FullPageCard title="" subtitle="">
			<div className="flex min-w-[200px] flex-col space-y-3">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</FullPageCard>
	);
}

export const Route = createFileRoute("/_authed/app/")({
	pendingComponent: OrgSwitcherSkeleton,
	loader: async () => {
		const result = await getOrganizations();
		if (result.platformDestination) {
			throw redirect({ to: result.platformDestination });
		}

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

	return (
		<FullPageCard title="Customer workspaces" subtitle="Select an assigned customer workspace">
			<div className="flex min-w-[200px] flex-col space-y-3">
				{organizations.length > 0 ? (
					organizations.map((org: { id: string; name: string }) => (
						<Button key={org.id} asChild variant="secondary">
							<Link to="/app/$brand" params={{ brand: org.id }}>
								{org.name}
							</Link>
						</Button>
					))
				) : (
					<p className="text-center text-muted-foreground">No brands available</p>
				)}
				{canCreateBrands && (
					<Button asChild variant="outline">
						<Link to="/app/new">+ Create new brand</Link>
					</Button>
				)}
			</div>
		</FullPageCard>
	);
}
