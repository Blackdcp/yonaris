import { getGeoContent } from "@/content/site/geo";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { SiteShell } from "../site-shell";
import { GeoAppliedWorkflow } from "./geo-applied-workflow";

function renderHeadline(headline: string, locale: Locale): React.ReactNode {
	if (locale !== "zh" || !headline.endsWith("证据之上")) return headline;
	return (
		<>
			{headline.slice(0, -4)}
			<span className="geo-semantic-unit">证据之上</span>
		</>
	);
}

export function GeoPage({ locale }: { locale: Locale }): React.ReactNode {
	const content = getGeoContent(locale);
	const productPath = getCorePath("product", locale);
	const companyPath = getCorePath("company", locale);
	const diagnosticPath = getCorePath("diagnostic", locale);

	return (
		<SiteShell locale={locale} activeKey="geo" mainClassName="geo-page">
			<section className="geo-hero">
				<div className="geo-hero__inner">
					<div className="geo-hero__copy">
						<p className="geo-kicker">{content.eyebrow}</p>
						<h1 aria-label={content.headline}>
							{renderHeadline(content.headline, locale)}
						</h1>
						<p className="geo-hero__dek">{content.dek}</p>
					</div>
					<aside className="geo-hero__boundary">
						<p className="geo-hero__category">{content.category}</p>
						<h2>{content.boundary.title}</h2>
						<p>{content.boundary.summary}</p>
						<p className="geo-hero__scope">{content.currentScope}</p>
					</aside>
				</div>
			</section>

			<GeoAppliedWorkflow
				claims={content.claims}
				content={content.workflow}
				evidenceBoundary={content.evidenceBoundary}
			/>

			<section className="geo-beyond" aria-labelledby="geo-beyond-title">
				<div className="geo-beyond__inner">
					<p className="geo-kicker">{content.broaderCategory.eyebrow}</p>
					<div className="geo-beyond__copy">
						<h2 id="geo-beyond-title">{content.broaderCategory.title}</h2>
						<p>{content.broaderCategory.summary}</p>
						<div className="geo-beyond__links">
							<a className="geo-context-link marketing-paper-focus" href={productPath}>
								<span>{content.broaderCategory.productLabel}</span>
								<span aria-hidden="true">↗</span>
							</a>
							<a className="geo-context-link marketing-paper-focus" href={companyPath}>
								<span>{content.broaderCategory.companyLabel}</span>
								<span aria-hidden="true">↗</span>
							</a>
						</div>
					</div>
				</div>
			</section>

			<section className="geo-diagnostic" aria-labelledby="geo-diagnostic-title">
				<div className="geo-diagnostic__inner">
					<p className="geo-kicker">{content.diagnostic.eyebrow}</p>
					<div className="geo-diagnostic__copy">
						<h2 id="geo-diagnostic-title">{content.diagnostic.title}</h2>
						<p>{content.diagnostic.summary}</p>
					</div>
					<div className="geo-diagnostic__action">
						<a className="geo-context-link marketing-paper-focus" href={diagnosticPath}>
							<span>{content.diagnostic.label}</span>
							<span aria-hidden="true">→</span>
						</a>
						<p>{content.diagnostic.disclosure}</p>
					</div>
				</div>
			</section>
		</SiteShell>
	);
}
