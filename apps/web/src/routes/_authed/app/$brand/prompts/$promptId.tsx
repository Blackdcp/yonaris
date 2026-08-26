/**
 * /app/$brand/prompts/$promptId - Prompt detail page
 *
 * Shows prompt details with tabs: Mentions, Web Queries, Citations, LLM Responses.
 */

import { IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { type CitationData, CitationsDisplay } from "@/components/citations-display";
import { CompetitorGuidance } from "@/components/competitor-guidance";
import {
	InfoTip,
	QueryWordsSection,
	UnknownQueriesNote,
	type VariationModelCount,
	VariationsList,
} from "@/components/fanout-sections";
import { ListPagination } from "@/components/list-pagination";
import { LookbackSelector, useLookbackPeriod } from "@/components/lookback-selector";
import { ProgressBarChart } from "@/components/progress-bar-chart";
import { ResponseSnapshotExportControls, ResponseSnapshotPanel } from "@/components/response-snapshot-panel";
import { useBrandAccess } from "@/hooks/use-brand-access";
import { useBrand } from "@/hooks/use-brands";
import type { BrandFilterSearch } from "@/hooks/use-list-filters";
import { usePromptRunsOnly } from "@/hooks/use-prompt-runs-only";
import { usePromptStats } from "@/hooks/use-prompt-stats";
import { useQueryFanout } from "@/hooks/use-query-fanout";
import type { MessageId } from "@/i18n/catalog";
import { translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { getDaysFromLookback } from "@/lib/chart-utils";
import { promptKeywords } from "@/lib/fanout-analysis";
import { buildTitle, getAppName, getBrandName } from "@/lib/route-head";
import { getModelDisplayName } from "@/lib/utils";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";
import { getPromptMetadataFn } from "@/server/prompts";

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

type PromptMetadata = {
	id: string;
	brandId: string;
	scopeId: string;
	value: string;
	enabled: boolean;
	tags: string[];
	systemTags: string[];
	nextRunAt?: string | null;
};

const TAB_KEYS = ["mentions", "web-queries", "citations", "responses"] as const;
type TabKey = (typeof TAB_KEYS)[number];
type PromptRouteSearch = BrandFilterSearch & { tab?: TabKey };

const TAB_MESSAGE_IDS: Record<TabKey, MessageId> = {
	mentions: "prompt.mentions",
	"web-queries": "prompt.tab.webQueries",
	citations: "prompt.tab.citations",
	responses: "prompt.tab.answers",
};
const SKELETON_KEYS = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

export const Route = createFileRoute("/_authed/app/$brand/prompts/$promptId")({
	// `tab` is part of the route's search schema so links can target a specific
	// tab (e.g. View Details → web-queries). Absent means the default tab.
	validateSearch: (search: Record<string, unknown>): { tab?: TabKey } => ({
		tab: TAB_KEYS.includes(search.tab as TabKey) ? (search.tab as TabKey) : undefined,
	}),
	head: ({ matches, match }) => {
		const appName = getAppName(match);
		const brandName = getBrandName(matches);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "prompt.detailTitle"), { appName, brandName }) },
				{ name: "description", content: translate(uiLanguage, "prompt.meta.description") },
			],
		};
	},
	component: PromptHistoryPage,
});

