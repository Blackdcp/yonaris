import type { ProductClaim } from "@/content/site/product";
import { getProductContent } from "@/content/site/product";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { SiteShell } from "../site-shell";
import { EvidenceWorkbench } from "./evidence-workbench";

function claimStatusLabel(claim: ProductClaim, content: ReturnType<typeof getProductContent>): string {
	if (claim.status === "managed-delivery") return content.workbench.ui.managedDeliveryLabel;
	if (claim.status === "illustrative") return content.workbench.ui.illustrativeLabel;
	return content.workbench.ui.currentSoftwareLabel;
}

function ClaimList({
	claims,
	content,
}: {
	claims: readonly ProductClaim[];
	content: ReturnType<typeof getProductContent>;
}) {
	return (
		<ul className="product-claim-list">
			{claims.map((claim) => (
				<li key={claim.id} className="product-claim" data-claim-status={claim.status}>
					<p className="product-claim__status">{claimStatusLabel(claim, content)}</p>
					<p className="product-claim__text">{claim.text}</p>
					<p className="product-claim__limitation">{claim.limitation}</p>
				</li>
			))}
		</ul>
	);
}

export function ProductPage({ locale }: { locale: Locale }): React.ReactNode {
	const content = getProductContent(locale);
	const geoPath = getCorePath("geo", locale);
	const diagnosticPath = getCorePath("diagnostic", locale);

	return (
		<SiteShell locale={locale} activeKey="product" mainClassName="product-page">
			<section className="product-hero">
				<div className="product-hero__inner">
					<div className="product-hero__copy">
						<p className="product-kicker">{content.eyebrow}</p>
						<h1>{content.headline}</h1>
						<p className="product-hero__scope">
							{content.heroClaims.map((claim, index) => (
								<span key={claim.id} data-claim-status={claim.status}>
									{index > 0 ? content.heroClaimSeparator : null}
									{claim.text}
								</span>
							))}
						</p>
					</div>
					<ol className="product-hero__rail" aria-label={content.activitiesLabel}>
						{content.activities.map((activity, index) => (
							<li key={activity.id}>
								<span>{String(index + 1).padStart(2, "0")}</span>
								{activity.title}
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className="product-activities" aria-labelledby="product-activities-title">
				<div className="product-section-heading">
					<p className="product-kicker">{content.activitiesLabel}</p>
					<h2 id="product-activities-title">{content.activitiesTitle}</h2>
				</div>
				<ol className="product-activities__list">
					{content.activities.map((activity, index) => (
						<li key={activity.id}>
							<p className="product-activities__index">{String(index + 1).padStart(2, "0")}</p>
							<h3>{activity.title}</h3>
							<ClaimList claims={activity.claims} content={content} />
						</li>
					))}
				</ol>
			</section>

			<section className="product-workbench-stage" aria-label={content.workbench.title}>
				<EvidenceWorkbench content={content.workbench} />
			</section>

			<section className="product-boundary" aria-labelledby="product-boundary-title">
				<div className="product-section-heading">
					<p className="product-kicker">{content.boundaryLabel}</p>
					<h2 id="product-boundary-title">{content.workspaceBoundary.title}</h2>
				</div>
				<div className="product-boundary__grid">
					<article>
						<h3>{content.workspaceBoundary.customer.title}</h3>
						<ClaimList claims={content.workspaceBoundary.customer.claims} content={content} />
					</article>
					<article>
						<h3>{content.workspaceBoundary.yonaris.title}</h3>
						<ClaimList claims={content.workspaceBoundary.yonaris.claims} content={content} />
					</article>
				</div>
				<div className="product-coverage">
					<h3>{content.coverage.title}</h3>
					<ClaimList claims={content.coverage.claims} content={content} />
				</div>
			</section>

			<section className="product-next" aria-labelledby="product-next-title">
				<div>
					<p className="product-kicker">{content.contextLabel}</p>
					<h2 id="product-next-title">{content.contextLinks.title}</h2>
				</div>
				<div className="product-next__links">
					<a href={geoPath} aria-label={content.contextLinks.geoLabel}>
						{content.contextLinks.geoLabel}
					</a>
					<a href={diagnosticPath} aria-label={content.contextLinks.diagnosticLabel}>
						{content.contextLinks.diagnosticLabel}
					</a>
				</div>
			</section>
		</SiteShell>
	);
}
