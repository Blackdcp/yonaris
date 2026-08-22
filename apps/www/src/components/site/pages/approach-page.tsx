import { type ApproachClaim, getApproachContent } from "@/content/site/approach";
import type { Locale } from "@/content/site/types";
import { getCorePath } from "@/lib/site-manifest";
import { SiteShell } from "../site-shell";
import { EvidenceLoop } from "./evidence-loop";

function findClaim(claims: readonly ApproachClaim[], id: string): ApproachClaim {
	const claim = claims.find((candidate) => candidate.id === id);
	if (!claim) throw new Error(`Missing Approach claim: ${id}`);
	return claim;
}

export function ApproachPage({ locale }: { locale: Locale }): React.ReactNode {
	const content = getApproachContent(locale);
	const scopeClaim = findClaim(content.claims, content.currentScopeClaimIds[0]);
	const productPath = getCorePath("product", locale);
	const diagnosticPath = getCorePath("diagnostic", locale);

	return (
		<SiteShell locale={locale} activeKey="approach" mainClassName="approach-page">
			<section className="approach-hero">
				<div className="approach-hero__inner">
					<div className="approach-hero__copy">
						<p className="approach-kicker">{content.eyebrow}</p>
						<h1>{content.headline}</h1>
					</div>
					<aside className="approach-hero__scope" data-claim-status={scopeClaim.status}>
						<div className="approach-hero__scope-heading">
							<p>{content.labels.currentScope}</p>
							<span>
								{scopeClaim.status === "current-software"
									? content.labels.currentSoftware
									: content.labels.managedDelivery}
							</span>
						</div>
						<p className="approach-hero__scope-text">{content.currentScope}</p>
						<p className="approach-hero__scope-limit">
							<span>{content.labels.limitation}</span>
							{scopeClaim.limitation}
						</p>
					</aside>
					<div className="approach-hero__sequence" aria-hidden="true">
						<span>01</span>
						<i />
						<span>06</span>
					</div>
				</div>
			</section>

			<section className="approach-loop-stage" aria-labelledby="approach-loop-title">
				<div className="approach-loop__heading">
					<p className="approach-kicker">{content.loop.eyebrow}</p>
					<div>
						<h2 id="approach-loop-title">{content.loop.title}</h2>
						<p>{content.loop.description}</p>
					</div>
				</div>
				<EvidenceLoop content={content.loop} />
				<div className="approach-causality-note">
					<span aria-hidden="true">↳</span>
					<p>{content.nonCausalityNote}</p>
				</div>
			</section>

			<section className="approach-method" aria-labelledby="approach-method-title">
				<div className="approach-method__inner">
					<div className="approach-method__identity">
						<p className="approach-kicker">{content.method.eyebrow}</p>
						<p className="approach-method__name">{content.method.name}</p>
						<div className="approach-method__branches" aria-hidden="true">
							<span />
							<span />
							<span />
							<span />
						</div>
					</div>
					<div className="approach-method__copy">
						<h2 id="approach-method-title">{content.method.title}</h2>
						<p className="approach-method__summary">{content.method.summary}</p>
						<p className="approach-method__boundary">
							<span>{content.labels.limitation}</span>
							{content.method.boundary}
						</p>
					</div>
				</div>
			</section>

			<section className="approach-next" aria-labelledby="approach-next-title">
				<div>
					<p className="approach-kicker">{content.next.eyebrow}</p>
					<h2 id="approach-next-title">{content.next.title}</h2>
				</div>
				<div className="approach-next__links">
					<a href={productPath} className="marketing-paper-focus">
						{content.next.productLabel}
					</a>
					<a href={diagnosticPath} className="marketing-paper-focus">
						{content.next.diagnosticLabel}
					</a>
				</div>
			</section>
		</SiteShell>
	);
}
