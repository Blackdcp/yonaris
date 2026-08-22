import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PublicationShell } from "@/components/site/publication-shell";
import { type GlossaryTerm, getGlossaryTerm, glossaryTerms } from "@/data/glossary";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/glossary/$slug")({
	head: ({ params }) => {
		const term = getGlossaryTerm(params.slug);
		if (!term) return {};
		const title = `What is ${term.term}? · Yonaris`;
		const description = term.short;
		const path = `/glossary/${term.slug}`;
		return {
			...siteRouteHead("glossary", { canonicalPath: path as `/${string}`, title, description }),
			scripts: [
				breadcrumbJsonLd([
					{ name: "Home", path: "/" },
					{ name: "Glossary", path: "/glossary" },
					{ name: term.term, path },
				]),
			],
		};
	},
	loader: ({ params }) => {
		const term = getGlossaryTerm(params.slug);
		if (!term) throw notFound();
		const related = (term.related ?? [])
			.map((slug) => glossaryTerms.find((candidate) => candidate.slug === slug))
			.filter((candidate): candidate is GlossaryTerm => Boolean(candidate));
		return { term, related };
	},
	component: GlossaryTermPage,
});

function GlossaryTermPage() {
	const { term, related } = Route.useLoaderData() as {
		term: GlossaryTerm;
		related: GlossaryTerm[];
	};

	return (
		<PublicationShell section="glossary">
			<article className="publication-article">
				<header className="publication-article__header">
					<a href="/glossary" className="publication-back-link">
						<ArrowLeft className="h-3 w-3" />
						AI market glossary
					</a>
					<p className="publication-kicker">Reference term</p>
					<h1 className="publication-article__title">{term.term}</h1>
					{term.aka?.length ? <p className="publication-meta">Also known as {term.aka.join(", ")}</p> : null}
					<p className="publication-article__lead">{term.short}</p>
				</header>

				<div className="publication-article__body prose">
					{term.body.map((paragraph) => (
						<p key={paragraph.slice(0, 32)}>{paragraph}</p>
					))}

					{term.seeAlso?.length ? (
						<section>
							<h2>Go deeper</h2>
							<ul>
								{term.seeAlso.map((link) => (
									<li key={link.href}>
										<a href={link.href} className="publication-action">
											{link.label}
											<ArrowRight className="h-3.5 w-3.5" />
										</a>
									</li>
								))}
							</ul>
						</section>
					) : null}

					{related.length > 0 ? (
						<section>
							<h2>Related terms</h2>
							<ul>
								{related.map((relatedTerm) => (
									<li key={relatedTerm.slug}>
										<a href={`/glossary/${relatedTerm.slug}`}>{relatedTerm.term}</a>
									</li>
								))}
							</ul>
						</section>
					) : null}

					<section>
						<h2>See it in your own data</h2>
						<p>
							Yonaris helps teams establish a repeatable GEO baseline across configured AI models while keeping
							deployment and data control with the operator.
						</p>
						<div>
							<Link to="/docs" className="publication-action">
								Get started
							</Link>
							<a href="/ai-visibility-tools" className="publication-action">
								Compare tools
							</a>
						</div>
					</section>
				</div>
			</article>
		</PublicationShell>
	);
}
