import { createFileRoute, notFound } from "@tanstack/react-router";
import {
	DirectoryBackLink,
	DirectoryElmoBanner,
	DirectoryHero,
	DirectorySection,
	ElmoCta,
} from "@/components/directory-shell";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { ToolGrid } from "@/components/tool-list";
import {
	type Competitor,
	getAlternatives,
	getAlternativesFaqs,
	getAlternativesVerdict,
	getComparisonSlug,
	getCompetitorBySlug,
	isIndexed,
} from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/ai-visibility-tools/alternatives/$slug")({
	head: ({ params }) => {
		const competitor = getCompetitorBySlug(params.slug);
		if (!competitor || !isIndexed(competitor)) return {};
		return siteRouteHead("aiVisibility", {
			canonicalPath: `/ai-visibility-tools/alternatives/${params.slug}`,
			title: `${competitor.name} Alternatives | Upstream Elmo Archive`,
			description: `Archived alternatives research for ${competitor.name} from the upstream Elmo comparison project.`,
		});
	},
	loader: ({ params }) => {
		const competitor = getCompetitorBySlug(params.slug);
		if (!competitor || !isIndexed(competitor)) throw notFound();
		return { competitor, alternatives: getAlternatives(competitor) };
	},
	component: AlternativesPage,
});

function AlternativesPage() {
	const { competitor, alternatives } = Route.useLoaderData() as { competitor: Competitor; alternatives: Competitor[] };
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Alternatives record"
				title={`${competitor.name} alternatives`}
				lead={getAlternativesVerdict(competitor)}
			/>
			<DirectoryElmoBanner
				pitch="The upstream archive described Elmo as an open-source, self-hosted reference for measuring answer-engine mentions and citations."
				comparison={{ slug: getComparisonSlug(competitor), name: competitor.name }}
			/>
			<DirectorySection title={`Other ${competitor.name} alternatives`}>
				<ToolGrid competitors={alternatives} />
			</DirectorySection>
			<LegacyArchiveFaq items={getAlternativesFaqs(competitor, alternatives)} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
