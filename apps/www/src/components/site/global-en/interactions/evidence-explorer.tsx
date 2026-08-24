import { useState } from "react";
import { GraphicFrame } from "../graphic-frame";

type MetricId = "mention-rate" | "source-availability" | "comparison-inclusion";

const metrics = [
	{
		id: "mention-rate" as const,
		label: "Mention rate",
		numerator: "valid answers mentioning target",
		denominator: "all valid answers in scope",
		definition: "Share of eligible answer samples in the defined scope that mention the target brand.",
		boundary: "A changed scope or denominator creates a different measurement.",
	},
	{
		id: "source-availability" as const,
		label: "Source availability",
		numerator: "valid answers with exposed source evidence",
		denominator: "all valid answers in scope",
		definition: "Share of eligible samples where the configured surface exposes reviewable source evidence.",
		boundary: "Unavailable evidence stays unknown; it is not inferred from the answer text.",
	},
	{
		id: "comparison-inclusion" as const,
		label: "Comparison inclusion",
		numerator: "valid comparison answers including target",
		denominator: "all valid comparison answers in cohort",
		definition: "Share of eligible comparison answers where the target appears inside the declared alternative cohort.",
		boundary: "The result is cohort-bound and is never a universal ranking.",
	},
] as const;

export function EvidenceExplorer({ initialMetric = "mention-rate" }: { initialMetric?: MetricId }) {
	const [activeId, setActiveId] = useState<MetricId>(initialMetric);
	const active = metrics.find(({ id }) => id === activeId) ?? metrics[0];

	return (
		<GraphicFrame label="Interactive evidence definition explorer" type="evidence-explorer">
			<div className="global-en__explorer-tabs" role="tablist" aria-label="Choose an evidence definition">
				{metrics.map((metric) => (
					<button key={metric.id} type="button" role="tab" aria-selected={metric.id === activeId} onClick={() => setActiveId(metric.id)}>
						{metric.label}
					</button>
				))}
			</div>
			<article className="global-en__explorer-panel" role="tabpanel" data-metric={active.id}>
				<header><small>DEFINITION</small><p>{active.definition}</p></header>
				<div className="global-en__explorer-equation">
					<span>{active.numerator}</span><i>÷</i><span>{active.denominator}</span><b>= {active.label}</b>
				</div>
				<footer><small>BOUNDARY</small><p>{active.boundary}</p><strong>No observation loaded</strong></footer>
			</article>
		</GraphicFrame>
	);
}
