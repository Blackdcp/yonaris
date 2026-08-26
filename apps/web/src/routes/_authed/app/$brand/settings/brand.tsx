/**
 * /app/$brand/settings/brand - Brand settings page
 *
 * Form to edit brand name, website, additional domains, and aliases.
 */

import { IconInfoCircle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useCallback, useEffect, useState } from "react";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import { LocalizedTagsInput as TagsInput } from "@/components/localized-tags-input";
import { useBrand } from "@/hooks/use-brands";
import { citationKeys } from "@/hooks/use-citations";
import { dashboardKeys } from "@/hooks/use-dashboard-summary";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { MAX_BRAND_NAME_LENGTH, MAX_WEBSITE_INPUT_LENGTH } from "@/lib/brand-settings";
import { validateWebsiteUrl } from "@/lib/brand-website";
import { cleanAndValidateDomain } from "@/lib/domain-categories";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { updateBrandFn } from "@/server/brands";

type BrandSettingsField = "name" | "website" | "additionalDomains";
type BrandSettingsFieldErrors = Partial<Record<BrandSettingsField, MessageId>>;
type UpdateBrand = (input: {
	data: {
		brandId: string;
		name: string;
		website: string;
		additionalDomains: string[];
		aliases: string[];
	};
}) => Promise<unknown>;

export type BrandSettingsSubmissionResult =
	| {
			ok: true;
			submitted: {
				brandId: string;
				name: string;
				website: string;
				additionalDomains: string[];
				aliases: string[];
			};
	  }
	| { ok: false; fieldErrors: BrandSettingsFieldErrors; formError?: MessageId };

export async function submitBrandSettingsForm(
	formData: FormData,
	context: { brandId: string; additionalDomains: string[]; aliases: string[] },
	updateBrand: UpdateBrand,
): Promise<BrandSettingsSubmissionResult> {
	const rawName = formData.get("name");
	const rawWebsite = formData.get("website");
	const name = typeof rawName === "string" ? rawName : "";
	const website = typeof rawWebsite === "string" ? rawWebsite : "";
	const fieldErrors: BrandSettingsFieldErrors = {};

	if (!name.trim()) fieldErrors.name = "settings.brand.validation.nameRequired";
	else if (name.length > MAX_BRAND_NAME_LENGTH) fieldErrors.name = "settings.brand.validation.nameTooLong";

	if (!website.trim()) fieldErrors.website = "settings.brand.validation.websiteRequired";
	else if (website.length > MAX_WEBSITE_INPUT_LENGTH) {
		fieldErrors.website = "settings.brand.validation.websiteTooLong";
	} else if (!validateWebsiteUrl(website).isValid) {
		fieldErrors.website = "settings.brand.validation.websiteInvalid";
	}

	if (context.additionalDomains.some((domain) => !cleanAndValidateDomain(domain))) {
		fieldErrors.additionalDomains = "settings.brand.validation.domainInvalid";
	}

	if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

	const submitted = { ...context, name, website };
	try {
		await updateBrand({ data: submitted });
		return { ok: true, submitted };
	} catch (error) {
		return {
			ok: false,
			fieldErrors: {},
			formError: customerSettingsErrorMessageId("brand", error),
		};
	}
}

export const Route = createFileRoute("/_authed/app/$brand/settings/brand")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "settings.brand.metaTitle"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "settings.brand.metaDescription") },
			],
		};
	},
	component: BrandSettingsPage,
});

