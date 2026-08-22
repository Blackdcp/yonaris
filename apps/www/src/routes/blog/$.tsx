import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BlogPostLayout } from "@/components/blog-post-layout";
import { breadcrumbJsonLd, SITE_NAME } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

export interface BlogPostFaqItem {
	question: string;
	answer: string;
}

export interface BlogPostLoaderData {
	slugs: string[];
	/** Collection-relative file path, passed to the browser client loader. */
	path: string;
	title: string;
	description: string;
	date: string;
	updated?: string;
	author: string;
	tags: string[];
	/** SEO <title> override; falls back to `${title} · Elmo` (see source.config.ts). */
	metaTitle?: string;
	/** Rendered at the foot of the post as visible editorial content. */
	faq?: BlogPostFaqItem[];
	/** Retained as unpublished editorial metadata for roundup posts. */
	itemList?: { name: string; url?: string; description?: string }[];
	/** Retained as unpublished editorial metadata for glossary content. */
	definedTerms?: { term: string; definition: string; href?: string }[];
	/** Retained as unpublished editorial metadata for step-by-step guides. */
	howTo?: { name?: string; description?: string; steps: { name: string; text: string }[] };
}

export const Route = createFileRoute("/blog/$")({
	component: Page,
	head: ({ loaderData }) => {
		const data = loaderData as BlogPostLoaderData | undefined;
		if (!data) return {};

		const { title, description, date, updated, slugs, metaTitle } = data;
		const pageTitle = metaTitle ?? `${title} · ${SITE_NAME}`;
		const pageDescription = description || `${title} — from the ${SITE_NAME} blog.`;
		const path = `/blog/${slugs.join("/")}`;
		const head = siteRouteHead("blog", {
			canonicalPath: path as `/${string}`,
			title: pageTitle,
			description: pageDescription,
			type: "article",
		});

		return {
			meta: [
				...head.meta,
				{ property: "article:published_time", content: date },
				...(updated ? [{ property: "article:modified_time", content: updated }] : []),
			],
			links: head.links,
			scripts: [
				breadcrumbJsonLd([
					{ name: "Home", path: "/" },
					{ name: "Blog", path: "/blog" },
					{ name: title, path },
				]),
			],
		};
	},
	loader: async ({ params }) => {
		const slugs = params._splat?.split("/") ?? [];
		return await serverLoader({ data: slugs });
	},
});

export const serverLoader = createServerFn({ method: "GET" })
	.inputValidator((slugs: string[]) => slugs)
	.handler(async ({ data: slugs }): Promise<BlogPostLoaderData> => {
		// Lazy import keeps the server-only blog source out of the client bundle
		// (see the note in @/lib/blog and the same pattern in routes/docs/$.tsx).
		const { blogSource } = await import("@/lib/blog");
		const page = blogSource.getPage(slugs);
		if (!page) throw notFound();

		return {
			slugs,
			path: page.path,
			title: page.data.title,
			description: page.data.description ?? "",
			date: page.data.date,
			updated: page.data.updated,
			author: page.data.author,
			tags: page.data.tags ?? [],
			metaTitle: page.data.metaTitle,
			faq: page.data.faq,
			itemList: page.data.itemList,
			definedTerms: page.data.definedTerms,
			howTo: page.data.howTo,
		};
	});

function Page() {
	const loaderData = Route.useLoaderData() as BlogPostLoaderData;
	return <BlogPostLayout data={loaderData} />;
}
