import type { DeepReadonly } from "@/content/site/types";
import type { MetricDefinition, ResearchContent } from "@/content/site/research";

interface MetricMethodCardProps {
	index: number;
	labels: DeepReadonly<ResearchContent["labels"]>;
	metric: DeepReadonly<MetricDefinition>;
}

export function MetricMethodCard({ index, labels, metric }: MetricMethodCardProps): React.ReactNode {
	return (
		<article className="metric-method-card" data-metric-id={metric.id}>
			<header className="metric-method-card__header">
				<span aria-hidden="true">{String(index).padStart(2, "0")}</span>
				<h3>{metric.label}</h3>
			</header>
			<dl>
				<div className="metric-method-card__definition">
					<dt>{labels.definition}</dt>
					<dd>{metric.definition}</dd>
				</div>
				<div>
					<dt>{labels.numerator}</dt>
					<dd>{metric.numerator}</dd>
				</div>
				<div>
					<dt>{labels.denominator}</dt>
					<dd>{metric.denominator}</dd>
				</div>
				<div className="metric-method-card__limitation">
					<dt>{labels.limitation}</dt>
					<dd>{metric.limitation}</dd>
				</div>
			</dl>
		</article>
	);
}
