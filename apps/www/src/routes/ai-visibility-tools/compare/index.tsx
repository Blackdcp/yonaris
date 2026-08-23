import { createFileRoute } from "@tanstack/react-router";
import { DirectoryBackLink, DirectoryHero, DirectorySection, ElmoCta } from "@/components/directory-shell";
import { LegacyArchiveShell } from "@/components/site/legacy-archive-shell";
import { comparePairSlug, comparePairs, compareSetSlug, compareSets } from "@/lib/competitors";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Compare AI Visibility Tools | Upstream Elmo Archive";
const description = "Archived upstream Elmo comparisons of AI visibility tools and SEO suites.";
const setItems = compareSets.map((tools) => ({
	name: tools.map((tool) => tool.name).join(" vs "),
	path: `/ai-visibility-tools/compare/${compareSetSlug(tools)}`,
}));
const pairItems = comparePairs.map(([first, second]) => ({
	name: `${first.name} vs ${second.name}`,
	path: `/ai-visibility-tools/compare/${comparePairSlug(first, second)}`,
}));

function ComparisonLedger({ items }: { items: { name: string; path: string }[] }) {
	return (
		<ul className="legacy-archive-ledger">
			{items.map((item, index) => (
				<li className="legacy-archive-ledger__row" key={item.path}>
					<span className="legacy-archive-index">{String(index + 1).padStart(2, "0")}</span>
					<a href={item.path}>
						<h3>{item.name}</h3>
						<p>Open archived comparison record</p>
					</a>
					<span className="legacy-archive-ledger__arrow" aria-hidden="true">
						↗
					</span>
				</li>
			))}
		</ul>
	);
}

export const Route = createFileRoute("/ai-visibility-tools/compare/")({
	head: () => siteRouteHead("aiVisibility", { canonicalPath: "/ai-visibility-tools/compare", title, description }),
	component: CompareHub,
});

function CompareHub() {
	return (
		<LegacyArchiveShell>
			<DirectoryBackLink />
			<DirectoryHero
				eyebrow="Comparison register"
				title="AI visibility tools, head-to-head"
				lead="A historical index of pair and multi-tool records imported from the upstream Elmo comparison project."
			/>
			<DirectorySection title="Multi-tool records">
				<ComparisonLedger items={setItems} />
			</DirectorySection>
			<DirectorySection title="Pair records">
				<ComparisonLedger items={pairItems} />
			</DirectorySection>
			<ElmoCta />
		</LegacyArchiveShell>
	);
}
