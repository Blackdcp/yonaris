/**
 * /app/new - Create a new brand (local mode only).
 *
 * Provisions a new organization + admin membership for the current user
 * and seeds the brand row with the supplied name + website. Whitelabel and
 * demo are blocked at both the loader (redirect to /app) and the server
 * function (canCreateBrands policy).
 */

import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useState } from "react";
import FullPageCard from "@/components/full-page-card";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";
import { trackEvent } from "@/lib/posthog";
import { createBrandWithOrgFn } from "@/server/brands";

const getCanCreateBrands = createServerFn({ method: "GET" }).handler(async () => {
	const session = await requireAuthSession();
	const deployment = getDeployment();
	return {
		canCreateBrands: deployment.features.canCreateBrands && isAdmin(session),
		platformIdentity: isAdmin(session),
	};
});

export const Route = createFileRoute("/_authed/app/new")({
	loader: async () => {
		const { platformIdentity } = await getCanCreateBrands();
		throw redirect({ to: platformIdentity ? "/admin/access" : "/app" });
	},
	component: NewBrandPage,
});

function NewBrandPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const router = useRouter();

	const handleSubmit = async (formData: FormData) => {
		setIsLoading(true);
		setError("");

		try {
			const brandName = (formData.get("brandName") as string)?.trim() ?? "";
			const website = (formData.get("website") as string)?.trim() ?? "";

			const { brandId } = await createBrandWithOrgFn({
				data: { brandName, website },
			});
			trackEvent("brand_created", { has_website: Boolean(website) });

			await router.invalidate();
			await navigate({ to: "/app/$brand", params: { brand: brandId } });
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<FullPageCard title="Create a customer workspace" subtitle="Set up one organization and one brand" showBackButton>
			<form action={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="brandName">Brand name</Label>
					<Input id="brandName" name="brandName" type="text" placeholder="Acme" required disabled={isLoading} />
				</div>

				<div className="space-y-2">
					<Label htmlFor="website">Website</Label>
					<Input id="website" name="website" type="text" placeholder="example.com" required disabled={isLoading} />
				</div>

				{error && <p className="text-sm text-destructive">{error}</p>}

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? "Creating..." : "Create brand"}
				</Button>
			</form>
		</FullPageCard>
	);
}
