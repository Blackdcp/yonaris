import type { DeepReadonly } from "@/content/site/types";
import type { GeoClaim, GeoContent } from "@/content/site/geo";

function findClaim(claims: readonly DeepReadonly<GeoClaim>[], id: string): DeepReadonly<GeoClaim> {
	const claim = claims.find((candidate) => candidate.id === id);
	if (!claim) throw new Error(`Missing GEO claim: ${id}`);
	return claim;
}

function claimStatusLabel(claim: DeepReadonly<GeoClaim>, ui: DeepReadonly<GeoContent["workflow"]["ui"]>): string {
	return claim.status === "current-software" ? ui.currentSoftwareLabel : ui.managedDeliveryLabel;
}

interface GeoAppliedWorkflowProps {
	claims: readonly DeepReadonly<GeoClaim>[];
	content: DeepReadonly<GeoContent["workflow"]>;
	evidenceBoundary: DeepReadonly<GeoContent["evidenceBoundary"]>;
}

export function GeoAppliedWorkflow({
	claims,
	content,
	evidenceBoundary,
}: GeoAppliedWorkflowProps): React.ReactNode {
	return (
		<section className="geo-applied-field" aria-labelledby="geo-workflow-title">
			<div className="geo-applied-field__inner">
				<header className="geo-workflow__heading">
					<p className="geo-kicker">{content.eyebrow}</p>
					<div>
						<h2 id="geo-workflow-title">{content.title}</h2>
						<p>{content.summary}</p>
					</div>
				</header>

				<div className="geo-workflow__column-headings" aria-hidden="true">
					<p>{content.ui.workflowLabel}</p>
					<p>{content.ui.observedSignalLabel}</p>
					<p>{content.ui.boundedActionLabel}</p>
					<p>{content.ui.capabilityContextLabel}</p>
				</div>

				<ol className="geo-workflow" aria-label={content.ui.workflowLabel}>
					{content.stages.map((stage, index) => {
						const stageClaims = stage.claimIds.map((id) => findClaim(claims, id));
						return (
							<li key={stage.id} data-geo-stage={stage.id}>
								<div className="geo-lane__question" data-geo-column="question">
									<p className="geo-lane__index">{String(index + 1).padStart(2, "0")}</p>
									<h3>{stage.title}</h3>
									<p>{stage.question}</p>
								</div>

								<div className="geo-lane__signal" data-geo-column="observed" data-geo-observed-signal>
									<p className="geo-workflow__label">{content.ui.observedSignalLabel}</p>
									<p>{stage.observedSignal}</p>
								</div>

								<div className="geo-lane__action" data-geo-column="action" data-geo-bounded-action>
									<p className="geo-workflow__label">{content.ui.boundedActionLabel}</p>
									<p>{stage.boundedAction}</p>
								</div>

								<div className="geo-lane__context" data-geo-column="context" data-geo-capability-context>
									<p className="geo-workflow__label">{content.ui.capabilityContextLabel}</p>
									{stageClaims.map((claim) => (
										<div className="geo-lane__claim" data-claim-status={claim.status} key={claim.id}>
											<p className="geo-lane__status">{claimStatusLabel(claim, content.ui)}</p>
											<p>{claim.text}</p>
											<p className="geo-lane__limitation" data-geo-limitation>
												<span>{content.ui.limitationLabel}</span>
												{claim.limitation}
											</p>
										</div>
									))}
								</div>
							</li>
						);
					})}
				</ol>

				<aside className="geo-evidence-boundary">
					<p className="geo-evidence-boundary__mark" aria-hidden="true">
						↳
					</p>
					<div>
						<h3>{evidenceBoundary.title}</h3>
						<p>{evidenceBoundary.summary}</p>
					</div>
				</aside>
			</div>
		</section>
	);
}
