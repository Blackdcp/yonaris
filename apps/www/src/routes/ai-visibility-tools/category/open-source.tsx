import { createFileRoute } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveFaq } from "@/components/site/legacy-archive-faq";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { ToolGrid } from "@/components/tool-list";
import { openSourceTools } from "@/lib/competitors";
import type { FaqItem } from "@/lib/faqs";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Open-Source AI Visibility Tools | Upstream Elmo Archive";
const description = "An archived upstream Elmo survey of open-source, self-hosted, and DIY AI visibility tooling.";
const path = "/ai-visibility-tools/category/open-source";
const lead =
	"A historical survey of self-hosted AI visibility tools, smaller open-source projects, and the build-it-yourself route.";

const FAQS: FaqItem[] = [
	{
		question: "Is there an open-source AI visibility tracker?",
		answer:
			"The upstream archive recorded Elmo and several smaller projects as open-source options. Availability and coverage should be rechecked at source.",
	},
	{
		question: "Can I build my own AI visibility tool?",
		answer:
			"The archived workflow sent defined prompts to model APIs, parsed mentions and citations, stored results, and repeated the checks over time.",
	},
	{
		question: "What is the DIY baseline described here?",
		answer:
			"Choose a small prompt set, run it across relevant engines on a schedule, and record mentions, citations, and description changes.",
	},
	{
		question: "Where did the Elmo claims originate?",
		answer:
			"They originated in the upstream elmohq/elmo comparison project and are retained here only as historical provenance.",
	},
];

const TRADEOFFS = [
	{
		dimension: "Cost",
		oss: "No license fee; infrastructure and provider usage remain.",
		managed: "Subscription or metered commercial access.",
	},
	{
		dimension: "Setup",
		oss: "The operator deploys and maintains the system.",
		managed: "The vendor operates the service.",
	},
	{
		dimension: "Transparency",
		oss: "The implementation can be inspected.",
		managed: "Scoring internals may remain proprietary.",
	},
	{
		dimension: "Data control",
		oss: "The operator defines storage and access.",
		managed: "The provider hosts the service data.",
	},
	{
		dimension: "Upkeep",
		oss: "The operator or project maintainers carry updates.",
		managed: "The vendor carries engine coverage and updates.",
	},
] as const;

export const Route = createFileRoute("/ai-visibility-tools/category/open-source")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: path, title, description }),
	component: OpenSourcePage,
});

function OpenSourcePage() {
	const tools = openSourceTools();
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero eyebrow="Static archive / open source" title="Open-source AI visibility tools" lead={lead} />
			<DirectorySection title="Why open source mattered in this archive">
				<div className="legacy-archive-copy">
					<p>
						The source directory contrasted auditable, operator-run systems with closed hosted services. It treated
						inspectable metrics and operator-controlled prompt history as the main open-source advantages.
					</p>
					<p>
						This is a historical market frame, not a current Yonaris product claim. Verify each project, license, and
						capability with its current maintainer.
					</p>
				</div>
			</DirectorySection>
			<DirectorySection title="The recorded open-source options">
				<ToolGrid competitors={tools} />
			</DirectorySection>
			<DirectorySection title="Build it yourself: scripting AI visibility checks">
				<div className="legacy-archive-copy">
					<p>
						The recorded loop was simple: send a stable prompt set to model APIs, parse each answer for brand mentions
						and cited links, store the observations, and repeat on a schedule.
					</p>
					<p>
						The operational burden sat around that loop: provider coverage, failure handling, maintenance, and a legible
						reporting layer.
					</p>
				</div>
			</DirectorySection>
			<DirectorySection title="Open source and managed: archived tradeoffs">
				<section
					className="legacy-archive-scroller"
					data-comparison-scroller="true"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to reach and scroll the overflow region.
					tabIndex={0}
					aria-label="Archived open-source and managed tradeoff comparison"
				>
					<table className="legacy-archive-table">
						<thead>
							<tr>
								<th>Dimension</th>
								<th>Open source / self-hosted</th>
								<th>Managed / paid</th>
							</tr>
						</thead>
						<tbody>
							{TRADEOFFS.map((row) => (
								<tr key={row.dimension}>
									<th scope="row">{row.dimension}</th>
									<td>{row.oss}</td>
									<td>{row.managed}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</DirectorySection>
			<LegacyArchiveFaq items={FAQS} />
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
