import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Bot, Inbox, Loader2, Play, UserRoundCheck, XCircle } from "lucide-react";
import { SamplingBatchCard } from "./sampling-batch-card";
import { SamplingResultBadge, SamplingStatusBadge } from "./sampling-status-badge";
import type { SamplingBatchView, SamplingHumanQueue } from "./types";

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

function formatAutomationStatus(batch: SamplingBatchView): string {
	if ((batch.executionMode ?? "manual") === "manual") return "Not automated";
	if (!batch.automationStatus) return "Not started";
	return batch.automationStatus.replaceAll("_", " ");
}

export function SamplingBatchList({
	batches,
	actingBatchId,
	onClaim,
	onStartAutomation,
	onFinalizeNeedsHuman,
	onCancel,
}: {
	batches: SamplingBatchView[];
	actingBatchId: string | null;
	onClaim: (batch: SamplingBatchView, queue?: SamplingHumanQueue) => void;
	onStartAutomation: (batch: SamplingBatchView) => void;
	onFinalizeNeedsHuman: (batch: SamplingBatchView) => void;
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
						onStartAutomation={onStartAutomation}
						onFinalizeNeedsHuman={onFinalizeNeedsHuman}
						onCancel={onCancel}
					/>
				))}
			</div>

			<Card className="hidden overflow-hidden py-0 md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Batch</TableHead>
							<TableHead>Program</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="min-w-44">Automation</TableHead>
							<TableHead className="min-w-44">Success coverage</TableHead>
							<TableHead className="text-center">Needs human</TableHead>
							<TableHead>Result</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{batches.map((batch) => {
							const coverage = batch.coverage.overall;
							const isActing = actingBatchId === batch.id;
							const executionMode = batch.executionMode ?? "manual";
							const isBrowserRunner = executionMode === "browser_runner";
							const canClaimManual =
								!isBrowserRunner &&
								(batch.status === "frozen" || batch.status === "in_progress") &&
								batch.claimableTaskCount > 0;
							const needsHumanCount = batch.needsHumanCount ?? 0;
							const preSubmitNeedsHumanCount = batch.needsHumanPreSubmitCount ?? 0;
							const postSubmitNeedsHumanCount = batch.needsHumanPostSubmitCount ?? 0;
							const finalizableNeedsHumanCount = batch.finalizableNeedsHumanCount ?? 0;
							const canClaimHuman =
								isBrowserRunner && batch.automationStatus === "needs_human" && preSubmitNeedsHumanCount > 0;
							const canFinalizeNeedsHuman =
								isBrowserRunner && batch.canFinalizeNeedsHuman === true && finalizableNeedsHumanCount > 0;
							const canStartAutomation =
								isBrowserRunner &&
								batch.browserRunnerEnabled === true &&
								batch.automationStatus === "not_started" &&
								(batch.status === "frozen" || batch.status === "in_progress");
							const canCancel =
								batch.canCancel === true ||
								(!isBrowserRunner &&
									(batch.status === "draft" || batch.status === "frozen" || batch.status === "in_progress"));
							const automationProgress = batch.automationProgress;

							return (
								<TableRow key={batch.id} className={needsHumanCount > 0 ? "bg-amber-50/40" : undefined}>
									<TableCell>
										<p className="max-w-60 truncate font-medium" title={batch.name}>
											{batch.name}
										</p>
										<p className="font-mono text-[10px] text-muted-foreground">{batch.id.slice(0, 8)}</p>
									</TableCell>
									<TableCell>
										<p>{batch.scopeName}</p>
										{batch.scopeTimezone && (
											<p className="text-xs text-muted-foreground">
												{batch.scopeMarket}/{batch.scopeLocale} · {batch.scopeTimezone}
											</p>
										)}
									</TableCell>
									<TableCell>
										<SamplingStatusBadge status={batch.status} />
									</TableCell>
									<TableCell>
										<div className="space-y-1.5">
											<div className="flex justify-between gap-2 text-xs">
												<span className="capitalize text-muted-foreground">{formatAutomationStatus(batch)}</span>
												{automationProgress && (
													<span className="tabular-nums">
														{automationProgress.completed}/{automationProgress.total}
													</span>
												)}
											</div>
											{automationProgress && (
												<Progress
													value={
														automationProgress.total === 0
															? 0
															: Math.round((automationProgress.completed / automationProgress.total) * 100)
													}
												/>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1.5">
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>
													{coverage.succeeded}/{coverage.total}
												</span>
												<span>{percentage(coverage.successCoverage)}%</span>
											</div>
											<Progress value={percentage(coverage.successCoverage)} />
										</div>
									</TableCell>
									<TableCell className="text-center">
										<div className="space-y-1">
											<Badge variant={needsHumanCount > 0 ? "secondary" : "outline"} className="tabular-nums">
												{needsHumanCount}
											</Badge>
											{postSubmitNeedsHumanCount > 0 && (
												<p className="text-[10px] text-amber-700">{postSubmitNeedsHumanCount} same-session</p>
											)}
										</div>
									</TableCell>
									<TableCell>
										<SamplingResultBadge executionMode={executionMode} resultStatus={batch.resultStatus} />
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">{formatDate(batch.createdAt)}</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											{canStartAutomation && (
												<Button size="sm" onClick={() => onStartAutomation(batch)} disabled={actingBatchId !== null}>
													{isActing ? <Loader2 className="animate-spin" /> : <Bot />}
													Start automated run
												</Button>
											)}
											{canClaimHuman && (
												<Button
													size="sm"
													onClick={() => onClaim(batch, "needs_human")}
													disabled={actingBatchId !== null}
												>
													{isActing ? <Loader2 className="animate-spin" /> : <UserRoundCheck />}
													Continue human task
												</Button>
											)}
											{canFinalizeNeedsHuman && (
												<Button
													variant="destructive"
													size="sm"
													onClick={() => onFinalizeNeedsHuman(batch)}
													disabled={actingBatchId !== null}
												>
													{isActing ? <Loader2 className="animate-spin" /> : <XCircle />}
													Finalize incomplete ({finalizableNeedsHumanCount})
												</Button>
											)}
											{canClaimManual && (
												<Button size="sm" onClick={() => onClaim(batch)} disabled={actingBatchId !== null}>
													{isActing ? <Loader2 className="animate-spin" /> : <Play />}
													Claim next
												</Button>
											)}
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
