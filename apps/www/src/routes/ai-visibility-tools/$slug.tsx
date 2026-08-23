import { createFileRoute, notFound } from "@tanstack/react-router";
import { CompetitorComparison } from "@/components/competitor-comparison";
import { ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { type Competitor, competitors, getComparisonSlug } from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/ai-visibility-tools/$slug")({
	head: ({ params }) => {
		const competitor = competitors.find((candidate) => getComparisonSlug(candidate) === params.slug);
		if (!competitor) return {};
		const path = `/ai-visibility-tools/${params.slug}` as const;
		return siteRouteHead("aiVisibility", {
			canonicalPath: path,
			title: `Elmo and ${competitor.name} | Upstream Comparison Archive`,
			description: `An archived upstream Elmo feature and pricing comparison with ${competitor.name}.`,
		});
	},
	loader: ({ params }) => {
		const competitor = competitors.find((candidate) => getComparisonSlug(candidate) === params.slug);
		if (!competitor) throw notFound();
		return { competitor };
	},
	component: ComparisonPage,
});

function ComparisonPage() {
	const { competitor } = Route.useLoaderData() as { competitor: Competitor };
	return (
		<LegacyArchiveShell>
			<CompetitorComparison competitor={competitor} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
