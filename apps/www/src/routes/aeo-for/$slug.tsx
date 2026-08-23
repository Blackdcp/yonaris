import { createFileRoute, notFound } from "@tanstack/react-router";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { PublicationShell } from "@/components/site/publication-shell";
import { type AeoVertical, aeoVerticals, getAeoVertical } from "@/data/aeo-verticals";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/aeo-for/$slug")({
	head: ({ params }) => {
		const vertical = getAeoVertical(params.slug);
		if (!vertical) return {};
		return siteRouteHead("aeoFor", {
			canonicalPath: `/aeo-for/${vertical.slug}`,
			title: `AEO for ${vertical.audience} · Yonaris`,
			description: vertical.short,
		});
	},
	loader: ({ params }) => {
		const vertical = getAeoVertical(params.slug);
		if (!vertical) throw notFound();
		return { vertical, others: aeoVerticals.filter((candidate) => candidate.slug !== vertical.slug) };
	},
	component: VerticalPage,
});

function VerticalPage() {
	const { vertical, others } = Route.useLoaderData() as { vertical: AeoVertical; others: AeoVertical[] };
	return (
		<PublicationShell section="aeo-for" archiveContext="legacy-research">
			<article className="publication-article">
				<a className="publication-back-link" href="/aeo-for">
					← AEO research archive
				</a>
				<header className="publication-article__header">
					<p className="publication-kicker">Archived audience study</p>
					<h1 className="publication-article__title">AEO for {vertical.audience}</h1>
					<p className="publication-article__lead">{vertical.short}</p>
				</header>
				<div className="publication-article__body">
					<div className="legacy-archive-copy">
						{vertical.intro.map((paragraph) => (
							<p key={paragraph.slice(0, 32)}>{paragraph}</p>
						))}
					</div>
					<section>
						<h2>Prompts recorded in this study</h2>
						<ul className="legacy-archive-prompt-list">
							{vertical.examplePrompts.map((prompt) => (
								<li key={prompt}>{prompt}</li>
							))}
						</ul>
					</section>
					<section>
						<h2>Historical recommendations</h2>
						<ol className="legacy-archive-steps">
							{vertical.plays.map((play, index) => (
								<li className="legacy-archive-step" key={play.name}>
									<span className="legacy-archive-step__number">{String(index + 1).padStart(2, "0")}</span>
									<div>
										<h3>{play.name}</h3>
										<p>{play.text}</p>
									</div>
								</li>
							))}
						</ol>
					</section>
					<section>
						<p className="publication-kicker">Archived product note</p>
						<h2>Measurement description at publication</h2>
						<p>
							<strong>Recorded Yonaris wording at publication — not a current product claim.</strong>
						</p>
						<p>{vertical.yonarisFit}</p>
					</section>
					<section>
						<h2>Other sector studies</h2>
						<nav aria-label="Other archived sector studies">
							{others.map((item) => (
								<a className="publication-action" href={`/aeo-for/${item.slug}`} key={item.slug}>
									{item.audience}
								</a>
							))}
						</nav>
					</section>
				</div>
			</article>
			<LegacyArchiveFaq items={vertical.faqs} />
		</PublicationShell>
	);
}
