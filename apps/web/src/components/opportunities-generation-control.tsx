import type { UiLanguage } from "@workspace/config/language";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { OpportunitiesResponse } from "@/server/opportunities";
import { type AdminOpportunityBrand, getOpportunityScopesForBrand } from "@/server/opportunities-admin-scopes";

export function opportunityGenerationMessage(result: OpportunitiesResponse, locale: UiLanguage = "en"): string {
	if (!result.report) {
		if (result.reason === "insufficient-data") {
			return translate(locale, "providerTool.opportunity.result.insufficient");
		}
		return translate(locale, "providerTool.opportunity.result.none");
	}
	return translate(
		locale,
		result.generatedFor ? "providerTool.opportunity.result.generated" : "providerTool.opportunity.result.current",
	);
}

export function OpportunitiesGenerationControl({
	onGenerate,
	brands = [],
}: {
	onGenerate(input: { brandId: string; scopeId: string }): Promise<OpportunitiesResponse>;
	brands?: AdminOpportunityBrand[];
}) {
	const { locale, t } = useI18n();
	const [brandId, setBrandId] = useState("");
	const [scopeId, setScopeId] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [rawError, setRawError] = useState<string | null>(null);

	const generate = async () => {
		if (!brandId || !scopeId) {
			setMessage(t("providerTool.opportunity.validation.selection"));
			return;
		}
		setIsLoading(true);
		setMessage(null);
		setRawError(null);
		try {
			const result = await onGenerate({ brandId, scopeId });
			setMessage(opportunityGenerationMessage(result, locale));
		} catch (caught) {
			setMessage(t("providerTool.opportunity.error"));
			setRawError(caught instanceof Error ? caught.message : null);
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
				<Button className="w-full cursor-pointer" onClick={generate} disabled={isLoading || !brandId || !scopeId}>
					{isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
					{isLoading ? t("providerTool.opportunity.generating") : t("providerTool.opportunity.generate")}
				</Button>
				{message && <p className="text-sm text-muted-foreground">{message}</p>}
				{rawError && (
					<div className="text-sm text-destructive">
						<p>{t("admin.raw.errorDetails")}</p>
						<pre className="whitespace-pre-wrap">{rawError}</pre>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
