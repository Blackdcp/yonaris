/**
 * /admin/tools — Admin utility for running the onboarding analysis against an
 * arbitrary website without going through the wizard.
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { OnboardingSuggestion } from "@workspace/lib/onboarding";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { OpportunitiesGenerationControl } from "@/components/opportunities-generation-control";
import { type LocalizedMessage, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
import { adminAnalyzeBrandFn, getAdminOpportunityScopesFn } from "@/server/admin";
import { generateOpportunitiesFn } from "@/server/opportunities";

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

function AnalyzeBrandDialog() {
	const { t, formatNumber } = useI18n();
	const [open, setOpen] = useState(false);
	const [website, setWebsite] = useState("");
	const [brandName, setBrandName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<LocalizedMessage | null>(null);
	const [result, setResult] = useState<OnboardingSuggestion | null>(null);
	const [copied, setCopied] = useState(false);

	const handleAnalyze = async () => {
		if (!website.trim()) {
			setError({ id: "providerTool.analysis.validation.website" });
			return;
		}
		setError(null);
		setResult(null);
		setIsLoading(true);
		try {
			const data = await adminAnalyzeBrandFn({
				data: {
					website: website.trim(),
					brandName: brandName.trim() || undefined,
				},
			});
			setResult(data);
		} catch (err) {
			setError({ id: "providerTool.analysis.error", detail: err instanceof Error ? err.message : undefined });
		} finally {
			setIsLoading(false);
		}
	};

	const handleCopy = async () => {
		if (!result) return;
		await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleCopyPrompts = async () => {
		if (!result) return;
		await navigator.clipboard.writeText(result.suggestedPrompts.map((p) => p.prompt).join("\n"));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleClose = () => {
		setOpen(false);
		setWebsite("");
		setBrandName("");
		setResult(null);
		setError(null);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
			<DialogTrigger asChild>
				<Button variant="outline" className="cursor-pointer w-full">
					<Sparkles className="h-4 w-4 mr-2" />
					{t("providerTool.analysis.action")}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("providerTool.analysis.action")}</DialogTitle>
					<DialogDescription>{t("providerTool.analysis.dialogDescription")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="analyze-website">{t("providerTool.analysis.website")}</Label>
							<Input
								id="analyze-website"
								placeholder="https://example.com"
								value={website}
								onChange={(e) => setWebsite(e.target.value)}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="analyze-brand">{t("providerTool.analysis.brandOptional")}</Label>
							<Input
								id="analyze-brand"
								placeholder={t("providerTool.analysis.brandPlaceholder")}
								value={brandName}
								onChange={(e) => setBrandName(e.target.value)}
								disabled={isLoading}
							/>
						</div>
					</div>

					<Button onClick={handleAnalyze} disabled={isLoading} className="cursor-pointer w-full">
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{t("providerTool.analysis.analyzing")}
							</>
						) : (
							t("providerTool.analysis.submit")
						)}
					</Button>

					{error && (
						<div className="text-sm text-destructive">
							<p>{t(error.id, error.values)}</p>
							{error.detail && (
								<>
									<p>{t("admin.raw.errorDetails")}</p>
									<pre className="whitespace-pre-wrap">{error.detail}</pre>
								</>
							)}
						</div>
					)}

					{result && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h4 className="font-semibold">{result.brandName}</h4>
								<div className="flex gap-2">
									<Button variant="ghost" size="sm" onClick={handleCopyPrompts} className="cursor-pointer">
										{copied ? (
											<>
												<Check className="h-4 w-4 mr-1" /> {t("providerTool.analysis.copied")}
											</>
										) : (
											<>
												<Copy className="h-4 w-4 mr-1" /> {t("providerTool.analysis.copyPrompts")}
											</>
										)}
									</Button>
									<Button variant="ghost" size="sm" onClick={handleCopy} className="cursor-pointer">
										<Copy className="h-4 w-4 mr-1" /> {t("providerTool.analysis.copyJson")}
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4 text-sm">
								<Stat label={t("providerTool.analysis.competitors")} value={formatNumber(result.competitors.length)} />
								<Stat label={t("providerTool.analysis.prompts")} value={formatNumber(result.suggestedPrompts.length)} />
							</div>

							{result.additionalDomains.length > 0 && (
								<TagSection title={t("providerTool.analysis.additionalDomains")} items={result.additionalDomains} />
							)}
							{result.aliases.length > 0 && (
								<TagSection title={t("providerTool.analysis.aliases")} items={result.aliases} />
							)}

							{result.competitors.length > 0 && (
								<div className="space-y-2">
									<Label className="text-muted-foreground">{t("providerTool.analysis.competitors")}</Label>
									<div className="space-y-1 text-sm">
										{result.competitors.map((c) => (
											<div key={c.name} className="flex items-center gap-2">
												<span className="font-medium">{c.name}</span>
												<span className="text-muted-foreground">({c.domains.join(", ") || "—"})</span>
											</div>
										))}
									</div>
								</div>
							)}

							{result.suggestedPrompts.length > 0 && (
								<div className="space-y-2">
									<Label className="text-muted-foreground">{t("providerTool.analysis.prompts")}</Label>
									<div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1 text-sm">
										{result.suggestedPrompts.map((p, i) => (
											<div key={p.prompt} className="flex items-start gap-2 py-1 border-b last:border-0">
												<span className="text-muted-foreground w-6 flex-shrink-0">{i + 1}.</span>
												<span className="flex-1">{p.prompt}</span>
												<div className="flex flex-wrap gap-1 flex-shrink-0">
													{p.tags.map((tag) => (
														<Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
															{tag}
														</Badge>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<Label className="text-muted-foreground">{label}</Label>
			<p className="font-medium">{value}</p>
		</div>
	);
}

function TagSection({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="space-y-1">
			<Label className="text-muted-foreground">{title}</Label>
			<div className="flex flex-wrap gap-1">
				{items.map((it) => (
					<Badge key={it} variant="secondary">
						{it}
					</Badge>
				))}
			</div>
		</div>
	);
}

export const Route = createFileRoute("/_authed/admin/tools")({
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "providerTool.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "providerTool.head.description") },
			],
		};
	},
	component: ToolsPage,
});

function ToolsPage() {
	const { t } = useI18n();
	const opportunityScopes = useQuery({
		queryKey: ["admin-opportunity-scopes"],
		queryFn: () => getAdminOpportunityScopesFn(),
	});

	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">{t("providerTool.title")}</h1>
				<p className="text-muted-foreground">
					{t("providerTool.description.beforeApi")}{" "}
					<code className="mx-1 rounded bg-muted px-1">POST /api/v1/tools/analyze</code>
					{t("providerTool.description.afterApi")}
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5" />
							{t("providerTool.analysis.title")}
						</CardTitle>
						<CardDescription>{t("providerTool.analysis.description")}</CardDescription>
					</CardHeader>
					<CardContent>
						<AnalyzeBrandDialog />
					</CardContent>
				</Card>
				<OpportunitiesGenerationControl
					brands={opportunityScopes.data ?? []}
					onGenerate={async (input) => {
						return generateOpportunitiesFn({ data: input });
					}}
				/>
			</div>
			{opportunityScopes.isLoading && (
				<p className="text-sm text-muted-foreground">{t("providerTool.opportunity.loadingScopes")}</p>
			)}
			{!opportunityScopes.isLoading && !opportunityScopes.error && opportunityScopes.data?.length === 0 && (
				<p className="text-sm text-muted-foreground">{t("providerTool.opportunity.emptyScopes")}</p>
			)}
			{opportunityScopes.error && (
				<div className="text-sm text-destructive">
					<p>{t("providerTool.opportunity.errorScopes")}</p>
					<p>{t("admin.raw.errorDetails")}</p>
					<pre className="whitespace-pre-wrap">{rawErrorDetail(opportunityScopes.error)}</pre>
				</div>
			)}
		</div>
	);
}