function BrandSettingsPage() {
	const { t } = useI18n();
	const { brand, isLoading, revalidate } = useBrand();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<BrandSettingsFieldErrors>({});
	const [formError, setFormError] = useState<MessageId | null>(null);
	const [success, setSuccess] = useState(false);
	const [additionalDomains, setAdditionalDomains] = useState<string[]>(() => brand?.additionalDomains || []);
	const [aliases, setAliases] = useState<string[]>(() => brand?.aliases || []);

	useEffect(() => {
		if (brand) {
			setAdditionalDomains(brand.additionalDomains || []);
			setAliases(brand.aliases || []);
		}
	}, [brand]);

	const validateDomain = useCallback(
		(val: string): true | string => {
			const cleaned = cleanAndValidateDomain(val);
			if (!cleaned) return t("settings.brand.validation.domainInvalid");
			return true;
		},
		[t],
	);
	const handleAliasesChange = useCallback((values: string[]) => setAliases(values), []);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">{t("settings.brand.title")}</h1>
					<p className="text-muted-foreground">{t("settings.loading")}</p>
				</div>
			</div>
		);
	}

	if (!brand) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">{t("settings.brand.title")}</h1>
					<p className="text-destructive">{t("settings.brandNotFound")}</p>
				</div>
			</div>
		);
	}

	const handleSubmit = async (formData: FormData) => {
		setIsSubmitting(true);
		setFieldErrors({});
		setFormError(null);
		setSuccess(false);

		try {
			const result = await submitBrandSettingsForm(
				formData,
				{ brandId: brand.id, additionalDomains, aliases },
				updateBrandFn,
			);
			if (!result.ok) {
				setFieldErrors(result.fieldErrors);
				setFormError(result.formError ?? null);
				return;
			}

			queryClient.invalidateQueries({ queryKey: citationKeys.all });
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
			setSuccess(true);
			await revalidate();
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6 max-w-2xl">
			<div>
				<h1 className="text-3xl font-bold">{t("settings.brand.title")}</h1>
				<p className="text-muted-foreground">{t("settings.brand.description")}</p>
			</div>

			<form action={handleSubmit} className="space-y-6" noValidate>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">{t("settings.brand.name")}</Label>
						<Input
							id="name"
							name="name"
							type="text"
							placeholder={t("settings.brand.namePlaceholder")}
							defaultValue={brand.name}
							required
							disabled={isSubmitting}
							aria-invalid={Boolean(fieldErrors.name)}
							aria-describedby={fieldErrors.name ? "brand-name-error" : "brand-name-hint"}
						/>
						<p id="brand-name-hint" className="text-xs text-muted-foreground">
							{t("settings.brand.nameHint")}
						</p>
						{fieldErrors.name && (
							<p id="brand-name-error" className="text-sm text-destructive">
								{t(fieldErrors.name, { max: MAX_BRAND_NAME_LENGTH })}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="website">{t("settings.brand.website")}</Label>
						<Input
							id="website"
							name="website"
							type="text"
							placeholder={t("settings.brand.websitePlaceholder")}
							defaultValue={brand.website}
							required
							disabled={isSubmitting}
							aria-invalid={Boolean(fieldErrors.website)}
							aria-describedby={fieldErrors.website ? "brand-website-error" : "brand-website-hint"}
						/>
						<p id="brand-website-hint" className="text-xs text-muted-foreground">
							{t("settings.brand.websiteHint")}
						</p>
						{fieldErrors.website && (
							<p id="brand-website-error" className="text-sm text-destructive">
								{t(fieldErrors.website, { max: MAX_WEBSITE_INPUT_LENGTH })}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label className="flex items-center gap-1.5">
							{t("settings.brand.additionalDomains")}
							<Tooltip>
								<TooltipTrigger asChild>
									<IconInfoCircle
										className="h-3.5 w-3.5 text-muted-foreground cursor-help"
										aria-label={t("settings.brand.additionalDomainsLabel")}
										tabIndex={0}
									/>
								</TooltipTrigger>
								<TooltipContent className="max-w-xs text-xs font-normal">
									{t("settings.brand.additionalDomainsHelp")}
								</TooltipContent>
							</Tooltip>
						</Label>
						<TagsInput
							value={additionalDomains}
							onValueChange={setAdditionalDomains}
							placeholder={t("settings.brand.additionalDomainsPlaceholder")}
							searchPlaceholder={t("settings.brand.additionalDomainsPlaceholder")}
							ariaLabel={t("settings.brand.additionalDomains")}
							maxItems={10}
							normalizeValue={(raw) => cleanAndValidateDomain(raw) ?? raw.trim()}
							onValidate={validateDomain}
							disabled={isSubmitting}
						/>
						{fieldErrors.additionalDomains && (
							<p className="text-sm text-destructive">{t(fieldErrors.additionalDomains)}</p>
						)}
					</div>

					<div className="space-y-2">
						<Label className="flex items-center gap-1.5">
							{t("settings.brand.aliases")}
							<Tooltip>
								<TooltipTrigger asChild>
									<IconInfoCircle
										className="h-3.5 w-3.5 text-muted-foreground cursor-help"
										aria-label={t("settings.brand.aliasesLabel")}
										tabIndex={0}
									/>
								</TooltipTrigger>
								<TooltipContent className="max-w-xs text-xs font-normal">
									{t("settings.brand.aliasesHelp")}
								</TooltipContent>
							</Tooltip>
						</Label>
						<TagsInput
							value={aliases}
							onValueChange={handleAliasesChange}
							placeholder={t("settings.brand.aliasesPlaceholder")}
							searchPlaceholder={t("settings.brand.aliasesPlaceholder")}
							ariaLabel={t("settings.brand.aliases")}
							maxItems={10}
							disabled={isSubmitting}
						/>
					</div>
				</div>

				{formError && (
					<div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">
						{t(formError)}
					</div>
				)}
				{success && (
					<div className="text-sm text-green-600 bg-green-50 p-3 rounded-md" role="status">
						{t("settings.brand.success")}
					</div>
				)}

				<div className="flex gap-2">
					<Button type="submit" disabled={isSubmitting} className="cursor-pointer">
						{isSubmitting ? t("settings.action.saving") : t("settings.action.saveChanges")}
					</Button>
				</div>
			</form>
		</div>
	);
}
