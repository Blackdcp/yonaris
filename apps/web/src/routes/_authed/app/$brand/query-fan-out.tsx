/**
 * /app/$brand/query-fan-out - Query Fan-Out
 *
 * "What are the answer engines really searching for?" When an engine answers a
 * tracked prompt it may run several web searches first. KPIs summarize how much
 * prompts expand, then three tabs: Prompt Fan-Out (each prompt's searches, with
 * its keywords bolded), Query Words (the cloud + which words engines add/drop/keep),
 * and Query Visibility (searches you're missing vs win).
 *
 * Read-only from `prompt_runs.web_queries`; engines that don't expose their
 * searches contribute runs but no queries. See `server/query-fanout.ts` and
 * `lib/fanout-analysis.ts`.
 */

import { IconChevronDown, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { useMemo, useState } from "react";
import { InfoTip, QueryWordsSection, VariationLine } from "@/components/fanout-sections";
import { ALL_MODELS_VALUE, FilterBar, getAvailableModels } from "@/components/filter-bar";
import { HistoryButton } from "@/components/history-button";
import { FilterSection, PageHeader } from "@/components/page-header";
import { type BrandFilterSearch, useListFilters } from "@/hooks/use-list-filters";
import { usePromptsSummary } from "@/hooks/use-prompts-summary";
import { useQueryFanout } from "@/hooks/use-query-fanout";
import { useScopeModels } from "@/hooks/use-scope-models";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	describeFanoutAvailability,
	type PromptFanoutStat,
	promptKeywords,
	summarizeFanoutRunExposure,
	type TopQueryStat,
} from "@/lib/fanout-analysis";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { getModelDisplayName } from "@/lib/utils";

/** The active tab lives in `?tab=` so each tab is directly linkable. */
const FANOUT_TABS = ["fanout", "top-queries", "words"] as const;
type FanoutTab = (typeof FANOUT_TABS)[number];
type FanoutRouteSearch = BrandFilterSearch & { tab?: FanoutTab };

export const Route = createFileRoute("/_authed/app/$brand/query-fan-out")({
	validateSearch: (search: Record<string, unknown>): { tab?: FanoutTab } => ({
		tab: FANOUT_TABS.includes(search.tab as FanoutTab) ? (search.tab as FanoutTab) : undefined,
	}),
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "prompt.tab.webQueries"), { appName, brandName }) },
				{
					name: "description",
					content: translate(uiLanguage, "fanout.metaDescription"),
				},
			],
		};
	},
	component: QueryFanoutPage,
});

