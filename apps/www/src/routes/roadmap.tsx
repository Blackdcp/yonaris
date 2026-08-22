import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, ThumbsUp } from "lucide-react";
import { UtilityShell } from "@/components/site/utility-shell";
import upcomingData from "@/data/upcoming-features.json";
import { getGitHubRoadmap, type RoadmapIssue } from "@/lib/github-roadmap";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Open-source Roadmap Archive · Yonaris";
const description =
	"A reference view of planning records from an upstream open-source project, not a Yonaris delivery commitment.";
const PROJECT_BOARD_URL = "https://github.com/orgs/elmohq/projects/3/views/1";

interface UpstreamHighlight {
	title: string;
	description: string;
	tag: string;
	issue?: number;
	url: string;
}

const upstreamHighlights = (upcomingData as { highlights: UpstreamHighlight[] }).highlights;

export const Route = createFileRoute("/roadmap")({
	head: () => ({
		...siteRouteHead("roadmap", { canonicalPath: "/roadmap", title, description }),
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Roadmap", path: "/roadmap" },
			]),
		],
	}),
	loader: async () => {
		const roadmap = await getGitHubRoadmap();
		const hasReactions = roadmap.issues.some((issue) => issue.reactions > 0);
		const sorted = [...roadmap.issues].sort((a, b) => {
			if (hasReactions) {
				if (b.reactions !== a.reactions) return b.reactions - a.reactions;
				if (b.comments !== a.comments) return b.comments - a.comments;
			}
			return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		});
		return { issues: sorted.slice(0, 7), references: upstreamHighlights };
	},
	component: RoadmapPage,
});

function IssueRow({ issue }: { issue: RoadmapIssue }) {
	return (
		<li className="utility-activity-entry">
			<div className="utility-activity-entry__meta">Issue #{issue.number}</div>
			<div className="utility-activity-entry__body">
				<h3>{issue.title}</h3>
				<p>
					{issue.area}
					{issue.labels.length ? ` · ${issue.labels.map((label) => label.name.replace("area/", "")).join(" · ")}` : ""}
				</p>
				{issue.reactions > 0 || issue.comments > 0 ? (
					<p className="utility-activity-signals">
						{issue.reactions > 0 ? (
							<span>
								<ThumbsUp aria-hidden="true" className="size-3" /> {issue.reactions} reactions
							</span>
						) : null}
						{issue.comments > 0 ? (
							<span>
								<MessageCircle aria-hidden="true" className="size-3" /> {issue.comments} comments
							</span>
						) : null}
					</p>
				) : null}
			</div>
			<a className="utility-action" href={issue.html_url} target="_blank" rel="noopener noreferrer">
				Source <ArrowUpRight aria-hidden="true" className="size-3.5" />
			</a>
		</li>
	);
}

function ReferenceRow({ reference }: { reference: UpstreamHighlight }) {
	return (
		<li className="utility-activity-entry">
			<div className="utility-activity-entry__meta">
				{reference.tag}
				{reference.issue ? ` · #${reference.issue}` : ""}
			</div>
			<div className="utility-activity-entry__body">
				<h3>{reference.title}</h3>
				<p>{reference.description}</p>
			</div>
			<a className="utility-action" href={reference.url} target="_blank" rel="noopener noreferrer">
				Source <ArrowUpRight aria-hidden="true" className="size-3.5" />
			</a>
		</li>
	);
}

function RoadmapPage() {
	const { issues, references } = Route.useLoaderData();

	return (
		<UtilityShell section="roadmap">
			<div className="utility-page">
				<header className="utility-masthead">
					<div className="utility-masthead__grid">
						<div>
							<p className="utility-kicker">Upstream planning archive</p>
							<h1 className="utility-title">Open-source issue record</h1>
							<p className="utility-deck">{description}</p>
						</div>
						<div className="utility-context-note">
							<p>
								This data comes from an upstream open-source project. An issue, board item, or reaction is not a Yonaris
								delivery commitment.
							</p>
							<a href={PROJECT_BOARD_URL} target="_blank" rel="noopener noreferrer">
								Review the upstream board
							</a>
						</div>
					</div>
				</header>

				<div className="utility-activity-ledger">
					{issues.length === 0 ? (
						<div className="utility-source-empty">
							<h2>Upstream issue data is unavailable here right now</h2>
							<p>No issue ordering or status is inferred while the upstream feed cannot be read.</p>
						</div>
					) : (
						<section className="utility-activity-group" aria-labelledby="upstream-issues-heading">
							<h2 id="upstream-issues-heading">Recent upstream issues</h2>
							<ul>
								{issues.map((issue) => (
									<IssueRow key={issue.number} issue={issue} />
								))}
							</ul>
						</section>
					)}

					{references.length > 0 ? (
						<section className="utility-activity-group" aria-labelledby="upstream-references-heading">
							<h2 id="upstream-references-heading">Filed upstream planning references</h2>
							<p className="utility-activity-disclosure">
								These summaries are source references only; inclusion does not establish scope, timing, or delivery.
							</p>
							<ul>
								{references.map((reference) => (
									<ReferenceRow key={reference.title} reference={reference} />
								))}
							</ul>
						</section>
					) : null}
				</div>
			</div>
		</UtilityShell>
	);
}
