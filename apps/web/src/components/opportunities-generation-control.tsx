import { useQueryClient } from "@tanstack/react-query";
import { isContentLanguage, type OutputLanguage, type UiLanguage } from "@workspace/config/language";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import { useArtifactLanguageSelection } from "@/hooks/use-artifact-language-selection";
import { opportunitiesKeys } from "@/hooks/use-opportunities";
import { type LocalizedMessage, type MessageId, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { OpportunitiesResponse } from "@/server/opportunities";
import { type AdminOpportunityBrand, getOpportunityScopesForBrand } from "@/server/opportunities-admin-scopes";

export function opportunityGenerationMessageId(result: OpportunitiesResponse): MessageId {
	if (!result.report) {
		if (result.reason === "insufficient-data") {
			return "providerTool.opportunity.result.insufficient";
		}
		if (result.reason === "temporarily-unavailable") {
			return "providerTool.opportunity.result.unavailable";
		}
		return "providerTool.opportunity.result.none";
	}
	return result.generatedFor ? "providerTool.opportunity.result.generated" : "providerTool.opportunity.result.current";
}

export function opportunityGenerationMessage(result: OpportunitiesResponse, locale: UiLanguage = "en"): string {
	return translate(locale, opportunityGenerationMessageId(result));
}

export function OpportunitiesGenerationControl({
	onGenerate,
	brands = [],
}: {
	onGenerate(input: {
		brandId: string;
		scopeId: string;
		outputLanguage: OutputLanguage;
	}): Promise<OpportunitiesResponse>;
	brands?: AdminOpportunityBrand[];
}) {
	const { t, locale } = useI18n();
	const queryClient = useQueryClient();
	const [brandId, setBrandId] = useState("");
	const [scopeId, setScopeId] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<LocalizedMessage | null>(null);
	const selection = useArtifactLanguageSelection("opportunities-admin", brandId, scopeId, locale);

	const generate = async () => {
		if (!brandId || !scopeId || !selection.isResolved) {
			setMessage({ id: "providerTool.opportunity.validation.selection" });
			return;
		}
		setIsLoading(true);
		setMessage(null);
		try {
			const result = await onGenerate({ brandId, scopeId, outputLanguage: selection.outputLanguage });
			if (result.reason !== "temporarily-unavailable" && result.outputLanguage === selection.outputLanguage) {
				queryClient.setQueryData(opportunitiesKeys.detail(brandId, scopeId, selection.outputLanguage), result);
			}
			setMessage({ id: opportunityGenerationMessageId(result) });
		} catch (caught) {
			setMessage({
				id: "providerTool.opportunity.error",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setIsLoading(false);
		}
	};
	const scopes = getOpportunityScopesForBrand(brands, brandId);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="size-5" />
					{t("providerTool.opportunity.title")}
				</CardTitle>
				<CardDescription>{t("providerTool.opportunity.description")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2">
					<Label htmlFor="opportunities-brand">{t("providerTool.opportunity.brand")}</Label>
					<select
						id="opportunities-brand"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={brandId}
						onChange={(event) => {
							setBrandId(event.target.value);
							setScopeId("");
						}}
					>
						<option value="">{t("providerTool.opportunity.selectBrand")}</option>
						{brands.map((brand) => (
							<option key={brand.id} value={brand.id}>
								{brand.name}
							</option>
						))}
					</select>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="opportunities-program">{t("providerTool.opportunity.program")}</Label>
					<select
						id="opportunities-program"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={scopeId}
						onChange={(event) => setScopeId(event.target.value)}
						disabled={!brandId}
					>
						<option value="">{t("providerTool.opportunity.selectProgram")}</option>
						{scopes.map((scope) => (
							<option key={scope.id} value={scope.id}>
								{scope.name} · {scope.market} · {scope.locale} ·{" "}
								{t("providerTool.opportunity.enabledPrompts", { count: scope.promptCount })}
							</option>
						))}
					</select>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="opportunities-output-language">{t("providerTool.opportunity.outputLanguage")}</Label>
					<select
						id="opportunities-output-language"
						aria-describedby="opportunities-output-language-help"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={selection.outputLanguage}
						onChange={(event) => {
							if (isContentLanguage(event.target.value)) selection.setOutputLanguage(event.target.value);
						}}
						disabled={!brandId || !scopeId || !selection.isResolved || isLoading}
					>
						<option value="en">{t("language.switcher.english")}</option>
						<option value="zh-CN">{t("language.switcher.chinese")}</option>
					</select>
					<p id="opportunities-output-language-help" className="text-xs text-muted-foreground">
						{t("providerTool.opportunity.outputLanguageHelp")}
					</p>
				</div>
				<Button
					className="w-full cursor-pointer"
					onClick={generate}
					disabled={isLoading || !brandId || !scopeId || !selection.isResolved}
				>
					{isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
					{isLoading ? t("providerTool.opportunity.generating") : t("providerTool.opportunity.generate")}
				</Button>
				{message && <p className="text-sm text-muted-foreground">{t(message.id, message.values)}</p>}
				{message?.detail && (
					<div className="text-sm text-destructive">
						<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={message.detail} />
					</div>
				)}
			</CardContent>
		</Card>
	);
}
