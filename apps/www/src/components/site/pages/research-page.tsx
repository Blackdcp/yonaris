import { getResearchContent } from "@/content/site/research";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { SiteShell } from "../site-shell";
import { MetricMethodCard } from "./metric-method-card";
import { ResearchLedger } from "./research-ledger";

export function ResearchPage({ locale }: { locale: Locale }): React.ReactNode {
	const content = getResearchContent(locale);
	const approachPath = getCorePath("approach", locale);
	const diagnosticPath = getCorePath("diagnostic", locale);

	return (
		<SiteShell locale={locale} activeKey="research" mainClassName="research-page">
			<section className="research-hero">
				<div className="research-hero__inner">
					<div className="research-hero__copy">
						<p className="research-kicker">{content.eyebrow}</p>
						<h1>{content.headline}</h1>
						<p className="research-hero__dek">{content.dek}</p>
					</div>
					<aside className="research-hero__scope">
						<p className="research-hero__scope-index" aria-hidden="true">
							R / 01
						</p>
						<p className="research-hero__scope-label">{content.labels.scope}</p>
						<p>{content.currentScope}</p>
					</aside>
				</div>
			</section>

			<section className="research-measurement" aria-labelledby="research-measurement-title">
				<div className="research-measurement__inner">
					<div className="research-measurement__copy">
						<p className="research-kicker">{content.measurement.eyebrow}</p>
						<h2 id="research-measurement-title">{content.measurement.title}</h2>
						<p>{content.measurement.summary}</p>
					</div>
					<div className="research-measurement__scope">
						<p>{content.measurement.scopeLabel}</p>
						<ol>
							{content.measurement.scopeItems.map((item, index) => (
								<li key={item.id}>
									<span>{String(index + 1).padStart(2, "0")}</span>
									{item.text}
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			<section className="research-metrics" aria-labelledby="research-metrics-title">
				<div className="research-section-heading">
					<p className="research-kicker">{content.metricsEyebrow}</p>
					<h2 id="research-metrics-title">{content.metricsTitle}</h2>
				</div>
				<div className="research-metrics__grid">
					{content.metrics.map((metric, index) => (
						<MetricMethodCard key={metric.id} metric={metric} labels={content.labels} index={index + 1} />
					))}
				</div>
			</section>

			<section className="research-record-stage" aria-label={content.record.title}>
				<div className="research-record-stage__heading">
					<p className="research-kicker">{content.recordEyebrow}</p>
					<p>{content.record.scope}</p>
				</div>
				<ResearchLedger labels={content.labels} record={content.record} />
			</section>

			<section className="research-comparison" aria-labelledby="research-comparison-title">
				<div className="research-comparison__inner">
					<p className="research-kicker">{content.comparison.eyebrow}</p>
					<div className="research-comparison__copy">
						<h2 id="research-comparison-title">{content.comparison.title}</h2>
						<p>{content.comparison.guidance}</p>
					</div>
					<aside>
						<span aria-hidden="true">↳</span>
						<p>{content.nonCausalityNote}</p>
					</aside>
				</div>
			</section>

			<section className="research-next" aria-labelledby="research-next-title">
				<div>
					<p className="research-kicker">{content.next.eyebrow}</p>
					<h2 id="research-next-title">{content.next.title}</h2>
				</div>
				<div className="research-next__links">
					<a href={approachPath} className="marketing-paper-focus">
						{content.next.approachLabel}
					</a>
					<a href={diagnosticPath} className="marketing-paper-focus">
						{content.next.diagnosticLabel}
					</a>
				</div>
			</section>
		</SiteShell>
	);
}
