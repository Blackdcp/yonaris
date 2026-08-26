/**
 * Single-step onboarding wizard.
 *
 * One LLM call returns brand info + competitors + prompts; the user reviews
 * and edits before saving. Replaces the prior 4-step wizard that required
 * DataForSEO + Anthropic in tandem.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { AlertCircle, Loader2, Play, Rocket } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { type CompetitorEntry, CompetitorsEditor, newCompetitorEntry } from "@/components/competitors-editor";
import { customerSettingsErrorMessageId } from "@/components/customer-settings-errors";
import { LocalizedTagsInput as TagsInput } from "@/components/localized-tags-input";
import { type EditablePrompt, newPromptEntry, PromptsListEditor } from "@/components/prompts-list-editor";
import { brandKeys, useBrand } from "@/hooks/use-brands";
import { citationKeys } from "@/hooks/use-citations";
import { dashboardKeys } from "@/hooks/use-dashboard-summary";
import { promptsSummaryKeys } from "@/hooks/use-prompts-summary";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { trackEvent } from "@/lib/posthog";
import {
	cancelAnalyzeBrandFn,
	getAnalyzeBrandStatusFn,
	startAnalyzeBrandFn,
	updateOnboardedBrandFn,
} from "@/server/onboarding";

interface PromptWizardProps {
	onComplete: () => void;
}

/** Brand analysis runs in the worker (LLM + web search, ~1 min); the client polls for the result. */
const POLL_INTERVAL_MS = 2000;
const ANALYZE_TIMEOUT_MS = 6 * 60 * 1000; // give up after ~6 minutes

const analyzeStatusKey = (brandId: string) => ["analyze-brand", "status", brandId] as const;

export interface WizardData {
	brandName: string;
	website: string;
	additionalDomains: string[];
	aliases: string[];
	competitors: CompetitorEntry[];
	prompts: EditablePrompt[];
}

export type PromptWizardSubmissionResult =
	| { ok: false; formError: MessageId }
	| {
			ok: true;
			submitted: {
				brandId: string;
				brandName: string;
				website: string;
				additionalDomains: string[];
				aliases: string[];
				competitors: Array<{ name: string; domains: string[]; aliases: string[] }>;
				prompts: Array<{ value: string; tags: string[]; enabled: true }>;
			};
	  };

export function buildPromptWizardSubmission({
	brand,
	data,
	needsReanalysis,
}: {
	brand: { id: string; name: string; website: string };
	data: WizardData;
	needsReanalysis: boolean;
}): PromptWizardSubmissionResult {
	if (needsReanalysis) {
		return { ok: false, formError: "customer.onboardingWizard.validation.reanalysisRequired" };
	}

	const competitors = data.competitors
		.filter((competitor) => competitor.name.trim() && competitor.domains.some((domain) => domain.trim()))
		.map((competitor) => ({
			name: competitor.name.trim(),
			domains: competitor.domains.filter((domain) => domain.trim()),
			aliases: competitor.aliases,
		}));
	const prompts = data.prompts
		.filter((prompt) => prompt.enabled && prompt.value.trim())
		.map((prompt) => ({ value: prompt.value.trim(), tags: prompt.tags, enabled: true as const }));

	if (prompts.length === 0) {
		return { ok: false, formError: "customer.onboardingWizard.validation.promptRequired" };
	}

	return {
		ok: true,
		submitted: {
			brandId: brand.id,
			brandName: data.brandName.trim() || brand.name,
			website: data.website.trim() || brand.website,
			additionalDomains: data.additionalDomains,
			aliases: data.aliases,
			competitors,
			prompts,
		},
	};
}

