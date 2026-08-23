import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	CATEGORY_LABELS,
	type Competitor,
	type CompetitorCategory,
	ELMO_FEATURES,
	FEATURE_CATEGORIES,
	type FeatureKey,
	getComparisonSlug,
	getPopularityGrade,
	sortedCompetitors,
} from "@/lib/competitors";

const visibleCompetitors = sortedCompetitors.filter(
	(competitor) => competitor.status !== "shutting-down" && competitor.category !== "other",
);

function Mark({ value }: { value: boolean }): React.ReactNode {
	return (
		<span>
			<span aria-hidden="true">{value ? "Yes" : "—"}</span>
			<span className="sr-only">{value ? "Recorded as available" : "Not recorded as available"}</span>
		</span>
	);
}

function CompetitorHeader({ competitor }: { competitor: Competitor }): React.ReactNode {
	return (
		<Link to="/ai-visibility-tools/$slug" params={{ slug: getComparisonSlug(competitor) }}>
			{competitor.name}
		</Link>
	);
}

export function CompetitorDirectory() {
	const [selectedCategory, setSelectedCategory] = useState<CompetitorCategory | "all">("all");
	const [isInteractive, setIsInteractive] = useState(false);
	useEffect(() => setIsInteractive(true), []);
	const filteredCompetitors = visibleCompetitors.filter(
		(competitor) => selectedCategory === "all" || competitor.category === selectedCategory,
	);
	const categories = [...new Set(visibleCompetitors.map((competitor) => competitor.category))];

	return (
		<>
			<header className="legacy-archive-hero">
				<div>
					<p className="legacy-archive-kicker">Upstream supplier register</p>
					<h1 className="legacy-archive-title">AI Visibility Tool Directory</h1>
					<p className="legacy-archive-lead">
						A dated market record of AI visibility and answer-engine tooling imported from the upstream Elmo project.
					</p>
				</div>
				<p className="legacy-archive-note">
					Feature, price, and availability claims belong to the source archive. Verify every supplier directly.
				</p>
			</header>
			<section className="legacy-archive-section" aria-labelledby="supplier-register-title">
				<p className="legacy-archive-kicker">Filter the archived dataset</p>
				<h2 className="legacy-archive-section__heading" id="supplier-register-title">
					{filteredCompetitors.length} recorded tools
				</h2>
				<fieldset className="legacy-archive-filters">
					<legend className="sr-only">Filter archived tools by category</legend>
					<button
						aria-pressed={selectedCategory === "all"}
						className="legacy-archive-filter"
						disabled={!isInteractive}
						onClick={() => setSelectedCategory("all")}
						type="button"
					>
						All
					</button>
					{categories.map((category) => (
						<button
							aria-pressed={selectedCategory === category}
							className="legacy-archive-filter"
							disabled={!isInteractive}
							key={category}
							onClick={() => setSelectedCategory(category)}
							type="button"
						>
							{CATEGORY_LABELS[category]}
						</button>
					))}
				</fieldset>
				<section
					aria-label="Archived AI visibility supplier comparison"
					className="legacy-archive-scroller"
					data-comparison-scroller="true"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to reach and scroll the overflow region.
					tabIndex={0}
				>
					<table className="legacy-archive-table">
						<thead>
							<tr>
								<th>Recorded feature</th>
								<th>Elmo</th>
								{filteredCompetitors.map((competitor) => (
									<th data-competitor-entry key={competitor.slug}>
										<CompetitorHeader competitor={competitor} />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{Object.entries(FEATURE_CATEGORIES).flatMap(([categoryKey, category]) => [
								<tr key={`category-${categoryKey}`}>
									<th colSpan={filteredCompetitors.length + 2}>{category.label}</th>
								</tr>,
								...Object.entries(category.features).map(([featureKey, definition]) => {
									const key = featureKey as FeatureKey;
									return (
										<tr data-feature-row={featureKey} key={featureKey}>
											<th scope="row">{definition.label}</th>
											<td>
												<Mark value={ELMO_FEATURES[key] ?? false} />
											</td>
											{filteredCompetitors.map((competitor) => (
												<td key={competitor.slug}>
													<Mark value={competitor.features[key] ?? false} />
												</td>
											))}
										</tr>
									);
								}),
							])}
							<tr>
								<th scope="row">Popularity</th>
								<td>Upstream reference</td>
								{filteredCompetitors.map((competitor) => (
									<td key={competitor.slug}>{getPopularityGrade(competitor)}</td>
								))}
							</tr>
						</tbody>
					</table>
				</section>
			</section>
		</>
	);
}
