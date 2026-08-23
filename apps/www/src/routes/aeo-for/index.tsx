import { createFileRoute } from "@tanstack/react-router";
import { PublicationShell } from "@/components/site/publication-shell";
import { aeoVerticals } from "@/data/aeo-verticals";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Answer Engine Optimization by Industry · Yonaris";
const description =
	"Archived answer-engine optimization research for agencies, SaaS, commerce, startups, enterprise, health, and finance.";

export const Route = createFileRoute("/aeo-for/")({
	head: () => siteRouteHead("aeoFor", { canonicalPath: "/aeo-for", title, description }),
	component: AeoForIndex,
});

function AeoForIndex() {
	return (
		<PublicationShell section="aeo-for" archiveContext="legacy-research">
			<div className="publication-page">
				<header className="publication-masthead">
					<div className="publication-masthead__grid">
						<div>
							<p className="publication-kicker">Research register / sector notes</p>
							<h1 className="publication-title">Answer engine optimization, by industry</h1>
							<p className="publication-deck">
								The fundamentals repeated. The buying questions and risk changed by sector. This archive preserves those
								earlier field notes.
							</p>
						</div>
						<p className="publication-masthead__note">
							Eight historical audience studies / retained for research continuity / not current solution packaging.
						</p>
					</div>
				</header>
				<section className="publication-ledger" aria-label="Archived AEO sector guides">
					<div className="publication-ledger__group">
						<h2 className="publication-ledger__group-label">Sector studies</h2>
						<ul className="publication-ledger__items">
							{aeoVerticals.map((vertical, index) => (
								<li className="publication-ledger__entry" key={vertical.slug}>
									<span className="publication-ledger__date">
										{String(index + 1).padStart(2, "0")} / {String(aeoVerticals.length).padStart(2, "0")}
									</span>
									<a className="publication-ledger__link" href={`/aeo-for/${vertical.slug}`}>
										<h2>AEO for {vertical.audience}</h2>
										<p>{vertical.short}</p>
									</a>
									<span className="publication-ledger__arrow" aria-hidden="true">
										↗
									</span>
								</li>
							))}
						</ul>
					</div>
				</section>
			</div>
		</PublicationShell>
	);
}
