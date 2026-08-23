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
	CATEGORY_HEADINGS,
	type Competitor,
	type CompetitorCategory,
	getCategoryBySlug,
	getCategoryElmoPitch,
	getCategoryFaqs,
	getCategoryVerdict,
	getComparisonSlug,
	toolsInCategory,
} from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/ai-visibility-tools/category/$slug")({
	head: ({ params }) => {
		const category = getCategoryBySlug(params.slug);
		if (!category) return {};
		const tools = toolsInCategory(category);
		if (tools.length < 2) return {};
		const heading = CATEGORY_HEADINGS[category];
		return siteRouteHead("aiVisibility", {
			canonicalPath: `/ai-visibility-tools/category/${params.slug}`,
			title: `${heading} | Upstream Elmo Archive`,
			description: `An archived upstream Elmo comparison of ${heading.toLowerCase()}.`,
		});
	},
	loader: ({ params }) => {
		const category = getCategoryBySlug(params.slug);
		if (!category) throw notFound();
		const tools = toolsInCategory(category);
		if (tools.length < 2) throw notFound();
		return { category, tools };
	},
	component: CategoryPage,
});

function CategoryPage() {
	const { category, tools } = Route.useLoaderData() as { category: CompetitorCategory; tools: Competitor[] };
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Category record"
				title={CATEGORY_HEADINGS[category]}
				lead={getCategoryVerdict(category, tools)}
			/>
			<DirectoryElmoBanner
				pitch={getCategoryElmoPitch(category)}
				comparison={{ slug: getComparisonSlug(tools[0]), name: tools[0].name }}
			/>
			<DirectorySection title="Tools in this category">
				<ToolGrid competitors={tools} />
			</DirectorySection>
			<LegacyArchiveFaq items={getCategoryFaqs(category, tools)} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
