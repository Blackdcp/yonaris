import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { UtilityShell } from "@/components/site/utility-shell";
import { type ChangelogIssue, getGitHubChangelog } from "@/lib/github-changelog";
import { getGitHubReleases, type ReleaseEntry } from "@/lib/github-releases";
import { extractCompareUrl, ReleaseMarkdown } from "@/lib/release-markdown";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Open-source Changelog · Yonaris";
const description =
	"A source-led ledger of releases and closed issues from the upstream Elmo-compatible open-source repository.";

export const Route = createFileRoute("/changelog")({
	head: () => ({
		...siteRouteHead("changelog", { canonicalPath: "/changelog", title, description }),
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Changelog", path: "/changelog" },
			]),
		],
	}),
	loader: async () => {
		const [releases, months] = await Promise.all([getGitHubReleases(), getGitHubChangelog()]);
		return { releases, months };
	},
	component: ChangelogPage,
});

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ReleaseEntryRow({ release }: { release: ReleaseEntry }) {
	const { cleaned, compareUrl } = extractCompareUrl(release.body);
	return (
		<article className="utility-activity-entry">
			<div className="utility-activity-entry__meta">
				<time dateTime={release.published_at}>{formatDate(release.published_at)}</time>
				{release.prerelease ? <span>Pre-release</span> : null}
			</div>
			<div className="utility-activity-entry__body">
				<h2>{release.name || release.tag_name}</h2>
				{cleaned.trim() ? <ReleaseMarkdown body={cleaned.trim()} /> : <p>No release notes were supplied upstream.</p>}
			</div>
			<a className="utility-action" href={compareUrl ?? release.html_url} target="_blank" rel="noopener noreferrer">
				Source <ArrowUpRight aria-hidden="true" className="size-3.5" />
			</a>
		</article>
	);
}

function IssueEntryRow({ issue }: { issue: ChangelogIssue }) {
	return (
		<li className="utility-activity-entry">
			<div className="utility-activity-entry__meta">Issue #{issue.number}</div>
			<div className="utility-activity-entry__body">
				<h3>{issue.title}</h3>
				{issue.labels.length ? <p>{issue.labels.map((label) => label.name.replace("area/", "")).join(" · ")}</p> : null}
			</div>
			<a className="utility-action" href={issue.html_url} target="_blank" rel="noopener noreferrer">
				Source <ArrowUpRight aria-hidden="true" className="size-3.5" />
			</a>
		</li>
	);
}

function ChangelogPage() {
	const { releases, months } = Route.useLoaderData();
	const monthsWithIssues = months.filter((month) => month.issues.length > 0);
	const hasActivity = releases.length > 0 || monthsWithIssues.length > 0;

	return (
		<UtilityShell section="changelog">
			<div className="utility-page">
				<header className="utility-masthead">
					<div className="utility-masthead__grid">
						<div>
							<p className="utility-kicker">Upstream source ledger</p>
							<h1 className="utility-title">Open-source activity</h1>
							<p className="utility-deck">{description}</p>
						</div>
						<div className="utility-context-note">
							<p>
								This records an upstream Elmo-compatible open-source repository. These are not Yonaris commercial
								product releases.
							</p>
							<a href="https://github.com/elmohq/elmo/releases" target="_blank" rel="noopener noreferrer">
								Review the upstream source
							</a>
						</div>
					</div>
				</header>

				<div className="utility-activity-ledger">
					{!hasActivity ? (
						<div className="utility-source-empty">
							<h2>Upstream activity is unavailable here right now</h2>
							<p>No release or issue summary is inferred while the upstream feed cannot be read.</p>
						</div>
					) : null}

					{releases.map((release) => (
						<ReleaseEntryRow key={release.id} release={release} />
					))}

					{monthsWithIssues.map((month) => (
						<section key={month.month} className="utility-activity-group" aria-labelledby={`month-${month.month}`}>
							<h2 id={`month-${month.month}`}>{month.label} closed issues</h2>
							<ul>
								{month.issues.map((issue) => (
									<IssueEntryRow key={issue.number} issue={issue} />
								))}
							</ul>
						</section>
					))}
				</div>
			</div>
		</UtilityShell>
	);
}
