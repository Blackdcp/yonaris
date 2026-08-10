import { Badge } from "@workspace/ui/components/badge";
import type { SamplingBatchStatus, SamplingTaskStatus } from "./types";

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
