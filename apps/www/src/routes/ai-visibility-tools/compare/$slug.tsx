import { createFileRoute, notFound } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, ElmoCta } from "@/components/directory-shell";
import { MultiComparison } from "@/components/multi-comparison";
import { PairComparison } from "@/components/pair-comparison";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { type Competitor, getCompareEntry, getCompareFaqs, getCompareVerdict } from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/ai-visibility-tools/compare/$slug")({
	head: ({ params }) => {
		const tools = getCompareEntry(params.slug);
		if (!tools) return {};
		const names = tools.map((tool) => tool.name).join(" vs ");
		return siteRouteHead("aiVisibility", {
			canonicalPath: `/ai-visibility-tools/compare/${params.slug}`,
			title: `${names} | Upstream Elmo Archive`,
			description: `An archived upstream Elmo feature comparison of ${names}.`,
		});
	},
	loader: ({ params }) => {
		const tools = getCompareEntry(params.slug);
		if (!tools) throw notFound();
		return { tools };
	},
	component: ComparePage,
});

function ComparePage() {
	const { tools } = Route.useLoaderData() as { tools: Competitor[] };
	const names = tools.map((tool) => tool.name).join(" vs ");
	const [first, second] = tools;
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero eyebrow="Comparison record" title={names} lead={getCompareVerdict(tools)} />
			{first && second && tools.length === 2 ? (
				<PairComparison a={first} b={second} />
			) : (
				<MultiComparison tools={tools} />
			)}
			<LegacyArchiveFaq items={getCompareFaqs(tools)} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
