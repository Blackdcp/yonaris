import type { ReactNode } from "react";
import { useState } from "react";
import { useRovingTabs } from "./use-roving-tabs";

export interface EvidenceRecord {
	readonly id: string;
	readonly label: string;
	readonly answer: ReactNode;
	readonly source: string;
	readonly boundary: string;
	readonly effect: string;
}

export function EvidenceInspector({ records, initialId }: { records: readonly EvidenceRecord[]; initialId: string }) {
	const recordIds = records.map((record) => record.id);
	const fallbackId = records.some((record) => record.id === initialId) ? initialId : (recordIds[0] ?? initialId);
	const [activeId, setActiveId] = useState(fallbackId);
	const tabs = useRovingTabs({ items: recordIds, active: activeId, onChange: setActiveId, idPrefix: "evidence" });

	if (records.length === 0) return null;

	return (
		<section className="site-06-inspector" aria-label="Inspect an observed answer">
			<div className="site-06-inspector__answer" role="tablist" aria-label="Choose a phrase to inspect">
				{records.map((record, index) => (
					<button key={record.id} type="button" {...tabs.getTabProps(record.id, index)}>
						{record.label}
					</button>
				))}
			</div>
			<div className="site-06-inspector__records" aria-live="polite">
				{records.map((record) => (
					<article key={record.id} className="site-06-evidence-document" {...tabs.getPanelProps(record.id)}>
						<div className="site-06-evidence-document__answer">{record.answer}</div>
						<dl>
							<div>
								<dt>Source</dt>
								<dd>{record.source}</dd>
							</div>
							<div>
								<dt>Boundary</dt>
								<dd>{record.boundary}</dd>
							</div>
							<div>
								<dt>Buying effect</dt>
								<dd>{record.effect}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}
