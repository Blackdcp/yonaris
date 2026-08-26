/**
 * /app/$brand - Dashboard overview page
 *
 * Shows visibility charts, citation trends, and stats.
 * Displays onboarding wizard if brand is not yet onboarded.
 */

import {
	IconActivity,
	IconArrowRight,
	IconClock,
	IconEye,
	IconInfoCircle,
	IconList,
	IconRefresh,
	IconSpeakerphone,
} from "@tabler/icons-react";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import type { ClientConfig } from "@workspace/config/types";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useEffect } from "react";
import { YONARIS_CHART_FOCUS, YONARIS_CHART_PRIMARY } from "@/brand/chart-theme";
import PromptWizard from "@/components/prompt-wizard";
import { TrendChart } from "@/components/trend-chart";
import { useBrandAccess } from "@/hooks/use-brand-access";
import { useBrand } from "@/hooks/use-brands";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { useListFilters } from "@/hooks/use-list-filters";
import { useShareOfVoice } from "@/hooks/use-share-of-voice";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { setPersonProperties } from "@/lib/posthog";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";

/** Most recent non-null value in a daily series — matches the right end of the trend line. */
function lastValue<T>(series: T[], key: keyof T): number | null {
	for (let i = series.length - 1; i >= 0; i--) {
		const v = series[i]?.[key];
		if (typeof v === "number") return v;
	}
	return null;
}

type I18nValue = ReturnType<typeof useI18n>;

function formatRelativeTime(dateString: string | null, t: I18nValue["t"], formatDate: I18nValue["formatDate"]): string {
	if (!dateString) return t("customer.overview.never");

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return t("customer.overview.justNow");
	if (diffMins < 60) return t("customer.overview.minutesAgo", { count: diffMins });
	if (diffHours < 24) return t("customer.overview.hoursAgo", { count: diffHours });
	if (diffDays < 7) return t("customer.overview.daysAgo", { count: diffDays });

	return formatDate(date, { month: "short", day: "numeric" });
}

function formatRunFrequency(hours: number, t: I18nValue["t"]): string {
	const weeks = Math.floor(hours / (7 * 24));
	const days = Math.floor((hours % (7 * 24)) / 24);
	const remainingHours = hours % 24;

	const parts: string[] = [];
	if (weeks > 0) parts.push(t("customer.overview.weeksShort", { count: weeks }));
	if (days > 0) parts.push(t("customer.overview.daysShort", { count: days }));
	if (remainingHours > 0) parts.push(t("customer.overview.hoursShort", { count: remainingHours }));

	return `~${parts.length > 0 ? parts.join(" ") : t("customer.overview.hoursShort", { count: 1 })}`;
}

export const Route = createFileRoute("/_authed/app/$brand/")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "navigation.overview"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "customer.overview.meta.description") },
			],
		};
	},
	component: DashboardPage,
});

function StatWithTooltip({
	icon: Icon,
	label,
	value,
	tooltip,
}: {
	icon: typeof IconList;
	label: string;
	value: string | number;
	tooltip: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex min-w-0 cursor-help items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
						<Icon className="h-4 w-4" />
					</div>
					<div className="min-w-0 flex-1 leading-tight">
						<div className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</div>
						<div className="mt-0.5 truncate text-xs text-muted-foreground">{label}</div>
					</div>
					<IconInfoCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
				</div>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs text-sm">{tooltip}</TooltipContent>
		</Tooltip>
	);
}

function CardTitleWithTooltip({
	title,
	tooltip,
	className = "",
}: {
	title: string;
	tooltip: string;
	className?: string;
}) {
	return (
		<CardTitle className={`text-sm font-medium flex items-center gap-1.5 ${className}`}>
			{title}
			<Tooltip>
				<TooltipTrigger asChild>
					<IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
				</TooltipTrigger>
				<TooltipContent className="max-w-xs text-sm font-normal">{tooltip}</TooltipContent>
			</Tooltip>
		</CardTitle>
	);
}

/** The latest point in a trend, presented as a primary metric rather than a status grade. */
function HeroStat({ value, loading, label }: { value: number | null; loading: boolean; label: string }) {
	const { t, formatNumber } = useI18n();
	return (
		<CardContent className="flex flex-1 flex-col items-start justify-between gap-5 px-5 py-1">
			<div data-yonaris-slot="metric-label">{label}</div>
			<div data-yonaris-slot="metric-value" style={{ fontSize: "clamp(2.75rem, 5vw, 4.5rem)" }}>
				{loading ? (
					<Skeleton className="h-16 w-32" />
				) : value === null ? (
					"—"
				) : (
					<>
						{formatNumber(value)}
						<span data-yonaris-slot="metric-unit">%</span>
					</>
				)}
			</div>
			<div data-yonaris-slot="metric-context">{t("customer.overview.latestContext")}</div>
		</CardContent>
	);
}

