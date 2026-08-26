/**
 * /admin/workflows - Monitor prompt scheduling, job execution, and worker health
 */

import { createFileRoute } from "@tanstack/react-router";
import type { UiLanguage } from "@workspace/config/language";
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
import { Progress } from "@workspace/ui/components/progress";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Loader2,
	Play,
	RefreshCw,
	Server,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type MessageId, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
import { getJobLogsFn, getWorkflowDataFn, retryJobFn } from "@/server/admin";

// ============================================================================
// Types
// ============================================================================

interface SchedulerInfo {
	exists: boolean;
	nextRunAt: number | null;
	cadenceHours: number | null;
}

interface LastRunByModel {
	lastRunAt: string | null;
	isOverdue: boolean;
	overdueByMs: number | null;
}

interface PromptScheduleStatus {
	promptId: string;
	promptValue: string;
	brandId: string;
	brandName: string;
	enabled: boolean;
	runFrequencyMs: number;
	lastRunsByModel: Record<string, LastRunByModel>;
	schedulerInfo: SchedulerInfo;
	recentFailures: number;
	jobStatus: "active" | "created" | "retry" | "none";
}

interface BrandScheduleSummary {
	brandId: string;
	brandName: string;
	website: string;
	enabled: boolean;
	totalPrompts: number;
	enabledPrompts: number;
	runFrequencyMs: number;
	overduePrompts: number;
	onSchedulePrompts: number;
	schedulerCoverage: { scheduled: number; total: number };
	prompts: PromptScheduleStatus[];
}

interface QueueStats {
	name: string;
	created: number;
	active: number;
	retry: number;
	completed: number;
	failed: number;
	totalPending: number;
}

interface RecentJob {
	id: string;
	name: string;
	data: { promptId?: string };
	status: "completed" | "failed";
	failedReason: string | null;
	attemptsMade: number;
	timestamp: number;
	processedOn: number | null;
	finishedOn: number | null;
}

interface WorkflowsData {
	summary: {
		totalBrands: number;
		totalPrompts: number;
		totalEnabled: number;
		totalOverdue: number;
		totalOnSchedule: number;
		percentOnSchedule: number;
	};
	queue: QueueStats;
	recentJobs: RecentJob[];
	brands: BrandScheduleSummary[];
}

type ActivePromptJobStatus = Exclude<PromptScheduleStatus["jobStatus"], "none">;

const RECENT_JOB_STATUS_LABELS: Record<RecentJob["status"], MessageId> = {
	completed: "workflow.status.completed",
	failed: "workflow.status.failed",
};

const PROMPT_JOB_STATUS_LABELS: Record<ActivePromptJobStatus, MessageId> = {
	active: "workflow.status.active",
	created: "workflow.status.queued",
	retry: "workflow.status.retry",
};

const PROMPT_JOB_ACTIVITY_LABELS: Record<ActivePromptJobStatus, MessageId> = {
	active: "workflow.status.processing",
	created: "workflow.status.inQueue",
	retry: "workflow.status.retryingSoon",
};

// ============================================================================
// Utility functions
// ============================================================================

function formatDuration(ms: number, locale: UiLanguage = "en"): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);

	if (weeks > 0) {
		const remainingDays = days % 7;
		return remainingDays > 0
			? `${translate(locale, "admin.duration.weeksShort", { count: weeks })} ${translate(locale, "admin.duration.daysShort", { count: remainingDays })}`
			: translate(locale, "admin.duration.weeksShort", { count: weeks });
	}
	if (days > 0) {
		const remainingHours = hours % 24;
		return remainingHours > 0
			? `${translate(locale, "admin.duration.daysShort", { count: days })} ${translate(locale, "admin.duration.hoursShort", { count: remainingHours })}`
			: translate(locale, "admin.duration.daysShort", { count: days });
	}
	if (hours > 0) {
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0
			? `${translate(locale, "admin.duration.hoursShort", { count: hours })} ${translate(locale, "admin.duration.minutesShort", { count: remainingMinutes })}`
			: translate(locale, "admin.duration.hoursShort", { count: hours });
	}
	if (minutes > 0) return translate(locale, "admin.duration.minutesShort", { count: minutes });
	return translate(locale, "admin.duration.secondsShort", { count: seconds });
}

function formatRelativeTime(dateStr: string | null, locale: UiLanguage = "en"): string {
	if (!dateStr) return translate(locale, "workflow.time.never");
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	return translate(locale, "workflow.time.ago", { duration: formatDuration(diffMs, locale) });
}

