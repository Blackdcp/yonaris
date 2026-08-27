import { useId } from "react";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";

export type RawDetailLabelId = Extract<
	MessageId,
	| "admin.raw.errorDetails"
	| "admin.raw.executionDetails"
	| "sampling.raw.errorDetails"
	| "sampling.raw.executionDetails"
>;

type LocalizedRawDetailProps = {
	detail: string;
	labelId: RawDetailLabelId;
	variant?: "plain" | "destructive" | "log";
};

/** Audited boundary for visibly labelled, byte-identical raw diagnostic evidence. */
export function LocalizedRawDetail({ detail, labelId, variant = "plain" }: LocalizedRawDetailProps) {
	const { t } = useI18n();
	const labelElementId = useId();
	const detailClassName =
		variant === "log"
			? "max-h-80 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs"
			: variant === "destructive"
				? "whitespace-pre-wrap text-destructive"
				: "whitespace-pre-wrap";

	return (
		<section data-slot="localized-raw-detail" aria-labelledby={labelElementId}>
			<p id={labelElementId} data-slot="localized-raw-detail-label" className="text-sm font-medium">
				{t(labelId)}
			</p>
			<pre data-raw-detail="true" data-slot="localized-raw-detail-value" className={detailClassName}>
				{detail}
			</pre>
		</section>
	);
}
