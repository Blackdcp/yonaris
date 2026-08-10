import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/list-pagination";
import { SamplingBatchCreateDialog } from "@/components/sampling/sampling-batch-create-dialog";
import { SamplingBatchList } from "@/components/sampling/sampling-batch-list";
import { storeSamplingLease } from "@/components/sampling/sampling-lease-storage";
import { SamplingScopeProvisionDialog } from "@/components/sampling/sampling-scope-provision-dialog";
import type {
	CreateSamplingBatchInput,
	ProvisionSamplingScopeInput,
	SamplingBatchStatus,
	SamplingBatchView,
	SamplingContextView,
} from "@/components/sampling/types";
import { getAppName } from "@/lib/route-head";
import {
	cancelSamplingBatchFn,
	claimSamplingTaskFn,
	createSamplingBatchFn,
	getSamplingContextFn,
	listSamplingBatchesFn,
	provisionSamplingScopeFn,
} from "@/server/sampling";

const PAGE_SIZE = 20;
const BATCH_STATUSES: SamplingBatchStatus[] = ["draft", "frozen", "in_progress", "completed", "cancelled"];

type SamplingSearch = {
	brand?: string;
	scope?: string;
	status?: SamplingBatchStatus;
	page?: number;
};

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
		return {
			meta: [
				{ title: `Sampling Tasks · ${appName}` },
				{ name: "description", content: "Create and execute auditable consumer-surface sampling batches." },
			],
		};
	},
	component: SamplingQueuePage,
});

function SamplingQueuePage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const page = search.page ?? 1;
	const selectedBrandId = search.brand;
	const [actingBatchId, setActingBatchId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

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
			search: (previous) => ({ ...previous, brand: firstBrandId, scope: undefined, page: undefined }),
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
		refetchInterval: 60_000,
	});

	const scopeNameById = useMemo(
		() => new Map(context?.selectedBrand?.scopes.map((scope) => [scope.id, scope.name]) ?? []),
		[context?.selectedBrand?.scopes],
	);
	const batches: SamplingBatchView[] = useMemo(
		() =>
			(listQuery.data?.batches ?? []).map((batch) => ({
				id: batch.id,
				brandId: batch.brandId,
				scopeId: batch.scopeId,
				scopeName: scopeNameById.get(batch.scopeId) ?? batch.scopeId,
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
			})),
		[listQuery.data?.batches, scopeNameById],
	);

	const visibleTotals = useMemo(
		() =>
			batches.reduce(
				(totals, batch) => ({
					claimable: totals.claimable + batch.claimableTaskCount,
					claimed: totals.claimed + batch.coverage.overall.claimed,
					succeeded: totals.succeeded + batch.coverage.overall.succeeded,
					failed: totals.failed + batch.coverage.overall.failed,
				}),
				{ claimable: 0, claimed: 0, succeeded: 0, failed: 0 },
			),
		[batches],
	);

	const setSearch = (updates: Partial<SamplingSearch>) => {
		navigate({
			to: ".",
			search: (previous) => ({ ...previous, ...updates }),
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

	const cancelBatch = async (batch: SamplingBatchView) => {
		if (!window.confirm(`Cancel sampling batch “${batch.name}”? Claimed and unfinished tasks will be cancelled.`))
			return;
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			await cancelSamplingBatchFn({ data: { brandId: batch.brandId, batchId: batch.id } });
			await listQuery.refetch();
		} catch (caught) {
			setActionError(caught instanceof Error ? caught.message : "Failed to cancel this sampling batch.");
		} finally {
			setActingBatchId(null);
		}
	};

	const claimTask = async (batch: SamplingBatchView) => {
		setActionError(null);
		setActingBatchId(batch.id);
		try {
			const claimed = await claimSamplingTaskFn({ data: { brandId: batch.brandId, batchId: batch.id } });
			if (!claimed) {
				setActionError("No available task remains in this batch. The queue may have changed since the last refresh.");
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
			setActionError(caught instanceof Error ? caught.message : "Failed to claim a sampling task.");
		} finally {
			setActingBatchId(null);
		}
	};

	const manualScopes = context?.selectedBrand?.scopes.filter((scope) => scope.enabled && scope.manualOnly) ?? [];
	const samplingScopes = manualScopes.filter((scope) => scope.samplingEvaluationRole !== null);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Sampling Tasks</h1>
					<p className="mt-1 text-muted-foreground">
						Run clean-session consumer-surface samples against frozen delivery manifests.
					</p>
				</div>
				{context && (
					<div className="flex flex-wrap gap-2">
						<SamplingScopeProvisionDialog context={context} onProvision={provisionScope} />
						<SamplingBatchCreateDialog context={context} onCreate={createBatch} />
					</div>
				)}
			</div>

			{context?.selectedBrand && samplingScopes.length === 0 && (
				<Alert>
					<AlertTriangle />
					<AlertTitle>No delivery-safe sampling scope</AlertTitle>
					<AlertDescription>
						Provision a manual-only scope with an explicit market, locale, timezone, and fixed scored or observation
						pool before creating a batch. Existing legacy ZZ/und scopes are intentionally not eligible.
					</AlertDescription>
				</Alert>
			)}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<SummaryCard title="Claimable (page)" value={visibleTotals.claimable} icon={<ClipboardList />} />
				<SummaryCard title="Claimed (page)" value={visibleTotals.claimed} icon={<Clock3 />} />
				<SummaryCard title="Succeeded (page)" value={visibleTotals.succeeded} icon={<CheckCircle2 />} />
				<SummaryCard title="Failed (page)" value={visibleTotals.failed} icon={<XCircle />} />
			</div>

			<Card>
				<CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Select
						value={search.brand ?? ""}
						onValueChange={(brand) => setSearch({ brand, scope: undefined, page: undefined })}
					>
						<SelectTrigger className="w-full sm:w-56">
							<SelectValue placeholder="Select brand" />
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
							<SelectValue placeholder="All manual scopes" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All manual scopes</SelectItem>
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
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All statuses</SelectItem>
							{BATCH_STATUSES.map((status) => (
								<SelectItem key={status} value={status} className="capitalize">
									{status.replaceAll("_", " ")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>

			{actionError && (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>Queue action failed</AlertTitle>
					<AlertDescription>{actionError}</AlertDescription>
				</Alert>
			)}

			{contextQuery.isLoading || listQuery.isLoading ? (
				<div className="space-y-3">
					{[0, 1, 2].map((item) => (
						<Skeleton key={item} className="h-20 w-full" />
					))}
				</div>
			) : contextQuery.isError || listQuery.isError ? (
				<Alert variant="destructive">
					<AlertTriangle />
					<AlertTitle>Could not load sampling work</AlertTitle>
					<AlertDescription>{String(contextQuery.error ?? listQuery.error)}</AlertDescription>
				</Alert>
			) : (
				<SamplingBatchList batches={batches} actingBatchId={actingBatchId} onClaim={claimTask} onCancel={cancelBatch} />
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

function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
	return (
		<Card className="gap-2">
			<CardHeader className="flex flex-row items-center justify-between pb-0">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
			</CardHeader>
			<CardContent>
				<p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
			</CardContent>
		</Card>
	);
}
