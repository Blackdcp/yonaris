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
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";
import { trackEvent } from "@/lib/posthog";
import { buildTitle, getAppName } from "@/lib/route-head";
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
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "customer.new.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "customer.new.subtitle") },
			],
		};
	},
	loader: async () => {
		const { platformIdentity } = await getCanCreateBrands();
		throw redirect({ to: platformIdentity ? "/admin/access" : "/app" });
	},
	component: NewBrandPage,
});

function NewBrandPage() {
	const { t } = useI18n();
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
		} catch {
			setError(t("common.error.unexpected"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<FullPageCard title={t("customer.new.title")} subtitle={t("customer.new.subtitle")} showBackButton>
			<form action={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="brandName">{t("customer.new.brandName")}</Label>
					<Input id="brandName" name="brandName" type="text" placeholder="Acme" required disabled={isLoading} />
				</div>

				<div className="space-y-2">
					<Label htmlFor="website">{t("customer.new.website")}</Label>
					<Input id="website" name="website" type="text" placeholder="example.com" required disabled={isLoading} />
				</div>

				{error && <p className="text-sm text-destructive">{error}</p>}

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? t("customer.new.creating") : t("customer.new.submit")}
				</Button>
			</form>
		</FullPageCard>
	);
}
