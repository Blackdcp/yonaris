import {
	CATEGORY_LABELS,
	type Competitor,
	ELMO_FEATURES,
	FEATURE_CATEGORIES,
	type FeatureKey,
} from "@/lib/competitors";

function Mark({ value }: { value: boolean }): React.ReactNode {
	return (
		<span>
			<span aria-hidden="true">{value ? "Yes" : "—"}</span>
			<span className="sr-only">{value ? "Recorded as available" : "Not recorded as available"}</span>
		</span>
	);
}

function recordedPricing(pricing: Competitor["pricing"]): string {
	if (!pricing) return "Pricing not recorded";
	const facts = [
		pricing.hasFree ? "Free tier" : null,
		pricing.startingPrice ? `From ${pricing.startingPrice}` : null,
		pricing.hasEnterprise ? "Enterprise pricing recorded" : null,
	].filter((fact): fact is string => Boolean(fact));
	return facts.length > 0 ? facts.join(" / ") : "Pricing details not recorded";
}

function SupplierSummary({ competitor, index }: { competitor: Competitor; index: number }): React.ReactNode {
	return (
		<li className="legacy-archive-ledger__row">
			<span className="legacy-archive-index">{String(index).padStart(2, "0")}</span>
			<div>
				<h3>{competitor.name}</h3>
				<p>{competitor.tagline}</p>
				<p className="legacy-archive-meta">{CATEGORY_LABELS[competitor.category]}</p>
				<p className="legacy-archive-meta" data-recorded-pricing>
					{recordedPricing(competitor.pricing)}
				</p>
				<a className="legacy-archive-link" href={competitor.url} target="_blank" rel="noopener noreferrer nofollow">
					Visit {competitor.domain} ↗
				</a>
			</div>
			<span className="legacy-archive-ledger__arrow" aria-hidden="true">
				—
			</span>
		</li>
	);
}

export function PairComparison({ a, b }: { a: Competitor; b: Competitor }) {
	const heading = `${a.name} vs ${b.name} vs Elmo`;
	return (
		<>
			<section className="legacy-archive-section" aria-labelledby="pair-summary-title">
				<p className="legacy-archive-kicker">Recorded supplier notes</p>
				<h2 className="legacy-archive-section__heading" id="pair-summary-title">
					{heading}
				</h2>
				<ul className="legacy-archive-ledger">
					<SupplierSummary competitor={a} index={1} />
					<SupplierSummary competitor={b} index={2} />
					<li className="legacy-archive-ledger__row">
						<span className="legacy-archive-index">03</span>
						<div>
							<h3>Elmo</h3>
							<p>The open-source reference recorded by the upstream archive.</p>
							<p className="legacy-archive-meta">Upstream project</p>
						</div>
						<span className="legacy-archive-ledger__arrow" aria-hidden="true">
							—
						</span>
					</li>
				</ul>
			</section>
			<section className="legacy-archive-section" aria-labelledby="pair-table-title">
				<h2 className="legacy-archive-section__heading" id="pair-table-title">
					Archived feature matrix
				</h2>
				<section
					className="legacy-archive-scroller"
					data-comparison-scroller="true"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to reach and scroll the overflow region.
					tabIndex={0}
					aria-label={`Archived feature comparison: ${heading}`}
				>
					<table className="legacy-archive-table">
						<thead>
							<tr>
								<th>Feature</th>
								<th>{a.name}</th>
								<th>{b.name}</th>
								<th>Elmo</th>
							</tr>
						</thead>
						<tbody>
							{Object.entries(FEATURE_CATEGORIES).flatMap(([categoryKey, category]) => [
								<tr key={`category-${categoryKey}`}>
									<th colSpan={4}>{category.label}</th>
								</tr>,
								...Object.entries(category.features).map(([featureKey, definition]) => {
									const key = featureKey as FeatureKey;
									return (
										<tr data-comparison-row key={featureKey}>
											<th scope="row">{definition.label}</th>
											<td>
												<Mark value={a.features[key] ?? false} />
											</td>
											<td>
												<Mark value={b.features[key] ?? false} />
											</td>
											<td>
												<Mark value={ELMO_FEATURES[key] ?? false} />
											</td>
										</tr>
									);
								}),
							])}
						</tbody>
					</table>
				</section>
			</section>
		</>
	);
}
