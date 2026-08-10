import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Inbox, Loader2, Play, XCircle } from "lucide-react";
import { SamplingBatchCard } from "./sampling-batch-card";
import { SamplingStatusBadge } from "./sampling-status-badge";
import type { SamplingBatchView } from "./types";

function percentage(value: number | null): number {
	return value === null ? 0 : Math.round(value * 100);
}

function formatDate(value: string | Date): string {
	return new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function SamplingBatchList({
	batches,
	actingBatchId,
	onClaim,
	onCancel,
}: {
	batches: SamplingBatchView[];
	actingBatchId: string | null;
	onClaim: (batch: SamplingBatchView) => void;
	onCancel: (batch: SamplingBatchView) => void;
}) {
	if (batches.length === 0) {
		return (
			<Card>
				<CardContent className="flex min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
					<Inbox className="mb-3 size-10 opacity-50" />
					<p>No sampling batches match these filters.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<div className="space-y-3 md:hidden">
				{batches.map((batch) => (
					<SamplingBatchCard
						key={batch.id}
						batch={batch}
						isActing={actingBatchId === batch.id}
						actionsDisabled={actingBatchId !== null}
						onClaim={onClaim}
						onCancel={onCancel}
					/>
				))}
			</div>

			<Card className="hidden overflow-hidden py-0 md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Batch</TableHead>
							<TableHead>Scope</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="min-w-44">Progress</TableHead>
							<TableHead className="text-center">Claimable</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{batches.map((batch) => {
							const coverage = batch.coverage.overall;
							const isActing = actingBatchId === batch.id;
							const canClaim =
								(batch.status === "frozen" || batch.status === "in_progress") && batch.claimableTaskCount > 0;
							const canCancel = batch.status === "draft" || batch.status === "frozen" || batch.status === "in_progress";

							return (
								<TableRow key={batch.id}>
									<TableCell>
										<p className="max-w-60 truncate font-medium" title={batch.name}>
											{batch.name}
										</p>
										<p className="font-mono text-[10px] text-muted-foreground">{batch.id.slice(0, 8)}</p>
									</TableCell>
									<TableCell>{batch.scopeName}</TableCell>
									<TableCell>
										<SamplingStatusBadge status={batch.status} />
									</TableCell>
									<TableCell>
										<div className="space-y-1.5">
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>
													{coverage.resolved}/{coverage.total} resolved
												</span>
												<span>{percentage(coverage.completionCoverage)}%</span>
											</div>
											<Progress value={percentage(coverage.completionCoverage)} />
											<p className="text-[10px] text-muted-foreground">
												Scored {batch.coverage.byEvaluationRole.scored.resolved}/
												{batch.coverage.byEvaluationRole.scored.total} · Observation{" "}
												{batch.coverage.byEvaluationRole.observation.resolved}/
												{batch.coverage.byEvaluationRole.observation.total}
											</p>
										</div>
									</TableCell>
									<TableCell className="text-center font-medium tabular-nums">{batch.claimableTaskCount}</TableCell>
									<TableCell className="text-sm text-muted-foreground">{formatDate(batch.createdAt)}</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											<Button size="sm" onClick={() => onClaim(batch)} disabled={!canClaim || actingBatchId !== null}>
												{isActing ? <Loader2 className="animate-spin" /> : <Play />}
												Claim next
											</Button>
											{canCancel && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => onCancel(batch)}
													disabled={actingBatchId !== null}
													aria-label="Cancel batch"
												>
													<XCircle />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</Card>
		</>
	);
}
