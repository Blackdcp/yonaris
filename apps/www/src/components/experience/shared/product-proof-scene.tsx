"use client";

import { useState } from "react";
import { productDemoFor, type ProductDemoView } from "@/content/experience/product-demo";
import type { ExperienceLocale } from "@/content/experience/types";
import { useRovingTabs } from "./use-roving-tabs";

const VIEWS: readonly ProductDemoView[] = ["overview", "shareOfVoice", "opportunities", "queryFanOut"];

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
							<dd>{demo.overview.visibility}</dd>
						</div>
						<div>
							<dt>{demo.labels.metricLabels.share}</dt>
							<dd>{demo.overview.share}</dd>
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
					<p>{demo.overview.evaluationWindow}</p>
					<p>{demo.overview.frequencyNote}</p>
				</section>

				<section {...tabs.getPanelProps("shareOfVoice")}>
					<h2>{demo.shareOfVoice.title}</h2>
					<p>{demo.shareOfVoice.summary}</p>
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
							<li key={row.title}>
								<h3>{row.title}</h3>
								<p>{row.signal}</p>
								<p>{row.action}</p>
							</li>
						))}
					</ol>
				</section>

				<section {...tabs.getPanelProps("queryFanOut")}>
					<h2>{demo.queryFanOut.title}</h2>
					<p>{demo.queryFanOut.summary}</p>
					<blockquote>{demo.queryFanOut.prompt}</blockquote>
					<dl>
						{demo.queryFanOut.lines.map((line) => (
							<div key={line.surface}>
								<dt>{line.surface}</dt>
								<dd>
									<strong>{line.status}</strong> {line.answer}
								</dd>
							</div>
						))}
					</dl>
				</section>
			</div>
		</section>
	);
}
