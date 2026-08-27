import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { AlertTriangle, ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
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
import { type MessageId, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { buildTitle, getAppName } from "@/lib/route-head";
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
const TASK_STATUS_LABELS: Record<SamplingTaskView["status"], MessageId> = {
	planned: "sampling.status.planned",
	available: "sampling.status.available",
	claimed: "sampling.status.claimed",
	succeeded: "sampling.status.succeeded",
	failed: "sampling.status.failed",
	cancelled: "sampling.status.cancelled",
};

function rawErrorDetail(error: unknown): string | null {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : null;
}

export const Route = createFileRoute("/_authed/admin/sampling/$taskId")({
	validateSearch: (search: Record<string, unknown>): TaskSearch => ({
		brand: typeof search.brand === "string" && search.brand ? search.brand : undefined,
	}),
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "sampling.task.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "sampling.task.head.description") },
			],
		};
	},
	component: SamplingTaskPage,
});

function SamplingTaskPage() {
	const { t } = useI18n();
	const { taskId } = Route.useParams();
	const { brand: brandId } = Route.useSearch();
	const navigate = useNavigate();
	const [lease, setLease] = useState<StoredSamplingLease | null>(null);
	const [leaseLoaded, setLeaseLoaded] = useState(false);
	const [heartbeatError, setHeartbeatError] = useState<string | true | null>(null);
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
				if (active) setHeartbeatError(rawErrorDetail(caught) ?? true);
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
		return (
			<MissingClaim
				title={t("sampling.task.missing.brandTitle")}
				description={t("sampling.task.missing.brandDescription")}
			/>
		);
	}

	if (taskQuery.isLoading || !leaseLoaded) {
		return (
			<div className="space-y-4">
				<p className="sr-only">{t("sampling.task.loading")}</p>
				<Skeleton className="h-10 w-72" />
				<Skeleton className="h-64 w-full" />
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}

	if (taskQuery.isError || !taskQuery.data) {
		const detail = rawErrorDetail(taskQuery.error);
		return (
			<Alert variant="destructive">
				<AlertTriangle />
				<AlertTitle>{t("sampling.task.loadError")}</AlertTitle>
				<AlertDescription>
					<p>{t("sampling.task.notFound")}</p>
					{detail && <LocalizedRawDetail labelId="sampling.raw.errorDetails" detail={detail} />}
				</AlertDescription>
			</Alert>
		);
	}

	if (!lease || lease.brandId !== brandId || lease.taskId !== taskId) {
		return (
			<MissingClaim
				title={t("sampling.task.missing.tokenTitle")}
				description={t("sampling.task.missing.tokenDescription")}
			/>
		);
	}

	if (taskQuery.data.leaseGeneration !== lease.leaseGeneration) {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title={t("sampling.task.missing.replacedTitle")}
				description={t("sampling.task.missing.replacedDescription")}
			/>
		);
	}

	if (!lease.leaseExpiresAt || new Date(lease.leaseExpiresAt).getTime() <= Date.now()) {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title={t("sampling.task.missing.expiredTitle")}
				description={t("sampling.task.missing.expiredDescription")}
			/>
		);
	}

	if (taskQuery.data.status !== "claimed") {
		clearSamplingLease(taskId);
		return (
			<MissingClaim
				title={t("sampling.task.missing.statusTitle", { status: t(TASK_STATUS_LABELS[taskQuery.data.status]) })}
				description={t("sampling.task.missing.statusDescription")}
			/>
		);
	}

	if (taskQuery.data.sessionRequirement === "none") {
		return (
			<MissingClaim
				title={t("sampling.task.missing.sessionTitle")}
				description={t("sampling.task.missing.sessionDescription")}
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
		automation: taskQuery.data.automation,
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
			setHeartbeatError(rawErrorDetail(caught) ?? true);
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
						{t("sampling.task.releaseReturn")}
					</Button>
					<h1 className="text-3xl font-bold tracking-tight">{t("sampling.task.title")}</h1>
					<p className="mt-1 text-muted-foreground">
						{t("sampling.task.subtitle", { taskId: task.id.slice(0, 8), batchName: task.batchName })}
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
							: true
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
	const { t } = useI18n();
	return (
		<div className="mx-auto max-w-xl py-12">
			<Alert>
				<LockKeyhole />
				<AlertTitle>{title}</AlertTitle>
				<AlertDescription>
					<p>{description}</p>
					<Button asChild variant="outline" className="mt-3">
						<Link to="/admin/sampling">{t("sampling.task.returnQueue")}</Link>
					</Button>
				</AlertDescription>
			</Alert>
		</div>
	);
}