function QueryFanoutPage() {
	const { brand: brandId } = Route.useParams();
	const { scopeId, isScopeResolving, model, lookback, tags } = useListFilters();
	const tab = Route.useSearch({ select: (s) => s.tab ?? "fanout" });
	const navigate = Route.useNavigate();
	const { t, formatNumber } = useI18n();
	const setTab = (next: FanoutTab) =>
		navigate({
			search: (prev: FanoutRouteSearch) => ({ ...prev, tab: next === "fanout" ? undefined : next }),
			replace: true,
			resetScroll: false,
		});

	const { models: scopeModels, isResolved: scopeModelsResolved } = useScopeModels(brandId, scopeId);
	const availableModels = getAvailableModels(scopeModels);
	const modelParam =
		model === ALL_MODELS_VALUE || (scopeModelsResolved && !scopeModels.includes(model)) ? undefined : model;

	const { promptsSummary } = usePromptsSummary(brandId, { scopeId: scopeId ?? "", lookback, model: modelParam });
	const availableTags = promptsSummary?.availableTags ?? [];

	const { data, isLoading, isError } = useQueryFanout(brandId, {
		scopeId,
		lookback,
		tags,
		model: modelParam,
	});
	const availability = data ? describeFanoutAvailability(data) : null;

	const infoContent = <p>{t("fanout.helper")}</p>;

	let content: React.ReactNode;
	if (isScopeResolving || (isLoading && !data)) {
		content = <LoadingState />;
	} else if (isError && !data) {
		content = <EmptyState message={t("fanout.error")} />;
	} else if (!data || availability?.kind === "no_search_enabled_runs") {
		// totalRuns counts only web-search-enabled runs — a brand whose models all
		// run without web search lands here even with plenty of runs.
		content = <EmptyState message={t("fanout.noSearchRuns")} />;
	} else if (availability?.kind === "queries_not_exposed") {
		// Runs happened but none exposed fan-out — still show the KPIs (run counts)
		// above the explanation rather than hiding everything.
		content = (
			<TooltipProvider delayDuration={150}>
				<div className="space-y-6">
					<StatRow data={data} />
					<EmptyState message={t("fanout.queriesNotExposed")} />
				</div>
			</TooltipProvider>
		);
	} else if (availability?.kind === "query_exposed_no_fanout") {
		content = (
			<TooltipProvider delayDuration={150}>
				<div className="space-y-6">
					<StatRow data={data} />
					<EmptyState
						message={`${t(availability.exposedRuns === 1 ? "fanout.echoOnly.one" : "fanout.echoOnly.many", {
							count: formatNumber(availability.exposedRuns),
						})}${
							availability.unknownRuns > 0
								? ` ${t(availability.unknownRuns === 1 ? "fanout.echoOnlyUnknown.one" : "fanout.echoOnlyUnknown.many", {
										count: formatNumber(availability.unknownRuns),
									})}`
								: ""
						}`}
					/>
				</div>
			</TooltipProvider>
		);
	} else {
		content = (
			<TooltipProvider delayDuration={150}>
				<div className="space-y-6">
					<StatRow data={data} />
					<Tabs value={tab} onValueChange={(v) => setTab(v as FanoutTab)} className="gap-4">
						<TabsList aria-label={t("fanout.tabsLabel")}>
							<TabsTrigger value="fanout">{t("prompt.webQueries.fanout")}</TabsTrigger>
							<TabsTrigger value="top-queries">{t("fanout.topQueries.title")}</TabsTrigger>
							<TabsTrigger value="words">{t("prompt.webQueries.words")}</TabsTrigger>
						</TabsList>
						<TabsContent value="fanout">
							<Prompts prompts={data.byPrompt} brandId={brandId} />
						</TabsContent>
						<TabsContent value="top-queries">
							<TopQueries data={data} brandId={brandId} />
						</TabsContent>
						<TabsContent value="words">
							<QueryWordsSection terms={data.terms} wordChanges={data.wordChanges} />
						</TabsContent>
					</Tabs>
				</div>
			</TooltipProvider>
		);
	}

	return (
		<PageHeader title={t("prompt.tab.webQueries")} subtitle={t("fanout.subtitle")} infoContent={infoContent}>
			<FilterSection>
				<FilterBar
					availableTags={availableTags}
					availableModels={availableModels}
					showSearch={false}
					showModelSelector
				/>
			</FilterSection>
			{content}
		</PageHeader>
	);
}

type FanoutData = NonNullable<ReturnType<typeof useQueryFanout>["data"]>;

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	tip,
	tipLabel,
}: {
	label: string;
	value: React.ReactNode;
	tip: React.ReactNode;
	tipLabel: string;
}) {
	return (
		<Card data-yonaris-slot="metric-card" className="py-4">
			<CardContent>
				<div data-yonaris-slot="metric-label" className="flex items-center gap-1">
					{label}
					<InfoTip label={tipLabel}>{tip}</InfoTip>
				</div>
				<div data-yonaris-slot="metric-value" className="mt-2 text-3xl tabular-nums">
					{value}
				</div>
			</CardContent>
		</Card>
	);
}

