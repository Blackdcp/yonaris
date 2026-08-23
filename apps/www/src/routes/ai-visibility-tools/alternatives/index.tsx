import { createFileRoute } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { CATEGORY_LABELS, indexableCategories, toolsInCategory } from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

const title = "AI Visibility Tool Alternatives | Upstream Elmo Archive";
const description = "Archived upstream Elmo alternatives research for AI visibility tools.";

export const Route = createFileRoute("/ai-visibility-tools/alternatives/")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: "/ai-visibility-tools/alternatives", title, description }),
	component: AlternativesHub,
});

function AlternativesHub() {
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Alternatives register"
				title="Alternatives to AI visibility tools"
				lead="A historical index of the adjacent tools recorded by the upstream Elmo comparison project."
			/>
			{indexableCategories.map((category) => (
				<DirectorySection key={category} title={CATEGORY_LABELS[category]}>
					<ul className="legacy-archive-ledger">
						{toolsInCategory(category).map((competitor, index) => (
							<li className="legacy-archive-ledger__row" key={competitor.slug}>
								<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
								<a href={`/ai-visibility-tools/alternatives/${competitor.slug}`}>
									<h3>{competitor.name} alternatives</h3>
									<p>{competitor.tagline}</p>
								</a>
								<span className="legacy-archive-ledger__arrow" aria-hidden="true">
									↗
								</span>
							</li>
						))}
					</ul>
				</DirectorySection>
			))}
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