function formatFutureTime(timestamp: number | null, locale: UiLanguage = "en"): string {
	if (!timestamp) return translate(locale, "workflow.time.unknown");
	const now = Date.now();
	const diffMs = timestamp - now;
	if (diffMs < 0) return translate(locale, "workflow.time.overdue");
	return translate(locale, "workflow.time.future", { duration: formatDuration(diffMs, locale) });
}

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

// ============================================================================
// Sub-components
// ============================================================================

function QueueStatsCard({ stats, title }: { stats: QueueStats; title: string }) {
	const { t, formatNumber } = useI18n();
	const hasIssues = stats.failed > 0;

	return (
		<Card className={hasIssues ? "border-amber-500/50 yonaris-warning-border" : ""}>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Server className="h-4 w-4" />
					{title}
				</CardTitle>
				<CardDescription>{t("workflow.queue.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-3 gap-4 text-sm">
					<div title={t("workflow.queue.createdTooltip")}>
						<p className="text-muted-foreground">{t("workflow.queue.created")}</p>
						<p className="text-xl font-semibold text-foreground">{formatNumber(stats.created)}</p>
					</div>
					<div title={t("workflow.queue.activeTooltip")}>
						<p className="text-muted-foreground">{t("workflow.queue.active")}</p>
						<p className="text-xl font-semibold text-foreground">{formatNumber(stats.active)}</p>
					</div>
					<div title={t("workflow.queue.retryTooltip")}>
						<p className="text-muted-foreground">{t("workflow.queue.retry")}</p>
						<p className="text-xl font-semibold text-amber-600 yonaris-warning-text">{formatNumber(stats.retry)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t("workflow.queue.completed")}</p>
						<p className="text-xl font-semibold">{formatNumber(stats.completed)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t("workflow.queue.failed")}</p>
						<p className={`text-xl font-semibold ${stats.failed > 0 ? "text-red-600" : ""}`}>
							{formatNumber(stats.failed)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground">{t("workflow.queue.totalPending")}</p>
						<p className="text-xl font-semibold text-foreground">{formatNumber(stats.totalPending)}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function SchedulerCell({ info }: { info: SchedulerInfo }) {
	const { locale, t } = useI18n();
	if (!info.exists) {
		return <span className="text-muted-foreground text-xs">&mdash;</span>;
	}
	const nextText = info.nextRunAt ? formatFutureTime(info.nextRunAt, locale) : t("workflow.time.unknown");
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-xs font-medium">{t("workflow.scheduler.next", { time: nextText })}</span>
		</div>
	);
}

function ModelStatus({ status }: { status?: LastRunByModel }) {
	const { locale, t } = useI18n();
	if (!status) {
		return <span className="text-muted-foreground">-</span>;
	}
	const lastRunText = status.lastRunAt ? formatRelativeTime(status.lastRunAt, locale) : t("workflow.time.never");

	if (status.isOverdue) {
		return (
			<div className="flex flex-col gap-0.5">
				<div className="flex items-center gap-1">
					<AlertTriangle className="h-3 w-3 text-amber-500" />
					<span className="text-amber-600 text-xs">{lastRunText}</span>
				</div>
				{status.overdueByMs && (
					<span className="text-red-500 text-xs">(+{formatDuration(status.overdueByMs, locale)})</span>
				)}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-1">
			<CheckCircle2 className="h-3 w-3 text-emerald-500" />
			<span className="text-emerald-600 text-xs">{lastRunText}</span>
		</div>
	);
}

function RetryButton({ promptId, onSuccess }: { promptId?: string; jobId?: string; onSuccess: () => void }) {
	const { t } = useI18n();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | true | null>(null);
	const [success, setSuccess] = useState<"queued" | "recreated" | false>(false);

	const handleRetry = async () => {
		setIsLoading(true);
		setError(null);
		setSuccess(false);

		try {
			await retryJobFn({ data: { promptId } });
			setSuccess("queued");
			setTimeout(() => onSuccess(), 1000);
		} catch (err) {
			setError(rawErrorDetail(err) ?? true);
		} finally {
			setIsLoading(false);
		}
	};

	if (success) {
		return (
			<Button size="sm" variant="outline" disabled className="cursor-default">
				<CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
				{t(success === "recreated" ? "workflow.retry.schedulerReset" : "workflow.retry.queued")}
			</Button>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			<Button size="sm" variant="outline" onClick={handleRetry} disabled={isLoading} className="cursor-pointer text-xs">
				{isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
				{t("workflow.retry.action")}
			</Button>
			{error && (
				<div className="text-xs text-red-500">
					<p>{t("workflow.retry.error")}</p>
					{typeof error === "string" && (
						<>
							<p>{t("admin.raw.errorDetails")}</p>
							<pre className="whitespace-pre-wrap">{error}</pre>
						</>
					)}
				</div>
			)}
		</div>
	);
}

function JobDetailsDialog({ job, onRetrySuccess }: { job: RecentJob; onRetrySuccess?: () => void }) {
	const { t, formatDate } = useI18n();
	const isFailed = job.status === "failed";
	const [isOpen, setIsOpen] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [logsLoading, setLogsLoading] = useState(false);
	const [logsError, setLogsError] = useState<string | true | null>(null);
	const [retryLoading, setRetryLoading] = useState(false);
	const [retryError, setRetryError] = useState<string | true | null>(null);
	const [retrySuccess, setRetrySuccess] = useState(false);

	useEffect(() => {
		if (isOpen && job.id) {
			setLogsLoading(true);
			setLogsError(null);
			getJobLogsFn({ data: { jobId: job.id } })
				.then((data) => setLogs(data.logs || []))
				.catch((err: unknown) => setLogsError(rawErrorDetail(err) ?? true))
				.finally(() => setLogsLoading(false));
		}
	}, [isOpen, job.id]);

	const handleRetry = async () => {
		setRetryLoading(true);
		setRetryError(null);
		setRetrySuccess(false);

		try {
			await retryJobFn({ data: { jobId: job.id, promptId: job.data?.promptId } });
			setRetrySuccess(true);
			setTimeout(() => {
				setIsOpen(false);
				onRetrySuccess?.();
			}, 1000);
		} catch (err) {
			setRetryError(rawErrorDetail(err) ?? true);
		} finally {
			setRetryLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={`cursor-pointer ${isFailed ? "text-red-600 hover:text-red-700" : "text-muted-foreground hover:text-foreground"}`}
				>
					{t("workflow.job.viewLogs")}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-full max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{isFailed ? (
							<XCircle className="h-5 w-5 text-red-500" />
						) : (
							<CheckCircle2 className="h-5 w-5 text-emerald-500" />
						)}
						{t(isFailed ? "workflow.job.failedTitle" : "workflow.job.completedTitle")}
					</DialogTitle>
					<DialogDescription>{t("workflow.job.id", { id: job.id })}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">{t("workflow.job.status")}</p>
							<Badge className={isFailed ? "bg-red-500" : "bg-emerald-600"}>
								{t(RECENT_JOB_STATUS_LABELS[job.status])}
							</Badge>
						</div>
						<div>
							<p className="text-muted-foreground">{t("workflow.job.promptId")}</p>
							<p className="font-mono text-xs">{job.data?.promptId || t("workflow.job.notApplicable")}</p>
						</div>
						<div>
							<p className="text-muted-foreground">{t("workflow.job.finishedAt")}</p>
							<p>
								{job.finishedOn
									? formatDate(new Date(job.finishedOn), { dateStyle: "medium", timeStyle: "medium" })
									: t("workflow.time.unknown")}
							</p>
						</div>
					</div>
					{isFailed && job.failedReason && (
						<div>
							<p className="text-muted-foreground mb-1">{t("workflow.job.errorMessage")}</p>
							<p className="text-sm font-medium text-red-800">{t("admin.raw.errorDetails")}</p>
							<pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
								{job.failedReason}
							</pre>
						</div>
					)}
					{/* Job Logs Section */}
					<div>
						<p className="text-muted-foreground mb-1">{t("workflow.job.executionLogs")}</p>
						{logsLoading ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								{t("workflow.job.loadingLogs")}
							</div>
						) : logsError ? (
							<div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
								<p>{t("workflow.job.errorLogs")}</p>
								{typeof logsError === "string" && (
									<>
										<p>{t("admin.raw.errorDetails")}</p>
										<pre className="whitespace-pre-wrap">{logsError}</pre>
									</>
								)}
							</div>
						) : logs.length > 0 ? (
							<pre className="bg-muted rounded p-3 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap">
								{logs.join("\n")}
							</pre>
						) : (
							<p className="text-sm text-muted-foreground italic">{t("workflow.job.noLogs")}</p>
						)}
					</div>
					{/* Retry Button for Failed Jobs */}
					{isFailed && (
						<div className="flex items-center gap-3 pt-2 border-t">
							{retrySuccess ? (
								<div className="flex items-center gap-2 text-emerald-600">
									<CheckCircle2 className="h-4 w-4" />
									<span>{t("workflow.job.queuedForRetry")}</span>
								</div>
							) : (
								<>
									<Button onClick={handleRetry} disabled={retryLoading} className="cursor-pointer">
										{retryLoading ? (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										) : (
											<Play className="h-4 w-4 mr-2" />
										)}
										{t("workflow.job.retry")}
									</Button>
									{retryError && (
										<div className="text-sm text-red-600">
											<p>{t("workflow.retry.error")}</p>
											{typeof retryError === "string" && (
												<>
													<p>{t("admin.raw.errorDetails")}</p>
													<pre className="whitespace-pre-wrap">{retryError}</pre>
												</>
											)}
										</div>
									)}
								</>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function BrandRow({
	brand,
	isExpanded,
	onToggle,
	recentJobs,
	onRefresh,
}: {
	brand: BrandScheduleSummary;
	isExpanded: boolean;
	onToggle: () => void;
	recentJobs: RecentJob[];
	onRefresh: () => void;
}) {
	const { locale, t } = useI18n();
	const hasOverdue = brand.overduePrompts > 0;
	const scheduleHealth =
		brand.enabledPrompts > 0 ? Math.round((brand.onSchedulePrompts / brand.enabledPrompts) * 100) : 100;

	return (
		<>
			<TableRow className={`cursor-pointer hover:bg-muted/50 ${hasOverdue ? "bg-amber-50/50" : ""}`} onClick={onToggle}>
				<TableCell>
					<div className="flex items-center gap-2">
						{isExpanded ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<div>
							<div className="font-medium">{brand.brandName}</div>
							<p className="text-xs text-muted-foreground">{brand.website}</p>
						</div>
					</div>
				</TableCell>
				<TableCell className="text-center">
					<div className="text-sm">
						<span className="font-medium">{brand.enabledPrompts}</span>
						<span className="text-muted-foreground">/{brand.totalPrompts}</span>
					</div>
				</TableCell>
				<TableCell className="text-center">
					<span className="text-sm">{formatDuration(brand.runFrequencyMs, locale)}</span>
				</TableCell>
				<TableCell className="text-center">
					<div className="flex items-center justify-center gap-2">
						<Progress value={scheduleHealth} className="w-20 h-2" />
						<span className={`text-sm font-medium ${scheduleHealth < 80 ? "text-amber-600" : "text-emerald-600"}`}>
							{scheduleHealth}%
						</span>
					</div>
				</TableCell>
				<TableCell className="text-center">
					{brand.overduePrompts > 0 ? (
						<Badge variant="destructive" className="bg-amber-500">
							{t("workflow.brand.overdue", { count: brand.overduePrompts })}
						</Badge>
					) : (
						<Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
							{t("workflow.brand.allOnSchedule")}
						</Badge>
					)}
				</TableCell>
			</TableRow>
			{isExpanded && brand.prompts.length > 0 && (
				<TableRow>
					<TableCell colSpan={5} className="bg-muted/30 p-0">
						<div className="p-4">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[250px]">{t("workflow.table.prompt")}</TableHead>
										<TableHead className="text-center">{t("workflow.table.status")}</TableHead>
										{Object.keys(brand.prompts[0]?.lastRunsByModel || {}).map((model) => (
											<TableHead key={model} className="text-center">
												{model}
											</TableHead>
										))}
										<TableHead className="text-center">{t("workflow.table.prodScheduler")}</TableHead>
										<TableHead className="text-center">{t("workflow.table.lastJob")}</TableHead>
										<TableHead className="text-center">{t("workflow.table.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{[...brand.prompts]
										.sort((a, b) => {
											const getCategory = (p: typeof a) => {
												const isOverdue = p.enabled && Object.values(p.lastRunsByModel).some((e) => e?.isOverdue);
												if (isOverdue) return 0;
												if (p.enabled) return 1;
												return 2;
											};
											return getCategory(a) - getCategory(b);
										})
										.map((prompt) => {
											const isStuck = prompt.enabled && Object.values(prompt.lastRunsByModel).some((e) => e?.isOverdue);
											const promptJobs = recentJobs
												.filter((j) => j.data?.promptId === prompt.promptId)
												.sort((a, b) => b.timestamp - a.timestamp);
											const latestJob = promptJobs[0];
											const hasActiveJob = prompt.jobStatus !== "none";
											const activeJobStatus = prompt.jobStatus === "none" ? null : prompt.jobStatus;
											const showRetry = prompt.enabled && isStuck && prompt.schedulerInfo.exists && !hasActiveJob;
											const shouldDim = !prompt.enabled;

											return (
												<TableRow key={prompt.promptId} className={shouldDim ? "opacity-50" : ""}>
													<TableCell className="max-w-xs">
														<p className="truncate text-sm" title={prompt.promptValue}>
															{prompt.promptValue}
														</p>
													</TableCell>
													<TableCell className="text-center">
														{!prompt.enabled ? (
															<Badge variant="outline">{t("workflow.status.disabled")}</Badge>
														) : (
															<div className="flex flex-col items-center gap-1">
																<Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
																	{t("workflow.status.enabled")}
																</Badge>
																{activeJobStatus && (
																	<Badge
																		variant="secondary"
																		className={
																			activeJobStatus === "active"
																				? "bg-emerald-100 text-emerald-700"
																				: activeJobStatus === "retry"
																					? "bg-amber-100 text-amber-700"
																					: undefined
																		}
																	>
																		{t(PROMPT_JOB_STATUS_LABELS[activeJobStatus])}
																	</Badge>
																)}
															</div>
														)}
													</TableCell>
													{Object.entries(prompt.lastRunsByModel).map(([model, status]) => (
														<TableCell key={model} className="text-center">
															<ModelStatus status={status} />
														</TableCell>
													))}
													<TableCell className="text-center">
														<SchedulerCell info={prompt.schedulerInfo} />
													</TableCell>
													<TableCell className="text-center">
														{latestJob && <JobDetailsDialog job={latestJob} onRetrySuccess={onRefresh} />}
													</TableCell>
													<TableCell className="text-center">
														{showRetry && <RetryButton promptId={prompt.promptId} onSuccess={onRefresh} />}
														{activeJobStatus && (
															<span className="text-xs text-muted-foreground">
																{t(PROMPT_JOB_ACTIVITY_LABELS[activeJobStatus])}
															</span>
														)}
													</TableCell>
												</TableRow>
											);
										})}
								</TableBody>
							</Table>
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}

// ============================================================================
// Route
// ============================================================================

export const Route = createFileRoute("/_authed/admin/workflows")({
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "workflow.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "workflow.head.description") },
			],
		};
	},
	component: WorkflowsPage,
});

function WorkflowsPage() {
	const { t, formatNumber } = useI18n();
	const [data, setData] = useState<WorkflowsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | true | null>(null);
	const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
	const [isRefreshing, setIsRefreshing] = useState(false);

	const fetchData = useCallback(async (showRefreshing = false) => {
		if (showRefreshing) setIsRefreshing(true);

		try {
			const result = await getWorkflowDataFn();
			setData(result as WorkflowsData);
		} catch (err) {
			setError(err instanceof Error ? err.message : true);
		} finally {
			setLoading(false);
			setIsRefreshing(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
		const interval = setInterval(() => fetchData(), 30000);
		return () => clearInterval(interval);
	}, [fetchData]);

	const toggleBrand = (brandId: string) => {
		setExpandedBrands((prev) => {
			const next = new Set(prev);
			if (next.has(brandId)) {
				next.delete(brandId);
			} else {
				next.add(brandId);
			}
			return next;
		});
	};

	if (loading) {
		return (
			<div className="space-y-8">
				<p className="sr-only">{t("workflow.loading")}</p>
				<div className="space-y-2">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-4 w-96" />
				</div>
				<div className="grid gap-4 md:grid-cols-4">
					{[0, 1, 2, 3].map((n) => (
						<Skeleton key={n} className="h-32" />
					))}
				</div>
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-48" />
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{[0, 1, 2, 3, 4].map((n) => (
								<Skeleton key={n} className="h-16 w-full" />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-destructive">{t("workflow.error.title")}</CardTitle>
				</CardHeader>
				<CardContent>
					{typeof error === "string" && (
						<>
							<p>{t("admin.raw.errorDetails")}</p>
							<pre className="whitespace-pre-wrap">{error}</pre>
						</>
					)}
				</CardContent>
			</Card>
		);
	}

	if (!data) return null;

	// Compute overdue breakdown
	const THIRTY_MIN_MS = 30 * 60 * 1000;
	const overdueBreakdown = data.brands.reduce(
		(acc, brand) => {
			for (const prompt of brand.prompts) {
				if (!prompt.enabled) continue;
				const models = Object.values(prompt.lastRunsByModel);
				const isOverdue = models.some((e) => e?.isOverdue);
				const isSeverelyOverdue = models.some((e) => e?.isOverdue && e.overdueByMs && e.overdueByMs > THIRTY_MIN_MS);
				if (isOverdue) acc.total++;
				if (isSeverelyOverdue) acc.severe++;
			}
			return acc;
		},
		{ total: 0, severe: 0 },
	);

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<h1 className="text-3xl font-bold tracking-tight">{t("workflow.title")}</h1>
					<p className="text-muted-foreground">{t("workflow.description")}</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => fetchData(true)} disabled={isRefreshing} className="cursor-pointer">
						<RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
						{t("workflow.refresh")}
					</Button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Activity className="h-4 w-4" />
							{t("workflow.summary.health")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span
								className={`text-3xl font-bold ${data.summary.percentOnSchedule >= 80 ? "text-emerald-600" : "text-amber-600"}`}
							>
								{data.summary.percentOnSchedule}%
							</span>
							<span className="text-muted-foreground text-sm">{t("workflow.summary.onScheduleSuffix")}</span>
						</div>
						<Progress value={data.summary.percentOnSchedule} className="mt-2" />
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<CheckCircle2 className="h-4 w-4 text-emerald-500" />
							{t("workflow.summary.onSchedule")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-bold text-emerald-600">{formatNumber(data.summary.totalOnSchedule)}</span>
							<span className="text-muted-foreground text-sm">{t("workflow.summary.prompts")}</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{t("workflow.summary.ofEnabled", { count: formatNumber(data.summary.totalEnabled) })}
						</p>
					</CardContent>
				</Card>

				<Card
					className={
						overdueBreakdown.severe > 0 ? "border-red-500/50" : overdueBreakdown.total > 0 ? "border-amber-500/50" : ""
					}
				>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<AlertTriangle className={`h-4 w-4 ${overdueBreakdown.severe > 0 ? "text-red-500" : "text-amber-500"}`} />
							{t("workflow.summary.overdue30")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span
								className={`text-3xl font-bold ${overdueBreakdown.severe > 0 ? "text-red-600" : "text-muted-foreground"}`}
							>
								{overdueBreakdown.severe}
							</span>
							<span className="text-muted-foreground text-sm">{t("workflow.summary.prompts")}</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{t("workflow.summary.additionalExpired", {
								count: formatNumber(overdueBreakdown.total - overdueBreakdown.severe),
							})}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium flex items-center gap-2">
							<Clock className="h-4 w-4" />
							{t("workflow.summary.totalBrands")}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-bold">{formatNumber(data.summary.totalBrands)}</span>
							<span className="text-muted-foreground text-sm">{t("workflow.summary.brands")}</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{t("workflow.summary.totalPrompts", { count: formatNumber(data.summary.totalPrompts) })}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Queue Stats */}
			<QueueStatsCard stats={data.queue} title={t("workflow.queue.prompt")} />

			{/* Brands Table */}
			<Card>
				<CardHeader>
					<CardTitle>{t("workflow.table.title")}</CardTitle>
					<CardDescription>{t("workflow.table.description")}</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("workflow.table.brand")}</TableHead>
								<TableHead className="text-center">{t("workflow.table.prompts")}</TableHead>
								<TableHead className="text-center">{t("workflow.table.runFrequency")}</TableHead>
								<TableHead className="text-center">{t("workflow.table.health")}</TableHead>
								<TableHead className="text-center">{t("workflow.table.status")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.brands.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
										{t("workflow.empty")}
									</TableCell>
								</TableRow>
							)}
							{[...data.brands]
								.sort((a, b) => b.overduePrompts - a.overduePrompts)
								.map((brand) => (
									<BrandRow
										key={brand.brandId}
										brand={brand}
										isExpanded={expandedBrands.has(brand.brandId)}
										onToggle={() => toggleBrand(brand.brandId)}
										recentJobs={data.recentJobs}
										onRefresh={() => fetchData(true)}
									/>
								))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
