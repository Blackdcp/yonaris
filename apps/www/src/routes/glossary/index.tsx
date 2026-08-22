import { createFileRoute } from "@tanstack/react-router";
import { PublicationShell } from "@/components/site/publication-shell";
import { GLOSSARY_GROUPS, glossaryTerms } from "@/data/glossary";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

const title = "AI Search & AEO Glossary · Yonaris";
const description =
	"A plain-English glossary of AI search and answer engine optimization terms: AEO, GEO, LLMO, AI Overviews, citations, share of voice, RAG, and more.";

export const Route = createFileRoute("/glossary/")({
	head: () => ({
		...siteRouteHead("glossary", { canonicalPath: "/glossary", title, description }),
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Glossary", path: "/glossary" },
			]),
		],
	}),
	component: GlossaryIndex,
});

function GlossaryIndex() {
	return (
		<PublicationShell section="glossary">
			<div className="publication-page">
				<header className="publication-masthead">
					<div className="publication-masthead__grid">
						<div>
							<p className="publication-kicker">Reference language</p>
							<h1 className="publication-title">The AI market glossary</h1>
							<p className="publication-deck">
								The vocabulary of AI search and answer engine optimization, defined in plain English and cross-linked.
								Start anywhere.
							</p>
						</div>
						<p className="publication-masthead__note">
							A working reference archive. Entries are descriptive, not current product claims.
						</p>
					</div>
				</header>

				<div className="publication-ledger">
					{GLOSSARY_GROUPS.map((group) => {
						const terms = glossaryTerms.filter((term) => term.group === group);
						if (terms.length === 0) return null;

						return (
							<section key={group} className="publication-ledger__group">
								<h2 className="publication-ledger__group-label">{group}</h2>
								<dl className="publication-ledger__items">
									{terms.map((term) => (
										<div key={term.slug} className="publication-ledger__entry">
											<div className="publication-ledger__date">Term</div>
											<div>
												<dt>
													<a href={`/glossary/${term.slug}`} className="publication-ledger__link">
														{term.term}
														{term.aka?.length ? <small> — {term.aka.join(", ")}</small> : null}
													</a>
												</dt>
												<dd>{term.short}</dd>
											</div>
											<span className="publication-ledger__arrow" aria-hidden="true">
												↗
											</span>
										</div>
									))}
								</dl>
							</section>
						);
					})}
				</div>
			</div>
		</PublicationShell>
	);
}
