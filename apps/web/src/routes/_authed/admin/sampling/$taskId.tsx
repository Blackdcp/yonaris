import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import {
	clearSamplingLease,
	readSamplingLease,
	type StoredSamplingLease,
	storeSamplingLease,
} from "@/components/sampling/sampling-lease-storage";
import { SamplingTaskWorkbench } from "@/components/sampling/sampling-task-workbench";
import type {
	SamplingEvidenceArtifactView,
	SamplingObservationInput,
	SamplingTaskView,
} from "@/components/sampling/types";
import { getAppName } from "@/lib/route-head";
import {
	failSamplingTaskFn,
	getSamplingTaskFn,
	heartbeatSamplingTaskFn,
	listSamplingEvidenceArtifactsFn,
	releaseSamplingTaskFn,
	submitSamplingTaskFn,
} from "@/server/sampling";

type TaskSearch = { brand?: string };
const NO_EVIDENCE_ARTIFACTS: SamplingEvidenceArtifactView[] = [];

export const Route = createFileRoute("/_authed/admin/sampling/$taskId")({
	validateSearch: (search: Record<string, unknown>): TaskSearch => ({
		brand: typeof search.brand === "string" && search.brand ? search.brand : undefined,
	}),
	head: ({ match }) => {
		const appName = getAppName(match);
		return {
			meta: [
				{ title: `Sampling Workbench · ${appName}` },
				{ name: "description", content: "Execute one claimed consumer-surface sampling task." },
			],
		};
	},
	component: SamplingTaskPage,
});

