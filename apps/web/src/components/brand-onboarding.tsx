import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useState } from "react";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import FullPageCard from "@/components/full-page-card";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { MAX_WEBSITE_INPUT_LENGTH } from "@/lib/brand-settings";
import { validateWebsiteUrl } from "@/lib/brand-website";
import { trackEvent } from "@/lib/posthog";
import { createBrandFn } from "@/server/brands";

interface BrandOnboardingProps {
	brandId: string;
	brandName: string;
}

type CreateBrand = (input: { data: { brandId: string; brandName: string; website: string } }) => Promise<unknown>;

export type BrandOnboardingSubmissionResult =
	| {
			ok: true;
			submitted: { brandId: string; brandName: string; website: string };
	  }
	| {
			ok: false;
			fieldErrors: { website?: MessageId };
			formError?: MessageId;
	  };

export async function submitBrandOnboardingForm(
	formData: FormData,
	identity: { brandId: string; brandName: string },
	createBrand: CreateBrand,
): Promise<BrandOnboardingSubmissionResult> {
	const rawWebsite = formData.get("website");
	const website = typeof rawWebsite === "string" ? rawWebsite : "";

	if (!website.trim()) {
		return { ok: false, fieldErrors: { website: "customer.onboarding.validation.websiteRequired" } };
	}
	if (website.length > MAX_WEBSITE_INPUT_LENGTH) {
		return { ok: false, fieldErrors: { website: "customer.onboarding.validation.websiteTooLong" } };
	}
	if (!validateWebsiteUrl(website).isValid) {
		return { ok: false, fieldErrors: { website: "customer.onboarding.validation.websiteInvalid" } };
	}

	const submitted = { ...identity, website };
	try {
		await createBrand({ data: submitted });
		return { ok: true, submitted };
	} catch (error) {
		return {
			ok: false,
			fieldErrors: {},
			formError: customerSettingsErrorMessageId("onboarding", error),
		};
	}
}

export function BrandOnboardingView({
	brandId,
	brandName,
	isLoading,
	fieldErrors,
	formError,
	onSubmit,
}: BrandOnboardingProps & {
	isLoading: boolean;
	fieldErrors: { website?: MessageId };
	formError: MessageId | null;
	onSubmit: (formData: FormData) => Promise<void>;
}) {
	const { t } = useI18n();
	return (
		<FullPageCard
			title={t("customer.onboarding.title", { brand: brandName })}
			subtitle={t("customer.onboarding.subtitle")}
			showBackButton
		>
			<form action={onSubmit} className="space-y-4" noValidate>
				<input type="hidden" name="brandId" value={brandId} />
				<input type="hidden" name="brandName" value={brandName} />

				<div className="space-y-2">
					<Label htmlFor="website">{t("customer.onboarding.website")}</Label>
					<Input
						id="website"
						name="website"
						type="text"
						placeholder={t("customer.onboarding.websitePlaceholder")}
						required
						disabled={isLoading}
						aria-invalid={Boolean(fieldErrors.website)}
						aria-describedby={fieldErrors.website ? "onboarding-website-error" : "onboarding-website-hint"}
					/>
					<p id="onboarding-website-hint" className="text-xs text-muted-foreground">
						{t("customer.onboarding.websiteHint")}
					</p>
					{fieldErrors.website && (
						<p id="onboarding-website-error" className="text-sm text-destructive">
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
					{isLoading ? t("customer.onboarding.submitting") : t("customer.onboarding.submit")}
				</Button>
			</form>
		</FullPageCard>
	);
}

export default function BrandOnboarding({ brandId, brandName }: BrandOnboardingProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ website?: MessageId }>({});
	const [formError, setFormError] = useState<MessageId | null>(null);
	const navigate = useNavigate();
	const router = useRouter();

	const handleSubmit = async (formData: FormData) => {
		setIsLoading(true);
		setFieldErrors({});
		setFormError(null);

		try {
			const result = await submitBrandOnboardingForm(formData, { brandId, brandName }, createBrandFn);
			if (!result.ok) {
				setFieldErrors(result.fieldErrors);
				setFormError(result.formError ?? null);
				return;
			}

			trackEvent("brand_created", { has_website: Boolean(result.submitted.website) });
			await router.invalidate();
			await navigate({ to: "/app/$brand", params: { brand: brandId } });
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<BrandOnboardingView
			brandId={brandId}
			brandName={brandName}
			isLoading={isLoading}
			fieldErrors={fieldErrors}
			formError={formError}
			onSubmit={handleSubmit}
		/>
	);
}
