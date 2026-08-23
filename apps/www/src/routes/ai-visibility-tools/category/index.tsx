import { createFileRoute } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { CATEGORY_HEADINGS, CATEGORY_SLUGS, indexableCategories, toolsInCategory } from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

const title = "AI Visibility Tools by Category | Upstream Elmo Archive";
const description = "Archived upstream Elmo categories for AI visibility and answer-engine tools.";

export const Route = createFileRoute("/ai-visibility-tools/category/")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: "/ai-visibility-tools/category", title, description }),
	component: CategoryHub,
});

function CategoryHub() {
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Category register"
				title="AI visibility tools by category"
				lead="The market groups preserved in the upstream Elmo comparison dataset."
			/>
			<DirectorySection title="Archived categories">
				<ul className="legacy-archive-ledger">
					{indexableCategories.map((category, index) => (
						<li className="legacy-archive-ledger__row" key={category}>
							<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
							<a href={`/ai-visibility-tools/category/${CATEGORY_SLUGS[category]}`}>
								<h3>{CATEGORY_HEADINGS[category]}</h3>
								<p>{toolsInCategory(category).length} recorded tools</p>
							</a>
							<span className="legacy-archive-ledger__arrow" aria-hidden="true">
								↗
							</span>
						</li>
					))}
				</ul>
			</DirectorySection>
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