const EditableTagsInput = memo(function EditableTagsInput({
	items,
	onValueChange,
	placeholder,
	ariaLabel,
	maxItems = 10,
}: {
	items: string[];
	onValueChange: (value: string[]) => void;
	placeholder: string;
	ariaLabel: string;
	maxItems?: number;
}) {
	const { t } = useI18n();
	return (
		<div className="space-y-2">
			<TagsInput
				value={items}
				onValueChange={onValueChange}
				placeholder={placeholder}
				searchPlaceholder={placeholder}
				ariaLabel={ariaLabel}
				maxItems={maxItems}
			/>
			<p className="text-xs text-muted-foreground">
				{t(
					items.length >= maxItems
						? "customer.onboardingWizard.itemsMaximum"
						: "customer.onboardingWizard.itemsEntered",
					{ count: items.length, max: maxItems },
				)}
			</p>
		</div>
	);
});

export interface PromptWizardViewProps {
	phase: "idle" | "analyzing" | "review";
	needsReanalysis: boolean;
	error: MessageId | null;
	submitError: MessageId | null;
	isSaving: boolean;
	websiteBeingAnalyzed: string;
	data: WizardData;
	onAnalyze: () => void;
	onCancel: () => void;
	onSubmit: () => void;
	onBrandNameChange: (value: string) => void;
	onWebsiteChange: (value: string) => void;
	onAdditionalDomainsChange: (values: string[]) => void;
	onAliasesChange: (values: string[]) => void;
	onCompetitorsChange: (values: CompetitorEntry[]) => void;
	onPromptsChange: (values: EditablePrompt[]) => void;
}

