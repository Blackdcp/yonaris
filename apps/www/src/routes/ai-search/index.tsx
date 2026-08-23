import { createFileRoute } from "@tanstack/react-router";
import { PublicationShell } from "@/components/site/publication-shell";
import { aiSearchEngines } from "@/data/ai-search-engines";
import { siteRouteHead } from "@/lib/site-seo";

const title = "How to Show Up in AI Search Engines · Yonaris";
const description =
	"Archived research guides to how ChatGPT, Perplexity, Google AI Overviews, Gemini, Claude, Copilot, and Grok selected sources.";

export const Route = createFileRoute("/ai-search/")({
	head: () => siteRouteHead("aiSearch", { canonicalPath: "/ai-search", title, description }),
	component: AiSearchIndex,
});

function AiSearchIndex() {
	return (
		<PublicationShell section="ai-search" archiveContext="legacy-research">
			<div className="publication-page">
				<header className="publication-masthead">
					<div className="publication-masthead__grid">
						<div>
							<p className="publication-kicker">Research register / AI search</p>
							<h1 className="publication-title">How to show up in AI search</h1>
							<p className="publication-deck">
								Each engine selected sources differently. These dated field notes preserve the practical observations
								behind seven major answer surfaces.
							</p>
						</div>
						<p className="publication-masthead__note">
							Archive scope / source selection, citation behavior, and historical optimization notes. Review current
							provider documentation before acting.
						</p>
					</div>
				</header>
				<section className="publication-ledger" aria-label="Archived AI search guides">
					<div className="publication-ledger__group">
						<h2 className="publication-ledger__group-label">Recorded guidance at publication</h2>
						<ul className="publication-ledger__items">
							{aiSearchEngines.map((engine, index) => (
								<li className="publication-ledger__entry" key={engine.slug}>
									<span className="publication-ledger__date">{String(index + 1).padStart(2, "0")} / 07</span>
									<a className="publication-ledger__link" href={`/ai-search/${engine.slug}`}>
										<h2>{engine.name}</h2>
										<small>{engine.vendor}</small>
										<p>{engine.short}</p>
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
