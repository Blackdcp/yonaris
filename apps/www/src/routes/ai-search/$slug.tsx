import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { PublicationShell } from "@/components/site/publication-shell";
import { type AiSearchEngine, aiSearchEngines, getAiSearchEngine } from "@/data/ai-search-engines";
import type { FaqItem } from "@/lib/faqs";
import { siteRouteHead } from "@/lib/site-seo";

function engineFaqs(engine: AiSearchEngine): FaqItem[] {
	return [
		{
			question: `How do I get my brand mentioned in ${engine.name}?`,
			answer: `${engine.short} In short: ${engine.steps[0].text} ${engine.steps[1].text}`,
		},
		{ question: `How did the archive describe Yonaris tracking ${engine.name}?`, answer: engine.tracking },
	];
}

export const Route = createFileRoute("/ai-search/$slug")({
	head: ({ params }) => {
		const engine = getAiSearchEngine(params.slug);
		if (!engine) return {};
		return siteRouteHead("aiSearch", {
			canonicalPath: `/ai-search/${engine.slug}`,
			title: `How to Appear in ${engine.name} · Yonaris`,
			description: engine.short,
		});
	},
	loader: ({ params }) => {
		const engine = getAiSearchEngine(params.slug);
		if (!engine) throw notFound();
		const related = (engine.related ?? [])
			.map((slug) => aiSearchEngines.find((candidate) => candidate.slug === slug))
			.filter((candidate): candidate is AiSearchEngine => Boolean(candidate));
		return { engine, related };
	},
	component: EnginePage,
});

function EnginePage() {
	const { engine, related } = Route.useLoaderData() as { engine: AiSearchEngine; related: AiSearchEngine[] };
	return (
		<PublicationShell section="ai-search" archiveContext="legacy-research">
			<article className="publication-article">
				<a className="publication-back-link" href="/ai-search">
					← AI search archive
				</a>
				<header className="publication-article__header">
					<p className="publication-kicker">{engine.vendor} / archived guide</p>
					<h1 className="publication-article__title">How to appear in {engine.name}</h1>
					<p className="publication-article__lead">{engine.short}</p>
				</header>
				<div className="publication-article__body">
					<div className="legacy-archive-copy">
						{engine.intro.map((paragraph) => (
							<p key={paragraph.slice(0, 32)}>{paragraph}</p>
						))}
					</div>
					<section>
						<h2>How the archive suggested improving your odds</h2>
						<ol className="legacy-archive-steps">
							{engine.steps.map((step, index) => (
								<li className="legacy-archive-step" key={step.name}>
									<span className="legacy-archive-step__number">{String(index + 1).padStart(2, "0")}</span>
									<div>
										<h3>{step.name}</h3>
										<p>{step.text}</p>
									</div>
								</li>
							))}
						</ol>
					</section>
					<section>
						<p className="publication-kicker">Historical product note</p>
						<h2>Archived measurement description</h2>
						<p>{engine.tracking}</p>
					</section>
					{related.length > 0 ? (
						<section>
							<h2>Other archived engine notes</h2>
							<nav aria-label="Other archived engine notes">
								{related.map((item) => (
									<a className="publication-action" href={`/ai-search/${item.slug}`} key={item.slug}>
										{item.name}
									</a>
								))}
							</nav>
						</section>
					) : null}
				</div>
			</article>
			<LegacyArchiveFaq items={engineFaqs(engine)} />
		</PublicationShell>
	);
}
