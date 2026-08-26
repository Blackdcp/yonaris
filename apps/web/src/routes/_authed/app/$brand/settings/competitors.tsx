/**
 * /app/$brand/settings/competitors - Competitor management page
 *
 * Form to manage competitor list with multiple domains and aliases per competitor.
 */
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CompetitorEntry, CompetitorsEditor } from "@/components/competitors-editor";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import { useBrand, useCompetitors } from "@/hooks/use-brands";
import { citationKeys } from "@/hooks/use-citations";
import { dashboardKeys } from "@/hooks/use-dashboard-summary";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { cleanAndValidateDomain } from "@/lib/domain-categories";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { updateCompetitors } from "@/server/brands";

type UpdateCompetitors = (input: {
	data: {
		brandId: string;
		competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
	};
}) => Promise<unknown>;

export type CompetitorsSettingsSubmissionResult =
	| {
			ok: true;
			submitted: {
				brandId: string;
				competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
			};
	  }
	| { ok: false; formError: MessageId };

export async function submitCompetitorsSettingsForm(
	brandId: string,
	competitors: CompetitorEntry[],
	update: UpdateCompetitors,
): Promise<CompetitorsSettingsSubmissionResult> {
	const configured = competitors.filter((competitor) => {
		return competitor.name.trim() && competitor.domains.some((domain) => domain.trim());
	});
	if (configured.some((competitor) => competitor.domains.some((domain) => !cleanAndValidateDomain(domain)))) {
		return { ok: false, formError: "settings.competitors.validation.domainInvalid" };
	}

	const submitted = {
		brandId,
		competitors: configured.map((competitor) => ({
			name: competitor.name.trim(),
			domains: competitor.domains.map((domain) => domain.trim()).filter(Boolean),
			aliases: competitor.aliases.map((alias) => alias.trim()).filter(Boolean),
		})),
	};
	try {
		await update({ data: submitted });
		return { ok: true, submitted };
	} catch (error) {
		return { ok: false, formError: customerSettingsErrorMessageId("competitors", error) };
	}
}

export const Route = createFileRoute("/_authed/app/$brand/settings/competitors")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{
					title: buildTitle(translate(uiLanguage, "settings.competitors.metaTitle"), { appName, brandName }),
				},
				{ name: "description", content: translate(uiLanguage, "settings.competitors.metaDescription") },
			],
		};
	},
	component: CompetitorsSettingsPage,
});

function CompetitorsSettingsPage() {
	const { t } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { brand, isLoading } = useBrand(brandId);
	const { competitors: existingCompetitors, isLoading: competitorsLoading } = useCompetitors(brandId);
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState<MessageId | null>(null);
	const [success, setSuccess] = useState(false);
	const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);

	useEffect(() => {
		if (existingCompetitors.length > 0) {
			setCompetitors(
				existingCompetitors.map((competitor) => ({
					_key: crypto.randomUUID(),
					name: competitor.name,
					domains: competitor.domains ?? [],
					aliases: competitor.aliases || [],
					expanded: false,
				})),
			);
		}
	}, [existingCompetitors]);

	if (isLoading || competitorsLoading) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">{t("settings.competitors.title")}</h1>
					<p className="text-muted-foreground">{t("settings.loading")}</p>
				</div>
			</div>
		);
	}

	if (!brand) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">{t("settings.competitors.title")}</h1>
					<p className="text-destructive">{t("settings.brandNotFound")}</p>
				</div>
			</div>
		);
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSubmitting(true);
		setFormError(null);
		setSuccess(false);

		try {
			const result = await submitCompetitorsSettingsForm(brand.id, competitors, updateCompetitors);
			if (!result.ok) {
				setFormError(result.formError);
				return;
			}

			queryClient.invalidateQueries({ queryKey: citationKeys.all });
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
			setSuccess(true);
		} catch {
			setFormError("common.error.unexpected");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6 max-w-2xl">
			<div>
				<h1 className="text-3xl font-bold">{t("settings.competitors.title")}</h1>
				<p className="text-muted-foreground">{t("settings.competitors.description")}</p>
			</div>

			<Alert variant="default" className="border-yellow-200 bg-yellow-50 text-yellow-800">
				<AlertTriangle className="h-4 w-4 text-yellow-600" />
				<AlertTitle>{t("settings.competitors.warningTitle")}</AlertTitle>
				<AlertDescription className="text-yellow-700">{t("settings.competitors.warningDescription")}</AlertDescription>
			</Alert>

			<form onSubmit={handleSubmit} className="space-y-6">
				<CompetitorsEditor competitors={competitors} onChange={setCompetitors} disabled={isSubmitting} />

				{formError && (
					<div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" role="alert">
						{t(formError)}
					</div>
				)}
				{success && (
					<div className="text-sm text-green-600 bg-green-50 p-3 rounded-md" role="status">
						{t("settings.competitors.success")}
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