function DashboardPage() {
	const { t, formatDate, formatNumber } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { scopeId } = useListFilters();
	const { canManageBrand } = useBrandAccess();
	const { brand, isLoading: isLoadingBrand, isError: brandError } = useBrand();
	const {
		dashboardSummary,
		isLoading: isLoadingSummary,
		isError: summaryError,
	} = useDashboardSummary(brand?.id, scopeId, "1m");
	const {
		data: sovData,
		isLoading: isLoadingSov,
		isError: sovError,
	} = useShareOfVoice(brand?.id, {
		scopeId: scopeId ?? "",
		lookback: "1m",
	});
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const clientConfig = context.clientConfig;
	const primaryChartColor =
		clientConfig?.mode === "whitelabel"
			? (clientConfig.branding?.chartColors?.[0] ?? YONARIS_CHART_PRIMARY)
			: YONARIS_CHART_FOCUS;

	const isLoading = isLoadingBrand || isLoadingSummary;

	useEffect(() => {
		if (dashboardSummary?.totalPrompts != null) {
			setPersonProperties({ active_prompt_count: dashboardSummary.totalPrompts });
		}
	}, [dashboardSummary?.totalPrompts]);

	const visibilityTimeSeries = dashboardSummary?.visibilityTimeSeries || [];

	// "Current" = the latest plotted point of each trend, so the hero number always
	// matches the right end of the chart beside it (rather than the whole-window average).
	const currentVisibility = lastValue(visibilityTimeSeries, "overall");
	const sovShare = lastValue(sovData?.shareTimeSeries ?? [], "share");

	if (isLoadingBrand) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="m-auto flex w-full max-w-[1600px] flex-col gap-3 p-4">
					{/* AI answer presence section skeleton */}
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold flex items-center gap-2">
								<IconEye className="h-5 w-5 text-muted-foreground" />
								{t("customer.overview.answerPresence")}
							</h2>
							<Button asChild variant="ghost" size="sm" className="h-8">
								<Link to="/app/$brand/visibility" params={{ brand: brandId }}>
									{t("customer.overview.viewVisibility")} <IconArrowRight className="h-4 w-4 ml-1" />
								</Link>
							</Button>
						</div>
						<div className="grid gap-4 lg:grid-cols-4">
							<Card
								data-yonaris-slot="metric-card"
								data-metric-emphasis="brand"
								className="shadow-none flex flex-col gap-3 py-4"
							>
								<HeroStat value={null} loading label={t("customer.overview.currentVisibility")} />
							</Card>
							<Card className="shadow-none lg:col-span-3 flex flex-col gap-3 py-4">
								<CardHeader className="border-b border-dotted pb-2!">
									<CardTitle className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
										{t("customer.overview.visibilityTrend")}
										<IconInfoCircle className="h-3.5 w-3.5 opacity-70" />
									</CardTitle>
								</CardHeader>
								<CardContent className="flex-1 min-h-[100px]">
									<Skeleton className="h-full w-full" />
								</CardContent>
							</Card>
						</div>
					</section>

					{/* Share of Voice section skeleton */}
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold flex items-center gap-2">
								<IconSpeakerphone className="h-5 w-5 text-muted-foreground" />
								{t("customer.overview.shareOfVoice")}
							</h2>
							<Button asChild variant="ghost" size="sm" className="h-8">
								<Link to="/app/$brand/share-of-voice" params={{ brand: brandId }}>
									{t("customer.overview.viewShareOfVoice")} <IconArrowRight className="h-4 w-4 ml-1" />
								</Link>
							</Button>
						</div>
						<div className="grid gap-4 lg:grid-cols-4">
							<Card
								data-yonaris-slot="metric-card"
								data-metric-emphasis="brand"
								className="shadow-none flex flex-col gap-3 py-4"
							>
								<HeroStat value={null} loading label={t("customer.overview.currentShare")} />
							</Card>
							<Card className="shadow-none lg:col-span-3 flex flex-col gap-3 py-4">
								<CardHeader className="border-b border-dotted pb-2!">
									<CardTitle className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
										{t("customer.overview.shareTrend")}
										<IconInfoCircle className="h-3.5 w-3.5 opacity-70" />
									</CardTitle>
								</CardHeader>
								<CardContent className="flex-1 min-h-[100px]">
									<Skeleton className="h-full w-full" />
								</CardContent>
							</Card>
						</div>
					</section>

					{/* Footer stats skeleton */}
					<section className="pt-2">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
								<Skeleton className="size-8 rounded-md" />
								<Skeleton className="h-8 flex-1" />
							</div>
							<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
								<Skeleton className="size-8 rounded-md" />
								<Skeleton className="h-8 flex-1" />
							</div>
							<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
								<Skeleton className="size-8 rounded-md" />
								<Skeleton className="h-8 flex-1" />
							</div>
							<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
								<Skeleton className="size-8 rounded-md" />
								<Skeleton className="h-8 flex-1" />
							</div>
						</div>
					</section>
				</div>
			</div>
		);
	}

	if ((brandError && !brand) || (summaryError && !dashboardSummary) || (sovError && !sovData)) {
		return <div className="m-auto p-8 text-center text-muted-foreground">{t("customer.overview.error")}</div>;
	}

	const hasPrompts = brand?.prompts && brand.prompts.length > 0;

	if (!brand?.onboarded) {
		return (
			<div className="space-y-6 max-w-2xl p-4">
				<div className="space-y-2">
					<h2 className="text-2xl font-bold">Research Brand Data</h2>
					<p className="text-muted-foreground text-balance">
						We will analyze your website and find the best generative AI prompts to track. This process may take a
						couple of minutes.
					</p>
				</div>
				<PromptWizard
					onComplete={() => {
						const template = clientConfig?.branding.onboardingRedirectUrlTemplate;
						if (template) {
							window.location.href = template.replace("{brandId}", brandId);
						}
					}}
				/>
			</div>
		);
	}

	// Get metrics from optimized summary
	const totalRuns = dashboardSummary?.totalRuns || 0;
	const totalPrompts = dashboardSummary?.totalPrompts || 0;
	const nonBrandedVisibility = dashboardSummary?.nonBrandedVisibility || 0;
	const lastUpdatedAt = dashboardSummary?.lastUpdatedAt || null;

	// Show placeholder if no evaluations yet
	const hasNoEvaluations = totalRuns === 0 && !isLoadingSummary;
	const hasEnabledPrompts = totalPrompts > 0;

	if (hasNoEvaluations) {
		const getMessage = () => {
			if (hasEnabledPrompts) {
				return t("customer.overview.awaitingEnabled");
			}
			if (hasPrompts) {
				return t("customer.overview.awaitingDisabled");
			}
			return t("customer.overview.awaitingNoPrompts");
		};

		return (
			<div className="flex flex-1 flex-col items-center justify-center p-8 max-w-xl mx-auto text-center">
				<div className="rounded-full bg-muted p-4 mb-6">
					<IconClock className="h-10 w-10 text-muted-foreground" />
				</div>
				<h2 className="text-2xl font-bold mb-3">
					{hasEnabledPrompts ? t("customer.overview.awaitingTitle") : t("customer.overview.noDataTitle")}
				</h2>
				<p className="text-muted-foreground mb-6 text-balance">{getMessage()}</p>
				<div className="flex flex-col gap-3 w-full">
					{hasEnabledPrompts && (
						<div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
							<div className="flex items-center gap-2">
								<IconList className="h-5 w-5 text-muted-foreground" />
								<span className="text-sm">{t("customer.overview.configured")}</span>
							</div>
							<span className="font-semibold">{formatNumber(totalPrompts)}</span>
						</div>
					)}
					{canManageBrand && (
						<Button asChild variant="outline" className="w-full">
							<Link to="/app/$brand/settings/prompts" params={{ brand: brandId }}>
								{hasEnabledPrompts
									? t("customer.overview.viewPrompts")
									: hasPrompts
										? t("customer.overview.editPrompts")
										: t("customer.overview.setUpPrompts")}{" "}
								<IconArrowRight className="h-4 w-4 ml-1" />
							</Link>
						</Button>
					)}
				</div>
				{hasEnabledPrompts && (
					<p className="text-xs text-muted-foreground mt-6">{t("customer.overview.refreshHint")}</p>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-4">
				{/* Section 1: AI answer presence */}
				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<IconEye className="h-5 w-5 text-muted-foreground" />
							{t("customer.overview.answerPresence")}
						</h2>
						<Button asChild variant="ghost" size="sm" className="h-8">
							<Link to="/app/$brand/visibility" params={{ brand: brandId }}>
								{t("customer.overview.viewVisibility")} <IconArrowRight className="h-4 w-4 ml-1" />
							</Link>
						</Button>
					</div>

					<div className="grid gap-4 lg:grid-cols-4">
						{/* Hero Visibility Score */}
						<Card
							data-yonaris-slot="metric-card"
							data-metric-emphasis="brand"
							className="shadow-none flex flex-col gap-3 py-4"
						>
							<HeroStat
								value={currentVisibility}
								loading={isLoading}
								label={t("customer.overview.currentVisibility")}
							/>
						</Card>

						{/* Visibility Chart */}
						<Card className="shadow-none lg:col-span-3 flex flex-col gap-3 py-4">
							<CardHeader className="border-b border-dotted pb-2!">
								<CardTitleWithTooltip
									title={t("customer.overview.visibilityTrend")}
									tooltip={t("customer.overview.visibilityTooltipWithNonBrand", {
										value: formatNumber(nonBrandedVisibility),
									})}
								/>
							</CardHeader>
							<CardContent className="flex-1 min-h-[100px]">
								{isLoading ? (
									<Skeleton className="h-full w-full" />
								) : (
									<TrendChart
										data={visibilityTimeSeries.map((p) => ({ date: p.date, value: p.overall }))}
										label={t("customer.overview.answerTrendLabel")}
										color={primaryChartColor}
									/>
								)}
							</CardContent>
						</Card>
					</div>
				</section>

				{/* Section: Share of Voice */}
				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<IconSpeakerphone className="h-5 w-5 text-muted-foreground" />
							{t("customer.overview.shareOfVoice")}
						</h2>
						<Button asChild variant="ghost" size="sm" className="h-8">
							<Link to="/app/$brand/share-of-voice" params={{ brand: brandId }}>
								{t("customer.overview.viewShareOfVoice")} <IconArrowRight className="h-4 w-4 ml-1" />
							</Link>
						</Button>
					</div>

					<div className="grid gap-4 lg:grid-cols-4">
						<Card
							data-yonaris-slot="metric-card"
							data-metric-emphasis="brand"
							className="shadow-none flex flex-col gap-3 py-4"
						>
							<HeroStat value={sovShare} loading={isLoadingSov} label={t("customer.overview.currentShare")} />
						</Card>

						<Card className="shadow-none lg:col-span-3 flex flex-col gap-3 py-4">
							<CardHeader className="border-b border-dotted pb-2!">
								<CardTitleWithTooltip
									title={t("customer.overview.shareTrend")}
									tooltip={t("customer.overview.shareTooltip")}
								/>
							</CardHeader>
							<CardContent className="flex-1 min-h-[100px]">
								{isLoadingSov ? (
									<Skeleton className="h-full w-full" />
								) : (
									<TrendChart
										data={(sovData?.shareTimeSeries ?? []).map((p) => ({ date: p.date, value: p.share }))}
										label={t("customer.overview.shareOfVoice")}
										color={primaryChartColor}
									/>
								)}
							</CardContent>
						</Card>
					</div>
				</section>

				{/* Section 3: Tracking Stats */}
				<section className="pt-2">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{isLoadingSummary ? (
							<>
								<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
									<Skeleton className="size-8 rounded-md" />
									<Skeleton className="h-8 flex-1" />
								</div>
								<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
									<Skeleton className="size-8 rounded-md" />
									<Skeleton className="h-8 flex-1" />
								</div>
								<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
									<Skeleton className="size-8 rounded-md" />
									<Skeleton className="h-8 flex-1" />
								</div>
								<div className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2.5">
									<Skeleton className="size-8 rounded-md" />
									<Skeleton className="h-8 flex-1" />
								</div>
							</>
						) : (
							<>
								<StatWithTooltip
									icon={IconList}
									label={t("customer.overview.promptsTracked")}
									value={formatNumber(totalPrompts)}
									tooltip={t("customer.overview.promptsTooltip")}
								/>
								<StatWithTooltip
									icon={IconActivity}
									label={t("customer.overview.evaluations")}
									value={formatNumber(totalRuns)}
									tooltip={t("customer.overview.evaluationsTooltip")}
								/>
								<StatWithTooltip
									icon={IconClock}
									label={t("customer.overview.runFrequency")}
									value={formatRunFrequency(brand?.delayOverrideHours ?? clientConfig?.defaultDelayHours ?? 24, t)}
									tooltip={t("customer.overview.frequencyTooltip", {
										frequency: formatRunFrequency(
											brand?.delayOverrideHours ?? clientConfig?.defaultDelayHours ?? 24,
											t,
										).replace("~", ""),
									})}
								/>
								<StatWithTooltip
									icon={IconRefresh}
									label={t("customer.overview.lastUpdated")}
									value={formatRelativeTime(lastUpdatedAt, t, formatDate)}
									tooltip={
										lastUpdatedAt
											? t("customer.overview.lastRunTooltip", {
													date: formatDate(new Date(lastUpdatedAt), {
														dateStyle: "medium",
														timeStyle: "short",
													}),
												})
											: t("customer.overview.noRunsTooltip")
									}
								/>
							</>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
