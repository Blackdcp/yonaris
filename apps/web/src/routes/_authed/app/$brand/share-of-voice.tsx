/**
 * /app/$brand/share-of-voice - Share of Voice
 *
 * "Who do the AI engines mention instead of you?" A leaderboard of competitor
 * mention rates next to the brand's own, with the brand's overall share, a
 * donut of top competitors, and share of voice over time.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { ColHead } from "@/components/col-head";
import { ALL_MODELS_VALUE, FilterBar, getAvailableModels } from "@/components/filter-bar";
import { FilterSection, PageHeader } from "@/components/page-header";
import { ShareOfVoiceDonut } from "@/components/share-of-voice-donut";
import { TrendChart } from "@/components/trend-chart";
import { useListFilters } from "@/hooks/use-list-filters";
import { usePromptsSummary } from "@/hooks/use-prompts-summary";
import { useScopeModels } from "@/hooks/use-scope-models";
import { useShareOfVoice } from "@/hooks/use-share-of-voice";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { BRAND_COLOR, shareOfVoiceColorMap } from "@/lib/share-of-voice-palette";

export const Route = createFileRoute("/_authed/app/$brand/share-of-voice")({
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "voice.title"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "voice.meta.description") },
			],
		};
	},
	component: ShareOfVoicePage,
});

/** Latest non-null point of the share-of-voice trend — the value the line ends on. */
function currentShareOf(series: Array<{ share: number | null }>): number | null {
	for (let i = series.length - 1; i >= 0; i--) {
		const v = series[i]?.share;
		if (typeof v === "number") return v;
	}
	return null;
}

function ShareOfVoicePage() {
	const { t, formatNumber } = useI18n();
	const { brand: brandId } = Route.useParams();
	const { scopeId, isScopeResolving, model, lookback, tags } = useListFilters();

	const { models: scopeModels, isResolved: scopeModelsResolved } = useScopeModels(brandId, scopeId);
	const availableModels = getAvailableModels(scopeModels);
	const modelParam =
		model === ALL_MODELS_VALUE || (scopeModelsResolved && !scopeModels.includes(model)) ? undefined : model;

	const { promptsSummary } = usePromptsSummary(brandId, { scopeId: scopeId ?? "", lookback, model: modelParam });
	const availableTags = promptsSummary?.availableTags ?? [];

	const { data, isLoading, isError } = useShareOfVoice(brandId, {
		scopeId: scopeId ?? "",
		lookback,
		model: modelParam,
		tags,
	});

	const infoContent = <p>{t("voice.info")}</p>;

	const maxMentions = data?.entries.reduce((m, e) => Math.max(m, e.mentions), 0) ?? 0;
	const barColors = shareOfVoiceColorMap(data?.entries ?? []);

	let content: React.ReactNode;
	if (isScopeResolving || (isLoading && !data)) {
		content = (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="h-4 w-1/2" />
				</CardContent>
			</Card>
		);
	} else if (isError && !data) {
		content = (
			<Card>
				<CardContent className="pt-6">
					<div className="py-8 text-center text-muted-foreground">{t("voice.error")}</div>
				</CardContent>
			</Card>
		);
	} else if (!data || data.totalRuns === 0 || data.entries.length === 0) {
		content = (
			<Card>
				<CardContent className="pt-6">
					<div className="text-muted-foreground text-center py-8">{t("voice.empty")}</div>
				</CardContent>
			</Card>
		);
	} else {
		// The big number = the trend's last plotted point, so it matches the line beside it.
		const currentShare = currentShareOf(data.shareTimeSeries);
		content = (
			<TooltipProvider delayDuration={150}>
				<div className="grid gap-6 lg:grid-cols-2">
					<Card data-yonaris-slot="metric-card" data-metric-emphasis="brand">
						<CardHeader>
							<CardTitle data-yonaris-slot="metric-label">{t("voice.currentShare")}</CardTitle>
						</CardHeader>
						<CardContent className="flex items-center justify-between gap-4">
							<div>
								<div data-yonaris-slot="metric-value" className="text-3xl sm:text-4xl tabular-nums">
									{currentShare !== null ? (
										<>
											{formatNumber(currentShare)}
											<span data-yonaris-slot="metric-unit">%</span>
										</>
									) : (
										"—"
									)}
								</div>
								<p data-yonaris-slot="metric-context" className="mt-2 max-w-[18rem]">
									{data.entries.length > 1
										? t("voice.contextWithCompetitors", {
												brand: data.brandName,
												runs: t(data.totalRuns === 1 ? "voice.run.one" : "voice.run.many", {
													count: formatNumber(data.totalRuns),
												}),
												competitors: t(data.entries.length === 2 ? "voice.competitor.one" : "voice.competitor.many", {
													count: formatNumber(data.entries.length - 1),
												}),
											})
										: t("voice.context", {
												brand: data.brandName,
												runs: t(data.totalRuns === 1 ? "voice.run.one" : "voice.run.many", {
													count: formatNumber(data.totalRuns),
												}),
											})}
								</p>
							</div>
							<ShareOfVoiceDonut entries={data.entries} />
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>{t("voice.trend")}</CardTitle>
						</CardHeader>
						<CardContent>
							<TrendChart
								data={data.shareTimeSeries.map((p) => ({ date: p.date, value: p.share }))}
								label={t("voice.title")}
								color={BRAND_COLOR}
								className="aspect-auto h-[180px] w-full"
							/>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>{t("voice.ranking")}</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-10">#</TableHead>
									<TableHead>{t("voice.brand")}</TableHead>
									<TableHead className="text-right">
										<ColHead label={t("voice.mentions")} tip={t("voice.tip.mentions")} right />
									</TableHead>
									<TableHead className="w-[34%]">
										<ColHead label={t("voice.share")} tip={t("voice.tip.share")} />
									</TableHead>
									<TableHead className="text-right">
										<ColHead label={t("voice.prompts")} tip={t("voice.tip.prompts")} right />
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.entries.map((e, i) => (
									<TableRow key={e.name} className={e.isBrand ? "bg-muted/40" : undefined}>
										<TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
										<TableCell className="font-medium">
											<span className="inline-flex items-center gap-2">
												{e.name}
												{e.isBrand && (
													<Badge variant="secondary" className="text-xs">
														{t("voice.you")}
													</Badge>
												)}
											</span>
										</TableCell>
										<TableCell className="text-right tabular-nums">{formatNumber(e.mentions)}</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												<div className="bg-muted h-2 w-full overflow-hidden rounded-full">
													<div
														className="h-full rounded-full"
														style={{
															width: `${maxMentions > 0 ? (e.mentions / maxMentions) * 100 : 0}%`,
															backgroundColor: barColors.get(e.name) ?? "var(--yonaris-mist, #cbd5e1)",
														}}
													/>
												</div>
												<span className="tabular-nums text-sm text-muted-foreground w-10 text-right">
													{formatNumber(Math.round(e.share * 100))}%
												</span>
											</div>
										</TableCell>
										<TableCell className="text-right tabular-nums text-muted-foreground">
											{formatNumber(e.prompts)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</TooltipProvider>
		);
	}

	return (
		<PageHeader title={t("voice.title")} subtitle={t("voice.description")} infoContent={infoContent}>
			<FilterSection>
				<FilterBar
					availableTags={availableTags}
					availableModels={availableModels}
					showSearch={false}
					showModelSelector
				/>
			</FilterSection>
			<div className="space-y-6">{content}</div>
		</PageHeader>
	);
}
