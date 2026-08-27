import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AlertTriangle, Bot, CheckCircle2, Laptop, UserRoundCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/list-pagination";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import {
	type OverseasRunCohortView,
	OverseasRunNowDialog,
	type OverseasRunNowInput,
} from "@/components/sampling/overseas-run-now-dialog";
import { SamplingBatchCreateDialog } from "@/components/sampling/sampling-batch-create-dialog";
import { SamplingBatchList } from "@/components/sampling/sampling-batch-list";
import { storeSamplingLease } from "@/components/sampling/sampling-lease-storage";
import { SamplingRunNowDialog, samplingBatchRefetchInterval } from "@/components/sampling/sampling-run-now-dialog";
import { SamplingScopeProvisionDialog } from "@/components/sampling/sampling-scope-provision-dialog";
import type {
	BrowserRunnerDeviceView,
	CreateSamplingBatchInput,
	ProvisionSamplingScopeInput,
	SamplingBatchStatus,
	SamplingBatchView,
	SamplingContextView,
	SamplingHumanQueue,
	SamplingRunNowInput,
} from "@/components/sampling/types";
import { type LocalizedMessage, type MessageId, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
import { listBrowserRunnerDevicesFn } from "@/server/browser-runner-devices";
import { listOverseasRunCohortsFn, runOverseasNowFn } from "@/server/overseas-run-now";
import {
	cancelSamplingBatchFn,
	claimSamplingTaskFn,
	createSamplingBatchFn,
	finalizeSamplingBatchNeedsHumanFn,
	getSamplingContextFn,
	listSamplingBatchesFn,
	provisionSamplingScopeFn,
	runSamplingNowFn,
	startSamplingBatchAutomationFn,
} from "@/server/sampling";

const PAGE_SIZE = 20;
const BATCH_STATUSES: SamplingBatchStatus[] = ["draft", "frozen", "in_progress", "completed", "cancelled"];
const BATCH_STATUS_LABELS: Record<SamplingBatchStatus, MessageId> = {
	draft: "sampling.status.draft",
	frozen: "sampling.status.frozen",
	in_progress: "sampling.status.inProgress",
	completed: "sampling.status.completed",
	cancelled: "sampling.status.cancelled",
};

type SamplingSearch = {
	brand?: string;
	scope?: string;
	status?: SamplingBatchStatus;
	page?: number;
};

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

function validateSearch(search: Record<string, unknown>): SamplingSearch {
	const pageValue = typeof search.page === "number" ? search.page : Number(search.page);
	return {
		brand: typeof search.brand === "string" && search.brand ? search.brand : undefined,
		scope: typeof search.scope === "string" && search.scope ? search.scope : undefined,
		status: BATCH_STATUSES.includes(search.status as SamplingBatchStatus)
			? (search.status as SamplingBatchStatus)
			: undefined,
		page: Number.isSafeInteger(pageValue) && pageValue > 1 ? pageValue : undefined,
	};
}

export const Route = createFileRoute("/_authed/admin/sampling/")({
	validateSearch,
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "sampling.queue.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "sampling.queue.head.description") },
			],
		};
	},
	component: SamplingQueuePage,
});

