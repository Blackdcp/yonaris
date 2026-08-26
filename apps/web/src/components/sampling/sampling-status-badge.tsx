import { Badge } from "@workspace/ui/components/badge";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { SamplingBatchStatus, SamplingExecutionMode, SamplingResultStatus, SamplingTaskStatus } from "./types";

const STATUS_LABELS: Record<SamplingBatchStatus | SamplingTaskStatus, MessageId> = {
	draft: "sampling.status.draft",
	frozen: "sampling.status.frozen",
	in_progress: "sampling.status.inProgress",
	completed: "sampling.status.completed",
	planned: "sampling.status.planned",
	available: "sampling.status.available",
	claimed: "sampling.status.claimed",
	succeeded: "sampling.status.succeeded",
	failed: "sampling.status.failed",
	cancelled: "sampling.status.cancelled",
};

export function SamplingStatusBadge({ status }: { status: SamplingBatchStatus | SamplingTaskStatus }) {
	const { t } = useI18n();
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
			{t(STATUS_LABELS[status])}
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
	const { t } = useI18n();
	if (executionMode === "manual") {
		return <span className="font-medium text-muted-foreground">{t("sampling.result.manual")}</span>;
	}
	if (!resultStatus) {
		return <span className="font-medium text-muted-foreground">{t("sampling.result.notFinalized")}</span>;
	}

	return (
		<Badge variant={resultStatus === "final" ? "default" : resultStatus === "incomplete" ? "destructive" : "secondary"}>
			{t(
				resultStatus === "final"
					? "sampling.result.final"
					: resultStatus === "incomplete"
						? "sampling.result.incomplete"
						: "sampling.result.provisional",
			)}
		</Badge>
	);
}
