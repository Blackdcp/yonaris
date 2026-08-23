import { createFileRoute } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import {
	FEATURE_CATEGORIES,
	FEATURE_SLUGS,
	type FeatureKey,
	getFeatureLabel,
	indexableFeatureKeys,
	toolsWithFeature,
} from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

const title = "AI Visibility Tools by Feature | Upstream Elmo Archive";
const description = "An archived upstream Elmo capability index for AI visibility tools.";
const indexableKeys = new Set(indexableFeatureKeys());
const featureGroups = Object.values(FEATURE_CATEGORIES)
	.map((section) => ({
		label: section.label,
		keys: (Object.keys(section.features) as FeatureKey[]).filter((key) => indexableKeys.has(key)),
	}))
	.filter((group) => group.keys.length > 0);

export const Route = createFileRoute("/ai-visibility-tools/features/")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: "/ai-visibility-tools/features", title, description }),
	component: FeatureHub,
});

function FeatureHub() {
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Capability register"
				title="AI visibility tools by feature"
				lead="A dated capability index retained from the upstream Elmo comparison project."
			/>
			{featureGroups.map((group) => (
				<DirectorySection key={group.label} title={group.label}>
					<ul className="legacy-archive-ledger">
						{group.keys.map((key, index) => (
							<li className="legacy-archive-ledger__row" key={key}>
								<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
								<a href={`/ai-visibility-tools/features/${FEATURE_SLUGS[key]}`}>
									<h3>{getFeatureLabel(key)}</h3>
									<p>{toolsWithFeature(key).length} recorded tools</p>
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
