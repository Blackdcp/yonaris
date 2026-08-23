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

function SupplierSummary({ tool, index }: { tool: Competitor; index: number }): React.ReactNode {
	return (
		<li className="legacy-archive-ledger__row">
			<span className="legacy-archive-index">{String(index).padStart(2, "0")}</span>
			<div>
				<h3>{tool.name}</h3>
				<p>{tool.tagline}</p>
				<p className="legacy-archive-meta">{CATEGORY_LABELS[tool.category]}</p>
				<p className="legacy-archive-meta" data-recorded-pricing>
					{recordedPricing(tool.pricing)}
				</p>
				<a className="legacy-archive-link" href={tool.url} target="_blank" rel="noopener noreferrer nofollow">
					Visit {tool.domain} ↗
				</a>
			</div>
			<span className="legacy-archive-ledger__arrow" aria-hidden="true">
				—
			</span>
		</li>
	);
}

export function MultiComparison({ tools }: { tools: Competitor[] }) {
	const heading = `${tools.map((tool) => tool.name).join(" vs ")} vs Elmo`;
	const columnCount = tools.length + 2;
	return (
		<>
			<section className="legacy-archive-section" aria-labelledby="multi-summary-title">
				<p className="legacy-archive-kicker">Recorded supplier notes</p>
				<h2 className="legacy-archive-section__heading" id="multi-summary-title">
					{heading}
				</h2>
				<ul className="legacy-archive-ledger">
					{tools.map((tool, index) => (
						<SupplierSummary tool={tool} index={index + 1} key={tool.slug} />
					))}
					<li className="legacy-archive-ledger__row">
						<span className="legacy-archive-index">{String(tools.length + 1).padStart(2, "0")}</span>
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
			<section className="legacy-archive-section" aria-labelledby="multi-table-title">
				<h2 className="legacy-archive-section__heading" id="multi-table-title">
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
								{tools.map((tool) => (
									<th key={tool.slug}>{tool.name}</th>
								))}
								<th>Elmo</th>
							</tr>
						</thead>
						<tbody>
							{Object.entries(FEATURE_CATEGORIES).flatMap(([categoryKey, category]) => [
								<tr key={`category-${categoryKey}`}>
									<th colSpan={columnCount}>{category.label}</th>
								</tr>,
								...Object.entries(category.features).map(([featureKey, definition]) => {
									const key = featureKey as FeatureKey;
									return (
										<tr data-comparison-row key={featureKey}>
											<th scope="row">{definition.label}</th>
											{tools.map((tool) => (
												<td key={tool.slug}>
													<Mark value={tool.features[key] ?? false} />
												</td>
											))}
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
