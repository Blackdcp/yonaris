import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { PublicationShell } from "@/components/site/publication-shell";
import { authorDisplayName, isAiAuthor } from "@/data/authors";
import { formatPostDate } from "@/lib/format";
import { breadcrumbJsonLd, canonicalUrl, SITE_NAME } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Blog · Yonaris";
const description = "Learn how to optimize your brand's AI search visibility.";

interface PostMeta {
	url: string;
	title: string;
	description: string;
	date: string;
	author: string;
	tags: string[];
}

const listPosts = createServerFn({ method: "GET" }).handler(async (): Promise<PostMeta[]> => {
	const { blogSource } = await import("@/lib/blog");
	return blogSource
		.getPages()
		.map((page) => ({
			url: page.url,
			title: page.data.title,
			description: page.data.description ?? "",
			date: page.data.date,
			author: page.data.author,
			tags: page.data.tags ?? [],
		}))
		.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
});

export const Route = createFileRoute("/blog/")({
	head: () => ({
		...siteRouteHead("blog", { canonicalPath: "/blog", title, description }),
		links: [
			...siteRouteHead("blog", { canonicalPath: "/blog", title, description }).links,
			{
				rel: "alternate",
				type: "application/rss+xml",
				title: `${SITE_NAME} Blog`,
				href: canonicalUrl("/blog/rss.xml"),
			},
		],
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Blog", path: "/blog" },
			]),
		],
	}),
	loader: async () => ({ posts: await listPosts() }),
	component: ResourcesPage,
});

function ResourcesPage() {
	const { posts } = Route.useLoaderData();

	return (
		<PublicationShell section="blog">
			<div className="publication-page">
				<header className="publication-masthead">
					<div className="publication-masthead__grid">
						<div>
							<p className="publication-kicker">AI-native MarTech</p>
							<h1 className="publication-title">Publication notes</h1>
							<p className="publication-deck">{description}</p>
						</div>
						<p className="publication-masthead__note">
							Working observations, methods, and source-led analysis from Yonaris.
						</p>
					</div>
				</header>

				{posts.length === 0 ? (
					<p className="publication-ledger">No publication notes yet — check back soon.</p>
				) : (
					<ul className="publication-ledger">
						{posts.map((post) => (
							<li key={post.url} className="publication-ledger__entry">
								<div className="publication-ledger__date">
									<time dateTime={post.date}>{formatPostDate(post.date)}</time>
									{!isAiAuthor(post.author) && <span> · {authorDisplayName(post.author)}</span>}
								</div>
								<a href={post.url} className="publication-ledger__link">
									<h2>{post.title}</h2>
									{post.description && <p>{post.description}</p>}
								</a>
								<ArrowUpRight className="publication-ledger__arrow" aria-hidden="true" />
							</li>
						))}
					</ul>
				)}
			</div>
		</PublicationShell>
	);
}
