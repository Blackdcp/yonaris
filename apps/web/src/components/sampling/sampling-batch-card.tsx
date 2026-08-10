import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { Loader2, Play, XCircle } from "lucide-react";
import { SamplingStatusBadge } from "./sampling-status-badge";
import type { SamplingBatchView } from "./types";

function percentage(value: number | null): number {
	return value === null ? 0 : Math.round(value * 100);
}

export function SamplingBatchCard({
	batch,
	isActing,
	actionsDisabled,
	onClaim,
	onCancel,
}: {
	batch: SamplingBatchView;
	isActing: boolean;
	actionsDisabled: boolean;
	onClaim: (batch: SamplingBatchView) => void;
	onCancel: (batch: SamplingBatchView) => void;
}) {
	const coverage = batch.coverage.overall;
	const canClaim = (batch.status === "frozen" || batch.status === "in_progress") && batch.claimableTaskCount > 0;
	const canCancel = batch.status === "draft" || batch.status === "frozen" || batch.status === "in_progress";

	return (
		<Card className="gap-4 md:hidden">
			<CardHeader className="gap-2">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<CardTitle className="truncate text-base">{batch.name}</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">{batch.scopeName}</p>
					</div>
					<SamplingStatusBadge status={batch.status} />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-3 gap-3 text-sm">
					<div>
						<p className="text-xs text-muted-foreground">Claimable</p>
						<p className="font-semibold tabular-nums">{batch.claimableTaskCount}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Succeeded</p>
						<p className="font-semibold tabular-nums">{coverage.succeeded}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Failed</p>
						<p className="font-semibold tabular-nums">{coverage.failed}</p>
					</div>
				</div>
				<div className="space-y-1.5">
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>Resolved</span>
						<span>{percentage(coverage.completionCoverage)}%</span>
					</div>
					<Progress value={percentage(coverage.completionCoverage)} />
				</div>
				<div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-xs">
					<div>
						<p className="text-muted-foreground">Scored pool</p>
						<p className="font-medium tabular-nums">
							{batch.coverage.byEvaluationRole.scored.resolved}/{batch.coverage.byEvaluationRole.scored.total} resolved
						</p>
					</div>
					<div>
						<p className="text-muted-foreground">Observation pool</p>
						<p className="font-medium tabular-nums">
							{batch.coverage.byEvaluationRole.observation.resolved}/{batch.coverage.byEvaluationRole.observation.total}{" "}
							resolved
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<Button className="flex-1" onClick={() => onClaim(batch)} disabled={!canClaim || actionsDisabled}>
						{isActing ? <Loader2 className="animate-spin" /> : <Play />}
						Claim next
					</Button>
					{canCancel && (
						<Button
							variant="outline"
							onClick={() => onCancel(batch)}
							disabled={actionsDisabled}
							aria-label="Cancel batch"
						>
							<XCircle />
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
