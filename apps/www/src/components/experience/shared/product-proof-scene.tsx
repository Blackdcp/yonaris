"use client";

import { useState } from "react";
import { type ProductDemoView, productDemoFor } from "@/content/experience/product-demo";
import type { ExperienceLocale } from "@/content/experience/types";
import { useRovingTabs } from "./use-roving-tabs";

const VIEWS: readonly ProductDemoView[] = ["overview", "shareOfVoice", "opportunities", "queryFanOut"];

function TrendTrace({ label, path }: { label: string; path: string }) {
	return (
		<figure>
			<svg viewBox="0 0 120 32" aria-hidden="true" focusable="false">
				<path d={path} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
			</svg>
			<figcaption>{label}</figcaption>
		</figure>
	);
}

export function ProductProofScene({ locale, compact = false }: { locale: ExperienceLocale; compact?: boolean }) {
	const demo = productDemoFor(locale);
	const [activeView, setActiveView] = useState<ProductDemoView>("overview");
	const tabs = useRovingTabs({
		items: VIEWS,
		active: activeView,
		onChange: setActiveView,
		idPrefix: "product-proof",
	});
	const numberFormat = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US");

	return (
		<section
			className="site-06-product-proof-scene"
			data-scene-object="product-proof"
			data-compact={compact || undefined}
			aria-label={demo.labels.sampleWorkspace}
		>
			<header className="site-06-product-proof-scene__header">
				<p>{demo.labels.sampleWorkspace}</p>
				<p>{demo.labels.sampleData}</p>
				<p>{demo.labels.coverageBoundary}</p>
			</header>

			<div className="site-06-product-proof-scene__tabs" role="tablist" aria-label={demo.labels.sampleWorkspace}>
				{VIEWS.map((view, index) => (
					<button key={view} type="button" {...tabs.getTabProps(view, index)}>
						{demo.labels.tabs[view]}
					</button>
				))}
			</div>

			<div className="site-06-product-proof-scene__ledger">
				<section {...tabs.getPanelProps("overview")}>
					<h2>{demo.labels.tabs.overview}</h2>
					<dl>
						<div>
							<dt>{demo.labels.metricLabels.visibility}</dt>
							<dd>{demo.overview.visibility}%</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.share}</dt>
							<dd>{demo.overview.share}%</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.prompts}</dt>
							<dd>{demo.overview.prompts}</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.evaluations}</dt>
							<dd>{numberFormat.format(demo.overview.evaluations)}</dd>
						</div>
					</dl>
					<div>
						<TrendTrace
							label={demo.overview.trends.visibility}
							path="M2 25 L22 20 L42 22 L62 13 L82 16 L102 8 L118 10"
						/>
						<TrendTrace label={demo.overview.trends.share} path="M2 23 L22 24 L42 18 L62 20 L82 14 L102 15 L118 9" />
					</div>
					<p>{demo.overview.evaluationWindow}</p>
					<p>{demo.overview.frequencyNote}</p>
					<p>{demo.overview.lastUpdated}</p>
				</section>

				<section {...tabs.getPanelProps("shareOfVoice")}>
					<h2>{demo.shareOfVoice.title}</h2>
					<p>{demo.shareOfVoice.summary}</p>
					<p>
						{demo.labels.metricLabels.share}: {demo.overview.share}%
					</p>
					<ol>
						{demo.shareOfVoice.rows.map((row) => (
							<li key={row.brand}>{row.brand}</li>
						))}
					</ol>
				</section>

				<section {...tabs.getPanelProps("opportunities")}>
					<h2>{demo.opportunities.title}</h2>
					<p>{demo.opportunities.summary}</p>
					<ol>
						{demo.opportunities.rows.map((row) => (
							<li key={row.category}>
								<p>{row.category}</p>
								<h3>{row.title}</h3>
								<p>
									<strong>{demo.labels.illustrativeSignal}</strong> {row.signal}
								</p>
								<p>
									<strong>{demo.labels.reviewAction}</strong> {row.action}
								</p>
							</li>
						))}
					</ol>
				</section>

				<section {...tabs.getPanelProps("queryFanOut")}>
					<h2>{demo.queryFanOut.title}</h2>
					<p>{demo.queryFanOut.summary}</p>
					<p>{demo.labels.originalPrompt}</p>
					<blockquote>{demo.queryFanOut.prompt}</blockquote>
					<p>{demo.labels.rewrittenQuery}</p>
					<ol>
						{demo.queryFanOut.lines.map((line) => (
							<li key={line.query}>
								<code>{line.query}</code>
								<p>
									<strong>{line.relationship}</strong> {line.explanation}
								</p>
							</li>
						))}
					</ol>
				</section>
			</div>
		</section>
	);
}