function PromptHistoryPage() {
	const { t, formatDate, formatNumber } = useI18n();
	const { brand: brandId, promptId } = Route.useParams();
	const { canManageBrand } = useBrandAccess();

	const lookback = useLookbackPeriod();
	const days = getDaysFromLookback(lookback);

	const activeTab = Route.useSearch({ select: (s) => s.tab ?? "mentions" });
	const urlScope = useSearch({ strict: false, select: (search) => search.scope });
	const navigate = Route.useNavigate();
	const setActiveTab = useCallback(
		(tab: TabKey) =>
			navigate({
				search: (prev: PromptRouteSearch) => ({ ...prev, tab: tab === "mentions" ? undefined : tab }),
				replace: true,
				resetScroll: false,
			}),
		[navigate],
	);
	const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set([activeTab]));
	const [currentPage, setCurrentPage] = useState(1);
	const [promptMeta, setPromptMeta] = useState<PromptMetadata | null>(null);
	const [isMetaLoading, setIsMetaLoading] = useState(true);
	const [isMetaError, setIsMetaError] = useState(false);

	const { brand } = useBrand(brandId);

	// Web Queries fetches its own data (useQueryFanout) — stats only back Mentions/Citations.
	const shouldFetchStats = visitedTabs.has("mentions") || visitedTabs.has("citations");
	const {
		isLoading: isStatsLoading,
		isError: isStatsError,
		aggregations,
	} = usePromptStats(shouldFetchStats ? promptId : "", { days });

	const shouldFetchRuns = visitedTabs.has("responses");
	const {
		runs,
		pagination,
		isLoading: isRunsLoading,
		isError: isRunsError,
	} = usePromptRunsOnly(shouldFetchRuns ? promptId : "", {
		page: currentPage,
		limit: 15,
		days,
	});

	// Fetch prompt metadata
	useEffect(() => {
		if (!brandId || !promptId) return;
		let cancelled = false;
		setPromptMeta(null);
		setIsMetaLoading(true);
		setIsMetaError(false);
		getPromptMetadataFn({ data: { brandId, promptId } })
			.then((data) => {
				if (!cancelled && data) {
					setPromptMeta(data);
					if (data.scopeId !== urlScope) {
						navigate({
							search: (previous: PromptRouteSearch) => ({ ...previous, scope: data.scopeId }),
							replace: true,
						});
					}
				}
			})
			.catch(() => {
				if (!cancelled) setIsMetaError(true);
			})
			.finally(() => {
				if (!cancelled) setIsMetaLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [brandId, promptId, navigate, urlScope]);

	const handleTabChange = useCallback(
		(tab: TabKey) => {
			setActiveTab(tab);
			setVisitedTabs((prev) => {
				if (prev.has(tab)) return prev;
				return new Set([...prev, tab]);
			});
		},
		[setActiveTab],
	);

	const handleLookbackChange = useCallback(() => {
		setCurrentPage(1);
	}, []);

	const handlePageChange = (newPage: number) => {
		if (newPage >= 1 && newPage <= (pagination?.totalPages || 1)) {
			setCurrentPage(newPage);
		}
	};

	const mentionStats = aggregations?.mentionStats || [];
	const citationStats = aggregations?.citationStats;

	const systemTags = promptMeta?.systemTags || [];
	const userTags = promptMeta?.tags || [];
	const hasTags = systemTags.length > 0 || userTags.length > 0;

	if (isMetaError || isStatsError || isRunsError) {
		return (
			<div className="space-y-6">
				<div className="flex justify-between items-start">
					<h1 className="text-3xl font-bold">{t("prompt.detailTitle")}</h1>
					<LookbackSelector onLookbackChange={handleLookbackChange} />
				</div>
				<Card>
					<CardContent className="pt-6">
						<div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">{t("prompt.error")}</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!isMetaLoading && !promptMeta) {
		return (
			<div className="space-y-6">
				<h1 className="text-3xl font-bold">{t("prompt.detailTitle")}</h1>
				<Card>
					<CardContent className="pt-6">
						<div className="text-muted-foreground">{t("prompt.notFound")}</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-0">
			{/* HEADER */}
			<div className="pb-6 space-y-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex-1 min-w-0">
						{isMetaLoading ? (
							<Skeleton className="h-8 w-[28rem] max-w-full" />
						) : (
							<h1 className="text-2xl font-semibold tracking-tight leading-tight break-words">{promptMeta?.value}</h1>
						)}
					</div>
					<div className="shrink-0">
						<LookbackSelector onLookbackChange={handleLookbackChange} />
					</div>
				</div>

				{isMetaLoading ? (
					<div className="flex items-center gap-3">
						<Skeleton className="h-5 w-14" />
						<Skeleton className="h-5 w-40" />
					</div>
				) : (
					<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
						{promptMeta?.enabled ? (
							<span className="inline-flex items-center gap-1.5 text-green-700">
								<span className="relative flex h-2 w-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
								</span>
								{t("prompt.status.active")}
							</span>
						) : (
							<span className="text-muted-foreground">{t("prompt.status.disabled")}</span>
						)}

						{promptMeta?.nextRunAt && (
							<>
								<span className="text-border">|</span>
								<span className="text-muted-foreground">
									{t("prompt.nextRun")}:{" "}
									<span className="text-foreground tabular-nums">
										{formatDate(new Date(promptMeta.nextRunAt), {
											month: "short",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								</span>
							</>
						)}

						{hasTags && <span className="text-border">|</span>}

						{hasTags && (
							<div className="flex items-center gap-1.5">
								<span className="text-muted-foreground">{t("prompt.tags")}:</span>
								{systemTags.map((tag) => (
									<Badge key={`sys-${tag}`} variant="secondary" className="text-xs capitalize font-normal">
										{tag}
									</Badge>
								))}
								{userTags.map((tag) => (
									<Badge key={`usr-${tag}`} variant="outline" className="text-xs capitalize font-normal">
										{tag}
									</Badge>
								))}
							</div>
						)}

						{canManageBrand && (
							<>
								<span className="text-border">|</span>
								<Link
									to="/app/$brand/settings/prompts"
									params={{ brand: brandId }}
									className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground/40"
								>
									{t("prompt.edit")}
								</Link>
							</>
						)}
					</div>
				)}
			</div>

			{/* TABS */}
			<div className="border-b border-border">
				<div className="flex items-end justify-between">
					<nav className="-mb-px flex gap-6" aria-label={t("prompt.tabs")}>
						{TAB_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => handleTabChange(key)}
								className={`cursor-pointer whitespace-nowrap pb-3 text-sm font-medium transition-colors border-b-2 ${
									activeTab === key
										? "border-foreground text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
								}`}
							>
								{t(TAB_MESSAGE_IDS[key])}
							</button>
						))}
					</nav>
					{aggregations?.totalRuns != null && (
						<span className="pb-3 text-xs text-muted-foreground tabular-nums">
							{t("prompt.runsInPeriod", { count: formatNumber(aggregations.totalRuns) })}
						</span>
					)}
				</div>
			</div>

			{/* TAB CONTENT */}
			<div className="pt-6 space-y-6">
				{activeTab === "mentions" && (
					<MentionsTab
						isLoading={isStatsLoading}
						mentionStats={mentionStats}
						totalRuns={aggregations?.totalRuns || 0}
						brandName={brand?.name}
						brandId={brandId}
						canManageBrand={canManageBrand}
					/>
				)}

				{activeTab === "web-queries" && (
					<WebQueriesTab
						brandId={brandId}
						promptId={promptId}
						promptValue={promptMeta?.value ?? ""}
						lookback={lookback}
					/>
				)}

				{activeTab === "citations" && (
					<CitationsTab
						isLoading={isStatsLoading}
						citationStats={citationStats}
						brandId={brandId}
						brandName={brand?.name}
						canManageBrand={canManageBrand}
					/>
				)}

				{activeTab === "responses" && (
					<ResponsesTab
						brandId={brandId}
						runs={runs}
						pagination={pagination}
						isLoading={isRunsLoading}
						currentPage={currentPage}
						onPageChange={handlePageChange}
						brandName={brand?.name}
					/>
				)}
			</div>
		</div>
	);
}

// =====================================================================
// Tab Content Components
// =====================================================================

function TabLoadingSkeleton({ lines = 3 }: { lines?: number }) {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-32 mb-2" />
				<Skeleton className="h-4 w-80" />
			</CardHeader>
			<Separator />
			<CardContent className="space-y-4 pt-6">
				{SKELETON_KEYS.slice(0, lines).map((key) => (
					<Skeleton key={key} className="h-8 w-full" />
				))}
			</CardContent>
		</Card>
	);
}

function MentionsTab({
	isLoading,
	mentionStats,
	totalRuns,
	brandName,
	brandId,
	canManageBrand,
}: {
	isLoading: boolean;
	mentionStats: { name: string; count: number }[];
	totalRuns: number;
	brandName?: string;
	brandId: string;
	canManageBrand: boolean;
}) {
	const { t, formatNumber } = useI18n();
	if (isLoading) return <TabLoadingSkeleton lines={5} />;

	if (mentionStats.length === 0) {
		return <div className="py-12 text-center text-muted-foreground text-sm">{t("prompt.mentionsEmpty")}</div>;
	}

	const brandMentionPct = Math.round(
		((mentionStats.find((s) => s.name === brandName)?.count || 0) / (totalRuns || 1)) * 100,
	);

	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle className="flex items-center gap-1.5 text-base">
					{t("prompt.mentions")}
					<Tooltip>
						<TooltipTrigger asChild>
							<IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
						</TooltipTrigger>
						<TooltipContent className="max-w-xs text-sm font-normal">
							<p>
								<CompetitorGuidance
									brandId={brandId}
									canManageBrand={canManageBrand}
									messageId="prompt.mentionsTooltip"
								/>
							</p>
						</TooltipContent>
					</Tooltip>
				</CardTitle>
				<CardDescription>
					{t("prompt.mentionsDescription", {
						brand: brandName ?? "",
						share: formatNumber(brandMentionPct),
						runs: t("prompt.runsInPeriod", { count: formatNumber(totalRuns) }),
					})}
				</CardDescription>
			</CardHeader>
			<Separator />
			<CardContent>
				<ProgressBarChart
					items={mentionStats.map((stat) => ({ label: stat.name, count: stat.count }))}
					defaultColor="#1e2a39"
					customTotal={totalRuns || 1}
					highlightLabel={brandName}
				/>
			</CardContent>
		</Card>
	);
}

function WebQueriesTab({
	brandId,
	promptId,
	promptValue,
	lookback,
}: {
	brandId: string;
	promptId: string;
	promptValue: string;
	lookback: ReturnType<typeof useLookbackPeriod>;
}) {
	const { t, formatNumber } = useI18n();
	// Same pipeline as the Query Fan-Out page, scoped to this prompt — echo and
	// "unavailable" sentinels filtered, and (unlike the brand-wide page) every
	// variation returned.
	const { data, isLoading, isError } = useQueryFanout(brandId, { lookback, promptId });

	// query → per-model counts, for the inline "2× ChatGPT" breakdown. byModel
	// lists are uncapped in single-prompt mode, so every variation resolves.
	const modelCounts = useMemo(() => {
		const map = new Map<string, VariationModelCount[]>();
		for (const m of data?.byModel ?? []) {
			for (const q of m.topQueries) {
				const entry = map.get(q.query);
				if (entry) entry.push({ model: m.model, count: q.count });
				else map.set(q.query, [{ model: m.model, count: q.count }]);
			}
		}
		for (const counts of map.values()) counts.sort((a, b) => b.count - a.count);
		return map;
	}, [data]);

	if (isLoading && !data) return <TabLoadingSkeleton lines={6} />;
	if (isError && !data) {
		return <div className="py-12 text-center text-muted-foreground text-sm">{t("prompt.webQueries.error")}</div>;
	}
	if (!data || data.totalQueries === 0) {
		return <div className="py-12 text-center text-muted-foreground text-sm">{t("prompt.webQueries.noData")}</div>;
	}
	const fanoutTooltip = t("prompt.webQueries.fanoutTooltip");

	return (
		<Tabs defaultValue="fanout" className="gap-4">
			<TabsList>
				<TabsTrigger value="fanout">{t("prompt.webQueries.fanout")}</TabsTrigger>
				<TabsTrigger value="words">{t("prompt.webQueries.words")}</TabsTrigger>
			</TabsList>
			<TabsContent value="fanout">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-1.5 text-base">
							{t("prompt.webQueries.fanout")}
							<InfoTip label={fanoutTooltip}>{fanoutTooltip}</InfoTip>
						</CardTitle>
						<CardDescription>
							{t("prompt.webQueries.distinct", { count: formatNumber(data.uniqueQueries) })}
						</CardDescription>
					</CardHeader>
					<Separator />
					<CardContent>
						<div className="mb-3 space-y-1 empty:hidden">
							<UnknownQueriesNote byModel={data.byModel} />
						</div>
						<div className="mb-2 text-xs font-medium text-muted-foreground">{t("prompt.webQueries.query")}</div>
						<VariationsList
							variations={data.topQueries}
							keywords={promptKeywords(promptValue)}
							totalUnique={data.uniqueQueries}
							modelCounts={modelCounts}
						/>
					</CardContent>
				</Card>
			</TabsContent>
			<TabsContent value="words">
				<QueryWordsSection terms={data.terms} wordChanges={data.wordChanges} />
			</TabsContent>
		</Tabs>
	);
}

function CitationsTab({
	isLoading,
	citationStats,
	brandId,
	brandName,
	canManageBrand,
}: {
	isLoading: boolean;
	citationStats: CitationData | undefined;
	brandId: string;
	brandName?: string;
	canManageBrand: boolean;
}) {
	const { t } = useI18n();
	if (isLoading) return <TabLoadingSkeleton lines={6} />;

	if (!citationStats || citationStats.totalCitations === 0) {
		return <div className="py-12 text-center text-muted-foreground text-sm">{t("prompt.citationsEmpty")}</div>;
	}

	return (
		<CitationsDisplay
			citationData={citationStats}
			brandId={brandId}
			brandName={brandName}
			showStats={true}
			maxDomains={10}
			maxUrls={50}
			canManageBrand={canManageBrand}
		/>
	);
}

function ResponsesTab({
	brandId,
	runs,
	pagination,
	isLoading,
	currentPage,
	onPageChange,
	brandName,
}: {
	brandId: string;
	runs: CustomerPromptRunDto[];
	pagination: ReturnType<typeof usePromptRunsOnly>["pagination"];
	isLoading: boolean;
	currentPage: number;
	onPageChange: (page: number) => void;
	brandName?: string;
}) {
	const { t, formatDate } = useI18n();

	if (isLoading && runs.length === 0) {
		return (
			<div className="space-y-4">
				{SKELETON_KEYS.slice(0, 3).map((key) => (
					<Card key={key}>
						<CardHeader className="pb-0 gap-y-0">
							<div className="grid grid-cols-3 gap-x-4">
								<div>
									<Skeleton className="h-4 w-20 mb-1" />
									<Skeleton className="h-4 w-16" />
								</div>
								<div>
									<Skeleton className="h-4 w-16 mb-1" />
									<Skeleton className="h-4 w-24" />
								</div>
								<div>
									<Skeleton className="h-4 w-20 mb-1" />
									<Skeleton className="h-4 w-32" />
								</div>
							</div>
						</CardHeader>
						<Separator />
						<CardContent className="space-y-4">
							<Skeleton className="h-20 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (runs.length === 0) {
		return <div className="py-12 text-center text-muted-foreground text-sm">{t("prompt.noRuns")}</div>;
	}

	return (
		<div className="space-y-4">
			<ResponseSnapshotExportControls brandId={brandId} />
			<h3 className="text-base font-medium">{t("prompt.history.title")}</h3>

			{runs.map((run) => (
				<Card key={run.id}>
					<CardHeader className="pb-0 gap-y-0">
						<div className="grid grid-cols-3 gap-x-4 text-sm">
							<div>
								<span className="text-muted-foreground block text-xs mb-0.5">{t("prompt.model")}</span>
								<span>{getModelDisplayName(run.model)}</span>
							</div>
							<div>
								<span className="text-muted-foreground block text-xs mb-0.5">{t("prompt.version")}</span>
								<span>{run.version}</span>
							</div>
							<div>
								<span className="text-muted-foreground block text-xs mb-0.5">{t("prompt.evaluated")}</span>
								<span>{formatDate(new Date(run.observedAt), { dateStyle: "medium", timeStyle: "short" })}</span>
							</div>
						</div>
					</CardHeader>
					<Separator />
					<CardContent className="space-y-5">
						{run.webQueries && run.webQueries.length > 0 && (
							<div>
								<span className="text-xs text-muted-foreground block mb-1.5">{t("prompt.webQueries.label")}</span>
								<div className="flex flex-wrap gap-1.5">
									{run.webQueries.map((query: string) => (
										<Badge key={query} variant="outline" className="text-xs font-normal">
											{query}
										</Badge>
									))}
								</div>
							</div>
						)}

						<div>
							<span className="text-xs text-muted-foreground block mb-1.5">{t("prompt.brandsMentioned")}</span>
							<div className="flex flex-wrap gap-1.5">
								{run.brandMentioned && brandName && <Badge className="text-xs font-normal">{brandName}</Badge>}
								{run.competitorsMentioned?.map((competitor: string) => (
									<Badge key={competitor} variant="outline" className="text-xs font-normal">
										{competitor}
									</Badge>
								))}
								{!run.brandMentioned && (!run.competitorsMentioned || run.competitorsMentioned.length === 0) && (
									<span className="text-xs text-muted-foreground">{t("prompt.none")}</span>
								)}
							</div>
						</div>

						<div>
							<span className="text-xs text-muted-foreground block mb-1.5">{t("prompt.response")}</span>
							<div className="rounded-md border bg-muted/30 p-4 max-h-64 overflow-auto prose prose-sm max-w-none">
								<ReactMarkdown>{run.answerText || t("prompt.responseEmpty")}</ReactMarkdown>
							</div>
						</div>

						{run.snapshot && <ResponseSnapshotPanel snapshot={run.snapshot} channel={run.model} />}
					</CardContent>
				</Card>
			))}

			<ListPagination
				page={currentPage - 1}
				pageSize={pagination?.limit ?? 15}
				totalItems={pagination?.total ?? runs.length}
				onPageChange={(p) => onPageChange(p + 1)}
			/>
		</div>
	);
}