export function PromptWizardView({
	phase,
	needsReanalysis,
	error,
	submitError,
	isSaving,
	websiteBeingAnalyzed,
	data,
	onAnalyze,
	onCancel,
	onSubmit,
	onBrandNameChange,
	onWebsiteChange,
	onAdditionalDomainsChange,
	onAliasesChange,
	onCompetitorsChange,
	onPromptsChange,
}: PromptWizardViewProps) {
	const { t } = useI18n();

	if (phase === "idle" || phase === "analyzing") {
		return (
			<div className="max-w-2xl mx-auto space-y-3">
				<p className="text-sm text-muted-foreground">
					{t("customer.onboardingWizard.intro", { website: websiteBeingAnalyzed })}
				</p>
				{error && (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
					>
						<AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
						<span>{t(error)}</span>
					</div>
				)}
				<div className="flex items-center gap-2">
					<Button
						type="button"
						onClick={onAnalyze}
						disabled={phase === "analyzing"}
						className="flex items-center gap-2 cursor-pointer"
					>
						{phase === "analyzing" ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" /> {t("customer.onboardingWizard.analyzing")}
							</>
						) : (
							<>
								<Play className="h-4 w-4" />
								{t(needsReanalysis ? "customer.onboardingWizard.reanalyze" : "customer.onboardingWizard.analyze")}
							</>
						)}
					</Button>
					{phase === "analyzing" && (
						<Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
							{t("customer.onboardingWizard.cancel")}
						</Button>
					)}
				</div>
			</div>
		);
	}

	const enabledPromptCount = data.prompts.filter((prompt) => prompt.enabled && prompt.value.trim().length > 0).length;
	const brandNameLabel = t("customer.onboardingWizard.brandName");
	const websiteLabel = t("customer.onboardingWizard.website");
	const additionalDomainsLabel = t("customer.onboardingWizard.additionalDomains");
	const aliasesLabel = t("customer.onboardingWizard.aliases");

	return (
		<div className="max-w-2xl mx-auto space-y-6">
			<div className="space-y-2">
				<h2 className="text-2xl font-bold">{t("customer.onboardingWizard.brandDetails")}</h2>
				<p className="text-muted-foreground">{t("customer.onboardingWizard.brandDetailsDescription")}</p>
				<div className="space-y-3">
					<div>
						<Label htmlFor="wizard-brand-name" className="text-xs text-muted-foreground">
							{brandNameLabel}
						</Label>
						<Input
							id="wizard-brand-name"
							value={data.brandName}
							onChange={(event) => onBrandNameChange(event.target.value)}
							placeholder={t("customer.onboardingWizard.brandNamePlaceholder")}
							aria-label={brandNameLabel}
						/>
					</div>
					<div>
						<Label htmlFor="wizard-website" className="text-xs text-muted-foreground">
							{websiteLabel}
						</Label>
						<Input
							id="wizard-website"
							type="url"
							value={data.website}
							onChange={(event) => onWebsiteChange(event.target.value)}
							placeholder={t("customer.onboardingWizard.websitePlaceholder")}
							aria-label={websiteLabel}
						/>
					</div>
					<div>
						<Label className="text-xs text-muted-foreground">{additionalDomainsLabel}</Label>
						<EditableTagsInput
							items={data.additionalDomains}
							onValueChange={onAdditionalDomainsChange}
							placeholder={t("customer.onboardingWizard.additionalDomainsPlaceholder")}
							ariaLabel={additionalDomainsLabel}
							maxItems={10}
						/>
					</div>
					<div>
						<Label className="text-xs text-muted-foreground">{aliasesLabel}</Label>
						<EditableTagsInput
							items={data.aliases}
							onValueChange={onAliasesChange}
							placeholder={t("customer.onboardingWizard.aliasesPlaceholder")}
							ariaLabel={aliasesLabel}
							maxItems={10}
						/>
					</div>
				</div>
			</div>

			{needsReanalysis ? (
				<div
					role="alert"
					className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
				>
					<div className="flex items-start gap-3">
						<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
						<div className="space-y-1 text-sm">
							<p className="font-medium">{t("customer.onboardingWizard.changedTitle")}</p>
							<p>{t("customer.onboardingWizard.changedDescription")}</p>
							{(!data.brandName.trim() || !data.website.trim()) && (
								<p>{t("customer.onboardingWizard.validation.identityRequired")}</p>
							)}
						</div>
					</div>
					<Button
						type="button"
						onClick={onAnalyze}
						disabled={!data.brandName.trim() || !data.website.trim()}
						className="flex items-center gap-2 cursor-pointer"
					>
						<Play className="h-4 w-4" /> {t("customer.onboardingWizard.reanalyze")}
					</Button>
				</div>
			) : (
				<>
					<Separator />

					<div className="space-y-3">
						<div>
							<h2 className="text-2xl font-bold">{t("settings.competitors.metaTitle")}</h2>
							<p className="text-muted-foreground">{t("customer.onboardingWizard.competitorsDescription")}</p>
						</div>
						<CompetitorsEditor competitors={data.competitors} onChange={onCompetitorsChange} disabled={isSaving} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div>
							<h2 className="text-2xl font-bold">{t("settings.prompts.metaTitle")}</h2>
							<p className="text-muted-foreground">{t("customer.onboardingWizard.promptsDescription")}</p>
						</div>
						<PromptsListEditor prompts={data.prompts} onChange={onPromptsChange} showSystemTags={false} />
					</div>

					{submitError && (
						<div
							role="alert"
							className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
						>
							<AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
							<div className="text-sm">{t(submitError)}</div>
						</div>
					)}

					<Button
						type="button"
						onClick={onSubmit}
						disabled={isSaving}
						className="flex items-center gap-2 cursor-pointer"
					>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" /> {t("customer.onboardingWizard.saving")}
							</>
						) : (
							<>
								<Rocket className="h-4 w-4" />
								{t("customer.onboardingWizard.startTracking", { count: enabledPromptCount })}
							</>
						)}
					</Button>
				</>
			)}
		</div>
	);
}