function SamplingTaskPage() {
	const { taskId } = Route.useParams();
	const { brand: brandId } = Route.useSearch();
	const navigate = useNavigate();
	const [lease, setLease] = useState<StoredSamplingLease | null>(null);
	const [leaseLoaded, setLeaseLoaded] = useState(false);
	const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
	const [returning, setReturning] = useState(false);
	const leaseBrandId = lease?.brandId;
	const leaseTaskId = lease?.taskId;
	const leaseToken = lease?.leaseToken;
	const leaseGeneration = lease?.leaseGeneration;

	useEffect(() => {
		setLease(readSamplingLease(taskId));
		setLeaseLoaded(true);
	}, [taskId]);

	const taskQuery = useQuery({
		queryKey: ["admin", "sampling", "task", brandId, taskId],
		queryFn: () => {
			if (!brandId) throw new Error("Brand context is required to load this sampling task.");
			return getSamplingTaskFn({ data: { brandId, taskId } });
		},
		enabled: Boolean(brandId),
		refetchInterval: 60_000,
	});
	const evidenceArtifactsQuery = useQuery({
		queryKey: ["admin", "sampling", "evidence", brandId, taskId, leaseGeneration],
		queryFn: () => {
			if (!brandId || !leaseToken || leaseGeneration === undefined) {
				throw new Error("A current sampling claim is required to recover staged evidence.");
			}
			return listSamplingEvidenceArtifactsFn({
				data: { brandId, taskId, leaseToken, leaseGeneration },
			});
		},
		enabled: Boolean(
			brandId && leaseToken && leaseGeneration !== undefined && leaseBrandId === brandId && leaseTaskId === taskId,
		),
	});

	useEffect(() => {
		if (!brandId || !leaseToken || leaseGeneration === undefined || leaseBrandId !== brandId || leaseTaskId !== taskId)
			return;
		let active = true;
		const heartbeat = async () => {
			try {
				const result = await heartbeatSamplingTaskFn({
					data: {
						brandId,
						taskId,
						leaseToken,
						leaseGeneration,
					},
				});
				if (!active) return;
				const refreshed: StoredSamplingLease = {
					brandId,
					taskId,
					leaseToken,
					leaseGeneration: result.leaseGeneration,
					leaseExpiresAt: result.leaseExpiresAt,
				};
				setLease(refreshed);
				storeSamplingLease(refreshed);
				setHeartbeatError(null);
			} catch (caught) {
				if (active) setHeartbeatError(caught instanceof Error ? caught.message : "Claim heartbeat failed.");
			}
		};
		void heartbeat();
		const interval = window.setInterval(heartbeat, 60_000);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, [brandId, leaseBrandId, leaseGeneration, leaseTaskId, leaseToken, taskId]);

	if (!brandId) {
		return <MissingClaim title="Brand context missing" description="Return to the queue and claim the task again." />;
	}

	if (taskQuery.isLoading || !leaseLoaded) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-10 w-72" />
				<Skeleton className="h-64 w-full" />
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}

	if (taskQuery.isError || !taskQuery.data) {
		return (
			<Alert variant="destructive">
				<AlertTriangle />
				<AlertTitle>Could not load sampling task</AlertTitle>
				<AlertDescription>{String(taskQuery.error ?? "Task not found")}</AlertDescription>
			</Alert>
		);
	}

	if (!lease || lease.brandId !== brandId || lease.taskId !== taskId) {
		return (
			<MissingClaim
				title="Claim token unavailable"
				description="Claim tokens stay only in this tab's session storage and are never placed in URLs. Return to the queue; if this task still appears claimed, wait for its lease to expire."
			/>
		);
	}

	if (taskQuery.data.leaseGeneration !== lease.leaseGeneration) {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title="Claim was replaced"
				description="This lease was reclaimed by another work session. Return to the queue to avoid duplicating the operator's work."
			/>
		);
	}

	if (!lease.leaseExpiresAt || new Date(lease.leaseExpiresAt).getTime() <= Date.now()) {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title="Claim lease expired"
				description="This claim can no longer be renewed or submitted. Return to the queue and claim available work again."
			/>
		);
	}

	if (taskQuery.data.status !== "claimed") {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title={`Task is ${taskQuery.data.status}`}
				description="This task is no longer held by the current claim. Return to the queue for available work."
			/>
		);
	}

	if (taskQuery.data.sessionRequirement === "none") {
		return (
			<MissingClaim
				title="Unsupported session requirement"
				description="This operator workbench only executes anonymous-clean or new-account-clean consumer samples."
			/>
		);
	}

	const task: SamplingTaskView = {
		id: taskQuery.data.id,
		batchId: taskQuery.data.batchId,
		batchName: taskQuery.data.batchName,
		brandId: taskQuery.data.brandId,
		brandName: taskQuery.data.brandName,
		status: taskQuery.data.status,
		promptId: taskQuery.data.promptId,
		promptText: taskQuery.data.promptText,
		surfaceTargetKey: taskQuery.data.surfaceTargetKey,
		captureRouteKey: taskQuery.data.captureRouteKey,
		targetLabel: taskQuery.data.targetLabel,
		model: taskQuery.data.model,
		launchUrl: taskQuery.data.launchUrl,
		scopeId: taskQuery.data.scopeId,
		scopeName: taskQuery.data.scopeName,
		market: taskQuery.data.market,
		locale: taskQuery.data.locale,
		timezone: taskQuery.data.timezone,
		sessionRequirement: taskQuery.data.sessionRequirement,
		searchRequirement: taskQuery.data.searchRequirement,
		evaluationRole: taskQuery.data.evaluationRole,
		sampleIndex: taskQuery.data.sampleIndex,
		claimCount: taskQuery.data.claimCount,
		leaseGeneration: taskQuery.data.leaseGeneration,
		leaseExpiresAt: taskQuery.data.leaseExpiresAt,
		measurementWindowStartsAt: taskQuery.data.protocol.measurementWindow.startsAt,
		measurementWindowEndsAt: taskQuery.data.protocol.measurementWindow.endsAt,
		minimumEvidenceArtifacts: taskQuery.data.minimumEvidenceArtifacts,
		requireEvidenceSha256: taskQuery.data.requireEvidenceSha256,
		requirePageUrl: taskQuery.data.requirePageUrl,
	};

	const returnToQueue = async () => {
		await navigate({ to: "/admin/sampling", search: { brand: brandId } });
	};

	const release = async () => {
		await releaseSamplingTaskFn({
			data: {
				brandId,
				taskId,
				leaseToken: lease.leaseToken,
				leaseGeneration: lease.leaseGeneration,
			},
		});
		clearSamplingLease(taskId);
		await returnToQueue();
	};

	const submit = async (observation: SamplingObservationInput) => {
		await submitSamplingTaskFn({
			data: {
				brandId,
				taskId,
				leaseToken: lease.leaseToken,
				leaseGeneration: lease.leaseGeneration,
				observation,
			},
		});
		clearSamplingLease(taskId);
		await returnToQueue();
	};

	const releaseAndReturn = async () => {
		setReturning(true);
		try {
			await release();
		} catch (caught) {
			setHeartbeatError(caught instanceof Error ? caught.message : "Could not release this claim.");
			setReturning(false);
		}
	};

	const fail = async (input: { errorCode?: string; errorMessage: string }) => {
		await failSamplingTaskFn({
			data: {
				brandId,
				taskId,
				leaseToken: lease.leaseToken,
				leaseGeneration: lease.leaseGeneration,
				...input,
			},
		});
		clearSamplingLease(taskId);
		await returnToQueue();
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={releaseAndReturn} disabled={returning}>
						{returning ? <Loader2 className="animate-spin" /> : <ArrowLeft />}
						Release and return
					</Button>
					<h1 className="text-3xl font-bold tracking-tight">Sampling Workbench</h1>
					<p className="mt-1 text-muted-foreground">
						Task {task.id.slice(0, 8)} · {task.batchName}
					</p>
				</div>
			</div>

			<SamplingTaskWorkbench
				task={task}
				lease={lease}
				heartbeatError={heartbeatError}
				initialEvidenceArtifacts={evidenceArtifactsQuery.data?.artifacts ?? NO_EVIDENCE_ARTIFACTS}
				evidenceArtifactsLoading={evidenceArtifactsQuery.isPending}
				evidenceArtifactsError={
					evidenceArtifactsQuery.isError
						? evidenceArtifactsQuery.error instanceof Error
							? evidenceArtifactsQuery.error.message
							: "Could not recover staged evidence."
						: null
				}
				onRelease={release}
				onSubmit={submit}
				onFail={fail}
			/>
		</div>
	);
}

function MissingClaim({ title, description }: { title: string; description: string }) {
	return (
		<div className="mx-auto max-w-xl py-12">
			<Alert>
				<LockKeyhole />
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription>
					<p>{description}</p>
					<Button asChild variant="outline" className="mt-3">
						<Link to="/admin/sampling">Return to sampling queue</Link>
					</Button>
				</AlertDescription>
			</Alert>
		</div>
	);
}
