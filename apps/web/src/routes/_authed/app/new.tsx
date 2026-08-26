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
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { BRAND_CREATION_ERROR_CODES, MAX_BRAND_NAME_LENGTH, MAX_WEBSITE_INPUT_LENGTH } from "@/lib/brand-settings";
import { validateWebsiteUrl } from "@/lib/brand-website";
import { getDeployment } from "@/lib/config/server";
import { trackEvent } from "@/lib/posthog";
import { buildTitle, getAppName } from "@/lib/route-head";
import { createBrandWithOrgFn } from "@/server/brands";

type NewBrandField = "brandName" | "website";
type NewBrandFieldErrors = Partial<Record<NewBrandField, MessageId>>;
type CreateCustomerBrand = (input: { data: { brandName: string; website: string } }) => Promise<{ brandId: string }>;

export type NewBrandSubmissionResult =
	| {
			ok: true;
			brandId: string;
			submitted: { brandName: string; website: string };
	  }
	| {
			ok: false;
			fieldErrors: NewBrandFieldErrors;
			formError?: MessageId;
	  };

function serverFailureMessageId(error: unknown): MessageId {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
				? error.message
				: "";
	if (message === BRAND_CREATION_ERROR_CODES.notAllowed || message === BRAND_CREATION_ERROR_CODES.forbidden) {
		return "customer.new.error.notAllowed";
	}
	return "common.error.unexpected";
}

export async function submitNewBrandForm(
	formData: FormData,
	createBrand: CreateCustomerBrand,
): Promise<NewBrandSubmissionResult> {
	const rawBrandName = formData.get("brandName");
	const rawWebsite = formData.get("website");
	const brandName = typeof rawBrandName === "string" ? rawBrandName.trim() : "";
	const website = typeof rawWebsite === "string" ? rawWebsite.trim() : "";
	const fieldErrors: NewBrandFieldErrors = {};

	if (!brandName) fieldErrors.brandName = "customer.new.validation.brandRequired";
	else if (brandName.length > MAX_BRAND_NAME_LENGTH) {
		fieldErrors.brandName = "customer.new.validation.brandTooLong";
	}

	if (!website) fieldErrors.website = "customer.new.validation.websiteRequired";
	else if (website.length > MAX_WEBSITE_INPUT_LENGTH) {
		fieldErrors.website = "customer.new.validation.websiteTooLong";
	} else if (!validateWebsiteUrl(website).isValid) {
		fieldErrors.website = "customer.new.validation.websiteInvalid";
	}

	if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

	try {
		const { brandId } = await createBrand({ data: { brandName, website } });
		return { ok: true, brandId, submitted: { brandName, website } };
	} catch (error) {
		return { ok: false, fieldErrors: {}, formError: serverFailureMessageId(error) };
	}
}

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
	const [fieldErrors, setFieldErrors] = useState<NewBrandFieldErrors>({});
	const [formError, setFormError] = useState<MessageId | null>(null);
	const navigate = useNavigate();
	const router = useRouter();

	const handleSubmit = async (formData: FormData) => {
		setIsLoading(true);
		setFieldErrors({});
		setFormError(null);

		try {
			const result = await submitNewBrandForm(formData, createBrandWithOrgFn);
			if (!result.ok) {
				setFieldErrors(result.fieldErrors);
				setFormError(result.formError ?? null);
				return;
			}

			trackEvent("brand_created", { has_website: Boolean(result.submitted.website) });

			await router.invalidate();
			await navigate({ to: "/app/$brand", params: { brand: result.brandId } });
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<FullPageCard title={t("customer.new.title")} subtitle={t("customer.new.subtitle")} showBackButton>
			<form action={handleSubmit} className="space-y-4" noValidate>
				<div className="space-y-2">
					<Label htmlFor="brandName">{t("customer.new.brandName")}</Label>
					<Input
						id="brandName"
						name="brandName"
						type="text"
						placeholder="Acme"
						required
						disabled={isLoading}
						aria-invalid={Boolean(fieldErrors.brandName)}
						aria-describedby={fieldErrors.brandName ? "brandName-error" : undefined}
					/>
					{fieldErrors.brandName && (
						<p id="brandName-error" className="text-sm text-destructive">
							{t(fieldErrors.brandName, { max: MAX_BRAND_NAME_LENGTH })}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="website">{t("customer.new.website")}</Label>
					<Input
						id="website"
						name="website"
						type="text"
						placeholder="example.com"
						required
						disabled={isLoading}
						aria-invalid={Boolean(fieldErrors.website)}
						aria-describedby={fieldErrors.website ? "website-error" : undefined}
					/>
					{fieldErrors.website && (
						<p id="website-error" className="text-sm text-destructive">
							{t(fieldErrors.website, { max: MAX_WEBSITE_INPUT_LENGTH })}
						</p>
					)}
				</div>

				{formError && (
					<p className="text-sm text-destructive" role="alert">
						{t(formError)}
					</p>
				)}

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading ? t("customer.new.creating") : t("customer.new.submit")}
				</Button>
			</form>
		</FullPageCard>
	);
}
