import { Link } from "@tanstack/react-router";
import { CATEGORY_LABELS, type Competitor, getComparisonSlug, getPopularityGrade } from "@/lib/competitors";

export function ToolGrid({ competitors }: { competitors: Competitor[] }) {
	return (
		<ul className="legacy-archive-ledger">
			{competitors.map((competitor, index) => (
				<li className="legacy-archive-ledger__row" data-competitor-row key={competitor.slug}>
					<span className="legacy-archive-index">
						{String(index + 1).padStart(2, "0")} / {getPopularityGrade(competitor)}
					</span>
					<div>
						<Link to="/ai-visibility-tools/$slug" params={{ slug: getComparisonSlug(competitor) }}>
							<h3>{competitor.name}</h3>
							<p>{competitor.tagline}</p>
						</Link>
						<p className="legacy-archive-meta">
							{CATEGORY_LABELS[competitor.category]}
							{competitor.pricing?.hasFree ? " / recorded free tier" : ""}
							{competitor.pricing?.startingPrice ? ` / recorded from ${competitor.pricing.startingPrice}` : ""}
						</p>
						<a className="legacy-archive-link" href={competitor.url} target="_blank" rel="noopener noreferrer nofollow">
							Visit recorded source ↗
						</a>
					</div>
					<span className="legacy-archive-ledger__arrow" aria-hidden="true">
						—
					</span>
				</li>
			))}
		</ul>
	);
}
