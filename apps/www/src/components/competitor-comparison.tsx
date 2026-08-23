import { DirectoryBackLink, DirectoryHero, DirectorySection } from "@/components/directory-shell";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import {
	CATEGORY_LABELS,
	type Competitor,
	ELMO_FEATURES,
	FEATURE_CATEGORIES,
	type FeatureKey,
	getComparisonFaqs,
	getComparisonVerdict,
	getPopularityGrade,
	isLowDR,
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

export function CompetitorComparison({ competitor }: { competitor: Competitor }) {
	const elmoOnly: string[] = [];
	const competitorOnly: string[] = [];
	const shared: string[] = [];
	for (const category of Object.values(FEATURE_CATEGORIES)) {
		for (const featureKey of Object.keys(category.features)) {
			const key = featureKey as FeatureKey;
			const elmoHas = ELMO_FEATURES[key] ?? false;
			const competitorHas = competitor.features[key] ?? false;
			if (elmoHas && !competitorHas) elmoOnly.push(category.features[key].label);
			if (!elmoHas && competitorHas) competitorOnly.push(category.features[key].label);
			if (elmoHas && competitorHas) shared.push(category.features[key].label);
		}
	}
	const heading = `Elmo and ${competitor.name}`;
	return (
		<>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow={`${CATEGORY_LABELS[competitor.category]} / single record`}
				title={heading}
				lead={getComparisonVerdict(competitor)}
			/>
			{competitor.status === "shutting-down" || isLowDR(competitor) ? (
				<section className="legacy-archive-section" aria-labelledby="archive-caveat">
					<p className="legacy-archive-kicker">Source caveat</p>
					<h2 className="legacy-archive-section__heading" id="archive-caveat">
						Limited or changed market presence
					</h2>
					<p className="legacy-archive-copy">
						The source archive marked this supplier as early-stage, low-presence, or changing status. Verify the current
						product directly.
					</p>
				</section>
			) : null}
			<DirectorySection title="Recorded supplier profiles">
				<ul className="legacy-archive-ledger">
					<li className="legacy-archive-ledger__row">
						<span className="legacy-archive-index">01</span>
						<div>
							<h3>Elmo</h3>
							<p>Open-source reference described by the upstream project.</p>
							<p className="legacy-archive-meta">Historical upstream positioning</p>
						</div>
						<span className="legacy-archive-ledger__arrow" aria-hidden="true">
							—
						</span>
					</li>
					<li className="legacy-archive-ledger__row">
						<span className="legacy-archive-index">02</span>
						<div>
							<h3>{competitor.name}</h3>
							<p>{competitor.tagline}</p>
							<p className="legacy-archive-meta">
								{CATEGORY_LABELS[competitor.category]} / popularity {getPopularityGrade(competitor)}
							</p>
							<p className="legacy-archive-meta" data-recorded-pricing>
								{recordedPricing(competitor.pricing)}
							</p>
						</div>
						<span className="legacy-archive-ledger__arrow" aria-hidden="true">
							—
						</span>
					</li>
				</ul>
			</DirectorySection>
			<DirectorySection title={`About ${competitor.name}`}>
				<div className="legacy-archive-copy">
					<p>{competitor.description}</p>
					{competitor.highlights?.length ? (
						<ul>
							{competitor.highlights.map((highlight) => (
								<li key={highlight}>{highlight}</li>
							))}
						</ul>
					) : null}
					<a className="legacy-archive-link" href={competitor.url} target="_blank" rel="noopener noreferrer nofollow">
						Visit recorded source ↗
					</a>
					<p className="legacy-archive-meta">
						Remote supplier imagery is not reproduced in this archive. Use the recorded source link for current visuals.
					</p>
				</div>
			</DirectorySection>
			<DirectorySection title="Archived feature matrix">
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
								<th>Elmo</th>
								<th>{competitor.name}</th>
							</tr>
						</thead>
						<tbody>
							{Object.entries(FEATURE_CATEGORIES).flatMap(([categoryKey, category]) => [
								<tr key={`category-${categoryKey}`}>
									<th colSpan={3}>{category.label}</th>
								</tr>,
								...Object.entries(category.features).map(([featureKey, definition]) => {
									const key = featureKey as FeatureKey;
									return (
										<tr data-comparison-row key={featureKey}>
											<th scope="row">{definition.label}</th>
											<td>
												<Mark value={ELMO_FEATURES[key] ?? false} />
											</td>
											<td>
												<Mark value={competitor.features[key] ?? false} />
											</td>
										</tr>
									);
								}),
							])}
						</tbody>
					</table>
				</section>
			</DirectorySection>
			<DirectorySection title="Recorded differences">
				<ul className="legacy-archive-ledger">
					{[
						{ title: "Recorded only for Elmo", values: elmoOnly },
						{ title: "Recorded for both", values: shared },
						{ title: `Recorded only for ${competitor.name}`, values: competitorOnly },
					].map((group, index) => (
						<li className="legacy-archive-ledger__row" key={group.title}>
							<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
							<div>
								<h3>{group.title}</h3>
								<p>{group.values.length ? group.values.join(" / ") : "No unique fields were recorded."}</p>
							</div>
							<span className="legacy-archive-ledger__arrow" aria-hidden="true">
								—
							</span>
						</li>
					))}
				</ul>
			</DirectorySection>
			<LegacyArchiveFaq items={getComparisonFaqs(competitor)} />
		</>
	);
}
