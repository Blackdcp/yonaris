import { Badge } from "@workspace/ui/components/badge";
import type { SamplingBatchStatus, SamplingExecutionMode, SamplingResultStatus, SamplingTaskStatus } from "./types";

const STATUS_LABELS: Record<SamplingBatchStatus | SamplingTaskStatus, string> = {
	draft: "Draft",
	frozen: "Ready",
	in_progress: "In progress",
	completed: "Completed",
	planned: "Planned",
	available: "Available",
	claimed: "Claimed",
	succeeded: "Succeeded",
	failed: "Failed",
	cancelled: "Cancelled",
};

export function SamplingStatusBadge({ status }: { status: SamplingBatchStatus | SamplingTaskStatus }) {
	const variant =
		status === "failed" || status === "cancelled"
			? "destructive"
			: status === "succeeded" || status === "completed"
				? "default"
				: "secondary";
	return (
		<Badge
			variant={variant}
			className={status === "claimed" || status === "in_progress" ? "bg-amber-100 text-amber-800" : undefined}
		>
			{STATUS_LABELS[status]}
		</Badge>
	);
}

export function SamplingResultBadge({
	executionMode,
	resultStatus,
}: {
	executionMode: SamplingExecutionMode;
	resultStatus?: SamplingResultStatus;
}) {
	if (executionMode === "manual") return <span className="font-medium text-muted-foreground">Manual</span>;
	if (!resultStatus) return <span className="font-medium text-muted-foreground">Not finalized</span>;

	return (
		<Badge variant={resultStatus === "final" ? "default" : resultStatus === "incomplete" ? "destructive" : "secondary"}>
			{resultStatus === "final" ? "Final" : resultStatus === "incomplete" ? "Incomplete" : "Provisional"}
		</Badge>
	);
}
