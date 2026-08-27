"use client";

import { useState } from "react";
import { useRovingTabs } from "./use-roving-tabs";

export interface ComparisonStageRecord {
	readonly id: string;
	readonly label: string;
	readonly answer: string;
	readonly evidence: string;
	readonly judgment: string;
	readonly nextAction: string;
}

export function ComparisonStage({
	heading,
	description,
	question,
	records,
	initialId,
}: {
	heading: string;
	description?: string;
	question: string;
	records: readonly ComparisonStageRecord[];
	initialId: string;
}) {
	const recordIds = records.map((record) => record.id);
	const fallbackId = records.some((record) => record.id === initialId) ? initialId : (recordIds[0] ?? initialId);
	const [activeId, setActiveId] = useState(fallbackId);
	const tabs = useRovingTabs({
		items: recordIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "site-06-comparison",
	});

	if (records.length === 0) return null;

	return (
		<section className="site-06-comparison-stage" data-scene-object="comparison-stage">
			<header className="site-06-comparison-stage__controls">
				<h2>{heading}</h2>
				{description ? <p>{description}</p> : null}
				<div className="site-06-comparison-stage__tabs" role="tablist" aria-label="Compare evidence states">
					{records.map((record, index) => (
						<button key={record.id} type="button" {...tabs.getTabProps(record.id, index)}>
							{record.label}
						</button>
					))}
				</div>
			</header>
			<div className="site-06-comparison-stage__record">
				<p className="site-06-comparison-stage__question-label">Question held constant</p>
				<blockquote>{question}</blockquote>
				{records.map((record) => (
					<article key={record.id} {...tabs.getPanelProps(record.id)}>
						<p className="site-06-comparison-stage__answer">{record.answer}</p>
						<dl>
							<div>
								<dt>Evidence</dt>
								<dd>{record.evidence}</dd>
							</div>
							<div>
								<dt>Judgment</dt>
								<dd>{record.judgment}</dd>
							</div>
							<div>
								<dt>Next action</dt>
								<dd>{record.nextAction}</dd>
							</div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}
