import { createFileRoute } from "@tanstack/react-router";
import { AiVisibilitySoftwareHub } from "@/components/ai-visibility-software-hub";
import { CompetitorDirectory } from "@/components/competitor-directory";
import { ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { DIRECTORY_FAQS } from "@/lib/faqs";
import { siteRouteHead } from "@/lib/site-seo";

const title = "AI Visibility Tool Directory | Upstream Elmo Archive";
const description = "An archived upstream Elmo dataset comparing AI visibility and answer-engine software.";

const browseLinks = [
	{
		title: "Compare head-to-head",
		description: "Historical side-by-side feature records.",
		href: "/ai-visibility-tools/compare",
	},
	{
		title: "Find alternatives",
		description: "Archived alternatives to listed tools.",
		href: "/ai-visibility-tools/alternatives",
	},
	{ title: "Browse by feature", description: "A dated capability index.", href: "/ai-visibility-tools/features" },
	{
		title: "Browse by category",
		description: "Trackers, content platforms, APIs, SEO suites, and open source.",
		href: "/ai-visibility-tools/category",
	},
] as const;

export const Route = createFileRoute("/ai-visibility-tools/")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: "/ai-visibility-tools", title, description }),
	component: AiVisibilitySoftwarePage,
});

function AiVisibilitySoftwarePage() {
	return (
		<LegacyArchiveShell>
			<CompetitorDirectory />
			<AiVisibilitySoftwareHub />
			<section className="legacy-archive-section" aria-labelledby="archive-browse-title">
				<p className="legacy-archive-kicker">Archive routes</p>
				<h2 className="legacy-archive-section__heading" id="archive-browse-title">
					Browse the upstream record
				</h2>
				<ul className="legacy-archive-ledger">
					{browseLinks.map((link, index) => (
						<li className="legacy-archive-ledger__row" key={link.href}>
							<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
							<a href={link.href}>
								<h3>{link.title}</h3>
								<p>{link.description}</p>
							</a>
							<span className="legacy-archive-ledger__arrow" aria-hidden="true">
								↗
							</span>
						</li>
					))}
				</ul>
			</section>
			<LegacyArchiveFaq items={DIRECTORY_FAQS} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