function RunsTooltip({ breakdown }: { breakdown: FanoutData["byModel"] }) {
	const { t, formatNumber } = useI18n();
	return (
		<>
			<p>{t("fanout.stats.exposedRunsDetail")}</p>
			{breakdown.length > 0 && (
				<div className="border-border/60 mt-2 space-y-0.5 border-t pt-2">
					{breakdown.map((m) => (
						<div key={m.model} className="flex items-center justify-between gap-3">
							<span>{getModelDisplayName(m.model)}</span>
							<span className="tabular-nums">{formatNumber(m.exposedQueryRuns)}</span>
						</div>
					))}
				</div>
			)}
		</>
	);
}

function UnknownRunsTooltip({ byModel }: { byModel: FanoutData["byModel"] }) {
	const { t, formatNumber } = useI18n();
	const rows = byModel
		.map((m) => ({ model: m.model, unknown: m.runs - m.exposedQueryRuns }))
		.filter((m) => m.unknown > 0)
		.sort((a, b) => b.unknown - a.unknown);
	return (
		<>
			<p>{t("fanout.stats.unknownRunsDetail")}</p>
			{rows.length > 0 && (
				<div className="border-border/60 mt-2 space-y-0.5 border-t pt-2">
					{rows.map((m) => (
						<div key={m.model} className="flex items-center justify-between gap-3">
							<span>{getModelDisplayName(m.model)}</span>
							<span className="tabular-nums">{formatNumber(m.unknown)}</span>
						</div>
					))}
				</div>
			)}
		</>
	);
}

function StatRow({ data }: { data: FanoutData }) {
	const { t, formatNumber } = useI18n();
	const exposure = summarizeFanoutRunExposure(data);
	const breakdown = data.byModel
		.filter((m) => m.exposedQueryRuns > 0)
		.sort((a, b) => b.exposedQueryRuns - a.exposedQueryRuns);
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<StatCard
				label={t("fanout.stats.searchRuns")}
				value={formatNumber(data.totalRuns)}
				tip={t("fanout.stats.searchRunsHelp")}
				tipLabel={t("prompt.fanout.accessibility.searchRuns")}
			/>
			<StatCard
				label={t("fanout.stats.unknownRuns")}
				value={formatNumber(exposure.unknownRuns)}
				tip={<UnknownRunsTooltip byModel={data.byModel} />}
				tipLabel={t("prompt.fanout.accessibility.unknownRuns")}
			/>
			<StatCard
				label={t("fanout.stats.exposedRuns")}
				value={formatNumber(exposure.exposedRuns)}
				tip={<RunsTooltip breakdown={breakdown} />}
				tipLabel={t("prompt.fanout.accessibility.exposedRuns")}
			/>
			<StatCard
				label={t("fanout.stats.average")}
				value={formatNumber(data.avgPerExecution)}
				tip={t("fanout.stats.averageHelp")}
				tipLabel={t("prompt.fanout.accessibility.average")}
			/>
		</div>
	);
}

function LoadingState() {
	const { t } = useI18n();
	return (
		<div className="space-y-6" role="status" aria-busy="true" aria-label={t("fanout.loading")}>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["a", "b", "c", "d"].map((k) => (
					<Card key={k} className="py-4">
						<CardContent className="space-y-2">
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-8 w-16" />
						</CardContent>
					</Card>
				))}
			</div>
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
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<Card>
			<CardContent className="py-8">
				<div className="text-muted-foreground text-center">{message}</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Prompt Fan-Out — per-prompt searches with the prompt's keywords bolded
// ---------------------------------------------------------------------------

type SortKey = "queries" | "avg";

function SortHead<K extends string>({
	k,
	label,
	sort,
	setSort,
}: {
	k: K;
	label: string;
	sort: K;
	setSort: (k: K) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => setSort(k)}
			className={cn(
				"hover:text-foreground cursor-pointer uppercase tracking-wide",
				sort === k ? "text-foreground" : "",
			)}
		>
			{label}
		</button>
	);
}