export default function PromptWizard({ onComplete }: PromptWizardProps) {
	const { brand } = useBrand();
	const queryClient = useQueryClient();
	const router = useRouter();
	const [phase, setPhase] = useState<"idle" | "analyzing" | "review">("idle");
	const [needsReanalysis, setNeedsReanalysis] = useState(false);
	const [error, setError] = useState<MessageId | null>(null);
	const [submitError, setSubmitError] = useState<MessageId | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const activeAnalysisIdentity = useRef<{ brandName: string; website: string } | null>(null);
	const [data, setData] = useState<WizardData>({
		brandName: "",
		website: "",
		additionalDomains: [],
		aliases: [],
		competitors: [],
		prompts: [],
	});

	const brandId = brand?.id;

	// Stop polling, drop the cached status so the next run starts clean, and
	// (best-effort) cancel the worker job. A bare cancel passes no error.
	const stopAnalyzing = useCallback(
		(errorMessage: MessageId | null) => {
			setPhase("idle");
			setError(errorMessage);
			if (brandId) {
				queryClient.removeQueries({ queryKey: analyzeStatusKey(brandId) });
				cancelAnalyzeBrandFn({ data: { brandId } }).catch(() => {});
			}
		},
		[brandId, queryClient],
	);

	const { mutate: enqueueAnalysis, isSuccess: analysisEnqueued } = useMutation({
		mutationFn: (vars: { brandId: string; website: string; brandName?: string }) => startAnalyzeBrandFn({ data: vars }),
		onError: (analysisError) => {
			setError(customerSettingsErrorMessageId("wizardAnalyze", analysisError));
			setPhase("idle");
		},
	});

	// Poll the job status while analyzing. The query stops itself once the job
	// reaches a terminal state (refetchInterval returns false), and is disabled
	// the moment we leave the analyzing phase.
	const statusQuery = useQuery({
		queryKey: analyzeStatusKey(brandId ?? "none"),
		queryFn: () => {
			if (!brandId) throw new Error("Cannot check analysis status without a brand.");
			return getAnalyzeBrandStatusFn({ data: { brandId } });
		},
		// Only poll once the job is actually enqueued.
		enabled: phase === "analyzing" && analysisEnqueued && !!brandId,
		staleTime: 0,
		gcTime: 0,
		refetchInterval: (query) => (query.state.data?.status === "pending" ? POLL_INTERVAL_MS : false),
		refetchIntervalInBackground: true,
	});

	const handleAnalyze = useCallback(() => {
		if (!brand?.id) return;
		const brandName = data.brandName.trim() || (!needsReanalysis ? brand.name.trim() : "");
		const website = data.website.trim() || (!needsReanalysis ? brand.website.trim() : "");
		if (!brandName || !website) {
			setError("customer.onboardingWizard.validation.identityRequired");
			return;
		}
		setError(null);
		setSubmitError(null);
		queryClient.removeQueries({ queryKey: analyzeStatusKey(brand.id) });
		activeAnalysisIdentity.current = { brandName, website };
		setPhase("analyzing");
		enqueueAnalysis({ brandId: brand.id, website, brandName });
	}, [brand, data.brandName, data.website, needsReanalysis, queryClient, enqueueAnalysis]);

	const statusData = statusQuery.data;
	useEffect(() => {
		if (phase !== "analyzing" || !statusData) return;
		if (statusData.status === "failed") {
			setError(customerSettingsErrorMessageId("wizardStatus", { message: statusData.error }));
			setPhase("idle");
			if (brandId) queryClient.removeQueries({ queryKey: analyzeStatusKey(brandId) });
			return;
		}
		if (statusData.status === "done") {
			const suggestion = statusData.suggestion;
			const analyzedIdentity = activeAnalysisIdentity.current;
			setData({
				brandName: analyzedIdentity?.brandName || suggestion.brandName || brand?.name || "",
				website: analyzedIdentity?.website || suggestion.website || brand?.website || "",
				additionalDomains: suggestion.additionalDomains,
				aliases: suggestion.aliases,
				competitors: suggestion.competitors.map((competitor) =>
					newCompetitorEntry({
						name: competitor.name,
						domains: competitor.domains,
						aliases: competitor.aliases,
						expanded: false,
					}),
				),
				prompts: suggestion.suggestedPrompts.map((prompt) =>
					newPromptEntry({ value: prompt.prompt, tags: prompt.tags, enabled: true }),
				),
			});
			setNeedsReanalysis(false);
			setSubmitError(null);
			setPhase("review");
			trackEvent("onboarding_analyzed", {
				competitor_count: suggestion.competitors.length,
				prompt_count: suggestion.suggestedPrompts.length,
			});
			if (brandId) queryClient.removeQueries({ queryKey: analyzeStatusKey(brandId) });
		}
	}, [phase, statusData, brandId, brand?.name, brand?.website, queryClient]);

	useEffect(() => {
		if (phase !== "analyzing") return;
		const timer = window.setTimeout(() => stopAnalyzing("customer.onboardingWizard.error.timeout"), ANALYZE_TIMEOUT_MS);
		return () => window.clearTimeout(timer);
	}, [phase, stopAnalyzing]);

	const invalidateSuggestionsForIdentityChange = useCallback((identity: Pick<WizardData, "brandName" | "website">) => {
		setData((previous) => ({ ...previous, ...identity, competitors: [], prompts: [] }));
		setNeedsReanalysis(true);
		setSubmitError(null);
	}, []);
	const updateBrandName = useCallback(
		(brandName: string) => invalidateSuggestionsForIdentityChange({ brandName, website: data.website }),
		[data.website, invalidateSuggestionsForIdentityChange],
	);
	const updateWebsite = useCallback(
		(website: string) => invalidateSuggestionsForIdentityChange({ brandName: data.brandName, website }),
		[data.brandName, invalidateSuggestionsForIdentityChange],
	);
	const updateAliases = useCallback((aliases: string[]) => setData((previous) => ({ ...previous, aliases })), []);
	const updateAdditionalDomains = useCallback(
		(additionalDomains: string[]) => setData((previous) => ({ ...previous, additionalDomains })),
		[],
	);
	const updateCompetitors = useCallback(
		(competitors: CompetitorEntry[]) => setData((previous) => ({ ...previous, competitors })),
		[],
	);
	const updatePrompts = useCallback(
		(prompts: EditablePrompt[]) => setData((previous) => ({ ...previous, prompts })),
		[],
	);

	const handleSubmit = useCallback(async () => {
		if (!brand?.id) return;
		setSubmitError(null);
		const submission = buildPromptWizardSubmission({ brand, data, needsReanalysis });
		if (!submission.ok) {
			setSubmitError(submission.formError);
			return;
		}

		try {
			setIsSaving(true);
			await updateOnboardedBrandFn({ data: submission.submitted });

			trackEvent("wizard_completed", {
				prompts_created: submission.submitted.prompts.length,
				competitors_created: submission.submitted.competitors.length,
				skipped: false,
			});

			queryClient.invalidateQueries({ queryKey: brandKeys.all });
			queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
			queryClient.invalidateQueries({ queryKey: citationKeys.all });
			queryClient.invalidateQueries({ queryKey: promptsSummaryKeys.all });
			await router.invalidate();

			onComplete();
		} catch (saveError) {
			setSubmitError(customerSettingsErrorMessageId("wizardSave", saveError));
		} finally {
			setIsSaving(false);
		}
	}, [brand, data, needsReanalysis, queryClient, router, onComplete]);

	return (
		<PromptWizardView
			phase={phase}
			needsReanalysis={needsReanalysis}
			error={error}
			submitError={submitError}
			isSaving={isSaving}
			websiteBeingAnalyzed={data.website.trim() || brand?.website || ""}
			data={data}
			onAnalyze={handleAnalyze}
			onCancel={() => stopAnalyzing(null)}
			onSubmit={handleSubmit}
			onBrandNameChange={updateBrandName}
			onWebsiteChange={updateWebsite}
			onAdditionalDomainsChange={updateAdditionalDomains}
			onAliasesChange={updateAliases}
			onCompetitorsChange={updateCompetitors}
			onPromptsChange={updatePrompts}
		/>
	);
}