function SamplingQueuePage() {
	const { t } = useI18n();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const page = search.page ?? 1;
	const selectedBrandId = search.brand;
	const [actingBatchId, setActingBatchId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<LocalizedMessage | null>(null);

	const contextQuery = useQuery({
		queryKey: ["admin", "sampling", "context", search.brand ?? "all"],
		queryFn: () => getSamplingContextFn({ data: { brandId: search.brand } }),
		staleTime: 30_000,
		refetchInterval: 60_000,
	});
	const context = contextQuery.data as SamplingContextView | undefined;
	const firstBrandId = context?.brands[0]?.id;

	useEffect(() => {
		if (selectedBrandId || !firstBrandId) return;
		navigate({
			to: ".",
			search: (previous: SamplingSearch) => ({ ...previous, brand: firstBrandId, scope: undefined, page: undefined }),
			replace: true,
		});
	}, [firstBrandId, navigate, selectedBrandId]);

	const listQuery = useQuery({
		queryKey: ["admin", "sampling", "batches", selectedBrandId, search.scope, search.status, page],
		queryFn: () => {
			if (!selectedBrandId) throw new Error("Select a brand before loading sampling batches.");
			return listSamplingBatchesFn({
				data: {
					brandId: selectedBrandId,
					...(search.scope ? { scopeId: search.scope } : {}),
					...(search.status ? { status: search.status } : {}),
					limit: PAGE_SIZE,
					offset: (page - 1) * PAGE_SIZE,
				},
			});
		},
		enabled: Boolean(selectedBrandId),
		refetchInterval: (query) => samplingBatchRefetchInterval(query.state.data),
	});
	const devicesQuery = useQuery({
		queryKey: ["admin", "sampling", "browser-runner-devices"],
		queryFn: () => listBrowserRunnerDevicesFn(),
		refetchInterval: 60_000,
	});
	const overseasQuery = useQuery({
		queryKey: ["admin", "sampling", "overseas-runs", selectedBrandId],
		queryFn: () => {
			if (!selectedBrandId) throw new Error("Select a brand before loading overseas runs.");
			return listOverseasRunCohortsFn({ data: { brandId: selectedBrandId, limit: 10 } });
		},
		enabled: Boolean(selectedBrandId),
		refetchInterval: 15_000,
	});

	const scopeById = useMemo(
		() => new Map(context?.selectedBrand?.scopes.map((scope) => [scope.id, scope]) ?? []),
		[context?.selectedBrand?.scopes],
	);
	const batches: SamplingBatchView[] = useMemo(
		() =>
			(listQuery.data?.batches ?? []).map((batch) => {
				const scope = scopeById.get(batch.scopeId);
				const automation = batch as typeof batch &
					Partial<
						Pick<
							SamplingBatchView,
							| "executionMode"
							| "browserRunnerEnabled"
							| "automationStatus"
							| "automationProgress"
							| "needsHumanCount"
							| "needsHumanPreSubmitCount"
							| "needsHumanPostSubmitCount"
							| "finalizableNeedsHumanCount"
							| "canFinalizeNeedsHuman"
							| "canCancel"
							| "resultStatus"
						>
					>;
				return {
					id: batch.id,
					brandId: batch.brandId,
					scopeId: batch.scopeId,
					scopeName: scope?.name ?? batch.scopeId,
					scopeMarket: scope?.market,
					scopeLocale: scope?.locale,
					scopeTimezone: scope?.timezone,
					name: batch.name,
					status: batch.status,
					plannedTaskCount: batch.plannedTaskCount,
					claimableTaskCount: batch.claimableTaskCount,
					manifestHash: batch.manifestHash,
					createdAt: batch.createdAt,
					frozenAt: batch.frozenAt,
					startedAt: batch.startedAt,
					completedAt: batch.completedAt,
					cancelledAt: batch.cancelledAt,
					coverage: batch.coverage,
					executionMode: automation.executionMode,
					browserRunnerEnabled: automation.browserRunnerEnabled,
					automationStatus: automation.automationStatus,
					automationProgress: automation.automationProgress,
					needsHumanCount: automation.needsHumanCount,
					needsHumanPreSubmitCount: automation.needsHumanPreSubmitCount,
					needsHumanPostSubmitCount: automation.needsHumanPostSubmitCount,
					finalizableNeedsHumanCount: automation.finalizableNeedsHumanCount,
					canFinalizeNeedsHuman: automation.canFinalizeNeedsHuman,
					canCancel: automation.canCancel,
					resultStatus: automation.resultStatus,
				};
			}),
		[listQuery.data?.batches, scopeById],
	);

	const visibleTotals = useMemo(
		() =>
			batches.reduce(
				(totals, batch) => ({
					automatedCompleted: totals.automatedCompleted + (batch.automationProgress?.completed ?? 0),
					needsHuman: totals.needsHuman + (batch.needsHumanCount ?? 0),
					succeeded: totals.succeeded + batch.coverage.overall.succeeded,
					total: totals.total + batch.coverage.overall.total,
					failed: totals.failed + batch.coverage.overall.failed,
				}),
				{ automatedCompleted: 0, needsHuman: 0, succeeded: 0, total: 0, failed: 0 },
			),
		[batches],
	);

	const setSearch = (updates: Partial<SamplingSearch>) => {
		navigate({
			to: ".",
			search: (previous: SamplingSearch) => ({ ...previous, ...updates }),
			replace: true,
			resetScroll: false,
		});
	};

	const createBatch = async (input: CreateSamplingBatchInput) => {
		await createSamplingBatchFn({ data: input });
		await listQuery.refetch();
	};

	const provisionScope = async (input: ProvisionSamplingScopeInput) => {
		const result = await provisionSamplingScopeFn({ data: input });
		await Promise.all([contextQuery.refetch(), listQuery.refetch()]);
		return { copiedPromptCount: result.copiedPromptCount };
	};

	const runNow = async (input: SamplingRunNowInput) => {
		await runSamplingNowFn({ data: input });
		await listQuery.refetch();
	};
	const runOverseasNow = async (input: OverseasRunNowInput) => {
		await runOverseasNowFn({ data: input });
		await overseasQuery.refetch();
	};

	const cancelBatch = async (batch: SamplingBatchView) => {
		if (!window.confirm(t("sampling.queue.cancelConfirm", { batchName: batch.name }))) return;
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			await cancelSamplingBatchFn({ data: { brandId: batch.brandId, batchId: batch.id } });
			await listQuery.refetch();
		} catch (caught) {
			setActionError({
				id: "sampling.queue.cancelError",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setActingBatchId(null);
		}
	};

	const claimTask = async (batch: SamplingBatchView, queue?: SamplingHumanQueue) => {
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			const claimed = await claimSamplingTaskFn({
				data: { brandId: batch.brandId, batchId: batch.id, ...(queue ? { queue } : {}) },
			});
			if (!claimed) {
				setActionError({ id: "sampling.queue.noTask" });
				await listQuery.refetch();
				return;
			}
			storeSamplingLease({
				brandId: batch.brandId,
				taskId: claimed.task.id,
				leaseToken: claimed.leaseToken,
				leaseGeneration: claimed.task.leaseGeneration,
				leaseExpiresAt: claimed.task.leaseExpiresAt,
			});
			await navigate({
				to: "/admin/sampling/$taskId",
				params: { taskId: claimed.task.id },
				search: { brand: batch.brandId },
			});
		} catch (caught) {
			setActionError({
				id: "sampling.queue.claimError",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setActingBatchId(null);
		}
	};

	const startAutomation = async (batch: SamplingBatchView) => {
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			await startSamplingBatchAutomationFn({ data: { brandId: batch.brandId, batchId: batch.id } });
			await listQuery.refetch();
		} catch (caught) {
			setActionError({
				id: "sampling.queue.startError",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setActingBatchId(null);
		}
	};

	const finalizeNeedsHuman = async (batch: SamplingBatchView) => {
		const reason = window.prompt(t("sampling.queue.finalizePrompt"));
		if (!reason?.trim()) return;
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			await finalizeSamplingBatchNeedsHumanFn({
				data: { brandId: batch.brandId, batchId: batch.id, reason: reason.trim() },
			});
			await listQuery.refetch();
		} catch (caught) {
			setActionError({
				id: "sampling.queue.finalizeError",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setActingBatchId(null);
		}
	};

	const manualScopes = context?.selectedBrand?.scopes.filter((scope) => scope.enabled && scope.manualOnly) ?? [];
	const samplingScopes = manualScopes.filter((scope) => scope.samplingEvaluationRole !== null);
	const runNowPrograms = samplingScopes
		.filter(
			(scope) =>
				scope.samplingEvaluationRole === "scored" &&
				scope.market === "CN" &&
				scope.locale === "zh-CN" &&
				scope.timezone === "Asia/Shanghai",
		)
		.map((scope) => ({
			id: scope.id,
			name: scope.name,
			timezone: scope.timezone,
			promptCount:
				context?.selectedBrand?.prompts.filter((prompt) => prompt.enabled && prompt.scopeId === scope.id).length ?? 0,
		}));
	const overseasPrograms = samplingScopes
		.filter(
			(scope) =>
				scope.samplingEvaluationRole === "scored" &&
				scope.market.toUpperCase() === "US" &&
				scope.locale.toLowerCase().startsWith("en"),
		)
		.map((scope) => ({
			id: scope.id,
			name: scope.name,
			timezone: scope.timezone,
			promptCount:
				context?.selectedBrand?.prompts.filter((prompt) => prompt.enabled && prompt.scopeId === scope.id).length ?? 0,
		}));
	const browserRunnerDevices = (devicesQuery.data ?? []) as BrowserRunnerDeviceView[];

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">{t("sampling.queue.title")}</h1>
					<p className="mt-1 text-muted-foreground">{t("sampling.queue.description")}</p>
				</div>
				{context && (
					<div className="flex flex-wrap gap-2">
						<Button asChild variant="outline">
							<Link to="/admin/sampling/devices">
								<Laptop /> {t("sampling.queue.localDevices")}
							</Link>
						</Button>
						<SamplingScopeProvisionDialog context={context} onProvision={provisionScope} />
						<SamplingBatchCreateDialog context={context} onCreate={createBatch} />
					</div>
				)}
			</div>

			{context?.selectedBrand && (
				<OverseasRunNowDialog
					brandId={context.selectedBrand.id}
					programs={overseasPrograms}
					cohorts={(overseasQuery.data?.cohorts ?? []) as OverseasRunCohortView[]}
					googleAiOverviewReady={context.overseasRunNow.googleAiOverviewReady}
					onRun={runOverseasNow}
				/>
			)}

			{context?.browserRunnerEnabled && context.selectedBrand && (
				<SamplingRunNowDialog
					key={context.selectedBrand.id}
					brandId={context.selectedBrand.id}
					programs={runNowPrograms}
					devices={browserRunnerDevices}
					onRun={runNow}
				/>
			)}

			{context?.selectedBrand && samplingScopes.length === 0 && (
				<Alert>
					<AlertTriangle />
					<AlertTitle>{t("sampling.queue.noSafeScope")}</AlertTitle>
					<AlertDescription>{t("sampling.queue.noSafeScopeDescription")}</AlertDescription>
				</Alert>
			)}

			{context?.browserRunnerEnabled && (
				<Alert>
					<Bot />
					<AlertTitle>{t("sampling.queue.runnerTitle")}</AlertTitle>
					<AlertDescription>{t("sampling.queue.runnerDescription")}</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					title={t("sampling.queue.summary.automated")}
					value={visibleTotals.automatedCompleted}
					icon={<Bot />}
				/>
				<SummaryCard
					title={t("sampling.queue.summary.needsHuman")}
					value={visibleTotals.needsHuman}
					icon={<UserRoundCheck />}
				/>
				<SummaryCard
					title={t("sampling.queue.summary.successful")}
					value={`${visibleTotals.succeeded}/${visibleTotals.total}`}
					icon={<CheckCircle2 />}
				/>
				<SummaryCard title={t("sampling.queue.summary.failures")} value={visibleTotals.failed} icon={<XCircle />} />
			</div>

			<Card>
				<CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Select
						value={search.brand ?? ""}
						onValueChange={(brand) => setSearch({ brand, scope: undefined, page: undefined })}
					>
						<SelectTrigger className="w-full sm:w-56">
							<SelectValue placeholder={t("sampling.queue.filter.brand")} />
						</SelectTrigger>
						<SelectContent>
							{context?.brands.map((brand) => (
								<SelectItem key={brand.id} value={brand.id}>
									{brand.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={search.scope ?? "all"}
						onValueChange={(scope) => setSearch({ scope: scope === "all" ? undefined : scope, page: undefined })}
						disabled={!search.brand}
					>
						<SelectTrigger className="w-full sm:w-64">
							<SelectValue placeholder={t("sampling.queue.filter.scopes")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("sampling.queue.filter.scopes")}</SelectItem>
							{manualScopes.map((scope) => (
								<SelectItem key={scope.id} value={scope.id}>
									{scope.name} · {scope.market}/{scope.locale}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={search.status ?? "all"}
						onValueChange={(status) =>
							setSearch({ status: status === "all" ? undefined : (status as SamplingBatchStatus), page: undefined })
						}
					>
						<SelectTrigger className="w-full sm:w-44">
							<SelectValue placeholder={t("sampling.queue.filter.statuses")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("sampling.queue.filter.statuses")}</SelectItem>
							{BATCH_STATUSES.map((status) => (
								<SelectItem key={status} value={status}>
									{t(BATCH_STATUS_LABELS[status])}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			{actionError && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>{t("sampling.queue.actionError")}</AlertTitle>
					<AlertDescription>
						<p>{t(actionError.id, actionError.values)}</p>
						{actionError.detail && (
							<LocalizedRawDetail labelId="sampling.raw.errorDetails" detail={actionError.detail} />
						)}
					</AlertDescription>
				</Alert>
			)}

			{(devicesQuery.isLoading || overseasQuery.isLoading) && (
				<p className="text-sm text-muted-foreground">{t("sampling.queue.supportLoading")}</p>
			)}
			{(devicesQuery.isError || overseasQuery.isError) && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>{t("sampling.queue.supportError")}</AlertTitle>
					<AlertDescription>
						<LocalizedRawDetail
							labelId="sampling.raw.errorDetails"
							detail={rawErrorDetail(devicesQuery.error ?? overseasQuery.error) ?? ""}
						/>
					</AlertDescription>
				</Alert>
			)}

			{contextQuery.isLoading || listQuery.isLoading ? (
				<div className="space-y-3">
					<p className="sr-only">{t("sampling.queue.loading")}</p>
					{[0, 1, 2].map((item) => (
						<Skeleton key={item} className="h-20 w-full" />
					))}
				</div>
			) : contextQuery.isError || listQuery.isError ? (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>{t("sampling.queue.loadError")}</AlertTitle>
					<AlertDescription>
						<LocalizedRawDetail
							labelId="sampling.raw.errorDetails"
							detail={rawErrorDetail(contextQuery.error ?? listQuery.error) ?? ""}
						/>
					</AlertDescription>
				</Alert>
			) : (
				<SamplingBatchList
					batches={batches}
					actingBatchId={actingBatchId}
					onClaim={claimTask}
					onStartAutomation={startAutomation}
					onFinalizeNeedsHuman={finalizeNeedsHuman}
					onCancel={cancelBatch}
				/>
			)}

			<ListPagination
				page={page - 1}
				pageSize={listQuery.data?.limit ?? PAGE_SIZE}
				totalItems={listQuery.data?.total ?? 0}
				onPageChange={(nextPage) => setSearch({ page: nextPage > 0 ? nextPage + 1 : undefined })}
			/>
		</div>
	);
}

function SummaryCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
	const { formatNumber } = useI18n();
	return (
		<Card className="gap-2">
			<CardHeader className="flex flex-row items-center justify-between pb-0">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
			</CardHeader>
			<CardContent>
				<p className="text-2xl font-semibold tabular-nums">{typeof value === "number" ? formatNumber(value) : value}</p>
			</CardContent>
		</Card>
	);
}