const GRID = "grid grid-cols-[1.25rem_1fr_4.5rem_7rem] items-center gap-3";

function Prompts({ prompts, brandId }: { prompts: PromptFanoutStat[]; brandId: string }) {
	const { t, formatNumber } = useI18n();
	const [expanded, setExpanded] = useState<Set<string>>(
		() => new Set(prompts.length === 1 ? [prompts[0].promptId] : []),
	);
	const [sort, setSort] = useState<SortKey>("queries");
	const [search, setSearch] = useState("");

	const rows = useMemo(() => {
		const s = search.trim().toLowerCase();
		const list = s ? prompts.filter((p) => p.promptValue.toLowerCase().includes(s)) : prompts;
		return [...list].sort((a, b) =>
			sort === "avg"
				? b.avgPerExecution - a.avgPerExecution || b.totalQueries - a.totalQueries
				: b.totalQueries - a.totalQueries,
		);
	}, [prompts, search, sort]);

	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	return (
		<Card className="gap-4">
			<CardHeader>
				<div className="flex items-center justify-between gap-4">
					<div>
						<CardTitle className="flex items-center gap-1.5 text-base">
							{t("fanout.prompts.title")}
							<InfoTip label={t("prompt.fanout.accessibility.prompts")}>{t("fanout.prompts.help")}</InfoTip>
						</CardTitle>
						<CardDescription>{t("fanout.prompts.description")}</CardDescription>
					</div>
					<div className="relative w-64 shrink-0">
						<IconSearch className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("fanout.prompts.searchPlaceholder")}
							aria-label={t("fanout.prompts.searchLabel")}
							className="h-8 pl-8 text-sm"
						/>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className={cn(GRID, "text-muted-foreground/80 border-b py-2 text-[11px] font-medium")}>
					<span />
					<span className="uppercase tracking-wide">{t("fanout.prompts.promptColumn")}</span>
					<span className="text-right">
						<SortHead k="queries" label={t("prompt.webQueries.label")} sort={sort} setSort={setSort} />
					</span>
					<span className="text-right">
						<SortHead k="avg" label={t("fanout.prompts.averageColumn")} sort={sort} setSort={setSort} />
					</span>
				</div>
				<div className="divide-border divide-y">
					{rows.map((p) => {
						const isOpen = expanded.has(p.promptId);
						const keywords = isOpen ? promptKeywords(p.promptValue) : null;
						return (
							<div key={p.promptId} className="py-1">
								<button
									type="button"
									onClick={() => toggle(p.promptId)}
									className={cn(GRID, "hover:bg-muted/50 w-full cursor-pointer rounded-sm py-2 text-left")}
									aria-expanded={isOpen}
									aria-label={t(isOpen ? "fanout.prompts.collapse" : "fanout.prompts.expand", {
										prompt: p.promptValue || t("fanout.untitledPrompt"),
									})}
								>
									<span className="text-muted-foreground">
										{isOpen ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
									</span>
									<span className="min-w-0">
										<span className="block truncate text-sm font-medium" title={p.promptValue}>
											{p.promptValue || t("fanout.untitledPrompt")}
										</span>
										<span className="text-muted-foreground text-xs">
											{t(p.uniqueQueries === 1 ? "fanout.variation.one" : "fanout.variation.many", {
												count: formatNumber(p.uniqueQueries),
											})}
										</span>
									</span>
									<span className="text-right text-sm tabular-nums">{formatNumber(p.totalQueries)}</span>
									<span className="text-right text-sm tabular-nums">{formatNumber(p.avgPerExecution)}</span>
								</button>
								{isOpen && keywords && (
									<div className="border-border mb-3 ml-8 mr-2 space-y-2 border-l pl-4">
										{p.variations.map((v) => (
											<VariationLine key={v.query} variation={v} keywords={keywords} />
										))}
										{p.uniqueQueries > p.variations.length && (
											<div className="text-muted-foreground text-xs">
												{t("prompt.fanout.topShown", {
													shown: formatNumber(p.variations.length),
													total: formatNumber(p.uniqueQueries),
												})}
											</div>
										)}
										<div className="pt-1">
											<HistoryButton
												brandId={brandId}
												promptId={p.promptId}
												promptName={p.promptValue}
												tab="web-queries"
											/>
										</div>
									</div>
								)}
							</div>
						);
					})}
					{rows.length === 0 && (
						<div className="text-muted-foreground py-6 text-center text-sm">{t("fanout.prompts.noMatches")}</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Top Queries — the searches with the widest reach, with the prompts behind them
// ---------------------------------------------------------------------------

type TopSort = "prompts" | "runs";

const TOP_GRID = "grid grid-cols-[1.25rem_1fr_5rem_5.5rem] items-center gap-3";

function TopQueries({ data, brandId }: { data: FanoutData; brandId: string }) {
	const { t, formatNumber } = useI18n();
	const [sort, setSort] = useState<TopSort>("prompts");
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const rows: TopQueryStat[] = sort === "prompts" ? data.topByPrompts : data.topByRuns;

	const toggle = (query: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(query)) next.delete(query);
			else next.add(query);
			return next;
		});

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-base">
					{t("fanout.topQueries.title")}
					<InfoTip label={t("prompt.fanout.accessibility.topQueries")}>{t("fanout.topQueries.help")}</InfoTip>
				</CardTitle>
				<CardDescription>{t("fanout.topQueries.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className={cn(TOP_GRID, "text-muted-foreground/80 border-b py-2 text-[11px] font-medium")}>
					<span />
					<span className="uppercase tracking-wide">{t("prompt.webQueries.label")}</span>
					<span className="text-right">
						<SortHead k="prompts" label={t("fanout.prompts.title")} sort={sort} setSort={setSort} />
					</span>
					<span className="text-right">
						<SortHead k="runs" label={t("fanout.topQueries.promptRuns")} sort={sort} setSort={setSort} />
					</span>
				</div>
				<div className="divide-border divide-y">
					{rows.map((q) => {
						const isOpen = expanded.has(q.query);
						return (
							<div key={q.query} className="py-1">
								<button
									type="button"
									onClick={() => toggle(q.query)}
									className={cn(TOP_GRID, "hover:bg-muted/50 w-full cursor-pointer rounded-sm py-2 text-left")}
									aria-expanded={isOpen}
									aria-label={t(isOpen ? "fanout.topQueries.collapse" : "fanout.topQueries.expand", {
										query: q.query,
									})}
								>
									<span className="text-muted-foreground">
										{isOpen ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
									</span>
									<span className="min-w-0 truncate text-sm" title={q.query}>
										{q.query}
									</span>
									<span className="text-right text-sm tabular-nums">{formatNumber(q.prompts)}</span>
									<span className="text-right text-sm tabular-nums">{formatNumber(q.runs)}</span>
								</button>
								{isOpen && (
									<div className="border-border mb-3 ml-8 mr-2 space-y-1.5 border-l pl-4">
										{q.promptRefs.map((p) => (
											<div key={p.promptId} className="flex items-baseline justify-between gap-4">
												<Link
													to="/app/$brand/prompts/$promptId"
													params={{ brand: brandId, promptId: p.promptId }}
													search={{ tab: "web-queries" }}
													className="min-w-0 truncate text-sm hover:underline"
													title={p.promptValue}
												>
													{p.promptValue || t("fanout.untitledPrompt")}
												</Link>
												<span
													className="text-muted-foreground shrink-0 text-sm tabular-nums"
													title={t("fanout.topQueries.promptRunsTitle")}
												>
													{formatNumber(p.runs)}×
												</span>
											</div>
										))}
									</div>
								)}
							</div>
						);
					})}
					{rows.length === 0 && (
						<div className="text-muted-foreground py-6 text-center text-sm">{t("fanout.topQueries.empty")}</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
