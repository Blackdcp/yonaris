import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { Bot, Loader2, Play, UserRoundCheck, XCircle } from "lucide-react";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import { SamplingResultBadge, SamplingStatusBadge } from "./sampling-status-badge";
import type { SamplingAutomationStatus, SamplingBatchView, SamplingHumanQueue } from "./types";

function percentage(value: number | null): number {
	return value === null ? 0 : Math.round(value * 100);
}

const AUTOMATION_LABELS: Record<SamplingAutomationStatus, MessageId> = {
	not_started: "sampling.automation.notStarted",
	running: "sampling.automation.running",
	needs_human: "sampling.automation.needsHuman",
	settled: "sampling.automation.settled",
};

export function SamplingBatchCard({
	batch,
	isActing,
	actionsDisabled,
	onClaim,
	onStartAutomation,
	onFinalizeNeedsHuman,
	onCancel,
}: {
	batch: SamplingBatchView;
	isActing: boolean;
	actionsDisabled: boolean;
	onClaim: (batch: SamplingBatchView, queue?: SamplingHumanQueue) => void;
	onStartAutomation: (batch: SamplingBatchView) => void;
	onFinalizeNeedsHuman: (batch: SamplingBatchView) => void;
	onCancel: (batch: SamplingBatchView) => void;
}) {
	const { t } = useI18n();
	const coverage = batch.coverage.overall;
	const executionMode = batch.executionMode ?? "manual";
	const isBrowserRunner = executionMode === "browser_runner";
	const canClaimManual =
		!isBrowserRunner && (batch.status === "frozen" || batch.status === "in_progress") && batch.claimableTaskCount > 0;
	const needsHumanCount = batch.needsHumanCount ?? 0;
	const preSubmitNeedsHumanCount = batch.needsHumanPreSubmitCount ?? 0;
	const postSubmitNeedsHumanCount = batch.needsHumanPostSubmitCount ?? 0;
	const finalizableNeedsHumanCount = batch.finalizableNeedsHumanCount ?? 0;
	const canClaimHuman = isBrowserRunner && batch.automationStatus === "needs_human" && preSubmitNeedsHumanCount > 0;
	const canFinalizeNeedsHuman =
		isBrowserRunner && batch.canFinalizeNeedsHuman === true && finalizableNeedsHumanCount > 0;
	const canStartAutomation =
		isBrowserRunner &&
		batch.browserRunnerEnabled === true &&
		batch.automationStatus === "not_started" &&
		(batch.status === "frozen" || batch.status === "in_progress");
	const canCancel =
		batch.canCancel === true ||
		(!isBrowserRunner && (batch.status === "draft" || batch.status === "frozen" || batch.status === "in_progress"));
	const automationProgress = batch.automationProgress;

	return (
		<Card className="gap-4 md:hidden">
			<CardHeader className="gap-2">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="truncate text-base">{batch.name}</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							{batch.scopeName}
							{batch.scopeTimezone ? ` · ${batch.scopeTimezone}` : ""}
						</p>
					</div>
					<SamplingStatusBadge status={batch.status} />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p className="text-xs text-muted-foreground">{t("sampling.batch.automatedProgress")}</p>
						<p className="font-semibold tabular-nums">
							{automationProgress
								? `${automationProgress.completed}/${automationProgress.total}`
								: t(
										(batch.executionMode ?? "manual") === "manual"
											? "sampling.automation.notAutomated"
											: batch.automationStatus
												? AUTOMATION_LABELS[batch.automationStatus]
												: "sampling.automation.notStarted",
									)}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">{t("sampling.batch.needsHuman")}</p>
						<p className="font-semibold tabular-nums">{needsHumanCount}</p>
					</div>
				</div>
				{postSubmitNeedsHumanCount > 0 && (
					<p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
						{t("sampling.batch.postSubmitWarning", { count: postSubmitNeedsHumanCount })}
					</p>
				)}
				<div className="space-y-1.5">
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>
							{t("sampling.batch.successCoverage", {
								succeeded: coverage.succeeded,
								total: coverage.total,
							})}
						</span>
						<span>{percentage(coverage.successCoverage)}%</span>
					</div>
					<Progress value={percentage(coverage.successCoverage)} />
				</div>
				<div className="flex items-center justify-between rounded-md bg-muted/40 p-3 text-xs">
					<span className="text-muted-foreground">{t("sampling.batch.resultState")}</span>
					<SamplingResultBadge executionMode={executionMode} resultStatus={batch.resultStatus} />
				</div>
				<div className="flex flex-wrap gap-2">
					{canStartAutomation && (
						<Button className="flex-1" onClick={() => onStartAutomation(batch)} disabled={actionsDisabled}>
							{isActing ? <Loader2 className="animate-spin" /> : <Bot />}
							{t("sampling.batch.action.start")}
						</Button>
					)}
					{canClaimHuman && (
						<Button className="flex-1" onClick={() => onClaim(batch, "needs_human")} disabled={actionsDisabled}>
							{isActing ? <Loader2 className="animate-spin" /> : <UserRoundCheck />}
							{t("sampling.batch.action.continuePreSubmit", { count: preSubmitNeedsHumanCount })}
						</Button>
					)}
					{canFinalizeNeedsHuman && (
						<Button
							variant="destructive"
							className="flex-1"
							onClick={() => onFinalizeNeedsHuman(batch)}
							disabled={actionsDisabled}
						>
							{isActing ? <Loader2 className="animate-spin" /> : <XCircle />}
							{t("sampling.batch.action.finalize", { count: finalizableNeedsHumanCount })}
						</Button>
					)}
					{canClaimManual && (
						<Button className="flex-1" onClick={() => onClaim(batch)} disabled={actionsDisabled}>
							{isActing ? <Loader2 className="animate-spin" /> : <Play />}
							{t("sampling.batch.action.claim")}
						</Button>
					)}
					{canCancel && (
						<Button
							variant="outline"
							onClick={() => onCancel(batch)}
							disabled={actionsDisabled}
							aria-label={t("sampling.batch.action.cancel")}
						>
							<XCircle />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
