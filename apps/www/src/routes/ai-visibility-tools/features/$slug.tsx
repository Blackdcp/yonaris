import { createFileRoute, notFound } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { ToolGrid } from "@/components/tool-list";
import {
	type Competitor,
	type FeatureKey,
	getFeatureFaqs,
	getFeatureKeyBySlug,
	getFeatureLabel,
	getFeatureVerdict,
	MIN_TOOLS_FOR_FEATURE_PAGE,
	toolsWithFeature,
} from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

export const Route = createFileRoute("/ai-visibility-tools/features/$slug")({
	head: ({ params }) => {
		const key = getFeatureKeyBySlug(params.slug);
		if (!key) return {};
		const tools = toolsWithFeature(key);
		if (tools.length < MIN_TOOLS_FOR_FEATURE_PAGE) return {};
		const label = getFeatureLabel(key);
		return siteRouteHead("aiVisibility", {
			canonicalPath: `/ai-visibility-tools/features/${params.slug}`,
			title: `AI Visibility Tools with ${label} | Upstream Elmo Archive`,
			description: `An archived upstream Elmo record of tools reported to offer ${label.toLowerCase()}.`,
		});
	},
	loader: ({ params }) => {
		const featureKey = getFeatureKeyBySlug(params.slug);
		if (!featureKey) throw notFound();
		const tools = toolsWithFeature(featureKey);
		if (tools.length < MIN_TOOLS_FOR_FEATURE_PAGE) throw notFound();
		return { featureKey, tools };
	},
	component: FeaturePage,
});

function FeaturePage() {
	const { featureKey, tools } = Route.useLoaderData() as { featureKey: FeatureKey; tools: Competitor[] };
	const label = getFeatureLabel(featureKey);
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Capability record"
				title={`AI visibility tools with ${label}`}
				lead={getFeatureVerdict(featureKey, tools)}
			/>
			<DirectorySection title="Tools that offer this feature">
				<ToolGrid competitors={tools} />
			</DirectorySection>
			<LegacyArchiveFaq items={getFeatureFaqs(featureKey, tools)} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
